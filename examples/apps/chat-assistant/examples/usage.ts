/**
 * Usage examples for Chat Assistant
 */

import { ChatAssistantApp } from '../src/index.js';

// Example 1: Basic usage
async function basicUsage() {
  const app = new ChatAssistantApp();
  await app.initialize();

  // Use the internal chat service
  const chatService = (app as any).chatService;

  const response = await chatService.chat('What is machine learning?');
  console.log('Response:', response.content);
  console.log('From cache:', response.fromCache);
  console.log('Model:', response.model);
}

// Example 2: Streaming responses
async function streamingExample() {
  const app = new ChatAssistantApp();
  await app.initialize();

  const chatService = (app as any).chatService;

  console.log('Streaming response:');
  for await (const chunk of chatService.chatStream('Tell me a short story')) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

// Example 3: Conversation with context
async function conversationExample() {
  const app = new ChatAssistantApp();
  await app.initialize();

  const chatService = (app as any).chatService;

  // Multi-turn conversation
  await chatService.chat('My name is Alice');
  await chatService.chat('What is my name?');
  await chatService.chat('Tell me a joke');

  // View conversation history
  const history = chatService.getHistory();
  console.log('Conversation history:');
  history.forEach((msg: any) => {
    console.log(`${msg.role}: ${msg.content}`);
  });
}

// Example 4: Custom configuration
async function customConfigExample() {
  const app = new ChatAssistantApp('./config/custom.json');

  // Or set config programmatically
  const configManager = (app as any).config;
  configManager.set('temperature', 0.9);
  configManager.set('context_window', 20);
  configManager.set('rag_enabled', false);

  await app.initialize();
}

// Example 5: Using HTTP API
async function httpApiExample() {
  const app = new ChatAssistantApp();
  await app.initialize();
  await app.start();

  // Now make HTTP requests:
  // curl -X POST http://localhost:3000/api/chat \
  //   -H "Content-Type: application/json" \
  //   -d '{"message": "Hello!"}'
}

// Example 6: Error handling
async function errorHandlingExample() {
  const app = new ChatAssistantApp();

  try {
    await app.initialize();

    const chatService = (app as any).chatService;
    const response = await chatService.chat('');

    if (!response.content) {
      console.error('Empty response received');
    }
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Example 7: Monitoring metrics
async function metricsExample() {
  const app = new ChatAssistantApp();
  await app.initialize();

  const chatService = (app as any).chatService;

  const startTime = Date.now();
  const response = await chatService.chat('Test message');
  const endTime = Date.now();

  console.log('Latency:', response.latency, 'ms');
  console.log('Total time:', endTime - startTime, 'ms');
  console.log('Confidence:', response.confidence);
  console.log('Model used:', response.model);
  console.log('RAG used:', response.ragUsed);
}

// Example 8: RAG-specific usage
async function ragExample() {
  const app = new ChatAssistantApp();
  await app.initialize();

  const rag = (app as any).rag;

  // Index documents
  await rag.indexDocument('doc1', 'Machine learning is a subset of AI...');
  await rag.indexDocument('doc2', 'Deep learning uses neural networks...');

  // Query with RAG
  const chatService = (app as any).chatService;
  const response = await chatService.chat('What is deep learning?');

  console.log('Response:', response.content);
  console.log('RAG used:', response.ragUsed);
}

// Run examples
async function main() {
  console.log('=== Example 1: Basic Usage ===');
  await basicUsage();
  console.log();

  console.log('=== Example 2: Streaming ===');
  await streamingExample();
  console.log();

  console.log('=== Example 3: Conversation ===');
  await conversationExample();
  console.log();

  // Uncomment to run other examples
  // await customConfigExample();
  // await httpApiExample();
  // await errorHandlingExample();
  // await metricsExample();
  // await ragExample();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
