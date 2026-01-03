/**
 * Example 01: Simple Sequential Flow
 *
 * Demonstrates a basic sequential agent workflow where three agents
 * process a request one after another.
 */

import { StateGraph } from '@langchain/langgraph';
import { SequentialStateAnnotation, GRAPH_CONFIG } from './config.js';
import { parseAgent } from './agents/parser.js';
import { analyzeAgent } from './agents/analyzer.js';
import { respondAgent } from './agents/responder.js';
import { createLogger } from '../../../utils/index.js';

const logger = createLogger('SequentialExample');

/**
 * Create the sequential graph
 */
export function createSequentialGraph() {
  const graph = new StateGraph(SequentialStateAnnotation);

  // Add nodes
  graph.addNode('parser', parseAgent);
  graph.addNode('analyzer', analyzeAgent);
  graph.addNode('responder', respondAgent);

  // Add edges (sequential flow)
  graph.addEdge('parser', 'analyzer');
  graph.addEdge('analyzer', 'responder');

  // Set entry and finish points
  graph.setEntryPoint(GRAPH_CONFIG.entryPoint);
  graph.setFinishPoint(GRAPH_CONFIG.finishPoint);

  return graph.compile();
}

/**
 * Run the sequential example
 */
export async function runSequentialExample(input: string) {
  logger.log('Starting sequential example', { input });

  const graph = createSequentialGraph();
  const result = await graph.invoke({ input });

  logger.log('Sequential example complete', result);
  return result;
}

/**
 * Main entry point for standalone execution
 */
export async function main() {
  const examples = [
    'Analyze the sales data for Q4 2024',
    'Generate a customer report for last month',
    'Compare product inventory this week',
    'What are the key metrics for today?',
  ];

  logger.log('Running sequential examples');

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    try {
      const result = await runSequentialExample(example);

      console.log('\nParsed:', JSON.stringify(result.parsed, null, 2));
      console.log('\nAnalyzed:', JSON.stringify(result.analyzed, null, 2));
      console.log('\nOutput:', result.output);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
