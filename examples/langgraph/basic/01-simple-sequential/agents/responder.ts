/**
 * Responder Agent
 *
 * Formulates the final response based on analysis
 */

import { SequentialState } from '../config.js';
import { createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('ResponderAgent');

/**
 * Responder agent implementation
 */
export async function respondAgent(state: SequentialState): Promise<Partial<SequentialState>> {
  logger.log('Formulating response', state.analyzed);

  // Simulate processing
  await delay(100);

  const parsed = state.parsed || {};
  const analyzed = state.analyzed || {};

  // Build contextual response
  let response = '';

  const topic = parsed.topic as string;
  const period = parsed.period as string;
  const type = parsed.type as string;

  // Start with context
  if (period) {
    response += `For ${period}, `;
  }

  // Add topic-specific insights
  switch (topic) {
    case 'sales':
      const trend = analyzed.trend as string;
      const growth = analyzed.growth as number;
      response += `sales data shows a ${trend} trend`;
      if (growth) {
        response += ` with ${growth}% growth`;
      }
      if (analyzed.regions) {
        response += ` across ${Array.isArray(analyzed.regions) ? analyzed.regions.length : 3} regions`;
      }
      break;

    case 'customer':
      const totalCustomers = analyzed.totalCustomers as number;
      const activeRate = analyzed.activeRate as number;
      response += `customer metrics indicate ${totalCustomers?.toLocaleString()} total customers`;
      if (activeRate) {
        response += ` with ${(activeRate * 100).toFixed(1)}% active rate`;
      }
      break;

    case 'product':
      const totalProducts = analyzed.totalProducts as number;
      const inventoryStatus = analyzed.inventoryStatus as string;
      response += `product catalog contains ${totalProducts} items`;
      if (inventoryStatus) {
        response += ` with ${inventoryStatus} inventory levels`;
      }
      break;

    default:
      const records = analyzed.records as number;
      response += `analysis of ${records || 'multiple'} records`;
  }

  // Add type-specific conclusion
  if (type === 'analysis') {
    response += '. Key findings have been identified and documented.';
  } else if (type === 'report') {
    response += '. A detailed report has been generated.';
  } else if (type === 'comparison' && analyzed.delta) {
    const delta = analyzed.delta as number;
    response += ` This represents a ${delta > 0 ? '+' : ''}${delta}% change from baseline.`;
  } else {
    response += '. Let me know if you need more specific information.';
  }

  logger.log('Response generated', { response });

  return {
    output: response,
    metadata: {
      ...state.metadata,
      responderCompleted: true,
    },
  };
}
