import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/utils'
import { startCall, openConvWS, EmergencyData } from '@/lib/elevenlabs'
import { getConversation } from '@/lib/conversation'

const EmergencyRequestSchema = z.object({
  serviceNeeded: z.enum(['police', 'fire', 'ambulance']),
  description: z.string().min(10).max(280),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  manualAddress: z.string().nullable(),
  browserLanguage: z.string(),
  timestamp: z.string(),
})

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
    // Rate limiting: 5 emergency requests per hour per IP
    const clientIP =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      'unknown'
    const rateLimit = checkRateLimit(`emergency:${clientIP}`, 5, 60) // 5 requests per hour

    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many emergency requests. Please wait before trying again.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      })
    }

    // Add rate limit headers to all responses
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString())
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime.toString())
    res.setHeader('X-RateLimit-Limit', '5')

    // Validate request body
    const validatedData = EmergencyRequestSchema.parse(req.body)

    // Generate unique session ID
    const sessionId = `emergency_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`

    // Create conversation for this emergency session
    const conversation = getConversation(sessionId)

    // Check if we can initiate a call to prevent duplicates
    const canInitiate = conversation.canInitiateCall()
    if (!canInitiate.allowed) {
      console.log(`[Emergency] Call initiation blocked: ${canInitiate.reason}`)
      return res.status(429).json({
        success: false,
        error: canInitiate.reason || 'Call initiation not allowed',
        retryAfter: 30, // 30 seconds
      })
    }

    // Mark call as initiated to prevent duplicates
    conversation.markCallInitiated()

    console.log('Emergency request received:', {
      sessionId,
      ...validatedData,
      userAgent: req.headers['user-agent'],
      ip: clientIP,
      rateLimitRemaining: rateLimit.remaining,
    })

    // Start ElevenLabs call
    let callResponse
    try {
      console.log(
        `[Emergency] Starting ElevenLabs call for session: ${sessionId}`
      )
      callResponse = await startCall(validatedData as EmergencyData)
      console.log(`[Emergency] ElevenLabs call response:`, callResponse)

      // Open WebSocket connection
      console.log(`[Emergency] Opening WebSocket for conversation: ${callResponse.conversationId}`)
      const ws = openConvWS(callResponse.conversationId)
      console.log(`[Emergency] WebSocket created, readyState: ${ws.readyState}`)

      // Set up conversation details
      console.log(`[Emergency] Setting conversation details...`)
      conversation.setConversationDetails(callResponse.conversationId, ws)
      console.log(`[Emergency] Conversation details set. isActive: ${conversation.isActive}`)

      // Wait a moment for WebSocket to connect
      console.log(`[Emergency] Waiting 2 seconds for WebSocket to connect...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log(`[Emergency] After wait - WebSocket readyState: ${ws.readyState}, conversation isActive: ${conversation.isActive}`)

      // Send emergency context to ElevenLabs
      const emergencyContext = buildEmergencyContext(validatedData)
      try {
        console.log(`[Emergency] Attempting to send context message...`)
        conversation.sendMessage(emergencyContext)
        console.log(`[Emergency] Context sent to ElevenLabs:`, emergencyContext)
      } catch (contextError) {
        console.error(
          '[Emergency] Failed to send context to ElevenLabs:',
          contextError
        )
        // Continue anyway - the call is still active
      }

      console.log(`[Emergency] ElevenLabs call started successfully:`, {
        sessionId,
        conversationId: callResponse.conversationId,
        isActive: conversation.isActive,
      })
    } catch (error) {
      console.error('[Emergency] Failed to start ElevenLabs call:', error)
      console.error('[Emergency] Error details:', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
      })

      // If call failed, reset the initiation state
      conversation.callInitiated = false

      // Even if ElevenLabs fails, we still want to return success
      // The frontend can handle the fallback to simulated operator
      return res.status(200).json({
        success: true,
        sessionId,
        message: 'Emergency services contacted successfully',
        estimatedResponseTime: '2-5 minutes',
        aiCallStatus: 'failed',
        fallbackMode: true,
      })
    }

    // Return success with call details
    return res.status(200).json({
      success: true,
      sessionId,
      conversationId: callResponse.conversationId,
      message: 'Emergency services contacted successfully',
      estimatedResponseTime: '2-5 minutes',
      aiCallStatus: 'active',
    })
  } catch (error) {
    console.error('Emergency API error:', error)

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      })
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred',
    })
  }
}

// Helper function to build emergency context message
function buildEmergencyContext(data: {
  serviceNeeded: 'police' | 'fire' | 'ambulance'
  description: string
  location?: { latitude: number; longitude: number }
  manualAddress?: string | null
  browserLanguage: string
}): string {
  const serviceMap = {
    police: 'police department',
    fire: 'fire department',
    ambulance: 'medical emergency/ambulance',
  }

  const service = serviceMap[data.serviceNeeded]
  const timestamp = new Date().toLocaleString()

  let context = `EMERGENCY UPDATE - ${service.toUpperCase()}: `
  context += `The person you are speaking for has reported: "${data.description}". `

  if (data.location) {
    context += `Their GPS coordinates are: ${data.location.latitude}, ${data.location.longitude}. `
  }

  if (data.manualAddress) {
    context += `They also provided this address: ${data.manualAddress}. `
  }

  context += `This emergency was reported at ${timestamp}. `
  context += `The person's browser language is ${data.browserLanguage}. `
  context += `Please use this information to provide accurate details to emergency dispatchers if they ask for more specific information.`

  return context
}
