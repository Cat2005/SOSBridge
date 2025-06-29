import { NextRequest, NextResponse } from 'next/server'
import { addTranscription } from '../get-transcriptions/route'

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

async function downloadRecordingWithRetry(
  recordingUrl: string,
  maxRetries = 3
): Promise<Blob> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Twilio Callback] Attempt ${attempt} to download recording...`
      )

      const recordingResponse = await fetch(recordingUrl, {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
        },
      })

      if (recordingResponse.ok) {
        const audioBlob = await recordingResponse.blob()
        console.log(
          `[Twilio Callback] Successfully downloaded recording on attempt ${attempt}, size:`,
          audioBlob.size
        )
        return audioBlob
      } else {
        console.log(`[Twilio Callback] Attempt ${attempt} failed:`, {
          status: recordingResponse.status,
          statusText: recordingResponse.statusText,
        })

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
          console.log(`[Twilio Callback] Waiting ${waitTime}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
    } catch (error) {
      console.error(`[Twilio Callback] Attempt ${attempt} error:`, error)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  throw new Error(`Failed to download recording after ${maxRetries} attempts`)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const recordingUrl = formData.get('RecordingUrl') as string
    const callSid = formData.get('CallSid') as string
    const recordingDuration = formData.get('RecordingDuration') as string

    if (!recordingUrl || !callSid) {
      console.error('[Twilio Callback] Missing recording URL or call SID')
      // Return TwiML even on error
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error processing recording</Say>
  <Hangup/>
</Response>`
      return new NextResponse(errorTwiML, {
        headers: { 'Content-Type': 'application/xml' },
      })
    }

    console.log('[Twilio Callback] Received recording:', {
      recordingUrl,
      callSid,
      recordingDuration,
    })

    if (!ELEVEN_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('[Twilio Callback] Missing API keys')
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Configuration error</Say>
  <Hangup/>
</Response>`
      return new NextResponse(errorTwiML, {
        headers: { 'Content-Type': 'application/xml' },
      })
    }

    try {
      // Download the recording from Twilio with retry mechanism
      const audioBlob = await downloadRecordingWithRetry(recordingUrl)

      // Check if the recording has actual content
      if (audioBlob.size === 0) {
        console.log('[Twilio Callback] Recording is empty, continuing call')
        const emptyTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I didn't hear anything. Please try again.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="5"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
        return new NextResponse(emptyTwiML, {
          headers: { 'Content-Type': 'application/xml' },
        })
      }

      // Transcribe the audio using ElevenLabs
      // Try using the Twilio recording URL directly first
      console.log(
        '[Twilio Callback] Attempting transcription with Twilio URL...'
      )

      const transcriptionResponse = await fetch(
        'https://api.elevenlabs.io/v1/speech-to-text',
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVEN_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: recordingUrl,
            model_id: 'scribe_v1',
          }),
        }
      )

      if (!transcriptionResponse.ok) {
        console.log(
          '[Twilio Callback] Direct URL transcription failed, trying with downloaded audio...'
        )

        // Fallback to downloading the audio first
        const formDataForTranscription = new FormData()
        formDataForTranscription.append('file', audioBlob, 'recording.wav')
        formDataForTranscription.append('model_id', 'scribe_v1')

        console.log(
          '[Twilio Callback] Sending audio to ElevenLabs for transcription...'
        )
        console.log('[Twilio Callback] Audio blob info:', {
          size: audioBlob.size,
          type: audioBlob.type,
        })

        const fallbackResponse = await fetch(
          'https://api.elevenlabs.io/v1/speech-to-text',
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVEN_API_KEY,
            },
            body: formDataForTranscription,
          }
        )

        if (!fallbackResponse.ok) {
          const errorText = await fallbackResponse.text()
          console.error(
            '[Twilio Callback] ElevenLabs transcription error response:',
            {
              status: fallbackResponse.status,
              statusText: fallbackResponse.statusText,
              body: errorText,
            }
          )

          let errorMessage = `Transcription failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`
          try {
            const errorData = JSON.parse(errorText)
            errorMessage = `Transcription failed: ${
              errorData.message || errorData.detail || errorMessage
            }`
          } catch (e) {
            // If we can't parse JSON, use the raw text
            errorMessage = `Transcription failed: ${errorText}`
          }

          console.error('[Twilio Callback] Transcription error:', errorMessage)

          // Continue the call even if transcription fails
          const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I had trouble understanding. Please try again.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="5"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
          return new NextResponse(errorTwiML, {
            headers: { 'Content-Type': 'application/xml' },
          })
        }

        const transcriptionData = await fallbackResponse.json()
        const transcribedText = transcriptionData.text

        console.log(
          '[Twilio Callback] Transcription successful (fallback):',
          transcribedText
        )

        // Only store transcription if there's actual text
        if (transcribedText && transcribedText.trim()) {
          addTranscription(callSid, transcribedText)
        } else {
          console.log('[Twilio Callback] No text transcribed, skipping storage')
        }

        // Continue the call with another recording
        const successTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you. The person at risk is now replying.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="10"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
        return new NextResponse(successTwiML, {
          headers: { 'Content-Type': 'application/xml' },
        })
      }

      const transcriptionData = await transcriptionResponse.json()
      const transcribedText = transcriptionData.text

      console.log(
        '[Twilio Callback] Transcription successful (direct URL):',
        transcribedText
      )

      // Only store transcription if there's actual text
      if (transcribedText && transcribedText.trim()) {
        addTranscription(callSid, transcribedText)
      } else {
        console.log('[Twilio Callback] No text transcribed, skipping storage')
      }

      // Continue the call with another recording
      const successTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you. I'm listening for your next message.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="15"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
      return new NextResponse(successTwiML, {
        headers: { 'Content-Type': 'application/xml' },
      })
    } catch (transcriptionError) {
      console.error(
        '[Twilio Callback] Transcription error:',
        transcriptionError
      )

      // Continue the call even if transcription fails
      const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="15"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
      return new NextResponse(errorTwiML, {
        headers: { 'Content-Type': 'application/xml' },
      })
    }
  } catch (error) {
    console.error('[Twilio Callback] Error:', error)

    // Return TwiML even on error
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again.</Say>
  <Record 
    action="/api/twilio/recording-callback"
    method="POST"
    maxLength="15"
    playBeep="true"
    trim="trim-silence"
    timeout="3"
  />
</Response>`
    return new NextResponse(errorTwiML, {
      headers: { 'Content-Type': 'application/xml' },
    })
  }
}
