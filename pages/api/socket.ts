import { NextApiRequest } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketNextApiResponse {
  socket: {
    server: SocketServer;
  };
}

export default function handler(req: NextApiRequest, res: SocketNextApiResponse) {
  if (!res.socket.server.io) {
    console.log('Setting up Socket.IO server...');
    
    const io = new IOServer(res.socket.server, {
      path: '/api/socket',
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_WS_URL 
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-session', (sessionId: string) => {
        socket.join(sessionId);
        console.log(`Client ${socket.id} joined session ${sessionId}`);
        
        // Simulate operator joining after a delay
        setTimeout(() => {
          socket.emit('operator-message', {
            text: 'Hello, this is emergency dispatch. I can see your request. Are you in immediate danger?',
            timestamp: new Date().toISOString(),
          });
        }, 2000);
      });

      socket.on('user-message', (data: {
        sessionId: string;
        text: string;
        timestamp: string;
      }) => {
        console.log('User message:', data);
        
        // In a real implementation, this would:
        // 1. Send to OpenAI for processing
        // 2. Generate TTS via ElevenLabs
        // 3. Stream to operator via Twilio
        
        // Simulate operator typing
        socket.emit('operator-typing');
        
        // Simulate operator response after delay
        setTimeout(() => {
          const responses = [
            'I understand. Can you provide more details about your location?',
            'Help is on the way. Please stay safe and keep this connection open.',
            'Are there any injuries that need immediate medical attention?',
            'I\'ve dispatched units to your location. ETA is approximately 5 minutes.',
          ];
          
          const response = responses[Math.floor(Math.random() * responses.length)];
          
          socket.emit('operator-message', {
            text: response,
            timestamp: new Date().toISOString(),
          });
        }, 3000 + Math.random() * 2000);
      });

      socket.on('end-call', (sessionId: string) => {
        console.log(`Call ended for session ${sessionId}`);
        socket.to(sessionId).emit('call-ended');
        socket.leave(sessionId);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}