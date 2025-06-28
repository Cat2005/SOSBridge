import { NextApiRequest } from 'next'
import { Server as IOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { getConversation, removeConversation } from '@/lib/conversation'

interface SocketServer extends HTTPServer {
  io?: IOServer
}

interface SocketNextApiResponse {
  socket: {
    server: SocketServer
  }
}

export default function handler(
  req: NextApiRequest,
  res: SocketNextApiResponse
) {
  if (!res.socket.server.io) {
    console.log('Setting up Socket.IO server...')

    const io = new IOServer(res.socket.server, {
      path: '/api/socket',
      cors: {
        origin:
          process.env.NODE_ENV === 'production'
            ? process.env.NEXT_PUBLIC_WS_URL
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
      },
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('join-session', (sessionId: string) => {
        socket.join(sessionId)
        console.log(`Client ${socket.id} joined session ${sessionId}`)

        // Check if there's an active ElevenLabs conversation
        const conversation = getConversation(sessionId)

        if (conversation.isActive && conversation.conversationId) {
          console.log(
            `[Socket] Found active ElevenLabs conversation: ${conversation.conversationId}`
          )

          // Set up event listeners for the conversation
          conversation.on('message', (message) => {
            console.log(
              `[Socket] Forwarding ElevenLabs message to client:`,
              message
            )

            if (message.role === 'callee') {
              socket.emit('operator-message', {
                text: message.text,
                timestamp: new Date(message.timestamp).toISOString(),
              })
            } else if (message.role === 'system') {
              socket.emit('call-ended')
            }
          })

          conversation.on('ended', () => {
            console.log(
              `[Socket] ElevenLabs conversation ended for session: ${sessionId}`
            )
            socket.emit('call-ended')
          })

          conversation.on('error', (error) => {
            console.error(
              `[Socket] ElevenLabs conversation error for session ${sessionId}:`,
              error
            )
            socket.emit('error', error.message)
          })
        } else {
          console.log(
            `[Socket] No active ElevenLabs conversation found for session: ${sessionId}`
          )
          // Fallback to simulated operator
          setTimeout(() => {
            socket.emit('operator-message', {
              text: 'Hello, this is emergency dispatch. I can see your request. Are you in immediate danger?',
              timestamp: new Date().toISOString(),
            })
          }, 2000)
        }
      })

      socket.on(
        'user-message',
        (data: { sessionId: string; text: string; timestamp: string }) => {
          console.log('User message:', data)

          const conversation = getConversation(data.sessionId)

          if (conversation.isActive && conversation.conversationId) {
            // Send message to ElevenLabs
            try {
              conversation.sendMessage(data.text)
              console.log(`[Socket] Message sent to ElevenLabs: "${data.text}"`)
            } catch (error) {
              console.error(
                '[Socket] Error sending message to ElevenLabs:',
                error
              )
              socket.emit('error', 'Failed to send message to operator')
            }
          } else {
            // Fallback to simulated operator
            socket.emit('operator-typing')

            setTimeout(() => {
              const responses = [
                'I understand. Can you provide more details about your location?',
                'Help is on the way. Please stay safe and keep this connection open.',
                'Are there any injuries that need immediate medical attention?',
                "I've dispatched units to your location. ETA is approximately 5 minutes.",
              ]

              const response =
                responses[Math.floor(Math.random() * responses.length)]

              socket.emit('operator-message', {
                text: response,
                timestamp: new Date().toISOString(),
              })
            }, 3000 + Math.random() * 2000)
          }
        }
      )

      socket.on('end-call', (sessionId: string) => {
        console.log(`Call ended for session ${sessionId}`)

        // End the ElevenLabs conversation
        const conversation = getConversation(sessionId)
        if (conversation.isActive) {
          conversation.end()
        }

        socket.to(sessionId).emit('call-ended')
        socket.leave(sessionId)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
  }

  res.end()
}
