/**
 * Example 12: Full-Stack Flow
 *
 * Demonstrates a complete frontend-to-backend flow with LangGraph
 * orchestrating the entire request lifecycle from UI to database.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('FullStackExample');

interface FullStackState {
  input: string;
  frontendContext?: any;
  backendProcessing?: any;
  databaseResult?: any;
  output?: string;
  metadata?: Record<string, unknown>;
}

const FullStackStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  frontendContext: Annotation<any>(),
  backendProcessing: Annotation<any>(),
  databaseResult: Annotation<any>(),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Frontend: Capture UI context
async function frontendCapture(state: FullStackState): Promise<Partial<FullStackState>> {
  logger.log('Frontend capturing context');
  await delay(50);

  const frontendContext = {
    userAgent: 'Mozilla/5.0...',
    screenSize: { width: 1920, height: 1080 },
    timestamp: new Date().toISOString(),
    sessionId: `sess_${Date.now()}`,
    userInput: state.input
  };

  return {
    frontendContext,
    metadata: { frontendCaptured: true }
  };
}

// Backend: Process request
async function backendProcess(state: FullStackState): Promise<Partial<FullStackState>> {
  logger.log('Backend processing request');
  await delay(100);

  const backendProcessing = {
    requestId: `req_${Date.now()}`,
    processingTime: '45ms',
    endpoints: ['/api/validate', '/api/process', '/api/transform'],
    statusCode: 200,
    validated: true
  };

  return {
    backendProcessing,
    metadata: { backendProcessed: true }
  };
}

// Database: Query and persist
async function databaseQuery(state: FullStackState): Promise<Partial<FullStackState>> {
  logger.log('Database querying');
  await delay(100);

  const databaseResult = {
    query: 'SELECT * FROM responses WHERE session_id = ?',
    executionTime: '12ms',
    rowsAffected: 1,
    data: {
      id: `id_${Date.now()}`,
      created_at: new Date().toISOString(),
      status: 'persisted'
    }
  };

  return {
    databaseResult,
    metadata: { databaseQueried: true }
  };
}

// Full-stack aggregator
async function fullStackAggregate(state: FullStackState): Promise<Partial<FullStackState>> {
  logger.log('Full-stack aggregation');
  await delay(50);

  const output = `Full-Stack Flow Complete:\n\n` +
    `1. FRONTEND:\n` +
    `   - Session: ${state.frontendContext?.sessionId}\n` +
    `   - Screen: ${state.frontendContext?.screenSize?.width}x${state.frontendContext?.screenSize?.height}\n\n` +
    `2. BACKEND:\n` +
    `   - Request: ${state.backendProcessing?.requestId}\n` +
    `   - Endpoints: ${state.backendProcessing?.endpoints?.length}\n` +
    `   - Status: ${state.backendProcessing?.statusCode}\n\n` +
    `3. DATABASE:\n` +
    `   - Query Time: ${state.databaseResult?.executionTime}\n` +
    `   - Rows: ${state.databaseResult?.rowsAffected}\n` +
    `   - Status: ${state.databaseResult?.data?.status}\n\n` +
    `✨ Complete end-to-end flow executed successfully`;

  return {
    output,
    metadata: {
      fullStackComplete: true,
      timestamp: Date.now()
    }
  };
}

export function createFullStackGraph() {
  const graph = new StateGraph(FullStackStateAnnotation);
  graph.addNode('frontend', frontendCapture);
  graph.addNode('backend', backendProcess);
  graph.addNode('database', databaseQuery);
  graph.addNode('aggregator', fullStackAggregate);

  graph.setEntryPoint('frontend');
  graph.addEdge('frontend', 'backend');
  graph.addEdge('backend', 'database');
  graph.addEdge('database', 'aggregator');
  graph.setFinishPoint('aggregator');

  return graph.compile();
}

export async function runFullStackExample(input: string) {
  logger.log('Starting full-stack example', { input });
  const graph = createFullStackGraph();
  const result = await graph.invoke({ input });
  logger.log('Full-stack example complete');
  return result;
}

export async function main() {
  const examples = [
    'User submitted contact form',
    'Customer placed an order',
    'Admin updated settings',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    const result = await runFullStackExample(example);
    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
