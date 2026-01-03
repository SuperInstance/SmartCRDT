/**
 * Parser Agent
 *
 * Extracts key information from the input
 */

import { SequentialState } from '../config.js';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('ParserAgent');

/**
 * Parse agent implementation
 */
export async function parseAgent(state: SequentialState): Promise<Partial<SequentialState>> {
  logger.log('Parsing input', { input: state.input });

  // Simulate processing
  await delay(100);

  // Extract key information using simple pattern matching
  const input = state.input.toLowerCase();
  const parsed: Record<string, unknown> = {
    originalInput: state.input,
    timestamp: Date.now(),
  };

  // Detect topic
  if (input.includes('sales') || input.includes('revenue')) {
    parsed.topic = 'sales';
  } else if (input.includes('customer') || input.includes('user')) {
    parsed.topic = 'customer';
  } else if (input.includes('product') || input.includes('item')) {
    parsed.topic = 'product';
  } else {
    parsed.topic = 'general';
  }

  // Detect time period
  const periodMatch = input.match(/(q[1-4]\s*2024|2024|last month|this week|today)/i);
  if (periodMatch) {
    parsed.period = periodMatch[1];
  }

  // Detect action type
  if (input.includes('analyze') || input.includes('analysis')) {
    parsed.type = 'analysis';
  } else if (input.includes('report') || input.includes('summary')) {
    parsed.type = 'report';
  } else if (input.includes('compare')) {
    parsed.type = 'comparison';
  } else {
    parsed.type = 'query';
  }

  logger.log('Parsed successfully', parsed);

  return {
    parsed,
    metadata: {
      ...state.metadata,
      parserCompleted: true,
    },
  };
}
