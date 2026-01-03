/**
 * @file server.ts - Collaboration server startup script
 * @description Start the CRDT collaboration WebSocket server
 * @module collaboration/server
 */

import { CollaborationServer } from './CollaborationServer.js';

const PORT = process.env.PORT || 8080;

const server = new CollaborationServer({
  port: PORT as number,
  host: '0.0.0.0',
  heartbeatInterval: 30000,
  clientTimeout: 60000
});

// Print stats every 10 seconds
setInterval(() => {
  const stats = server.getStats();
  console.log(
    `[Stats] ${stats.clientCount} clients, ${stats.documentCount} documents`
  );
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.shutdown();
  process.exit(0);
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║     Aequor CRDT Collaboration Server                       ║
║     Real-time document editing with CRDTs                  ║
╠════════════════════════════════════════════════════════════╣
║     WebSocket: ws://localhost:${PORT}                        ║
║     Open index.html in multiple browser windows            ║
║                                                              ║
║     Press Ctrl+C to stop                                    ║
╚════════════════════════════════════════════════════════════╝
`);
