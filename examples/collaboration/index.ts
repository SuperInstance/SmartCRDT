#!/usr/bin/env node

/**
 * CRDT Collaborative Editor Demo
 *
 * Real-time multi-user document editing powered by Conflict-free Replicated Data Types (CRDTs).
 * Demonstrates Aequor's collaboration features.
 */

import { CollaborationServer } from './src/CollaborationServer.js';
import { ConflictDemo } from './src/ConflictDemo.js';

async function runDemo() {
  console.log('🤝 CRDT Collaborative Editor Demo');
  console.log('==================================================\n');

  const args = process.argv.slice(2);

  if (args.includes('--conflict')) {
    // Run conflict resolution demo
    console.log('🔧 Running Conflict Resolution Demo...\n');
    const conflictDemo = new ConflictDemo();
    await conflictDemo.run();
  } else {
    // Start collaboration server
    console.log('🚀 Starting Collaboration Server...\n');
    console.log('WebSocket server will start on ws://localhost:8080\n');
    console.log('Open multiple browser windows to:\n');
    console.log('1. Navigate to index.html');
    console.log('2. Enter unique usernames');
    console.log('3. Use the same Document ID (e.g., "demo-doc")');
    console.log('4. Start collaborating in real-time!\n');

    const server = new CollaborationServer();
    await server.start();
  }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;