/**
 * Example 08: Multi-Orchestrator Coordination
 *
 * Demonstrates multiple orchestrators working together to coordinate
 * complex workflows across different domains and responsibilities.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay, asyncMap } from '../../../utils/index.js';

const logger = createLogger('MultiOrchestratorExample');

interface MultiOrchestratorState {
  input: string;
  orchestratorResults?: Map<string, unknown>;
  output?: string;
  metadata?: Record<string, unknown>;
}

const MultiOrchestratorStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  orchestratorResults: Annotation<Record<string, unknown>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Orchestrator 1: Task Planning
async function taskOrchestrator(state: MultiOrchestratorState): Promise<Partial<MultiOrchestratorState>> {
  logger.log('Task orchestrator working');
  await delay(100);
  return {
    orchestratorResults: {
      taskOrchestrator: {
        tasks: ['analyze', 'process', 'report'],
        priority: 'high',
        estimatedDuration: '5min'
      }
    }
  };
}

// Orchestrator 2: Resource Management
async function resourceOrchestrator(state: MultiOrchestratorState): Promise<Partial<MultiOrchestratorState>> {
  logger.log('Resource orchestrator working');
  await delay(100);
  return {
    orchestratorResults: {
      resourceOrchestrator: {
        cpu: '45%',
        memory: '2.1GB',
        status: 'available'
      }
    }
  };
}

// Orchestrator 3: Quality Assurance
async function qualityOrchestrator(state: MultiOrchestratorState): Promise<Partial<MultiOrchestratorState>> {
  logger.log('Quality orchestrator working');
  await delay(100);
  return {
    orchestratorResults: {
      qualityOrchestrator: {
        checks: ['validation', 'integrity', 'compliance'],
        status: 'passed',
        score: 98
      }
    }
  };
}

// Master coordinator
async function masterCoordinator(state: MultiOrchestratorState): Promise<Partial<MultiOrchestratorState>> {
  logger.log('Master coordinator orchestrating');
  await delay(50);

  const results = state.orchestratorResults || {};
  const orchestratorCount = Object.keys(results).length;

  return {
    output: `Multi-Orchestrator Coordination Complete:\n\n` +
      `Participating Orchestrators: ${orchestratorCount}\n` +
      `Task Planning: ${results.taskOrchestrator ? '✓' : '○'}\n` +
      `Resource Management: ${results.resourceOrchestrator ? '✓' : '○'}\n` +
      `Quality Assurance: ${results.qualityOrchestrator ? '✓' : '○'}\n\n` +
      `Overall Status: COORDINATED SUCCESS`,
    metadata: {
      coordinationComplete: true,
      orchestratorCount,
      timestamp: Date.now()
    }
  };
}

export function createMultiOrchestratorGraph() {
  const graph = new StateGraph(MultiOrchestratorStateAnnotation);
  graph.addNode('task_orchestrator', taskOrchestrator);
  graph.addNode('resource_orchestrator', resourceOrchestrator);
  graph.addNode('quality_orchestrator', qualityOrchestrator);
  graph.addNode('master_coordinator', masterCoordinator);
  graph.setEntryPoint('task_orchestrator');

  // Chain orchestrators
  graph.addEdge('task_orchestrator', 'resource_orchestrator');
  graph.addEdge('resource_orchestrator', 'quality_orchestrator');
  graph.addEdge('quality_orchestrator', 'master_coordinator');
  graph.setFinishPoint('master_coordinator');

  return graph.compile();
}

export async function runMultiOrchestratorExample(input: string) {
  const graph = createMultiOrchestratorGraph();
  return await graph.invoke({ input });
}

export async function main() {
  const examples = [
    'Coordinate complex data pipeline',
    'Orchestrate multi-region deployment',
    'Manage distributed ML training',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    const result = await runMultiOrchestratorExample(example);
    console.log(`\nOrchestrator Results:`, JSON.stringify(result.orchestratorResults, null, 2));
    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
