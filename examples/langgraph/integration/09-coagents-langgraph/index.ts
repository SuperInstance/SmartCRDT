/**
 * Example 09: CoAgents + LangGraph Integration
 *
 * Demonstrates the integration of CoAgents (human-in-the-loop frontend)
 * with LangGraph (backend orchestration) for a seamless hybrid experience.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('CoAgentsLangGraphExample');

interface CoAgentsLangGraphState {
  input: string;
  checkpoint?: string;
  humanFeedback?: string;
  output?: string;
  metadata?: Record<string, unknown>;
}

const CoAgentsLangGraphStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  checkpoint: Annotation<string>(),
  humanFeedback: Annotation<string>(),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Agent with checkpoint for human feedback
async function agentWithCheckpoint(state: CoAgentsLangGraphState): Promise<Partial<CoAgentsLangGraphState>> {
  logger.log('Agent processing with checkpoint');
  await delay(100);

  const checkpoint = `CHECKPOINT: Agent has processed "${state.input.substring(0, 50)}..." ` +
    `and is awaiting human feedback via CoAgents UI.`;

  return {
    checkpoint,
    metadata: {
      checkpointReached: true,
      checkpointId: `cp_${Date.now()}`,
      checkpointTime: new Date().toISOString()
    }
  };
}

// Resume after human feedback
async function resumeWithFeedback(state: CoAgentsLangGraphState): Promise<Partial<CoAgentsLangGraphState>> {
  logger.log('Resuming with human feedback', { feedback: state.humanFeedback });
  await delay(100);

  const output = `Hybrid CoAgents + LangGraph Response:\n\n` +
    `Original Input: ${state.input}\n` +
    `Human Feedback: ${state.humanFeedback || 'No feedback provided'}\n\n` +
    `Based on the human-in-the-loop interaction, ` +
    `the agent has incorporated your feedback and generated this optimized response.`;

  return {
    output,
    metadata: {
      feedbackIncorporated: true,
      completedAt: Date.now()
    }
  };
}

// Determine if human feedback is present
function checkFeedbackRoute(state: CoAgentsLangGraphState): string {
  return state.humanFeedback ? 'resume' : 'wait';
}

export function createCoAgentsLangGraphGraph() {
  const graph = new StateGraph(CoAgentsLangGraphStateAnnotation);
  graph.addNode('agent_checkpoint', agentWithCheckpoint);
  graph.addNode('resume_agent', resumeWithFeedback);
  graph.setEntryPoint('agent_checkpoint');

  // Conditional routing based on human feedback
  graph.addConditionalEdges('agent_checkpoint', checkFeedbackRoute, {
    wait: '__end__',
    resume: 'resume_agent'
  });

  graph.setFinishPoint('resume_agent');
  return graph.compile();
}

export async function runCoAgentsLangGraphExample(input: string, humanFeedback?: string) {
  logger.log('Starting CoAgents + LangGraph example', { input, hasFeedback: !!humanFeedback });
  const graph = createCoAgentsLangGraphGraph();
  const result = await graph.invoke({ input, humanFeedback });
  logger.log('CoAgents + LangGraph complete');
  return result;
}

export async function main() {
  const examples = [
    { input: 'Help me write a marketing email', humanFeedback: 'Make it more professional' },
    { input: 'Analyze this code snippet', humanFeedback: 'Focus on performance issues' },
    { input: 'Create a project plan', humanFeedback: undefined },
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example.input}"`);
    console.log(`Human Feedback: ${example.humanFeedback || '(waiting for feedback...)'}`);
    console.log('='.repeat(60));

    const result = await runCoAgentsLangGraphExample(example.input, example.humanFeedback);

    if (result.checkpoint) {
      console.log(`\n🔄 ${result.checkpoint}`);
    }
    if (result.output) {
      console.log(`\n${result.output}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
