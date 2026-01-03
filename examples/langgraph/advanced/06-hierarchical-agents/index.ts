/**
 * Example 06: Hierarchical Agents
 *
 * Demonstrates nested sub-graphs where a main graph coordinates
 * multiple specialized sub-graphs, each with their own workflows.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('HierarchicalAgentsExample');

// Shared state interface
interface HierarchicalState {
  input: string;
  subgraphResult?: string;
  output?: string;
  metadata?: Record<string, unknown>;
}

const HierarchicalStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  subgraphResult: Annotation<string>(),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Sub-graph 1: Data Processing
async function processData(state: HierarchicalState): Promise<Partial<HierarchicalState>> {
  logger.log('Processing data');
  await delay(100);
  return { subgraphResult: 'Data processed: Cleaned, normalized, validated' };
}

// Sub-graph 2: Analysis
async function analyzeData(state: HierarchicalState): Promise<Partial<HierarchicalState>> {
  logger.log('Analyzing data');
  await delay(100);
  return { subgraphResult: 'Analysis complete: Patterns identified, insights generated' };
}

// Sub-graph 3: Reporting
async function generateReport(state: HierarchicalState): Promise<Partial<HierarchicalState>> {
  logger.log('Generating report');
  await delay(100);
  return { subgraphResult: 'Report generated: Visualizations, summaries, recommendations' };
}

// Main coordinator
async function coordinator(state: HierarchicalState): Promise<Partial<HierarchicalState>> {
  logger.log('Coordinating sub-graphs');
  await delay(50);
  return { metadata: { coordination: true, timestamp: Date.now() } };
}

// Final aggregator
async function aggregateResults(state: HierarchicalState): Promise<Partial<HierarchicalState>> {
  logger.log('Aggregating results');
  await delay(100);
  return {
    output: `Hierarchical Workflow Complete:\n\n` +
      `1. Data Processing: Complete\n` +
      `2. Analysis: Complete\n` +
      `3. Reporting: Complete\n\n` +
      `Final Status: All sub-graphs executed successfully`,
  };
}

/**
 * Create hierarchical agent graph
 */
export function createHierarchicalGraph() {
  const graph = new StateGraph(HierarchicalStateAnnotation);

  // Add sub-graph nodes
  graph.addNode('data_processing', processData);
  graph.addNode('analysis', analyzeData);
  graph.addNode('reporting', generateReport);
  graph.addNode('coordinator', coordinator);
  graph.addNode('aggregator', aggregateResults);

  // Set entry point
  graph.setEntryPoint('coordinator');

  // Connect coordinator to sub-graphs (simulated hierarchy)
  graph.addEdge('coordinator', 'data_processing');
  graph.addEdge('data_processing', 'analysis');
  graph.addEdge('analysis', 'reporting');
  graph.addEdge('reporting', 'aggregator');

  // Set finish point
  graph.setFinishPoint('aggregator');

  return graph.compile();
}

/**
 * Run hierarchical agents example
 */
export async function runHierarchicalAgentsExample(input: string) {
  logger.log('Starting hierarchical agents example', { input });
  const graph = createHierarchicalGraph();
  const result = await graph.invoke({ input });
  logger.log('Hierarchical agents complete');
  return result;
}

/**
 * Main entry point
 */
export async function main() {
  const examples = [
    'Process quarterly sales data',
    'Analyze customer behavior patterns',
    'Generate executive dashboard',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    const result = await runHierarchicalAgentsExample(example);
    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
