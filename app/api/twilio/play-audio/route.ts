import { NextRequest, NextResponse } from 'next/server'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    const { callSid, audioUrl } = await request.json()

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        { error: 'Missing Twilio credentials' },
        { status: 500 }
      )
    }

    if (!callSid || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: callSid or audioUrl' },
        { status: 400 }
      )
    }

    console.log('[Twilio API] Playing audio in call:', { callSid, audioUrl })

    // Get the proper base URL for webhooks
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    let baseUrl: string
    if (forwardedHost && forwardedProto) {
      // Use ngrok URL
      baseUrl = `${forwardedProto}://${forwardedHost}`
    } else {
      // Fallback to local URL
      baseUrl = request.nextUrl.origin
    }

    const callbackUrl = `${baseUrl}/api/twilio/recording-callback`
    console.log('[Twilio API] Using callback URL:', callbackUrl)

    // Create TwiML for playing audio
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Record 
    action="${callbackUrl}"
    method="POST"
    maxLength="30"
    playBeep="true"
    trim="trim-silence"
  />
</Response>`

    // Update the call with new TwiML
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Twiml: twiml,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('[Twilio API] Error updating call:', errorData)
      return NextResponse.json(
        { error: 'Failed to update Twilio call' },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[Twilio API] Call updated successfully:', data.sid)

    return NextResponse.json({
      success: true,
      callSid: data.sid,
      status: data.status,
    })
  } catch (error) {
    console.error('[Twilio API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
