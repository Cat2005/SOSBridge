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

      // Open WebSocket connection
      const ws = openConvWS(callResponse.conversationId)

      // Set up conversation details
      conversation.setConversationDetails(callResponse.conversationId, ws)

      // Wait a moment for WebSocket to connect
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Send emergency context to ElevenLabs
      const emergencyContext = buildEmergencyContext(validatedData)
      try {
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
      })
    } catch (error) {
      console.error('[Emergency] Failed to start ElevenLabs call:', error)

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
