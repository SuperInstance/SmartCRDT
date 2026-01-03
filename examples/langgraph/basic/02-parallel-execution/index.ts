/**
 * Example 02: Parallel Execution
 *
 * Demonstrates parallel agent execution where multiple agents
 * work simultaneously on different aspects of the same request.
 */

import { StateGraph, Annotation, Send } from '@langchain/langgraph';
import { createLogger, delay, asyncMap } from '../../../utils/index.js';

const logger = createLogger('ParallelExample');

/**
 * Parallel Agent State
 */
interface ParallelState {
  input: string;
  tasks: string[];
  results?: Map<string, unknown>;
  merged?: string;
  metadata?: Record<string, unknown>;
}

const ParallelStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  tasks: Annotation<string[]>({
    default: () => [],
  }),
  results: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  merged: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

/**
 * Task splitter - breaks input into parallel tasks
 */
async function splitTasks(state: ParallelState): Promise<Partial<ParallelState>> {
  logger.log('Splitting tasks for parallel execution');

  await delay(50);

  // Generate parallel tasks based on input
  const tasks = [
    `${state.input} - sentiment analysis`,
    `${state.input} - keyword extraction`,
    `${state.input} - entity recognition`,
  ];

  return { tasks };
}

/**
 * Parallel worker node
 */
async function parallelWorker(state: ParallelState, config: { config?: { task?: string } }): Promise<Partial<ParallelState>> {
  const task = config?.config?.task || 'unknown';
  logger.log('Executing parallel task', { task });

  await delay(100 + Math.random() * 100);

  let result: unknown;
  if (task.includes('sentiment')) {
    result = { sentiment: Math.random() > 0.5 ? 'positive' : 'negative', confidence: 0.8 + Math.random() * 0.2 };
  } else if (task.includes('keyword')) {
    result = { keywords: ['analysis', 'data', 'insights'].slice(0, Math.floor(Math.random() * 3) + 1) };
  } else if (task.includes('entity')) {
    result = { entities: ['Organization', 'Date', 'Metric'].slice(0, Math.floor(Math.random() * 2) + 1) };
  } else {
    result = { processed: true };
  }

  return {
    results: { [task]: result },
  };
}

/**
 * Merge results from parallel tasks
 */
async function mergeResults(state: ParallelState): Promise<Partial<ParallelState>> {
  logger.log('Merging results', { resultCount: Object.keys(state.results || {}).length });

  await delay(50);

  const results = state.results || {};
  const mergedParts: string[] = [];

  for (const [task, result] of Object.entries(results)) {
    mergedParts.push(`${task}: ${JSON.stringify(result)}`);
  }

  const merged = `Parallel Analysis Complete:\n${mergedParts.join('\n')}`;

  return { merged };
}

/**
 * Create parallel graph
 */
export function createParallelGraph() {
  const graph = new StateGraph(ParallelStateAnnotation);

  // Add nodes
  graph.addNode('splitter', splitTasks);
  graph.addNode('worker', parallelWorker);
  graph.addNode('merger', mergeResults);

  // Set entry point
  graph.setEntryPoint('splitter');

  // Add edge from splitter to worker
  graph.addEdge('splitter', 'worker');

  // Add conditional edge for parallel execution
  graph.addConditionalEdges('worker', mergeResults);

  // Add edge to merger
  graph.addEdge('worker', 'merger');

  // Set finish point
  graph.setFinishPoint('merger');

  return graph.compile();
}

/**
 * Run parallel example
 */
export async function runParallelExample(input: string) {
  logger.log('Starting parallel example', { input });

  const graph = createParallelGraph();
  const result = await graph.invoke({ input });

  logger.log('Parallel example complete', result);
  return result;
}

/**
 * Main entry point
 */
export async function main() {
  const examples = [
    'Analyze customer feedback',
    'Process social media posts',
    'Review product reviews',
  ];

  logger.log('Running parallel examples');

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    try {
      const result = await runParallelExample(example);
      console.log('\nTasks:', result.tasks);
      console.log('\nResults:', JSON.stringify(result.results, null, 2));
      console.log('\nMerged:', result.merged);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
