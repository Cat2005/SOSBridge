import { NextApiRequest, NextApiResponse } from 'next'
import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { getConversation } from '@/lib/conversation'

export interface NextApiResponseServerIO extends NextApiResponse {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    })
  }

  try {
    const { sessionId } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      })
    }

    // Get the conversation for this session
    const conversation = getConversation(sessionId)

    if (!conversation.isActive) {
      return res.status(400).json({
        success: false,
        error: 'No active conversation found for this session',
      })
    }

    // Set up event listeners for the conversation
    conversation.on('message', (message) => {
      // This will be handled by the WebSocket connection
      console.log(`[WS] Received message from ElevenLabs:`, message)
    })

    conversation.on('ended', () => {
      console.log(`[WS] Conversation ended for session: ${sessionId}`)
    })

    conversation.on('error', (error) => {
      console.error(`[WS] Conversation error for session ${sessionId}:`, error)
    })

    return res.status(200).json({
      success: true,
      message: 'WebSocket connection established',
      conversationId: conversation.conversationId,
    })
  } catch (error) {
    console.error('[API] ElevenLabs WebSocket API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred',
    })
  }
}
