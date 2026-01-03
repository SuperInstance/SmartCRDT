/**
 * Cascade Router - Basic Usage Example
 *
 * This example demonstrates the fundamental usage of CascadeRouter for
 * intelligent query routing between local and cloud models.
 *
 * @package @lsi/cascade
 * @example
 */

import { CascadeRouter } from '@lsi/cascade';

/**
 * Example 1: Basic Routing Decision
 *
 * The router analyzes query complexity and determines whether to use
 * a local model (fast, free) or cloud model (powerful, paid).
 */
async function basicRoutingExample() {
  console.log('=== Example 1: Basic Routing ===\n');

  const router = new CascadeRouter({
    enableRefiner: true,
    enableCache: true,
    complexityThreshold: 0.7,
  });

  // Simple query - routes to local
  const simpleQuery = 'What is TypeScript?';
  const simpleDecision = await router.route(simpleQuery);

  console.log(`Query: "${simpleQuery}"`);
  console.log(`Route: ${simpleDecision.route}`);
  console.log(`Confidence: ${simpleDecision.confidence.toFixed(2)}`);
  console.log(`Est. Latency: ${simpleDecision.estimatedLatency}ms`);
  console.log(`Est. Cost: $${simpleDecision.estimatedCost.toFixed(4)}`);
  console.log(`Reason: ${simpleDecision.notes?.join(', ')}`);

  console.log('\n---\n');

  // Complex query - routes to cloud
  const complexQuery =
    'Explain the differences between structural typing in TypeScript and nominal typing in Java, including implications for type system design and tradeoffs in large-scale applications.';
  const complexDecision = await router.route(complexQuery);

  console.log(`Query: "${complexQuery}"`);
  console.log(`Route: ${complexDecision.route}`);
  console.log(`Confidence: ${complexDecision.confidence.toFixed(2)}`);
  console.log(`Est. Latency: ${complexDecision.estimatedLatency}ms`);
  console.log(`Est. Cost: $${complexDecision.estimatedCost.toFixed(4)}`);
  console.log(`Reason: ${complexDecision.notes?.join(', ')}`);
}

/**
 * Example 2: Routing with Context
 *
 * Provide additional context for better routing decisions.
 */
async function routingWithContextExample() {
  console.log('\n=== Example 2: Routing with Context ===\n');

  const router = new CascadeRouter();

  const decision = await router.route('Help me debug this error', {
    timestamp: Date.now(),
    sessionId: 'user-session-123',
    metadata: {
      previousQueries: 5,
      averageComplexity: 0.5,
    },
  });

  console.log(`Route: ${decision.route}`);
  console.log(`Confidence: ${decision.confidence.toFixed(2)}`);
  console.log(`Suggestions: ${decision.notes?.join(', ')}`);
}

/**
 * Example 3: Session-Based Routing
 *
 * The router maintains session context to detect patterns like
 * user cadence (typing speed) and motivation (emotional state).
 */
async function sessionRoutingExample() {
  console.log('\n=== Example 3: Session-Based Routing ===\n');

  const router = new CascadeRouter();
  const sessionId = 'demo-session-456';

  // Simulate a conversation
  const queries = [
    'What is a function?',
    'How do I declare variables?',
    'What about classes?',
    'Explain async/await',
    'How do I handle errors?',
  ];

  for (const query of queries) {
    const decision = await router.route(query, {
      sessionId,
      timestamp: Date.now(),
    });

    console.log(`"${query}"`);
    console.log(`  Route: ${decision.route} (confidence: ${decision.confidence.toFixed(2)})`);

    // Small delay to simulate real typing
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Get session context
  const sessionContext = router.getSessionContext();
  console.log(`\nSession stats:`);
  console.log(`  Total queries: ${sessionContext.getQueryCount()}`);
  console.log(`  Session duration: ${sessionContext.getSessionDuration()}ms`);
}

/**
 * Example 4: Error Handling
 *
 * Demonstrates proper error handling for routing operations.
 */
async function errorHandlingExample() {
  console.log('\n=== Example 4: Error Handling ===\n');

  const router = new CascadeRouter();

  try {
    // Valid query
    const decision = await router.route('What is AI?');
    console.log('✓ Routing successful:', decision.route);
  } catch (error) {
    console.error('✗ Routing failed:', error);

    // Handle specific error types
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    }
  }

  // Handling invalid input
  try {
    const decision = await router.route('');
    console.log('✓ Empty query handled:', decision.route);
  } catch (error) {
    console.error('✗ Empty query rejected:', error);
  }
}

/**
 * Example 5: Configuration Best Practices
 *
 * Recommended production configuration.
 */
async function productionConfigExample() {
  console.log('\n=== Example 5: Production Configuration ===\n');

  const router = new CascadeRouter({
    // Enable all features for production
    enableRefiner: true,
    enableCache: true,
    enableCostAware: true,
    enableHealthChecks: true,
    enableFallback: true,

    // Thresholds tuned for cost-quality balance
    complexityThreshold: 0.7,
    confidenceThreshold: 0.6,
    cacheSimilarityThreshold: 0.85,

    // Ollama configuration
    ollamaBaseURL: 'http://localhost:11434',
    ollamaModel: 'llama2',

    // Cache configuration
    cacheConfig: {
      maxSize: 1000,
      ttl: 300000, // 5 minutes
    },

    // Fallback strategy
    fallbackStrategy: {
      type: 'adaptive',
      maxRetries: 3,
    },
  });

  const decision = await router.route('Production query example');
  console.log('Production route:', decision.route);
  console.log('All features enabled');
}

/**
 * Example 6: Query Refinement
 *
 * The router can suggest improvements to user queries.
 */
async function queryRefinementExample() {
  console.log('\n=== Example 6: Query Refinement ===\n');

  const router = new CascadeRouter({
    enableRefiner: true,
  });

  const queries = [
    'ts func',
    'debug error',
    'help me code',
  ];

  for (const query of queries) {
    const decision = await router.route(query);
    console.log(`Original: "${query}"`);
    console.log(`Route: ${decision.route}`);
    console.log(`Notes: ${decision.notes?.join('; ')}`);

    if (decision.suggestBreakdown) {
      console.log('💡 Suggestion: Consider breaking this into smaller steps');
    }
    console.log();
  }
}

/**
 * Run all examples
 */
async function main() {
  try {
    await basicRoutingExample();
    await routingWithContextExample();
    await sessionRoutingExample();
    await errorHandlingExample();
    await productionConfigExample();
    await queryRefinementExample();

    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export {
  basicRoutingExample,
  routingWithContextExample,
  sessionRoutingExample,
  errorHandlingExample,
  productionConfigExample,
  queryRefinementExample,
};
