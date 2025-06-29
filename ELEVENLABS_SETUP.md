# ElevenLabs TTS Integration Setup

This project integrates with ElevenLabs for text-to-speech functionality and Twilio for emergency calls. Follow these steps to set up the integration:

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# ElevenLabs Configuration
NEXT_PUBLIC_ELEVEN_API_KEY=your_elevenlabs_api_key_here
NEXT_PUBLIC_ELEVEN_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Twilio Configuration
NEXT_PUBLIC_TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
NEXT_PUBLIC_TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
NEXT_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890
NEXT_PUBLIC_CALLEE_NUMBER=+1234567890

# Server-side environment variables (for API routes)
ELEVEN_API_KEY=your_elevenlabs_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
```

## Getting Credentials

### ElevenLabs

1. **API Key**: Get your API key from the [ElevenLabs Console](https://elevenlabs.io/)
2. **Voice ID**: Use the default voice ID or create a custom voice in your ElevenLabs account

### Twilio

1. **Account SID**: Found in your Twilio Console dashboard
2. **Auth Token**: Found in your Twilio Console dashboard
3. **Phone Number**: Your Twilio phone number for making calls
4. **Callee Number**: The emergency services number to call

## How It Works

1. **Emergency Message Creation**:

   - User fills out emergency form
   - System builds a natural language message from the form data
   - Message is displayed in the chat interface

2. **Text-to-Speech Conversion**:

   - Emergency message is converted to speech using ElevenLabs TTS API
   - Audio file is uploaded to the server
   - Public URL is generated for the audio file

3. **Twilio Call**:

   - System initiates a call to emergency services using Twilio
   - Audio message is played to the emergency operator
   - Call is set up to record responses

4. **Response Handling**:

   - Emergency operator's response is recorded by Twilio
   - Audio is transcribed using ElevenLabs Speech-to-Text
   - Transcribed text is displayed in the chat interface

5. **Ongoing Communication**:
   - User can type additional messages
   - Messages are converted to speech and played in the call
   - Two-way communication continues until call ends

## API Endpoints

- `POST /api/twilio/call` - Initiate Twilio call with audio
- `POST /api/twilio/play-audio` - Play additional audio during active call
- `POST /api/twilio/end-call` - End active Twilio call
- `POST /api/twilio/recording-callback` - Handle call recordings and transcription
- `POST /api/upload-audio` - Upload audio files to server

## Features

- **Real-time TTS**: Instant text-to-speech conversion
- **Call Management**: Full control over Twilio calls
- **Audio Recording**: Automatic recording of emergency operator responses
- **Speech Recognition**: Transcription of operator responses
- **Chat Interface**: Real-time messaging interface
- **Error Handling**: Comprehensive error handling and user feedback

## Troubleshooting

- Ensure all environment variables are set correctly
- Check ElevenLabs account status and billing
- Verify Twilio account status and phone number configuration
- Monitor server logs for API errors
- Ensure the `/public/uploads` directory is writable

## Security Notes

- Never commit your `.env` file to version control
- Use environment-specific API keys for development/production
- Implement proper authentication for production use
- Monitor API usage to avoid unexpected charges
- Secure your Twilio webhook endpoints in production
