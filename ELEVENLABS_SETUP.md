# ElevenLabs Integration Setup

This project integrates with ElevenLabs for AI-powered emergency calls. Follow these steps to set up the integration:

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# ElevenLabs Configuration
ELEVEN_API_KEY=your_elevenlabs_api_key_here
ELEVEN_AGENT_ID=your_elevenlabs_agent_id_here
ELEVEN_PHONE_ID=your_elevenlabs_phone_id_here
CALLEE_NUMBER=+1234567890

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

## Getting ElevenLabs Credentials

1. **API Key**: Get your API key from the [ElevenLabs Console](https://elevenlabs.io/)
2. **Agent ID**: Create an agent in the ElevenLabs ConvAI platform
3. **Phone ID**: Set up a phone number in your ElevenLabs account
4. **Callee Number**: The phone number that will receive the emergency calls

## How It Works

1. When a user starts an emergency session, the system:

   - Initiates an ElevenLabs outbound call to the configured number
   - Establishes a WebSocket connection for real-time communication
   - Bridges the chat interface with the ElevenLabs conversation

2. The conversation flow:

   - User types messages in the chat interface
   - Messages are sent to ElevenLabs via WebSocket
   - ElevenLabs AI responds through the phone call
   - Transcripts are sent back to the chat interface

3. Real-time features:
   - Live message streaming
   - Call status indicators
   - Error handling and reconnection
   - Automatic call termination

## API Endpoints

- `POST /api/elevenlabs` - Start/end ElevenLabs calls
- `POST /api/elevenlabs-ws` - WebSocket connection management
- WebSocket events for real-time communication

## Troubleshooting

- Ensure all environment variables are set correctly
- Check ElevenLabs account status and billing
- Verify phone number format (E.164 format required)
- Monitor server logs for WebSocket connection issues

## Security Notes

- Never commit your `.env` file to version control
- Use environment-specific API keys for development/production
- Implement proper authentication for production use
- Monitor API usage to avoid unexpected charges
