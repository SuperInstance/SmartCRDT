/**
 * Example 03: Conditional Routing
 *
 * Demonstrates conditional routing where the execution path
 * changes based on the sentiment of the input.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('ConditionalRoutingExample');

/**
 * Conditional Routing State
 */
interface ConditionalRoutingState {
  input: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  output?: string;
  metadata?: Record<string, unknown>;
}

const ConditionalRoutingStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  sentiment: Annotation<'positive' | 'neutral' | 'negative'>(),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

/**
 * Sentiment analyzer - determines routing
 */
async function analyzeSentiment(state: ConditionalRoutingState): Promise<Partial<ConditionalRoutingState>> {
  logger.log('Analyzing sentiment', { input: state.input });

  await delay(50);

  const input = state.input.toLowerCase();
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';

  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'happy', 'thank'];
  const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'frustrated', 'disappointed'];

  const hasPositive = positiveWords.some(word => input.includes(word));
  const hasNegative = negativeWords.some(word => input.includes(word));

  if (hasPositive && !hasNegative) {
    sentiment = 'positive';
  } else if (hasNegative && !hasPositive) {
    sentiment = 'negative';
  }

  logger.log('Sentiment detected', { sentiment });
  return { sentiment };
}

/**
 * Positive response handler
 */
async function handlePositive(state: ConditionalRoutingState): Promise<Partial<ConditionalRoutingState>> {
  logger.log('Handling positive sentiment');

  await delay(100);

  return {
    output: `Thank you for your positive feedback! We're glad to hear that ${state.input.substring(0, 50)}... We appreciate your support!`,
    metadata: { route: 'positive', timestamp: Date.now() },
  };
}

/**
 * Neutral response handler
 */
async function handleNeutral(state: ConditionalRoutingState): Promise<Partial<ConditionalRoutingState>> {
  logger.log('Handling neutral sentiment');

  await delay(100);

  return {
    output: `Thank you for your message. We've received your input: "${state.input.substring(0, 50)}..." How can we help you further?`,
    metadata: { route: 'neutral', timestamp: Date.now() },
  };
}

/**
 * Negative response handler
 */
async function handleNegative(state: ConditionalRoutingState): Promise<Partial<ConditionalRoutingState>> {
  logger.log('Handling negative sentiment');

  await delay(100);

  return {
    output: `We're sorry to hear about your experience. Your feedback: "${state.input.substring(0, 50)}..." is important to us. How can we make things right?`,
    metadata: { route: 'negative', timestamp: Date.now() },
  };
}

/**
 * Route function based on sentiment
 */
function routeBySentiment(state: ConditionalRoutingState): string {
  const sentiment = state.sentiment || 'neutral';
  return `${sentiment}_handler`;
}

/**
 * Create conditional routing graph
 */
export function createConditionalRoutingGraph() {
  const graph = new StateGraph(ConditionalRoutingStateAnnotation);

  // Add nodes
  graph.addNode('sentiment_analyzer', analyzeSentiment);
  graph.addNode('positive_handler', handlePositive);
  graph.addNode('neutral_handler', handleNeutral);
  graph.addNode('negative_handler', handleNegative);

  // Set entry point
  graph.setEntryPoint('sentiment_analyzer');

  // Add conditional routing
  graph.addConditionalEdges('sentiment_analyzer', routeBySentiment, {
    positive_handler: 'positive_handler',
    neutral_handler: 'neutral_handler',
    negative_handler: 'negative_handler',
  });

  // All handlers are end states
  graph.setFinishPoint('positive_handler');
  graph.setFinishPoint('neutral_handler');
  graph.setFinishPoint('negative_handler');

  return graph.compile();
}

/**
 * Run conditional routing example
 */
export async function runConditionalRoutingExample(input: string) {
  logger.log('Starting conditional routing example', { input });

  const graph = createConditionalRoutingGraph();
  const result = await graph.invoke({ input });

  logger.log('Conditional routing complete', { sentiment: result.sentiment, route: result.metadata?.route });
  return result;
}

/**
 * Main entry point
 */
export async function main() {
  const examples = [
    'I love your product! It is amazing and works great.',
    'Can you tell me about your pricing plans?',
    'I am very frustrated with the service. It is terrible.',
  ];

  logger.log('Running conditional routing examples');

  for (const example of examples) {
    console.log('\n' + '='.repeat(60));
    console.log(`Input: "${example}"`);
    console.log('='.repeat(60));

    try {
      const result = await runConditionalRoutingExample(example);
      console.log(`\nSentiment: ${result.sentiment?.toUpperCase()}`);
      console.log(`Route: ${result.metadata?.route}`);
      console.log(`\nOutput: ${result.output}`);
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
