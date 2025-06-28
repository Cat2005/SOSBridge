import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

const EmergencyRequestSchema = z.object({
  serviceNeeded: z.enum(['police', 'fire', 'ambulance']),
  description: z.string().min(10).max(280),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  manualAddress: z.string().optional(),
  browserLanguage: z.string(),
  timestamp: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Validate request body
    const validatedData = EmergencyRequestSchema.parse(req.body);
    
    // Generate unique session ID
    const sessionId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In a real implementation, this would:
    // 1. Initialize Twilio call to PSAP
    // 2. Set up ElevenLabs conversational AI
    // 3. Create WebSocket room for the session
    // 4. Store emergency data in database
    
    console.log('Emergency request received:', {
      sessionId,
      ...validatedData,
      userAgent: req.headers['user-agent'],
      ip: req.connection.remoteAddress,
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For demo purposes, return success
    return res.status(200).json({
      success: true,
      sessionId,
      message: 'Emergency services contacted successfully',
      estimatedResponseTime: '2-5 minutes',
    });

  } catch (error) {
    console.error('Emergency API error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error occurred',
    });
  }
}