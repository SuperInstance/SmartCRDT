/**
 * Example 05: Recursive Agent
 *
 * Demonstrates a self-referential agent that continues calling itself
 * until a base condition is met (e.g., task completion or max iterations).
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('RecursiveAgentExample');

/**
 * Recursive Agent State
 */
interface RecursiveAgentState {
  input: string;
  iteration: number;
  maxIterations: number;
  progress: number;
  completed: boolean;
  output?: string;
  metadata?: Record<string, unknown>;
}

const RecursiveAgentStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  iteration: Annotation<number>({
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    default: () => 5,
  }),
  progress: Annotation<number>({
    default: () => 0,
  }),
  completed: Annotation<boolean>({
    default: () => false,
  }),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

/**
 * Recursive processor - processes task incrementally
 */
async function recursiveProcessor(state: RecursiveAgentState): Promise<Partial<RecursiveAgentState>> {
  const iteration = state.iteration + 1;
  logger.log(`Recursive iteration ${iteration}`, { input: state.input });

  await delay(50);

  // Simulate incremental progress
  const progressIncrement = 20 + Math.random() * 30;
  const newProgress = Math.min(100, state.progress + progressIncrement);
  const completed = newProgress >= 100 || iteration >= state.maxIterations;

  logger.log(`Progress: ${newProgress.toFixed(1)}%, Completed: ${completed}`);

  return {
    iteration,
    progress: newProgress,
    completed,
    metadata: {
      ...state.metadata,
      lastIteration: iteration,
      lastUpdate: Date.now(),
    },
  };
}

/**
 * Final output generator - runs when base condition is met
 */
async function generateFinalOutput(state: RecursiveAgentState): Promise<Partial<RecursiveAgentState>> {
  logger.log('Generating final output');

  await delay(50);

  const output = `Task Completed!\n\n` +
    `Input: ${state.input}\n` +
    `Iterations: ${state.iteration}\n` +
    `Progress: ${state.progress.toFixed(1)}%\n` +
    `Status: ${state.completed ? 'SUCCESS' : 'MAX ITERATIONS'}\n` +
    `Timestamp: ${new Date().toISOString()}`;

  return {
    output,
    metadata: {
      ...state.metadata,
      completedAt: Date.now(),
    },
  };
}

/**
 * Base condition checker - determines if recursion should stop
 */
function checkBaseCondition(state: RecursiveAgentState): string {
  if (state.completed) {
    return 'complete';
  }
  if (state.iteration >= state.maxIterations) {
    return 'complete';
  }
  return 'continue';
}

/**
 * Create recursive agent graph
 */
export function createRecursiveAgentGraph() {
  const graph = new StateGraph(RecursiveAgentStateAnnotation);

  // Add nodes
  graph.addNode('processor', recursiveProcessor);
  graph.addNode('final_output', generateFinalOutput);

  // Set entry point
  graph.setEntryPoint('processor');

  // Add conditional edges for recursion
  graph.addConditionalEdges('processor', checkBaseCondition, {
    continue: 'processor',
    complete: 'final_output',
  });

  // Set finish point
  graph.setFinishPoint('final_output');

  return graph.compile();
}

/**
 * Run recursive agent example
 */
export async function runRecursiveAgentExample(input: string, maxIterations = 5) {
  logger.log('Starting recursive agent example', { input, maxIterations });

  const graph = createRecursiveAgentGraph();
  const result = await graph.invoke({
    input,
    maxIterations,
    iteration: 0,
    progress: 0,
    completed: false,
  });

  logger.log('Recursive agent complete', { iterations: result.iteration, progress: result.progress });
  return result;
}

/**
 * Main entry point
 */
export async function main() {
  const examples = [
    { input: 'Analyze large dataset', maxIterations: 5 },
    { input: 'Process video frames', maxIterations: 8 },
    { input: 'Train machine learning model', maxIterations: 3 },
  ];

  logger.log('Running recursive agent examples');

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example.input}"`);
    console.log(`Max Iterations: ${example.maxIterations}`);
    console.log('='.repeat(60));

    try {
      const result = await runRecursiveAgentExample(example.input, example.maxIterations);
      console.log(`\nIterations: ${result.iteration}`);
      console.log(`Progress: ${result.progress.toFixed(1)}%`);
      console.log(`Completed: ${result.completed}`);
      console.log(`\n${result.output}`);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
