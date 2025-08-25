// File: lib/globals.d.ts or types/globals.d.ts

import { Server as SocketIOServer } from 'socket.io';

declare global {
  // This declares the global variable 'serverSocket' with a specific type.
  var serverSocket: {
    io: SocketIOServer | null;
  };
}

// This export is necessary to ensure the file is treated as a module.
export {};
