/**
 * Example 11: A2UI Progressive Responses
 *
 * Demonstrates A2UI (Agent-to-User Interface) protocol integration
 * with LangGraph for progressive UI updates and streaming responses.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('A2UIResponsesExample');

interface A2UIState {
  input: string;
  progressiveUpdates?: string[];
  finalUI?: any;
  output?: string;
  metadata?: Record<string, unknown>;
}

const A2UIStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  progressiveUpdates: Annotation<string[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  finalUI: Annotation<any>(),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Generate progressive A2UI updates
async function generateProgressiveUpdates(state: A2UIState): Promise<Partial<A2UIState>> {
  logger.log('Generating progressive A2UI updates');
  const updates: string[] = [];

  // Update 1: Initial acknowledgment
  await delay(50);
  updates.push(JSON.stringify({
    type: 'status',
    message: 'Processing your request...',
    progress: 10
  }));

  // Update 2: Working
  await delay(100);
  updates.push(JSON.stringify({
    type: 'status',
    message: 'Analyzing requirements...',
    progress: 30
  }));

  // Update 3: Generating UI
  await delay(100);
  updates.push(JSON.stringify({
    type: 'status',
    message: 'Generating UI components...',
    progress: 60
  }));

  // Update 4: Almost done
  await delay(100);
  updates.push(JSON.stringify({
    type: 'status',
    message: 'Finalizing...',
    progress: 90
  }));

  return {
    progressiveUpdates: updates,
    metadata: {
      updatesGenerated: updates.length,
      timestamp: Date.now()
    }
  };
}

// Build final A2UI response
async function buildFinalUI(state: A2UIState): Promise<Partial<A2UIState>> {
  logger.log('Building final A2UI response');
  await delay(100);

  const finalUI = {
    version: '0.8.0',
    type: 'a2ui-response',
    request: state.input,
    components: [
      {
        type: 'card',
        props: {
          title: 'Response',
          content: 'Your request has been processed successfully.'
        }
      },
      {
        type: 'button',
        props: {
          label: 'View Details',
          action: 'show-details'
        }
      },
      {
        type: 'progress',
        props: {
          value: 100,
          label: 'Complete'
        }
      }
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      progressiveUpdateCount: state.progressiveUpdates?.length || 0
    }
  };

  return {
    finalUI,
    output: `A2UI Progressive Response Complete:\n\n` +
      `Request: ${state.input}\n` +
      `Progressive Updates: ${finalUI.metadata.progressiveUpdateCount}\n` +
      `Components: ${finalUI.components.length}\n` +
      `Status: READY_TO_RENDER`,
    metadata: {
      finalUIBuilt: true,
      timestamp: Date.now()
    }
  };
}

export function createA2UIGraph() {
  const graph = new StateGraph(A2UIStateAnnotation);
  graph.addNode('progressive_generator', generateProgressiveUpdates);
  graph.addNode('final_ui_builder', buildFinalUI);
  graph.addEdge('progressive_generator', 'final_ui_builder');
  graph.setEntryPoint('progressive_generator');
  graph.setFinishPoint('final_ui_builder');
  return graph.compile();
}

export async function runA2UIExample(input: string) {
  logger.log('Starting A2UI example', { input });
  const graph = createA2UIGraph();
  const result = await graph.invoke({ input });
  logger.log('A2UI example complete');
  return result;
}

export async function main() {
  const examples = [
    'Create a dashboard for sales metrics',
    'Build a form for user feedback',
    'Design a settings panel',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    const result = await runA2UIExample(example);

    console.log('\n📡 Progressive Updates:');
    result.progressiveUpdates?.forEach((update, i) => {
      const parsed = JSON.parse(update);
      console.log(`  [${i + 1}] ${parsed.message} (${parsed.progress}%)`);
    });

    console.log('\n🎨 Final UI:');
    console.log(JSON.stringify(result.finalUI, null, 2));

    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
