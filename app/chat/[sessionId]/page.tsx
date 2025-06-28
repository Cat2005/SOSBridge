'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import ChatBubble from '@/components/ChatBubble';
import LoaderDots from '@/components/LoaderDots';
import ErrorBanner from '@/components/ErrorBanner';
import { useToastSteps } from '@/hooks/useToastSteps';
import { Send, ArrowLeft, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'operator';
  timestamp: Date;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isOperatorTyping, setIsOperatorTyping] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toastSteps = useToastSteps();

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-session', sessionId);
      toastSteps.success('Connected to operator');
      setCallStatus('active');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCallStatus('ended');
      toastSteps.error('Connection lost');
    });

    socket.on('operator-message', (data: { text: string; timestamp: string }) => {
      const message: Message = {
        id: Date.now().toString(),
        text: data.text,
        sender: 'operator',
        timestamp: new Date(data.timestamp),
      };
      setMessages(prev => [...prev, message]);
      setIsOperatorTyping(false);
    });

    socket.on('operator-typing', () => {
      setIsOperatorTyping(true);
      setTimeout(() => setIsOperatorTyping(false), 3000);
    });

    socket.on('call-ended', () => {
      setCallStatus('ended');
      toastSteps.info('Call ended by operator');
    });

    socket.on('error', (error: string) => {
      setError(error);
      toastSteps.error('Communication error occurred');
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, toastSteps]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !socketRef.current || !isConnected) return;

    const message: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, message]);
    socketRef.current.emit('user-message', {
      sessionId,
      text: inputText,
      timestamp: new Date().toISOString(),
    });

    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('end-call', sessionId);
      setCallStatus('ended');
    }
    router.push('/');
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-slate-950">
      {error && (
        <ErrorBanner 
          message={error} 
          onDismiss={() => setError(null)} 
        />
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-800 p-4"
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-red-500'
            }`} />
            <span className="text-sm font-medium text-neutral-700 dark:text-slate-300">
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'active' && 'Operator Online'}
              {callStatus === 'ended' && 'Call Ended'}
            </span>
          </div>

          <Button
            variant={callStatus === 'active' ? 'destructive' : 'ghost'}
            size="sm"
            onClick={endCall}
            className="p-2"
          >
            {callStatus === 'active' ? (
              <PhoneOff className="w-4 h-4" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-4">
          {callStatus === 'connecting' && (
            <div className="text-center py-8">
              <LoaderDots />
              <p className="text-sm text-neutral-600 dark:text-slate-400 mt-4">
                Connecting to emergency operator...
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message.text}
              sender={message.sender}
              timestamp={message.timestamp}
            />
          ))}

          {isOperatorTyping && (
            <ChatBubble
              message={<LoaderDots />}
              sender="operator"
              timestamp={new Date()}
              isTyping
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {callStatus === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border-t border-neutral-200 dark:border-slate-800 p-4"
        >
          <div className="max-w-md mx-auto flex space-x-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={!isConnected}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || !isConnected}
              size="sm"
              className="px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}