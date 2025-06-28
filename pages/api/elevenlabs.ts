import { NextApiRequest, NextApiResponse } from 'next'
import { startCall, openConvWS } from '@/lib/elevenlabs'
import { getConversation, removeConversation } from '@/lib/conversation'
import { checkRateLimit } from '@/lib/utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    })
  }

  try {
    const { sessionId, action } = req.body

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      })
    }

    // Rate limiting: 10 ElevenLabs API calls per hour per IP
    const clientIP =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      'unknown'
    const rateLimit = checkRateLimit(`elevenlabs:${clientIP}`, 5, 60) // 5 calls per minute

    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many API calls. Please wait before trying again.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      })
    }

    // Add rate limit headers to all responses
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString())
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString())
    res.setHeader('X-RateLimit-Limit', '10')

    switch (action) {
      case 'status':
        // Check if ElevenLabs environment variables are configured
        const hasConfig =
          process.env.ELEVEN_API_KEY &&
          process.env.ELEVEN_AGENT_ID &&
          process.env.ELEVEN_PHONE_ID &&
          process.env.CALLEE_NUMBER

        if (hasConfig) {
          return res.status(200).json({
            success: true,
            message: 'ElevenLabs integration configured',
            configured: true,
          })
        } else {
          return res.status(400).json({
            success: false,
            message: 'ElevenLabs integration not configured',
            configured: false,
            missing: {
              ELEVEN_API_KEY: !process.env.ELEVEN_API_KEY,
              ELEVEN_AGENT_ID: !process.env.ELEVEN_AGENT_ID,
              ELEVEN_PHONE_ID: !process.env.ELEVEN_PHONE_ID,
              CALLEE_NUMBER: !process.env.CALLEE_NUMBER,
            },
          })
        }

      case 'start-call':
        console.log(`[API] Starting ElevenLabs call for session: ${sessionId}`)

        try {
          // Get or create conversation
          const conversation = getConversation(sessionId)

          // Check if we can initiate a call
          const canInitiate = conversation.canInitiateCall()
          if (!canInitiate.allowed) {
            console.log(`[API] Call initiation blocked: ${canInitiate.reason}`)
            return res.status(429).json({
              success: false,
              error: canInitiate.reason || 'Call initiation not allowed',
              retryAfter: 30, // 30 seconds
            })
          }

          // Mark call as initiated to prevent duplicates
          conversation.markCallInitiated()

          // Start the ElevenLabs call
          const callResponse = await startCall()
          console.log(
            `[API] Call started with conversation ID: ${callResponse.conversationId}`
          )

          // Open WebSocket connection
          const ws = openConvWS(callResponse.conversationId)

          // Set up conversation details
          conversation.setConversationDetails(callResponse.conversationId, ws)

          console.log(
            `[API] ElevenLabs call successful - Rate limit remaining: ${rateLimit.remaining}`
          )

          return res.status(200).json({
            success: true,
            conversationId: callResponse.conversationId,
            message: 'Call initiated successfully',
          })
        } catch (error) {
          console.error('[API] Error starting call:', error)

          // If call failed, reset the initiation state
          const conversation = getConversation(sessionId)
          conversation.callInitiated = false

          return res.status(500).json({
            success: false,
            error:
              error instanceof Error ? error.message : 'Failed to start call',
          })
        }
        break

      case 'end-call':
        console.log(`[API] Ending call for session: ${sessionId}`)

        try {
          removeConversation(sessionId)
          return res.status(200).json({
            success: true,
            message: 'Call ended successfully',
          })
        } catch (error) {
          console.error('[API] Error ending call:', error)
          return res.status(500).json({
            success: false,
            error: 'Failed to end call',
          })
        }
        break

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use "status", "start-call", or "end-call"',
        })
    }
  } catch (error) {
    console.error('[API] ElevenLabs API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred',
    })
  }
}
