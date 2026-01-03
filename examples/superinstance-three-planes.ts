/**
 * SuperInstance Three-Planes Example
 *
 * This example demonstrates the complete SuperInstance architecture with:
 * 1. Context Plane - Sovereign memory and knowledge retrieval
 * 2. Intention Plane - Intent encoding and model selection
 * 3. LucidDreamer - Metabolic learning and hypothesis generation
 *
 * @package @lsi/superinstance
 * @example
 */

import {
  SuperInstance,
  ContextPlane,
  IntentionPlane,
  LucidDreamer,
  type SuperInstanceConfig,
  type ContextPlaneConfig,
  type IntentionPlaneConfig,
  type LucidDreamerConfig,
} from '@lsi/superinstance';

/**
 * Example 1: Basic SuperInstance Initialization
 *
 * Initialize SuperInstance with all three planes enabled.
 */
async function basicInitializationExample() {
  console.log('=== Example 1: Basic SuperInstance Initialization ===\n');

  const config: SuperInstanceConfig = {
    // Enable all three planes
    contextPlane: true,
    intentionPlane: true,
    lucidDreamer: true,

    // Context plane configuration
    contextConfig: {
      enableVectorSearch: true,
      enableKnowledgeGraph: true,
      maxContextItems: 100,
      contextWindowSize: 4096,
    } as ContextPlaneConfig,

    // Intention plane configuration
    intentionConfig: {
      enableIntentEncoding: true,
      enablePrivacyClassification: true,
      embeddingDimension: 768,
      enableDifferentialPrivacy: true,
      epsilon: 1.0,
    } as IntentionPlaneConfig,

    // LucidDreamer configuration
    lucidDreamerConfig: {
      enableHypothesisGeneration: true,
      enableORPOTraining: true,
      hypothesisCount: 5,
      confidenceThreshold: 0.7,
      trainingDataPath: './training-data',
    } as LucidDreamerConfig,
  };

  const instance = new SuperInstance(config);

  try {
    await instance.initialize();

    console.log('✓ SuperInstance initialized successfully');
    console.log(`  Context Plane: ${instance.isContextPlaneReady() ? 'Ready' : 'Not Ready'}`);
    console.log(`  Intention Plane: ${instance.isIntentionPlaneReady() ? 'Ready' : 'Not Ready'}`);
    console.log(`  LucidDreamer: ${instance.isLucidDreamerReady() ? 'Ready' : 'Not Ready'}`);

    return instance;
  } catch (error) {
    console.error('✗ Initialization failed:', error);
    throw error;
  }
}

/**
 * Example 2: Context Plane Usage
 *
 * Store and retrieve context using the Context Plane.
 */
async function contextPlaneExample() {
  console.log('\n=== Example 2: Context Plane Usage ===\n');

  const contextPlane = new ContextPlane({
    enableVectorSearch: true,
    enableKnowledgeGraph: true,
    maxContextItems: 1000,
  });

  await contextPlane.initialize();

  // Add context items
  console.log('Adding context items...');

  await contextPlane.addContext({
    id: 'ctx-1',
    content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
    type: 'knowledge',
    metadata: {
      domain: 'programming',
      language: 'typescript',
      timestamp: Date.now(),
    },
  });

  await contextPlane.addContext({
    id: 'ctx-2',
    content: 'React is a JavaScript library for building user interfaces.',
    type: 'knowledge',
    metadata: {
      domain: 'web',
      library: 'react',
      timestamp: Date.now(),
    },
  });

  console.log('✓ Added 2 context items');

  // Retrieve context for a query
  const query = 'What is TypeScript?';
  const context = await contextPlane.getContext(query, {
    maxItems: 5,
    similarityThreshold: 0.7,
  });

  console.log(`\nRetrieved context for: "${query}"`);
  console.log(`  Found ${context.items.length} relevant items`);

  context.items.forEach((item, index) => {
    console.log(`    ${index + 1}. ${item.content.substring(0, 80)}...`);
    console.log(`       Similarity: ${item.similarity.toFixed(3)}`);
  });

  // Get statistics
  const stats = contextPlane.getStats();
  console.log(`\nContext Plane Statistics:`);
  console.log(`  Total Items: ${stats.totalItems}`);
  console.log(`  Total Queries: ${stats.totalQueries}`);
  console.log(`  Avg Retrieval Time: ${stats.avgRetrievalTime.toFixed(2)}ms`);
}

/**
 * Example 3: Intention Plane Usage
 *
 * Encode queries as intent vectors for privacy-preserving routing.
 */
async function intentionPlaneExample() {
  console.log('\n=== Example 3: Intention Plane Usage ===\n');

  const intentionPlane = new IntentionPlane({
    enableIntentEncoding: true,
    enablePrivacyClassification: true,
    embeddingDimension: 768,
    enableDifferentialPrivacy: true,
    epsilon: 1.0,
  });

  await intentionPlane.initialize();

  // Classify privacy level
  const query = 'My email is user@example.com, help me reset my password';

  const classification = await intentionPlane.classify(query);

  console.log(`Query: "${query}"`);
  console.log('\nPrivacy Classification:');
  console.log(`  Level: ${classification.level}`);
  console.log(`  Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
  console.log(`  PII Types: ${classification.piiTypes.join(', ')}`);
  console.log(`  Recommendation: ${classification.recommendedAction}`);

  // Encode as intent vector
  const intent = await intentionPlane.encodeIntent(query);

  console.log('\nIntent Encoding:');
  console.log(`  Vector Dimensions: ${intent.length}`);
  console.log(`  First 5 values: [${intent.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

  // Route based on intent
  const routingDecision = await intentionPlane.route(query, {
    availableModels: ['local-llama', 'cloud-gpt4'],
    complexityThreshold: 0.7,
  });

  console.log('\nRouting Decision:');
  console.log(`  Selected Model: ${routingDecision.model}`);
  console.log(`  Backend: ${routingDecision.backend}`);
  console.log(`  Confidence: ${routingDecision.confidence.toFixed(2)}`);
  console.log(`  Reason: ${routingDecision.reason}`);

  // Get privacy budget
  const budget = intentionPlane.getPrivacyBudget();
  console.log('\nPrivacy Budget:');
  console.log(`  Remaining: ε = ${budget.epsilon.toFixed(3)}`);
  console.log(`  Initial: ε = ${budget.initialEpsilon.toFixed(3)}`);
  console.log(`  Consumed: ε = ${(budget.initialEpsilon - budget.epsilon).toFixed(3)}`);
}

/**
 * Example 4: LucidDreamer Hypothesis Generation
 *
 * Generate and test hypotheses using LucidDreamer.
 */
async function lucidDreamerExample() {
  console.log('\n=== Example 4: LucidDreamer Hypothesis Generation ===\n');

  const lucidDreamer = new LucidDreamer({
    enableHypothesisGeneration: true,
    enableORPOTraining: true,
    hypothesisCount: 5,
    confidenceThreshold: 0.7,
    trainingDataPath: './training-data',
  });

  await lucidDreamer.initialize();

  // Generate hypotheses
  const observation = {
    query: 'Users are experiencing high latency on database queries',
    metrics: {
      latency: 500, // ms
      throughput: 100, // queries/sec
      errorRate: 0.05,
    },
  };

  const hypotheses = await lucidDreamer.generateHypotheses(observation);

  console.log('Generated Hypotheses:');
  hypotheses.forEach((hypothesis, index) => {
    console.log(`\n  ${index + 1}. ${hypothesis.statement}`);
    console.log(`     Confidence: ${(hypothesis.confidence * 100).toFixed(1)}%`);
    console.log(`     Expected Impact: ${hypothesis.expectedImpact}`);
    console.log(`     Actionability: ${hypothesis.actionability}`);
    console.log(`     Suggested Action: ${hypothesis.suggestedAction}`);
  });

  // Test a hypothesis
  if (hypotheses.length > 0) {
    const topHypothesis = hypotheses[0];
    const testResult = await lucidDreamer.testHypothesis(topHypothesis, {
      duration: 60000, // 1 minute
      sampleSize: 1000,
    });

    console.log('\n--- Hypothesis Testing Results ---');
    console.log(`  Hypothesis: ${testResult.hypothesis.statement}`);
    console.log(`  Validated: ${testResult.validated ? '✓ Yes' : '✗ No'}`);
    console.log(`  Confidence: ${(testResult.confidence * 100).toFixed(1)}%`);
    console.log(`  Improvement: ${testResult.improvement.toFixed(1)}%`);

    if (testResult.validated) {
      console.log(`  Action: Deploy to production`);
    } else {
      console.log(`  Action: Discard hypothesis`);
    }
  }
}

/**
 * Example 5: End-to-End Query Processing
 *
 * Process a query through all three planes.
 */
async function endToEndProcessingExample() {
  console.log('\n=== Example 5: End-to-End Query Processing ===\n');

  const instance = new SuperInstance({
    contextPlane: true,
    intentionPlane: true,
    lucidDreamer: false, // Disable for this example
  });

  await instance.initialize();

  const query = 'How do I optimize database queries in TypeScript?';

  console.log(`Processing Query: "${query}"\n`);

  // Step 1: Intention Plane - Classify and route
  console.log('Step 1: Intention Plane');
  const classification = await instance.intentionPlane!.classify(query);
  const intent = await instance.intentionPlane!.encodeIntent(query);

  console.log(`  Privacy Level: ${classification.level}`);
  console.log(`  Intent Vector: [${intent.length} dimensions]`);

  // Step 2: Context Plane - Retrieve relevant context
  console.log('\nStep 2: Context Plane');
  const context = await instance.contextPlane!.getContext(query, {
    maxItems: 3,
  });

  console.log(`  Retrieved ${context.items.length} context items`);
  context.items.forEach((item, index) => {
    console.log(`    ${index + 1}. ${item.content.substring(0, 60)}...`);
  });

  // Step 3: Generate response (simulated)
  console.log('\nStep 3: Response Generation');
  console.log('  Response: To optimize database queries in TypeScript...');
  console.log('  1. Use parameterized queries to prevent SQL injection');
  console.log('  2. Implement proper indexing on frequently queried columns');
  console.log('  3. Use connection pooling to manage database connections');
  console.log('  4. Consider using an ORM like TypeORM or Prisma');

  // Step 4: Learn from interaction (if LucidDreamer enabled)
  console.log('\nStep 4: Learning');
  console.log('  Interaction logged for future learning');
}

/**
 * Example 6: Privacy-Preserving Query
 *
 * Process a sensitive query with full privacy protection.
 */
async function privacyPreservingQueryExample() {
  console.log('\n=== Example 6: Privacy-Preserving Query ===\n');

  const instance = new SuperInstance({
    contextPlane: true,
    intentionPlane: true,
    lucidDreamer: false,
    intentionConfig: {
      enableIntentEncoding: true,
      enablePrivacyClassification: true,
      enableDifferentialPrivacy: true,
      epsilon: 1.0,
    },
  });

  await instance.initialize();

  const sensitiveQuery = 'My SSN is 123-45-6789, help me file my taxes';

  console.log(`Sensitive Query: "${sensitiveQuery}"\n`);

  // Classify privacy level
  const classification = await instance.intentionPlane!.classify(sensitiveQuery);
  console.log(`Privacy Level: ${classification.level}`);
  console.log(`PII Detected: ${classification.piiTypes.join(', ')}`);

  // Route based on privacy
  if (classification.level === 'SECRET' || classification.level === 'CONFIDENTIAL') {
    console.log('\n✓ Routing to LOCAL model (privacy-sensitive)');
    console.log('  No data leaves the device');

    const response = await instance.query(sensitiveQuery, {
      forceLocal: true,
    });

    console.log(`\nResponse: ${response.content}`);
    console.log(`Source: ${response.metadata.source}`);
  } else {
    console.log('\n✓ Safe to route through cloud with intent encoding');

    const intent = await instance.intentionPlane!.encodeIntent(sensitiveQuery);
    console.log(`  Intent vector: [${intent.length} dimensions]`);
    console.log('  Original text never leaves device');
  }
}

/**
 * Example 7: Knowledge Graph Integration
 *
 * Use the knowledge graph to understand codebase relationships.
 */
async function knowledgeGraphExample() {
  console.log('\n=== Example 7: Knowledge Graph Integration ===\n');

  const contextPlane = new ContextPlane({
    enableKnowledgeGraph: true,
    enableVectorSearch: true,
  });

  await contextPlane.initialize();

  // Add code entities to knowledge graph
  const codeEntities = [
    {
      id: 'entity-1',
      type: 'function',
      name: 'calculateTotal',
      file: 'utils/math.ts',
      dependencies: ['calculateTax', 'applyDiscount'],
    },
    {
      id: 'entity-2',
      type: 'class',
      name: 'UserService',
      file: 'services/user.ts',
      dependencies: ['Database', 'Cache'],
    },
    {
      id: 'entity-3',
      type: 'function',
      name: 'calculateTax',
      file: 'utils/tax.ts',
      dependencies: [],
    },
  ];

  for (const entity of codeEntities) {
    await contextPlane.addContext({
      id: entity.id,
      content: `${entity.type}: ${entity.name} (${entity.file})`,
      type: 'code',
      metadata: entity,
    });
  }

  console.log('✓ Added code entities to knowledge graph');

  // Query the knowledge graph
  const query = 'How do I use calculateTotal?';
  const result = await contextPlane.queryKnowledgeGraph(query);

  console.log('\nKnowledge Graph Query Results:');
  console.log(`  Found ${result.nodes.length} related nodes`);

  result.nodes.forEach((node, index) => {
    console.log(`    ${index + 1}. ${node.type}: ${node.name}`);
    console.log(`       File: ${node.file}`);
    if (node.dependencies.length > 0) {
      console.log(`       Dependencies: ${node.dependencies.join(', ')}`);
    }
  });

  // Get impact analysis
  const impact = await contextPlane.analyzeImpact('calculateTotal');

  console.log('\nImpact Analysis for calculateTotal:');
  console.log(`  Direct Dependents: ${impact.directDependents.length}`);
  console.log(`  Total Dependents: ${impact.totalDependents}`);
  console.log(`  Risk Level: ${impact.riskLevel}`);

  if (impact.directDependents.length > 0) {
    console.log('  Affected Components:');
    impact.directDependents.forEach(dep => {
      console.log(`    - ${dep}`);
    });
  }
}

/**
 * Example 8: ORPO Training with LucidDreamer
 *
 * Train models using offline reinforcement learning.
 */
async orpoTrainingExample() {
  console.log('\n=== Example 8: ORPO Training ===\n');

  const lucidDreamer = new LucidDreamer({
    enableORPOTraining: true,
    trainingDataPath: './training-data',
    modelOutputPath: './models',
  });

  await lucidDreamer.initialize();

  // Prepare training data
  const trainingData = {
    preferences: [
      {
        query: 'What is TypeScript?',
        chosen: 'TypeScript is a strongly typed programming language...',
        rejected: 'TypeScript is good.',
      },
      {
        query: 'How do I optimize queries?',
        chosen: 'To optimize database queries, use indexes, avoid N+1 queries...',
        rejected: 'Use indexes.',
      },
    ],
    metadata: {
      source: 'shadow-logs',
      timestamp: Date.now(),
      privacyFiltered: true,
    },
  };

  console.log('Preparing ORPO training...');
  console.log(`  Training pairs: ${trainingData.preferences.length}`);

  // Start training (simulated)
  const trainingConfig = {
    epochs: 3,
    learningRate: 1e-5,
    batchSize: 8,
    validationSplit: 0.2,
  };

  console.log('\nTraining Configuration:');
  console.log(`  Epochs: ${trainingConfig.epochs}`);
  console.log(`  Learning Rate: ${trainingConfig.learningRate}`);
  console.log(`  Batch Size: ${trainingConfig.batchSize}`);

  const trainingProgress = await lucidDreamer.trainORPO(trainingData, trainingConfig);

  console.log('\nTraining Progress:');
  console.log(`  Status: ${trainingProgress.status}`);
  console.log(`  Epoch: ${trainingProgress.currentEpoch}/${trainingProgress.totalEpochs}`);
  console.log(`  Loss: ${trainingProgress.loss.toFixed(4)}`);
  console.log(`  Reward: ${trainingProgress.reward.toFixed(4)}`);

  if (trainingProgress.status === 'completed') {
    console.log('\n✓ Training completed successfully');
    console.log(`  Model saved to: ${trainingProgress.modelPath}`);
  }
}

/**
 * Example 9: Production Configuration
 *
 * Recommended production setup for SuperInstance.
 */
async function productionConfigExample() {
  console.log('\n=== Example 9: Production Configuration ===\n');

  const config: SuperInstanceConfig = {
    // Enable all planes
    contextPlane: true,
    intentionPlane: true,
    lucidDreamer: true,

    // Context plane - optimized for production
    contextConfig: {
      enableVectorSearch: true,
      enableKnowledgeGraph: true,
      maxContextItems: 10000,
      contextWindowSize: 8192,
      cacheEnabled: true,
      cacheSize: 1000,
    } as ContextPlaneConfig,

    // Intention plane - privacy-first
    intentionConfig: {
      enableIntentEncoding: true,
      enablePrivacyClassification: true,
      enableDifferentialPrivacy: true,
      epsilon: 1.0,
      delta: 1e-5,
      embeddingDimension: 768,
      enableCache: true,
    } as IntentionPlaneConfig,

    // LucidDreamer - metabolic learning
    lucidDreamerConfig: {
      enableHypothesisGeneration: true,
      enableORPOTraining: true,
      hypothesisCount: 5,
      confidenceThreshold: 0.7,
      trainingDataPath: './data/training',
      modelOutputPath: './models',
      enableShadowLogging: true,
    } as LucidDreamerConfig,
  };

  const instance = new SuperInstance(config);

  try {
    await instance.initialize();

    console.log('✓ SuperInstance production configuration loaded');
    console.log('\nFeatures:');
    console.log('  Context Plane: Vector search + Knowledge graph + Cache');
    console.log('  Intention Plane: Intent encoding + Differential privacy');
    console.log('  LucidDreamer: Hypothesis generation + ORPO training');

    const healthCheck = await instance.healthCheck();

    console.log('\nHealth Check:');
    console.log(`  Overall: ${healthCheck.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log(`  Context Plane: ${healthCheck.components.contextPlane ? '✓' : '✗'}`);
    console.log(`  Intention Plane: ${healthCheck.components.intentionPlane ? '✓' : '✗'}`);
    console.log(`  LucidDreamer: ${healthCheck.components.lucidDreamer ? '✓' : '✗'}`);

    return instance;
  } catch (error) {
    console.error('✗ Production initialization failed:', error);
    throw error;
  }
}

/**
 * Run all examples
 */
async function main() {
  try {
    await basicInitializationExample();
    await contextPlaneExample();
    await intentionPlaneExample();
    await lucidDreamerExample();
    await endToEndProcessingExample();
    await privacyPreservingQueryExample();
    await knowledgeGraphExample();
    await orpoTrainingExample();
    await productionConfigExample();

    console.log('\n=== All SuperInstance Examples Completed ===');
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
  basicInitializationExample,
  contextPlaneExample,
  intentionPlaneExample,
  lucidDreamerExample,
  endToEndProcessingExample,
  privacyPreservingQueryExample,
  knowledgeGraphExample,
  orpoTrainingExample,
  productionConfigExample,
};
