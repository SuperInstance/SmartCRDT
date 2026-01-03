/**
 * Example 13: Multi-Agent Customer Support
 *
 * A real-world customer support system with multiple specialized agents
 * handling different aspects of customer inquiries.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { MockSupportDataGenerator, createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('CustomerSupportExample');

interface CustomerSupportState {
  ticketId: string;
  customerInput: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  agentResponse?: string;
  resolution?: string;
  metadata?: Record<string, unknown>;
}

const CustomerSupportStateAnnotation = Annotation.Root({
  ticketId: Annotation<string>(),
  customerInput: Annotation<string>(),
  category: Annotation<string>(),
  priority: Annotation<string>(),
  sentiment: Annotation<string>(),
  agentResponse: Annotation<string>(),
  resolution: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Triage Agent: Categorize and prioritize
async function triageAgent(state: CustomerSupportState): Promise<Partial<CustomerSupportState>> {
  logger.log('Triage agent analyzing ticket', { ticketId: state.ticketId });
  await delay(100);

  const input = state.customerInput.toLowerCase();
  let category = 'general';
  let priority = 'medium';
  let sentiment = 'neutral';

  // Categorize
  if (input.includes('billing') || input.includes('payment') || input.includes('refund')) {
    category = 'billing';
  } else if (input.includes('login') || input.includes('password') || input.includes('account')) {
    category = 'technical';
  } else if (input.includes('product') || input.includes('feature') || input.includes('service')) {
    category = 'product';
  }

  // Prioritize
  if (input.includes('urgent') || input.includes('emergency') || input.includes('critical')) {
    priority = 'high';
  } else if (input.includes('question') || input.includes('inquiry')) {
    priority = 'low';
  }

  // Sentiment
  if (input.includes('angry') || input.includes('frustrated') || input.includes('terrible')) {
    sentiment = 'negative';
  } else if (input.includes('happy') || input.includes('great') || input.includes('thanks')) {
    sentiment = 'positive';
  }

  logger.log('Ticket triaged', { category, priority, sentiment });

  return {
    category,
    priority,
    sentiment,
    metadata: { triageComplete: true, timestamp: Date.now() }
  };
}

// Specialist Agent: Handle category-specific issues
async function specialistAgent(state: CustomerSupportState): Promise<Partial<CustomerSupportState>> {
  logger.log('Specialist agent handling ticket', { category: state.category });
  await delay(150);

  const category = state.category || 'general';
  let response = '';

  switch (category) {
    case 'billing':
      response = `Thank you for contacting billing support. ` +
        `I've reviewed your account and can help with payment issues. ` +
        `For your security, please verify the last 4 digits of the card on file.`;
      break;
    case 'technical':
      response = `Hello! I'm a technical support specialist. ` +
        `I can help you resolve login and account access issues. ` +
        `Let's work through this step by step.`;
      break;
    case 'product':
      response = `Hi there! I'm a product specialist. ` +
        `I'd be happy to help you with product features and services. ` +
        `What specific aspect would you like to know more about?`;
      break;
    default:
      response = `Thank you for contacting customer support. ` +
        `How can I assist you today?`;
  }

  return {
    agentResponse: response,
    metadata: { specialistAssigned: category, timestamp: Date.now() }
  };
}

// Resolution Agent: Resolve and close ticket
async function resolutionAgent(state: CustomerSupportState): Promise<Partial<CustomerSupportState>> {
  logger.log('Resolution agent finalizing ticket');
  await delay(100);

  const resolution = `Ticket Resolution Summary:\n\n` +
    `Ticket ID: ${state.ticketId}\n` +
    `Category: ${state.category?.toUpperCase()}\n` +
    `Priority: ${state.priority?.toUpperCase()}\n` +
    `Sentiment: ${state.sentiment?.toUpperCase()}\n\n` +
    `Agent Response: ${state.agentResponse}\n\n` +
    `Status: RESOLVED\n` +
    `Resolution Time: ${new Date().toISOString()}\n` +
    `Customer Satisfaction: Target met based on ${state.sentiment} sentiment`;

  return {
    resolution,
    metadata: {
      ticketResolved: true,
      resolutionTime: Date.now(),
      category: state.category,
      priority: state.priority
    }
  };
}

export function createCustomerSupportGraph() {
  const graph = new StateGraph(CustomerSupportStateAnnotation);
  graph.addNode('triage', triageAgent);
  graph.addNode('specialist', specialistAgent);
  graph.addNode('resolution', resolutionAgent);

  graph.setEntryPoint('triage');
  graph.addEdge('triage', 'specialist');
  graph.addEdge('specialist', 'resolution');
  graph.setFinishPoint('resolution');

  return graph.compile();
}

export async function runCustomerSupportExample(customerInput: string) {
  const ticketId = `TICK-${Date.now().toString().slice(-6)}`;
  logger.log('Creating customer support ticket', { ticketId, customerInput });

  const graph = createCustomerSupportGraph();
  const result = await graph.invoke({ ticketId, customerInput });

  logger.log('Ticket resolved', { ticketId });
  return result;
}

export async function main() {
  const examples = [
    'I need help with my payment, it is urgent!',
    'I cannot login to my account, please help.',
    'Can you tell me more about your premium features?',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(70));
    console.log(`Customer Input: "${example}"`);
    console.log('='.repeat(70));

    const result = await runCustomerSupportExample(example);

    console.log(`\n[Triage Analysis]`);
    console.log(`  Category: ${result.category?.toUpperCase()}`);
    console.log(`  Priority: ${result.priority?.toUpperCase()}`);
    console.log(`  Sentiment: ${result.sentiment?.toUpperCase()}`);

    console.log(`\n[Specialist Response]`);
    console.log(`  ${result.agentResponse}`);

    console.log(`\n[Resolution]`);
    console.log(`  ${result.resolution}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
