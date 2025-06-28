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

export interface OutboundCallResponse {
  conversationId: string
}

export async function startCall(): Promise<OutboundCallResponse> {
  console.log('[ElevenLabs] Starting outbound call...')
  console.log(`[ElevenLabs] Calling number: ${CALLEE_NUMBER}`)

  try {
    const requestBody = {
      agent_id: ELEVEN_AGENT_ID,
      agent_phone_number_id: ELEVEN_PHONE_ID,
      to_number: CALLEE_NUMBER,
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
