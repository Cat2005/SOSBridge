import WebSocket from 'ws'
import { EventEmitter } from 'events'

export interface Message {
  id: string
  role: 'user' | 'callee' | 'system'
  text: string
  timestamp: number
}

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  MAX_CALLS_PER_SESSION: 1, // Only one active call per session
  MAX_CALLS_PER_MINUTE: 3, // Max 3 calls per minute globally
  MAX_CALLS_PER_HOUR: 10, // Max 10 calls per hour globally
  CALL_COOLDOWN_MS: 30000, // 30 seconds between calls
}

// Global rate limiting state
const rateLimitState = {
  globalCalls: [] as number[], // Timestamps of all calls
  sessionCalls: new Map<string, { count: number; lastCall: number }>(),
}

// Rate limiting functions
function isRateLimited(sessionId: string): {
  limited: boolean
  reason?: string
} {
  const now = Date.now()

  // Clean up old timestamps (older than 1 hour)
  rateLimitState.globalCalls = rateLimitState.globalCalls.filter(
    (timestamp) => now - timestamp < 3600000
  )

  // Check global hourly limit
  const hourlyCalls = rateLimitState.globalCalls.filter(
    (timestamp) => now - timestamp < 3600000
  ).length
  if (hourlyCalls >= RATE_LIMIT_CONFIG.MAX_CALLS_PER_HOUR) {
    return { limited: true, reason: 'Hourly call limit exceeded' }
  }

  // Check global minute limit
  const minuteCalls = rateLimitState.globalCalls.filter(
    (timestamp) => now - timestamp < 60000
  ).length
  if (minuteCalls >= RATE_LIMIT_CONFIG.MAX_CALLS_PER_MINUTE) {
    return { limited: true, reason: 'Minute call limit exceeded' }
  }

  // Check session-specific limits
  const sessionData = rateLimitState.sessionCalls.get(sessionId)
  if (sessionData) {
    // Check cooldown period
    if (now - sessionData.lastCall < RATE_LIMIT_CONFIG.CALL_COOLDOWN_MS) {
      return { limited: true, reason: 'Call cooldown period active' }
    }

    // Check per-session limit
    if (sessionData.count >= RATE_LIMIT_CONFIG.MAX_CALLS_PER_SESSION) {
      return { limited: true, reason: 'Session call limit exceeded' }
    }
  }

  return { limited: false }
}

function recordCall(sessionId: string) {
  const now = Date.now()

  // Record global call
  rateLimitState.globalCalls.push(now)

  // Record session call
  const sessionData = rateLimitState.sessionCalls.get(sessionId) || {
    count: 0,
    lastCall: 0,
  }
  sessionData.count += 1
  sessionData.lastCall = now
  rateLimitState.sessionCalls.set(sessionId, sessionData)
}

export class Conversation extends EventEmitter {
  public readonly sessionId: string
  public conversationId: string | null = null
  public ws: WebSocket | null = null
  public isActive = false
  public messages: Message[] = []
  public callInitiated = false // Track if call has been initiated

  constructor(sessionId: string) {
    super()
    this.sessionId = sessionId
    console.log(
      `[Conversation] Created new conversation for session: ${sessionId}`
    )
  }

  // Check if we can initiate a call
  canInitiateCall(): { allowed: boolean; reason?: string } {
    // Check if call is already active
    if (this.isActive && this.conversationId) {
      return { allowed: false, reason: 'Call already active' }
    }

    // Check if call was already initiated
    if (this.callInitiated) {
      return { allowed: false, reason: 'Call already initiated' }
    }

    // Check rate limits
    const rateLimitCheck = isRateLimited(this.sessionId)
    if (rateLimitCheck.limited) {
      return { allowed: false, reason: rateLimitCheck.reason }
    }

    return { allowed: true }
  }

  // Mark call as initiated
  markCallInitiated() {
    this.callInitiated = true
    recordCall(this.sessionId)
    console.log(
      `[Conversation] Call marked as initiated for session: ${this.sessionId}`
    )
  }

  setConversationDetails(conversationId: string, ws: WebSocket) {
    console.log(
      `[Conversation] Setting up conversation details - ID: ${conversationId}, Session: ${this.sessionId}`
    )
    console.log(`[Conversation] WebSocket initial state: ${ws.readyState}`)
    this.conversationId = conversationId
    this.ws = ws

    // Set up WebSocket event handlers
    ws.on('message', (data) => {
      console.log(
        `[WebSocket] Received raw message: ${data.toString()}`
      )
      try {
        const message = JSON.parse(data.toString())
        console.log(`[WebSocket] Parsed message type: ${message.type}`)
        this.handleWebSocketMessage(message)
      } catch (error) {
        console.error('[WebSocket] Error parsing WebSocket message:', error)
      }
    })

    ws.on('close', (code, reason) => {
      console.log(
        `[WebSocket] Connection closed - Code: ${code}, Reason: ${reason}`
      )
      console.log(`[Conversation] Setting isActive to false due to close`)
      this.handleConnectionClose()
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] WebSocket error:', error)
      console.log(`[Conversation] Setting isActive to false due to error`)
      this.handleConnectionClose()
    })

    // Only mark as active when WebSocket is open
    ws.on('open', () => {
      console.log(
        `[WebSocket] Connection opened for conversation: ${conversationId}`
      )
      this.isActive = true
      console.log(
        `[Conversation] Conversation activated for session: ${this.sessionId} (isActive = true)`
      )
    })

    // If WebSocket is already open, mark as active immediately
    if (ws.readyState === WebSocket.OPEN) {
      console.log(
        `[WebSocket] WebSocket already open for conversation: ${conversationId}`
      )
      this.isActive = true
      console.log(
        `[Conversation] Conversation activated (already connected) for session: ${this.sessionId} (isActive = true)`
      )
    } else {
      console.log(
        `[WebSocket] WebSocket not yet open (state: ${ws.readyState}), waiting for 'open' event`
      )
    }
  }

  private handleWebSocketMessage(message: { type: string; text?: string }) {
    console.log(`[Conversation] Handling message type: ${message.type}`)

    switch (message.type) {
      case 'agent_transcript':
        if (message.text && message.text.trim()) {
          console.log(`[Agent] Speaking: "${message.text}"`)
          this.emit('message', {
            role: 'callee',
            text: message.text,
          })
        } else {
          console.log('[Agent] Received empty transcript, ignoring')
        }
        break

      case 'agent_response':
        if (message.text && message.text.trim()) {
          console.log(`[Agent] Speaking: "${message.text}"`)
          this.emit('message', {
            role: 'callee',
            text: message.text,
          })
        } else {
          console.log('[Agent] Received empty response, ignoring')
        }
        break

      case 'audio_chunk':

      case 'conversation_ended':
        console.log('[Conversation] Call ended by ElevenLabs')
        this.emit('message', {
          role: 'system',
          text: 'Call ended',
        })
        this.end()
        break

      case 'ping':
        // console.log('[WebSocket] Received ping response')
        break

      default:
        console.log(
          `[WebSocket] Ignoring unknown message type: ${message.type}`
        )
        break
    }
  }

  private handleConnectionClose() {
    console.log(
      `[Conversation] Handling connection close for session: ${this.sessionId}`
    )
    if (this.isActive) {
      console.log('[Conversation] Connection lost - emitting system message')
      this.emit('message', {
        role: 'system',
        text: 'Connection lost',
      })
      this.end()
    }
  }

  sendMessage(text: string) {
    console.log(`[User] (IE PERSON THAT IS IN EMERGENCY) Sending message: "${text}"`)
    
    // Debug the conversation state
    console.log(`[Conversation] Debug state:`)
    console.log(`  - sessionId: ${this.sessionId}`)
    console.log(`  - conversationId: ${this.conversationId}`)
    console.log(`  - ws exists: ${!!this.ws}`)
    console.log(`  - ws readyState: ${this.ws?.readyState || 'N/A'}`)
    console.log(`  - isActive: ${this.isActive}`)
    console.log(`  - callInitiated: ${this.callInitiated}`)

    if (!this.ws || !this.conversationId || !this.isActive) {
      console.error(
        '[Conversation] Cannot send message - conversation not active'
      )
      console.error(`[Conversation] Missing components:`)
      console.error(`  - ws: ${!this.ws ? 'MISSING' : 'OK'}`)
      console.error(`  - conversationId: ${!this.conversationId ? 'MISSING' : 'OK'}`)
      console.error(`  - isActive: ${!this.isActive ? 'FALSE' : 'TRUE'}`)
      throw new Error('Conversation not active')
    }

    // Check if WebSocket is ready
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error(
        `[WebSocket] Cannot send message - WebSocket state: ${this.ws.readyState}`
      )
      throw new Error('WebSocket connection is not ready')
    }

    console.log(
      `[WebSocket] Sending message to ElevenLabs: ${text}`
    )

    try {
      this.ws.send(JSON.stringify({
        type: 'contextual_update',
        text: text,
        conversation_id: this.conversationId,
      }))
      console.log('[WebSocket] Message sent successfully')
    } catch (error) {
      console.error('[WebSocket] Error sending message via WebSocket:', error)
      // If it's a bufferUtil error, try to reconnect or handle gracefully
      if (error instanceof Error && error.message.includes('bufferUtil')) {
        console.error(
          '[WebSocket] bufferUtil error detected, attempting to handle gracefully'
        )
        // Emit an error event that the application can handle
        this.emit(
          'error',
          new Error('WebSocket connection issue, please try again')
        )
      } else {
        throw error
      }
    }
  }

  end() {
    console.log(
      `[Conversation] Ending conversation for session: ${this.sessionId}`
    )
    this.isActive = false
    this.callInitiated = false // Reset call initiation state
    if (this.ws) {
      console.log('[WebSocket] Closing WebSocket connection')
      this.ws.close()
      this.ws = null
    }
    console.log(
      `[Conversation] Conversation ended for session: ${this.sessionId}`
    )
    this.emit('ended')
  }
}

// Global conversation store - persistent across Next.js hot reloads
declare global {
  var conversationStore: Map<string, Conversation> | undefined
}

const conversations = globalThis.conversationStore || new Map<string, Conversation>()
globalThis.conversationStore = conversations

export function getConversation(sessionId: string): Conversation {
  console.log(
    `[Conversation Store] Getting conversation for session: ${sessionId}`
  )
  console.log(`[Conversation Store] Current store has ${conversations.size} conversations`)
  console.log(`[Conversation Store] Store keys: [${Array.from(conversations.keys()).join(', ')}]`)
  
  let conversation = conversations.get(sessionId)
  if (!conversation) {
    console.log(
      `[Conversation Store] Creating new conversation for session: ${sessionId}`
    )
    conversation = new Conversation(sessionId)
    conversations.set(sessionId, conversation)
    console.log(`[Conversation Store] Store now has ${conversations.size} conversations`)
  } else {
    console.log(
      `[Conversation Store] Found existing conversation for session: ${sessionId}`
    )
    console.log(`[Conversation Store] Existing conversation state:`)
    console.log(`  - conversationId: ${conversation.conversationId}`)
    console.log(`  - isActive: ${conversation.isActive}`)
    console.log(`  - callInitiated: ${conversation.callInitiated}`)
    console.log(`  - ws exists: ${!!conversation.ws}`)
  }
  return conversation
}

export function removeConversation(sessionId: string) {
  console.log(
    `[Conversation Store] Removing conversation for session: ${sessionId}`
  )
  const conversation = conversations.get(sessionId)
  if (conversation) {
    conversation.end()
    conversations.delete(sessionId)
    console.log(
      `[Conversation Store] Conversation removed for session: ${sessionId}`
    )
  } else {
    console.log(
      `[Conversation Store] No conversation found to remove for session: ${sessionId}`
    )
  }
}

// Cleanup function to close all conversations
export function cleanupAllConversations() {
  console.log('[Conversation Store] Cleaning up all conversations...')
  const sessionIds = Array.from(conversations.keys())

  for (const sessionId of sessionIds) {
    removeConversation(sessionId)
  }

  console.log(
    `[Conversation Store] Cleaned up ${sessionIds.length} conversations`
  )
}

// Note: Signal handlers are managed by lib/shutdown.ts to avoid conflicts
