/**
 * Example 04: Human-in-the-Loop
 *
 * Demonstrates a workflow with human approval checkpoints.
 * The graph pauses at specific points awaiting human input.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('HumanInTheLoopExample');

/**
 * Human-in-the-Loop State
 */
interface HumanInTheLoopState {
  input: string;
  draft?: string;
  approved?: boolean;
  output?: string;
  status?: 'pending' | 'awaiting_approval' | 'approved' | 'rejected';
  metadata?: Record<string, unknown>;
}

const HumanInTheLoopStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  draft: Annotation<string>(),
  approved: Annotation<boolean>({
    default: () => false,
  }),
  output: Annotation<string>(),
  status: Annotation<'pending' | 'awaiting_approval' | 'approved' | 'rejected'>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

/**
 * Draft generator - creates initial content
 */
async function generateDraft(state: HumanInTheLoopState): Promise<Partial<HumanInTheLoopState>> {
  logger.log('Generating draft', { input: state.input });

  await delay(100);

  const draft = `Draft Response:\n\nThank you for your request: "${state.input}"\n\n` +
    `Based on our analysis, we recommend the following:\n` +
    `1. Review the current settings\n` +
    `2. Update the configuration\n` +
    `3. Verify the changes\n` +
    `\nThis action requires your approval before proceeding.`;

  logger.log('Draft generated');
  return {
    draft,
    status: 'awaiting_approval',
    metadata: { draftGenerated: true, timestamp: Date.now() },
  };
}

/**
 * Approval checker - validates human approval
 */
async function checkApproval(state: HumanInTheLoopState): Promise<Partial<HumanInTheLoopState>> {
  logger.log('Checking approval', { approved: state.approved });

  await delay(50);

  if (!state.approved) {
    return {
      status: 'awaiting_approval',
      metadata: { awaitingApproval: true },
    };
  }

  return {
    status: 'approved',
    metadata: { approvalGranted: true },
  };
}

/**
 * Final executor - executes approved action
 */
async function executeApproved(state: HumanInTheLoopState): Promise<Partial<HumanInTheLoopState>> {
  logger.log('Executing approved action');

  await delay(100);

  const output = `Action Executed Successfully!\n\n` +
    `Original Request: ${state.input}\n\n` +
    `Approved Draft:\n${state.draft}\n\n` +
    `Status: COMPLETED\n` +
    `Timestamp: ${new Date().toISOString()}`;

  return {
    output,
    status: 'approved',
    metadata: { executed: true, completedAt: Date.now() },
  };
}

/**
 * Rejection handler - handles rejected actions
 */
async function handleRejection(state: HumanInTheLoopState): Promise<Partial<HumanInTheLoopState>> {
  logger.log('Handling rejection');

  await delay(50);

  const output = `Action Not Approved\n\n` +
    `Original Request: ${state.input}\n\n` +
    `The proposed action was not approved. ` +
    `You may modify the request and try again.`;

  return {
    output,
    status: 'rejected',
    metadata: { rejected: true, rejectedAt: Date.now() },
  };
}

/**
 * Route based on approval status
 */
function routeByApproval(state: HumanInTheLoopState): string {
  if (state.approved) {
    return 'execute';
  }
  return 'reject';
}

/**
 * Create human-in-the-loop graph
 */
export function createHumanInTheLoopGraph() {
  const graph = new StateGraph(HumanInTheLoopStateAnnotation);

  // Add nodes
  graph.addNode('generate_draft', generateDraft);
  graph.addNode('check_approval', checkApproval);
  graph.addNode('execute', executeApproved);
  graph.addNode('reject', handleRejection);

  // Set entry point
  graph.setEntryPoint('generate_draft');

  // Connect nodes
  graph.addEdge('generate_draft', 'check_approval');

  // Add conditional routing
  graph.addConditionalEdges('check_approval', routeByApproval, {
    execute: 'execute',
    reject: 'reject',
  });

  // Set finish points
  graph.setFinishPoint('execute');
  graph.setFinishPoint('reject');

  return graph.compile();
}

/**
 * Run human-in-the-loop example
 */
export async function runHumanInTheLoopExample(input: string, approved = false) {
  logger.log('Starting human-in-the-loop example', { input, approved });

  const graph = createHumanInTheLoopGraph();
  const result = await graph.invoke({ input, approved });

  logger.log('Human-in-the-loop complete', { status: result.status });
  return result;
}

/**
 * Run interactive example with approval prompt
 */
export async function runInteractiveExample(input: string) {
  console.log('\n' + '='.repeat(60));
  console.log('Human-in-the-Loop Workflow');
  console.log('='.repeat(60));

  // Generate draft
  const graph = createHumanInTheLoopGraph();
  let state = await graph.invoke({ input });

  console.log(`\nRequest: ${state.input}`);
  console.log(`\n${state.draft}`);
  console.log('\n' + '-'.repeat(60));

  // Check if awaiting approval
  if (state.status === 'awaiting_approval') {
    console.log('\n⏸️  AWAITING APPROVAL');
    console.log('\nDo you approve this action?');
    console.log('For demo purposes, simulating approval...');

    // Simulate user approval
    await delay(1000);
    state = await graph.invoke({ ...state, approved: true });
  }

  console.log(`\nStatus: ${state.status?.toUpperCase()}`);
  console.log(`\n${state.output}`);
  console.log('\n' + '='.repeat(60));

  return state;
}

/**
 * Main entry point
 */
export async function main() {
  const examples = [
    { input: 'Deploy the latest changes to production', approved: true },
    { input: 'Delete all user data', approved: false },
    { input: 'Update the pricing configuration', approved: true },
  ];

  logger.log('Running human-in-the-loop examples');

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example.input}"`);
    console.log(`Approved: ${example.approved}`);
    console.log('='.repeat(60));

    try {
      const result = await runHumanInTheLoopExample(example.input, example.approved);
      console.log(`\nStatus: ${result.status?.toUpperCase()}`);
      console.log(`\nDraft:\n${result.draft}`);
      if (result.output) {
        console.log(`\nResult:\n${result.output}`);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
