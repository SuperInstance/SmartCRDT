/**
 * Example 07: Dynamic Graph
 *
 * Demonstrates runtime graph modification where the graph structure
 * changes based on the input or intermediate results.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('DynamicGraphExample');

interface DynamicGraphState {
  input: string;
  dynamicNodes?: string[];
  output?: string;
  metadata?: Record<string, unknown>;
}

const DynamicGraphStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  dynamicNodes: Annotation<string[]>({
    default: () => [],
  }),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

async function analyzeInput(state: DynamicGraphState): Promise<Partial<DynamicGraphState>> {
  logger.log('Analyzing input for dynamic node generation');
  await delay(50);

  const input = state.input.toLowerCase();
  let dynamicNodes: string[] = [];

  if (input.includes('data')) {
    dynamicNodes.push('extract_data', 'transform_data', 'load_data');
  }
  if (input.includes('ml') || input.includes('model')) {
    dynamicNodes.push('train_model', 'evaluate_model', 'deploy_model');
  }
  if (input.includes('report') || input.includes('visualize')) {
    dynamicNodes.push('create_charts', 'generate_summary', 'export_pdf');
  }

  logger.log('Dynamic nodes determined', { dynamicNodes });
  return {
    dynamicNodes,
    metadata: { nodesGenerated: true, nodeCount: dynamicNodes.length }
  };
}

async function executeDynamicWorkflow(state: DynamicGraphState): Promise<Partial<DynamicGraphState>> {
  logger.log('Executing dynamic workflow');
  await delay(100);

  const nodes = state.dynamicNodes || [];
  const results = nodes.map(node => {
    const formatted = node.replace(/_/g, ' ').toUpperCase();
    return `[✓] ${formatted}`;
  });

  return {
    output: `Dynamic Workflow Execution:\n\n${results.join('\n')}\n\n` +
      `Total Steps: ${nodes.length}\n` +
      `Status: COMPLETED`
  };
}

export function createDynamicGraph() {
  const graph = new StateGraph(DynamicGraphStateAnnotation);
  graph.addNode('analyzer', analyzeInput);
  graph.addNode('executor', executeDynamicWorkflow);
  graph.addEdge('analyzer', 'executor');
  graph.setEntryPoint('analyzer');
  graph.setFinishPoint('executor');
  return graph.compile();
}

export async function runDynamicGraphExample(input: string) {
  const graph = createDynamicGraph();
  return await graph.invoke({ input });
}

export async function main() {
  const examples = [
    'Process data and create ML model',
    'Generate visualization report',
    'Train model with data pipeline',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    const result = await runDynamicGraphExample(example);
    console.log(`\nDynamic Nodes: ${result.dynamicNodes?.join(', ')}`);
    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
