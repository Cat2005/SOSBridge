'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import ChatBubble from '@/components/ChatBubble'
import LoaderDots from '@/components/LoaderDots'
import ErrorBanner from '@/components/ErrorBanner'
import { useToastSteps } from '@/hooks/useToastSteps'
import { Send, ArrowLeft, Phone, PhoneOff, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  text: string
  sender: 'user' | 'operator'
  timestamp: Date
}

interface EmergencyData {
  serviceNeeded: string
  description: string
  location: { latitude: number; longitude: number } | null
  manualAddress: string | null
  browserLanguage: string
  timestamp: string
}

interface Props {
  emergencyData: EmergencyData
  onBack: () => void
}

// ElevenLabs configuration
const ELEVEN_API_KEY = process.env.NEXT_PUBLIC_ELEVEN_API_KEY
const ELEVEN_VOICE_ID =
  process.env.NEXT_PUBLIC_ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM' // Default voice ID
const TWILIO_ACCOUNT_SID = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER
const CALLEE_NUMBER = process.env.NEXT_PUBLIC_CALLEE_NUMBER

function buildEmergencyMessage(emergencyData: EmergencyData): string {
  const serviceMap: Record<string, string> = {
    police: 'police',
    fire: 'fire department',
    ambulance: 'medical assistance',
  }

  const service =
    serviceMap[emergencyData.serviceNeeded] || emergencyData.serviceNeeded

  let locationInfo = ''
  if (emergencyData.manualAddress) {
    locationInfo += `My address is ${emergencyData.manualAddress}. `
  }

  return `Hello, I cannot speak right now. I need help with ${service}. ${emergencyData.description}. ${locationInfo}Please send help immediately.`
}

async function textToSpeech(text: string): Promise<ArrayBuffer> {
  if (!ELEVEN_API_KEY) {
    throw new Error('Missing ElevenLabs API key')
  }

  console.log('[ElevenLabs TTS] Converting text to speech:', text)

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `ElevenLabs TTS API error: ${errorData.message || response.statusText}`
    )
  }

  const audioBuffer = await response.arrayBuffer()
  console.log('[ElevenLabs TTS] Audio generated successfully')
  return audioBuffer
}

async function makeTwilioCall(audioUrl: string): Promise<string> {
  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN ||
    !TWILIO_PHONE_NUMBER ||
    !CALLEE_NUMBER
  ) {
    throw new Error('Missing Twilio environment variables')
  }

  console.log('[Twilio] Making call to:', CALLEE_NUMBER)

  const response = await fetch('/api/twilio/call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: CALLEE_NUMBER,
      from: TWILIO_PHONE_NUMBER,
      audioUrl: audioUrl,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Twilio API error: ${errorData.message || response.statusText}`
    )
  }

  const data = await response.json()
  console.log('[Twilio] Call initiated successfully:', data.callSid)
  return data.callSid
}

async function uploadAudioToServer(audioBuffer: ArrayBuffer): Promise<string> {
  // Convert ArrayBuffer to Blob
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

  // Create FormData
  const formData = new FormData()
  formData.append('audio', audioBlob, 'emergency-message.mp3')

  const response = await fetch('/api/upload-audio', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Audio upload error: ${errorData.message || response.statusText}`
    )
  }

  const data = await response.json()
  console.log('[Upload] Audio uploaded successfully:', data.audioUrl)
  return data.audioUrl
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!ELEVEN_API_KEY) {
    throw new Error('Missing ElevenLabs API key')
  }

  console.log('[ElevenLabs] Transcribing audio...')

  const formData = new FormData()
  formData.append('audio', audioBlob)
  formData.append('model_id', 'eleven_english_sts_v2')

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `ElevenLabs transcription error: ${
        errorData.message || response.statusText
      }`
    )
  }

  const data = await response.json()
  console.log('[ElevenLabs] Transcription successful:', data.text)
  return data.text
}

export default function Chat({ emergencyData, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [callStatus, setCallStatus] = useState<
    | 'connecting'
    | 'active'
    | 'ended'
    | 'hanging_up'
    | 'speaking'
    | 'listening'
    | 'transcribing'
  >('connecting')
  const [error, setError] = useState<string | null>(null)
  const [callSid, setCallSid] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastTranscriptionCheck, setLastTranscriptionCheck] =
    useState<number>(0)
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isInitializedRef = useRef(false)
  const toastSteps = useToastSteps()

  // Poll for transcribed responses
  useEffect(() => {
    if (!callSid || callStatus !== 'active') return

    const pollForTranscriptions = async () => {
      try {
        const response = await fetch(
          `/api/twilio/get-transcriptions?callSid=${callSid}&since=${lastTranscriptionCheck}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.transcriptions && data.transcriptions.length > 0) {
            // Add new transcriptions to chat
            const newMessages = data.transcriptions.map(
              (transcription: any) => ({
                id: Date.now().toString() + Math.random(),
                text: transcription.text,
                sender: 'operator' as const,
                timestamp: new Date(transcription.timestamp),
              })
            )

            setMessages((prev) => [...prev, ...newMessages])
            setLastTranscriptionCheck(Date.now())

            // Show notification for new messages
            if (newMessages.length > 0) {
              toastSteps.info('Received response from operator')
            }
          }
        }
      } catch (error) {
        console.error('[Chat] Error polling transcriptions:', error)
      }
    }

    const interval = setInterval(pollForTranscriptions, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [callSid, callStatus, lastTranscriptionCheck, toastSteps])

  // Simulate transcription progress when call is active
  useEffect(() => {
    if (callStatus === 'active') {
      const progressSteps = [
        'Listening to operator...',
        'Processing audio...',
        'Transcribing speech...',
        'Listening to operator...',
      ]

      let stepIndex = 0
      const progressInterval = setInterval(() => {
        setTranscriptionProgress(progressSteps[stepIndex])
        stepIndex = (stepIndex + 1) % progressSteps.length
      }, 3000) // Change every 3 seconds

      return () => clearInterval(progressInterval)
    } else {
      setTranscriptionProgress('')
    }
  }, [callStatus])

  // Initialize emergency call
  useEffect(() => {
    if (isInitializedRef.current) {
      console.log('[Chat] Already initialized, skipping...')
      return
    }

    const initializeCall = async () => {
      try {
        isInitializedRef.current = true
        console.log(
          '[Chat] Initializing emergency call with data:',
          emergencyData
        )

        // Build the emergency message
        const emergencyMessage = buildEmergencyMessage(emergencyData)
        console.log('[Chat] Emergency message:', emergencyMessage)

        // Add the emergency message as the first message
        const initialMessage: Message = {
          id: Date.now().toString(),
          text: emergencyMessage,
          sender: 'user',
          timestamp: new Date(),
        }
        setMessages([initialMessage])

        // Convert message to speech
        setIsProcessing(true)
        setCallStatus('speaking')
        toastSteps.info('Converting message to speech...')

        const audioBuffer = await textToSpeech(emergencyMessage)

        // Upload audio to server
        toastSteps.info('Uploading audio...')
        const audioUrl = await uploadAudioToServer(audioBuffer)

        // Make Twilio call
        toastSteps.info('Initiating call...')
        const twilioCallSid = await makeTwilioCall(audioUrl)
        setCallSid(twilioCallSid)

        setCallStatus('active')
        setIsProcessing(false)
        toastSteps.success('Emergency call connected')
      } catch (error) {
        console.error('[Chat] Error initializing call:', error)
        setError('Failed to start emergency call. Please try again.')
        setCallStatus('ended')
        setIsProcessing(false)
      }
    }

    initializeCall()

    return () => {
      console.log('[Chat] Cleaning up...')
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === 'recording'
      ) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [emergencyData, toastSteps])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!inputText.trim() || callStatus !== 'active' || isProcessing) return

    const message: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, message])
    setIsProcessing(true)
    setCallStatus('speaking')

    try {
      // Convert message to speech
      toastSteps.info('Converting message to speech...')
      const audioBuffer = await textToSpeech(inputText)

      // Upload audio to server
      toastSteps.info('Uploading audio...')
      const audioUrl = await uploadAudioToServer(audioBuffer)

      // Play audio in the call
      toastSteps.info('Playing message...')
      await fetch('/api/twilio/play-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid: callSid,
          audioUrl: audioUrl,
        }),
      })

      setCallStatus('active')
      setIsProcessing(false)
      toastSteps.success('Message sent')
    } catch (error) {
      console.error('[Chat] Error sending message:', error)
      setError('Failed to send message')
      setCallStatus('active')
      setIsProcessing(false)
    }

    setInputText('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const endCall = () => {
    console.log('[Chat] User initiated call end')

    if (callSid) {
      // End the Twilio call
      fetch('/api/twilio/end-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid: callSid,
        }),
      }).catch(console.error)
    }

    setCallStatus('ended')
    toastSteps.info('Call ended')

    // Add a small delay before going back to allow the user to see the "Call Ended" status
    setTimeout(() => {
      onBack()
    }, 1500)
  }

  const hangUpCall = () => {
    console.log('[Chat] User initiated hang up')

    setCallStatus('hanging_up')
    toastSteps.info('Hanging up call...')

    if (callSid) {
      fetch('/api/twilio/end-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid: callSid,
        }),
      }).catch(console.error)
    }

    setTimeout(() => {
      endCall()
    }, 1000)
  }

  return (
    <div className="h-full flex flex-col bg-[#0E1017]">
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#14181F] border-b border-[#1E2329] p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2 text-slate-300 hover:text-white hover:bg-[#1E2329]">
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                callStatus === 'active'
                  ? 'bg-emerald-500'
                  : callStatus === 'speaking'
                  ? 'bg-yellow-500'
                  : callStatus === 'listening'
                  ? 'bg-blue-500'
                  : callStatus === 'transcribing'
                  ? 'bg-purple-500'
                  : callStatus === 'connecting'
                  ? 'bg-blue-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium text-slate-300">
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'speaking' && 'Speaking...'}
              {callStatus === 'active' && transcriptionProgress}
              {callStatus === 'listening' && 'Listening to operator...'}
              {callStatus === 'transcribing' && 'Transcribing audio...'}
              {callStatus === 'hanging_up' && 'Hanging Up...'}
              {callStatus === 'ended' && 'Call Ended'}
            </span>
          </div>

          <Button
            variant={callStatus === 'active' ? 'destructive' : 'ghost'}
            size="sm"
            onClick={callStatus === 'active' ? hangUpCall : endCall}
            disabled={
              callStatus === 'hanging_up' || callStatus === 'connecting'
            }
            className={`p-2 ${
              callStatus === 'active'
                ? 'text-red-300 hover:text-white hover:bg-red-600 border border-red-500'
                : callStatus === 'hanging_up' || callStatus === 'connecting'
                ? 'text-slate-500 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-[#1E2329]'
            }`}
            title={
              callStatus === 'active'
                ? 'Hang up call'
                : callStatus === 'hanging_up'
                ? 'Hanging up...'
                : 'End session'
            }>
            {callStatus === 'active' ? (
              <PhoneOff className="w-4 h-4" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-4">
          {callStatus === 'connecting' && (
            <div className="text-center py-8">
              <LoaderDots />
              <p className="text-sm text-slate-400 mt-4">
                {isProcessing
                  ? 'Processing emergency message...'
                  : 'Connecting to emergency services...'}
              </p>
            </div>
          )}

          {callStatus === 'speaking' && (
            <div className="text-center py-8">
              <div className="flex items-center justify-center space-x-2">
                <Volume2 className="w-5 h-5 text-yellow-500 animate-pulse" />
                <span className="text-sm text-yellow-500">Speaking...</span>
              </div>
              <p className="text-sm text-slate-400 mt-4">
                Converting your message to speech
              </p>
            </div>
          )}

          {callStatus === 'active' && transcriptionProgress && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm text-blue-500">
                  {transcriptionProgress}
                </span>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message.text}
              sender={message.sender}
              timestamp={message.timestamp}
            />
          ))}

          {/* Prominent Hang Up Button for Active Calls */}
          {(callStatus === 'active' || callStatus === 'hanging_up') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center pt-4">
              <Button
                onClick={hangUpCall}
                disabled={callStatus === 'hanging_up'}
                variant="destructive"
                size="lg"
                className={`px-8 py-3 rounded-full shadow-lg border-2 ${
                  callStatus === 'hanging_up'
                    ? 'bg-slate-600 border-slate-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 border-red-500'
                } text-white`}>
                <PhoneOff className="w-5 h-5 mr-2" />
                {callStatus === 'hanging_up'
                  ? 'Hanging Up...'
                  : 'Hang Up Emergency Call'}
              </Button>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {callStatus === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#14181F] border-t border-[#1E2329] p-4">
          <div className="max-w-md mx-auto flex space-x-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isProcessing}
              className="flex-1 bg-[#0E1017] border-[#1E2329] text-slate-100 placeholder-slate-500 focus:border-slate-600"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || isProcessing}
              size="sm"
              className="px-3 bg-[#14181F] hover:bg-[#1E2329] text-slate-300 hover:text-white border border-[#1E2329]">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
