// server.js (prod entry - runs with node)
const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Global reference for Socket.IO (useful for API routes)
global.serverSocket = { io: null };

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  const io = new Server(server, {
    path: '/ws',
    cors: { origin: '*' },
  });

  // Authentication middleware
  io.use((socket, nextFn) => {
    const companyId =
      socket.handshake.auth?.companyId ?? socket.handshake.query?.companyId;
    if (!companyId || typeof companyId !== 'string') {
      return nextFn(new Error('Unauthorized'));
    }
    socket.data.companyId = companyId;
    nextFn();
  });

  // Connection handling
  io.on('connection', (socket) => {
    const companyId = socket.data.companyId;
    console.log(`Client connected: ${socket.id}, Company: ${companyId}`);

    // Join company room
    socket.join(`company:${companyId}`);

    socket.on('conversation:join', (conversationId) => {
      if (typeof conversationId === 'string') {
        socket.join(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} joined conversation: ${conversationId}`);
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      if (typeof conversationId === 'string') {
        socket.leave(`conversation:${conversationId}`);
        console.log(`Socket ${socket.id} left conversation: ${conversationId}`);
      }
    });

    socket.on('typing', (payload) => {
      if (!payload?.conversationId) return;
      socket.to(`conversation:${payload.conversationId}`).emit('typing', {
        conversationId: payload.conversationId,
        companyId,
        isTyping: !!payload.isTyping,
      });
    });

    socket.on('message:read', (payload) => {
      if (!payload?.conversationId || !payload?.messageId) return;
      socket.to(`conversation:${payload.conversationId}`).emit('message:read', {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        companyId,
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });
  });

  // Make io available globally for API routes
  global.serverSocket.io = io;

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, () => {
    console.log(`> Server ready on http://localhost:${port}`);
    console.log(`> Socket.IO at ws://localhost:${port}/ws`);
  });
});
