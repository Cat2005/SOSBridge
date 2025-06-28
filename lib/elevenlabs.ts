import axios from 'axios'
import WebSocket from 'ws'
import { config } from 'dotenv'

config({ path: '.env' })

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY
const ELEVEN_AGENT_ID = process.env.ELEVEN_AGENT_ID
const ELEVEN_PHONE_ID = process.env.ELEVEN_PHONE_ID
const CALLEE_NUMBER = process.env.CALLEE_NUMBER

if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID || !ELEVEN_PHONE_ID || !CALLEE_NUMBER) {
  console.error('[ElevenLabs] Missing environment variables:')
  console.error(`  - ELEVEN_API_KEY: ${ELEVEN_API_KEY ? 'SET' : 'MISSING'}`)
  console.error(`  - ELEVEN_AGENT_ID: ${ELEVEN_AGENT_ID ? 'SET' : 'MISSING'}`)
  console.error(`  - ELEVEN_PHONE_ID: ${ELEVEN_PHONE_ID ? 'SET' : 'MISSING'}`)
  console.error(`  - CALLEE_NUMBER: ${CALLEE_NUMBER ? 'SET' : 'MISSING'}`)
  throw new Error('Missing required environment variables')
}

console.log('[ElevenLabs] Environment variables loaded successfully')
console.log(`[ElevenLabs] Agent ID: ${ELEVEN_AGENT_ID}`)
console.log(`[ElevenLabs] Phone ID: ${ELEVEN_PHONE_ID}`)
console.log(`[ElevenLabs] Callee Number: ${CALLEE_NUMBER}`)

export interface EmergencyData {
  serviceNeeded: 'police' | 'fire' | 'ambulance'
  description: string
  location?: { latitude: number; longitude: number }
  manualAddress?: string | null
  browserLanguage: string
  timestamp: string
}

export interface OutboundCallResponse {
  conversationId: string
}

function buildEmergencyPrompt(emergencyData: EmergencyData): string {
  const serviceMap = {
    police: 'police department',
    fire: 'fire department',
    ambulance: 'medical emergency services/ambulance',
  }

  const service = serviceMap[emergencyData.serviceNeeded]
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

export async function startCall(
  emergencyData?: EmergencyData
): Promise<OutboundCallResponse> {
  console.log('[ElevenLabs] Starting outbound call...')
  console.log(`[ElevenLabs] Calling number: ${CALLEE_NUMBER}`)

  // Build dynamic prompt based on emergency data, or use default if none provided
  const prompt = emergencyData
    ? buildEmergencyPrompt(emergencyData)
    : 'You are an AI assistant calling on behalf of someone who cannot speak. They are in an emergency and need help. Please identify yourself and explain the situation clearly.'

  const conversationInitiationClientData = {
    type: 'conversation_initiation_client_data',
    conversation_config_override: {
      agent: {
        prompt: {
          prompt: prompt,
        },
        first_message: emergencyData
          ? `I am an AI assistant calling on behalf of someone who cannot speak at the moment. They are experiencing an emergency and need ${
              emergencyData.serviceNeeded === 'ambulance'
                ? 'medical'
                : emergencyData.serviceNeeded
            } assistance immediately.`
          : 'Hello I am a bot for someone that cannot speak at the moment. They are in an emergency and need help.',
      },
    },
  }

  try {
    const requestBody = {
      agent_id: ELEVEN_AGENT_ID,
      agent_phone_number_id: ELEVEN_PHONE_ID,
      to_number: CALLEE_NUMBER,
      conversation_initiation_client_data: conversationInitiationClientData,
    }

    console.log('[ElevenLabs] Making API request to start call:')
    console.log(
      `[ElevenLabs] Request body: ${JSON.stringify(requestBody, null, 2)}`
    )

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
      requestBody,
      {
        headers: {
          'xi-api-key': ELEVEN_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('[ElevenLabs] Call initiated successfully!')
    console.log(`[ElevenLabs] Response status: ${response.status}`)
    console.log(
      `[ElevenLabs] Conversation ID: ${response.data.conversation_id}`
    )
    console.log(
      `[ElevenLabs] Full response: ${JSON.stringify(response.data, null, 2)}`
    )

    return {
      conversationId: response.data.conversation_id,
    }
  } catch (error) {
    console.error('[ElevenLabs] Error starting call:')
    if (axios.isAxiosError(error)) {
      console.error(`[ElevenLabs] HTTP Status: ${error.response?.status}`)
      console.error(
        `[ElevenLabs] Error Response: ${JSON.stringify(
          error.response?.data,
          null,
          2
        )}`
      )
      console.error(
        `[ElevenLabs] Error Message: ${
          error.response?.data?.message || error.message
        }`
      )
      throw new Error(
        `ElevenLabs API error: ${
          error.response?.data?.message || error.message
        }`
      )
    }
    console.error('[ElevenLabs] Non-HTTP error:', error)
    throw error
  }
}

export function openConvWS(conversationId: string): WebSocket {
  console.log(
    `[ElevenLabs] Opening WebSocket connection for conversation: ${conversationId}`
  )

  const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVEN_AGENT_ID}&conversation_id=${conversationId}`
  console.log(`[ElevenLabs] WebSocket URL: ${wsUrl}`)

  // Disable optional dependencies to avoid bufferUtil issues
  const ws = new WebSocket(wsUrl, {
    headers: {
      'xi-api-key': ELEVEN_API_KEY,
    },
    // Disable optional dependencies that might cause issues
    perMessageDeflate: false,
    maxPayload: 1024 * 1024, // 1MB max payload
    // Add timeout to prevent hanging connections
    handshakeTimeout: 10000, // 10 seconds
  })

  console.log('[ElevenLabs] WebSocket created with configuration:')
  console.log(`[ElevenLabs] - perMessageDeflate: false`)
  console.log(`[ElevenLabs] - maxPayload: 1MB`)
  console.log(`[ElevenLabs] - handshakeTimeout: 10s`)

  // Keep-alive ping every 30 seconds to prevent timeout
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

  ws.on('close', (code, reason) => {
    console.log(
      `[ElevenLabs] WebSocket closed - Code: ${code}, Reason: ${reason}`
    )
    clearInterval(pingInterval)
  })

  ws.on('error', (error) => {
    console.error('[ElevenLabs] WebSocket error:', error)
    clearInterval(pingInterval)
  })

  // Add connection timeout
  const connectionTimeout = setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) {
      console.error(
        '[ElevenLabs] WebSocket connection timeout after 15 seconds'
      )
      ws.terminate()
    }
  }, 15000) // 15 seconds timeout

  ws.on('open', () => {
    clearTimeout(connectionTimeout)
    console.log(
      `[ElevenLabs] WebSocket connection established for conversation: ${conversationId}`
    )
    console.log(`[ElevenLabs] WebSocket ready state: ${ws.readyState}`)
  })

  return ws
}
