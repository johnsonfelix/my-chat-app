'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function TestSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    // Initialize socket connection
    const socketIO = io(process.env.NODE_ENV === 'production' 
      ? 'https://your-app.onrender.com' 
      : 'http://localhost:3000', {
      path: '/ws',
      transports: ['websocket', 'polling'],
      auth: {
        companyId: 'test-company-123'
      }
    });

    socketIO.on('connect', () => {
      setConnected(true);
      setMessages(prev => [...prev, 'Connected to server']);
    });

    socketIO.on('disconnect', () => {
      setConnected(false);
      setMessages(prev => [...prev, 'Disconnected from server']);
    });

    socketIO.on('connect_error', (error) => {
      setMessages(prev => [...prev, `Connection error: ${error.message}`]);
    });

    setSocket(socketIO);

    return () => {
      socketIO.disconnect();
    };
  }, []);

  const joinConversation = () => {
    socket?.emit('conversation:join', 'test-conversation-456');
    setMessages(prev => [...prev, 'Joined conversation: test-conversation-456']);
  };

  const sendTyping = () => {
    socket?.emit('typing', {
      conversationId: 'test-conversation-456',
      isTyping: true
    });
    setMessages(prev => [...prev, 'Sent typing indicator']);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Socket.IO Test</h1>
      
      <div className="mb-4">
        <p>Status: <span className={connected ? 'text-green-600' : 'text-red-600'}>
          {connected ? 'Connected' : 'Disconnected'}
        </span></p>
      </div>

      <div className="space-x-4 mb-4">
        <button 
          onClick={joinConversation}
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={!connected}
        >
          Join Conversation
        </button>
        
        <button 
          onClick={sendTyping}
          className="bg-green-500 text-white px-4 py-2 rounded"
          disabled={!connected}
        >
          Send Typing
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
        <h3 className="font-bold mb-2">Messages:</h3>
        {messages.map((msg, index) => (
          <p key={index} className="text-sm">{msg}</p>
        ))}
      </div>
    </div>
  );
}
