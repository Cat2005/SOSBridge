# Silent SOS - Emergency Communication System

A web-based emergency communication system that helps people who cannot speak communicate with emergency services using text-to-speech technology.

## Features

- **Emergency Form**: Collect emergency details including service needed, description, and location
- **Text-to-Speech**: Convert emergency messages to natural speech using ElevenLabs
- **Twilio Integration**: Make actual phone calls to emergency services
- **Real-time Communication**: Two-way communication with emergency operators
- **Speech Recognition**: Transcribe operator responses back to text
- **Modern UI**: Clean, accessible interface designed for emergency situations

## How It Works

1. **Emergency Report**: User fills out an emergency form with details about their situation
2. **Message Generation**: System creates a natural language message from the form data
3. **Speech Conversion**: Message is converted to speech using ElevenLabs TTS API
4. **Emergency Call**: System calls emergency services using Twilio and plays the audio message
5. **Response Handling**: Operator responses are recorded and transcribed back to text
6. **Ongoing Communication**: User can send additional messages that are converted to speech and played in the call

## Technology Stack

- **Frontend**: Next.js 13, React, TypeScript, Tailwind CSS
- **Text-to-Speech**: ElevenLabs API
- **Phone Calls**: Twilio API
- **Speech Recognition**: ElevenLabs Speech-to-Text
- **UI Components**: Radix UI, Framer Motion

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd elevenlabs-hack
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your API keys and configuration (see `ELEVENLABS_SETUP.md` for details)

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## Environment Variables

See `ELEVENLABS_SETUP.md` for detailed setup instructions.

Required environment variables:

- `NEXT_PUBLIC_ELEVEN_API_KEY` - ElevenLabs API key
- `NEXT_PUBLIC_TWILIO_ACCOUNT_SID` - Twilio Account SID
- `NEXT_PUBLIC_TWILIO_AUTH_TOKEN` - Twilio Auth Token
- `NEXT_PUBLIC_TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `NEXT_PUBLIC_CALLEE_NUMBER` - Emergency services number

## API Endpoints

- `POST /api/twilio/call` - Initiate emergency call
- `POST /api/twilio/play-audio` - Play audio during active call
- `POST /api/twilio/end-call` - End active call
- `POST /api/twilio/recording-callback` - Handle call recordings
- `POST /api/upload-audio` - Upload audio files

## Development

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI components
│   ├── Chat.tsx          # Main chat interface
│   ├── EmergencyForm.tsx # Emergency form
│   └── ...
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
└── public/              # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This is a demo project for educational purposes. In a real emergency, always call emergency services directly if possible. This system should not be relied upon for actual emergency situations without proper testing and validation.
