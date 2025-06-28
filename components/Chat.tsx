'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import ChatBubble from '@/components/ChatBubble'
import LoaderDots from '@/components/LoaderDots'
import ErrorBanner from '@/components/ErrorBanner'
import { useToastSteps } from '@/hooks/useToastSteps'
import { Send, ArrowLeft, Phone, PhoneOff } from 'lucide-react'
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
const ELEVEN_AGENT_ID = process.env.NEXT_PUBLIC_ELEVEN_AGENT_ID
const ELEVEN_PHONE_ID = process.env.NEXT_PUBLIC_ELEVEN_PHONE_ID
const CALLEE_NUMBER = process.env.NEXT_PUBLIC_CALLEE_NUMBER

function buildEmergencyPrompt(emergencyData: EmergencyData): string {
  const serviceMap: Record<string, string> = {
    police: 'police department',
    fire: 'fire department',
    ambulance: 'medical emergency services/ambulance',
  }

  const service =
    serviceMap[emergencyData.serviceNeeded] || emergencyData.serviceNeeded
  const timestamp = new Date(emergencyData.timestamp).toLocaleString()

  let locationInfo = ''
  if (emergencyData.location) {
    locationInfo = `Location coordinates: ${emergencyData.location.latitude}, ${emergencyData.location.longitude}. `
  }
  if (emergencyData.manualAddress) {
    locationInfo += `Manual address provided: ${emergencyData.manualAddress}. `
  }

  const prompt = `You are an AI emergency communication assistant speaking on behalf of someone who cannot speak at the moment. 

EMERGENCY DETAILS:
- Service needed: ${service}
- Emergency description: ${emergencyData.description}
- ${locationInfo}
- Time reported: ${timestamp}
- User's language: ${emergencyData.browserLanguage}

YOUR ROLE:
You are calling emergency services (${service}) on behalf of someone in distress. You must:
1. Clearly identify yourself as an AI assistant speaking for someone who cannot speak
2. Provide all the emergency details above clearly and concisely
3. Stay calm, professional, and speak clearly
4. Answer any questions from emergency dispatchers
5. Provide additional context if requested
6. Stay on the line until emergency services arrive or you're told to hang up

IMPORTANT:
- This is a real emergency situation requiring immediate response
- Speak with urgency but remain composed
- Be prepared to repeat information if needed
- If asked for more details, provide them clearly
- Follow any instructions given by emergency dispatchers

Your first message should be: "Hello, I am an AI assistant calling on behalf of someone who cannot speak at the moment. They are experiencing an emergency and need ${service} assistance immediately."`

  return prompt
}

async function startElevenLabsCall(
  emergencyData: EmergencyData
): Promise<string> {
  if (
    !ELEVEN_API_KEY ||
    !ELEVEN_AGENT_ID ||
    !ELEVEN_PHONE_ID ||
    !CALLEE_NUMBER
  ) {
    throw new Error('Missing ElevenLabs environment variables')
  }

  console.log('[ElevenLabs] Starting outbound call...')
  console.log(`[ElevenLabs] Calling number: ${CALLEE_NUMBER}`)

  const prompt = buildEmergencyPrompt(emergencyData)

  const conversationInitiationClientData = {
    type: 'conversation_initiation_client_data',
    conversation_config_override: {
      agent: {
        prompt: {
          prompt: prompt,
        },
        first_message: `I am an AI assistant calling on behalf of someone who cannot speak at the moment. They are experiencing an emergency and need ${
          emergencyData.serviceNeeded === 'ambulance'
            ? 'medical'
            : emergencyData.serviceNeeded
        } assistance immediately.`,
      },
    },
  }

  const requestBody = {
    agent_id: ELEVEN_AGENT_ID,
    agent_phone_number_id: ELEVEN_PHONE_ID,
    to_number: CALLEE_NUMBER,
    conversation_initiation_client_data: conversationInitiationClientData,
  }

  console.log('[ElevenLabs] Making API request to start call:')
  console.log(`[ElevenLabs] Request body:`, requestBody)

  const response = await fetch(
    'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `ElevenLabs API error: ${errorData.message || response.statusText}`
    )
  }

  const data = await response.json()
  console.log('[ElevenLabs] Call initiated successfully!')
  console.log(`[ElevenLabs] Conversation ID: ${data.conversation_id}`)
  console.log(`[ElevenLabs] Full response:`, data)

  return data.conversation_id
}

function openElevenLabsWebSocket(conversationId: string): WebSocket {
  console.log(
    `[ElevenLabs] Opening WebSocket connection for conversation: ${conversationId}`
  )

  if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID) {
    throw new Error('Missing ElevenLabs environment variables')
  }

  // Note: Browser WebSocket doesn't support custom headers in constructor
  // The API key should be passed via URL parameters or the server should handle authentication differently
  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVEN_AGENT_ID}&conversation_id=${conversationId}&xi-api-key=${ELEVEN_API_KEY}`
  console.log(`[ElevenLabs] WebSocket URL: ${wsUrl}`)

  const ws = new WebSocket(wsUrl)

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        console.log('[ElevenLabs] Sending keep-alive ping')
        ws.send(JSON.stringify({ type: 'ping' }))
      } catch (error) {
        console.error('[ElevenLabs] Error sending ping:', error)
        clearInterval(pingInterval)
      }
    } else {
      console.log(
        `[ElevenLabs] WebSocket not open for ping (state: ${ws.readyState}), clearing interval`
      )
      clearInterval(pingInterval)
    }
  }, 30000)

  ws.onclose = () => {
    console.log('[ElevenLabs] WebSocket closed')
    clearInterval(pingInterval)
  }

  ws.onerror = (error) => {
    console.error('[ElevenLabs] WebSocket error:', error)
    clearInterval(pingInterval)
  }

  ws.onopen = () => {
    console.log(
      `[ElevenLabs] WebSocket connection established for conversation: ${conversationId}`
    )
  }

  return ws
}

export default function Chat({ emergencyData, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isOperatorTyping, setIsOperatorTyping] = useState(false)
  const [callStatus, setCallStatus] = useState<
    'connecting' | 'active' | 'ended'
  >('connecting')
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isInitializedRef = useRef(false)
  const toastSteps = useToastSteps()

  // Initialize ElevenLabs call
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      console.log('[Chat] Already initialized, skipping...')
      return
    }

    const initializeCall = async () => {
      try {
        isInitializedRef.current = true
        console.log(
          '[Chat] Initializing ElevenLabs call with emergency data:',
          emergencyData
        )

        // Start the call
        const convId = await startElevenLabsCall(emergencyData)
        setConversationId(convId)

        // Open WebSocket connection
        const ws = openElevenLabsWebSocket(convId)
        wsRef.current = ws

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('[ElevenLabs] Received message:', data)

            if (
              data.type === 'agent_transcript' ||
              data.type === 'agent_response'
            ) {
              if (data.text && data.text.trim()) {
                console.log(`[ElevenLabs] Agent speaking: "${data.text}"`)

                const message: Message = {
                  id: Date.now().toString(),
                  text: data.text,
                  sender: 'operator',
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, message])
                setIsOperatorTyping(false)
              }
            } else if (data.type === 'conversation_ended') {
              console.log('[ElevenLabs] Conversation ended')
              setCallStatus('ended')
              toastSteps.info('Call ended by operator')
            } else if (data.type === 'ping') {
              console.log('[ElevenLabs] Received ping response')
            } else {
              console.log(`[ElevenLabs] Unknown message type: ${data.type}`)
            }
          } catch (error) {
            console.error('[ElevenLabs] Error parsing message:', error)
          }
        }

        ws.onopen = () => {
          console.log('[ElevenLabs] WebSocket connected')
          setIsConnected(true)
          setCallStatus('active')
          toastSteps.success('Connected to emergency operator')
        }

        ws.onclose = (event) => {
          console.log(
            '[ElevenLabs] WebSocket disconnected',
            event.code,
            event.reason
          )
          setIsConnected(false)
          setCallStatus('ended')
          toastSteps.error('Connection lost')
        }

        ws.onerror = (error) => {
          console.error('[ElevenLabs] WebSocket error:', error)
          // Don't set error state immediately, let onclose handle it
        }
      } catch (error) {
        console.error('[Chat] Error initializing call:', error)
        setError('Failed to start emergency call. Please try again.')
        // Don't reset isInitializedRef on error - let it fail once
      }
    }

    initializeCall()

    return () => {
      console.log('[Chat] Cleaning up...')
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      // Don't reset isInitializedRef in cleanup - we want it to stay true
    }
  }, []) // Empty dependency array - only run once

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!inputText.trim() || !wsRef.current || !isConnected || !conversationId)
      return

    const message: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, message])

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'contextual_update',
          text: inputText,
          conversation_id: conversationId,
        })
      )
      console.log(`[ElevenLabs] Sent message: "${inputText}"`)
    } catch (error) {
      console.error('[ElevenLabs] Error sending message:', error)
      setError('Failed to send message')
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
    if (wsRef.current) {
      wsRef.current.close()
    }
    setCallStatus('ended')
    onBack()
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
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-medium text-slate-300">
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'active' && 'Operator Online'}
              {callStatus === 'ended' && 'Call Ended'}
            </span>
          </div>

          <Button
            variant={callStatus === 'active' ? 'destructive' : 'ghost'}
            size="sm"
            onClick={endCall}
            className="p-2 text-slate-300 hover:text-white hover:bg-[#1E2329]">
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
                Connecting to emergency operator...
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

          {isOperatorTyping && (
            <ChatBubble
              message={<LoaderDots />}
              sender="operator"
              timestamp={new Date()}
              isTyping
            />
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
              disabled={!isConnected}
              className="flex-1 bg-[#0E1017] border-[#1E2329] text-slate-100 placeholder-slate-500 focus:border-slate-600"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || !isConnected}
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
