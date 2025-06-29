'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import ChatBubble from '@/components/ChatBubble'
import LoaderDots from '@/components/LoaderDots'
import ErrorBanner from '@/components/ErrorBanner'
import { useToastSteps } from '@/hooks/useToastSteps'
import { Send, ArrowLeft, Phone, PhoneOff, Volume2, Mic } from 'lucide-react'
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

  return `Hello this is a robot on behalf of someone that cannot speak. They said: I need help with ${service}. ${emergencyData.description}. ${locationInfo}`
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
  const [statusMessage, setStatusMessage] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isInitializedRef = useRef(false)

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
            setStatusMessage('') // Clear status when we get a response
          }
        }
      } catch (error) {
        console.error('[Chat] Error polling transcriptions:', error)
      }
    }

    const interval = setInterval(pollForTranscriptions, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [callSid, callStatus, lastTranscriptionCheck])

  // Update status message based on call status
  useEffect(() => {
    if (callStatus === 'connecting') {
      setStatusMessage('Connecting to emergency services...')
    } else if (callStatus === 'speaking') {
      setStatusMessage('Converting your message to speech...')
    } else if (callStatus === 'active') {
      setStatusMessage('Listening for operator response...')
    } else if (callStatus === 'listening') {
      setStatusMessage('Listening to operator...')
    } else if (callStatus === 'transcribing') {
      setStatusMessage('Transcribing operator response...')
    } else if (callStatus === 'hanging_up') {
      setStatusMessage('Ending call...')
    } else if (callStatus === 'ended') {
      setStatusMessage('Call ended')
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

        const audioBuffer = await textToSpeech(emergencyMessage)

        // Upload audio to server
        const audioUrl = await uploadAudioToServer(audioBuffer)

        // Make Twilio call
        const twilioCallSid = await makeTwilioCall(audioUrl)
        setCallSid(twilioCallSid)

        setCallStatus('active')
        setIsProcessing(false)
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
  }, [emergencyData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusMessage])

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
      const audioBuffer = await textToSpeech(inputText)

      // Upload audio to server
      const audioUrl = await uploadAudioToServer(audioBuffer)

      // Play audio in the call
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

    // Add a small delay before going back to allow the user to see the "Call Ended" status
    setTimeout(() => {
      onBack()
    }, 1500)
  }

  const hangUpCall = () => {
    console.log('[Chat] User initiated hang up')

    setCallStatus('hanging_up')

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
              {callStatus === 'active' && 'Connected'}
              {callStatus === 'listening' && 'Listening...'}
              {callStatus === 'transcribing' && 'Transcribing...'}
              {callStatus === 'hanging_up' && 'Hanging Up...'}
              {callStatus === 'ended' && 'Call Ended'}
            </span>
          </div>

          {callStatus === 'active' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={hangUpCall}
              className="p-2 text-red-300 hover:text-white hover:bg-red-600 border border-red-500"
              title="Hang up call">
              <PhoneOff className="w-4 h-4" />
            </Button>
          )}
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

          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message.text}
              sender={message.sender}
              timestamp={message.timestamp}
            />
          ))}

          {/* Status message below last message */}
          {statusMessage && callStatus !== 'connecting' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center space-x-2 py-3 px-4 bg-[#1E2329] rounded-lg border border-[#2A2F38]">
              {callStatus === 'speaking' && (
                <Volume2 className="w-4 h-4 text-yellow-500 animate-pulse" />
              )}
              {callStatus === 'listening' && (
                <Mic className="w-4 h-4 text-blue-500 animate-pulse" />
              )}
              {callStatus === 'transcribing' && (
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              )}
              {callStatus === 'active' && (
                <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
              )}
              <span className="text-sm text-slate-300">{statusMessage}</span>
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
