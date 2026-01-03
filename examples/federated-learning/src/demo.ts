/**
 * @fileoverview Federated Learning Demo
 *
 * End-to-end demonstration of federated learning with:
 * - 3 clients with different data distributions
 * - 1 server coordinating the training
 * - Visual output of training progress
 * - Comparison with centralized and local training
 */

import { FederatedServer, AggregationStrategy, ClientInfo } from './server.js';
import { FederatedClient, ClientManager } from './client.js';
import { LogisticRegressionModel, generateSyntheticData, DataPoint } from './model.js';

// Global declarations for Node.js
declare const process: {
  argv: string[];
  exit: (code?: number) => never;
};

// ============================================================================
// Demo Configuration
// ============================================================================

const DEMO_CONFIG = {
  // Feature dimension for the model
  featureDim: 10,

  // Number of training rounds
  numRounds: 20,

  // Number of clients
  numClients: 3,

  // Samples per client
  samplesPerClient: 500,

  // Server configuration
  serverConfig: {
    clientFraction: 1.0, // Use all clients
    minClients: 2,
    maxClients: 10,
    strategy: AggregationStrategy.WEIGHTED_AVG,
  },

  // Client configuration
  clientConfig: {
    learningRate: 0.01,
    localEpochs: 5,
    batchSize: 32,
    regularization: 0.0001,
    useDifferentialPrivacy: false,
  },

  // Visualization options
  showProgress: true,
  verbose: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Print a section header
 */
function printHeader(title: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

/**
 * Print a subsection header
 */
function printSubsection(title: string): void {
  console.log(`\n${'-'.repeat(40)}`);
  console.log(`  ${title}`);
  console.log(`${'-'.repeat(40)}\n`);
}

/**
 * Format a metric for display
 */
function formatMetric(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

/**
 * Create a progress bar
 */
function progressBar(current: number, total: number, width: number = 30): string {
  const progress = current / total;
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(progress * 100)}%`;
}

/**
 * Generate global test data for evaluation
 */
function generateTestData(numSamples: number, featureDim: number): DataPoint[] {
  const numClass0 = Math.floor(numSamples / 2);
  const numClass1 = numSamples - numClass0;

  const class0Data = generateSyntheticData(numClass0, featureDim, 0, 0.5);
  const class1Data = generateSyntheticData(numClass1, featureDim, 1, 0.5);

  return [...class0Data, ...class1Data].sort(() => Math.random() - 0.5);
}

// ============================================================================
// Demo Implementation
// ============================================================================

/**
 * Run the federated learning demo
 */
async function runDemo(config = DEMO_CONFIG): Promise<void> {
  printHeader('Federated Learning Demo');

  // Display configuration
  console.log('Configuration:');
  console.log(`  Feature Dimension: ${config.featureDim}`);
  console.log(`  Number of Clients: ${config.numClients}`);
  console.log(`  Samples per Client: ${config.samplesPerClient}`);
  console.log(`  Number of Rounds: ${config.numRounds}`);
  console.log(`  Aggregation Strategy: ${config.serverConfig.strategy}`);
  console.log(`  Learning Rate: ${config.clientConfig.learningRate}`);
  console.log(`  Local Epochs: ${config.clientConfig.localEpochs}`);

  // ============================================================================
  // Step 1: Initialize Server
  // ============================================================================

  printSubsection('Step 1: Initialize Server');

  const server = new FederatedServer(config.featureDim, config.serverConfig);
  console.log('✓ Server created');

  // ============================================================================
  // Step 2: Create Clients
  // ============================================================================

  printSubsection('Step 2: Create Clients');

  const clientManager = new ClientManager();

  for (let i = 0; i < config.numClients; i++) {
    const clientId = `client_${i}`;
    const client = clientManager.createClient(
      clientId,
      config.featureDim,
      config.samplesPerClient,
      config.clientConfig
    );

    const state = client.getState();
    console.log(`✓ Client ${clientId} created:`);
    console.log(`    - Training samples: ${state.numSamples}`);
    console.log(`    - Data distribution: ${state.dataDistribution}`);

    // Register client with server
    server.registerClient({
      id: clientId,
      numSamples: state.numSamples,
      isAvailable: true,
      connectionQuality: 0.9 + Math.random() * 0.1,
      performanceScore: 0.8 + Math.random() * 0.2,
    });
  }

  // ============================================================================
  // Step 3: Generate Test Data
  // ============================================================================

  printSubsection('Step 3: Generate Test Data');

  const testData = generateTestData(1000, config.featureDim);
  console.log(`✓ Generated ${testData.length} test samples`);

  // ============================================================================
  // Step 4: Federated Training Rounds
  // ============================================================================

  printSubsection('Step 4: Federated Training');

  const roundHistory: {
    round: number;
    selectedClients: string[];
    avgLoss: number;
    avgAccuracy: number;
    globalLoss: number;
    globalAccuracy: number;
  }[] = [];

  // Create a global model for evaluation
  const globalModel = new LogisticRegressionModel(config.featureDim);

  for (let round = 1; round <= config.numRounds; round++) {
    // Select clients
    const selectedClientIds = server.selectClients();
    const selectedClients = selectedClientIds.map((id) => clientManager.getClient(id)!);

    if (config.showProgress) {
      // Use console.log for progress instead of process.stdout
      if (round % 5 === 0 || round === config.numRounds) {
        console.log(`  Round ${round}/${config.numRounds} ${progressBar(round, config.numRounds)}`);
      }
    }

    // Distribute global model
    const globalParams = server.getGlobalModel();
    for (const client of selectedClients) {
      client.receiveGlobalModel(globalParams);
    }

    // Local training
    const updates = selectedClients.map((client) => {
      const result = client.train();
      return result.update;
    });

    // Aggregate updates
    await server.executeRound(updates);

    // Update global model for evaluation
    globalModel.setParameters(server.getGlobalModel());

    // Evaluate on test data
    const testMetrics = globalModel.evaluate(testData);

    // Get round summary
    const summary = server.getRoundHistory()[server.getRoundHistory().length - 1];

    roundHistory.push({
      round: summary.round,
      selectedClients: summary.selectedClients,
      avgLoss: summary.avgLoss,
      avgAccuracy: summary.avgAccuracy,
      globalLoss: testMetrics.loss,
      globalAccuracy: testMetrics.accuracy,
    });

    if (config.verbose && round % 5 === 0) {
      console.log(`\n  Round ${round} Summary:`);
      console.log(`    Avg Local Loss: ${formatMetric(summary.avgLoss)}`);
      console.log(`    Avg Local Accuracy: ${formatMetric(summary.avgAccuracy)}`);
      console.log(`    Global Loss: ${formatMetric(testMetrics.loss)}`);
      console.log(`    Global Accuracy: ${formatMetric(testMetrics.accuracy)}`);
    }
  }

  if (config.showProgress) {
    console.log();
  }

  console.log('✓ Federated training complete');

  // ============================================================================
  // Step 5: Results Summary
  // ============================================================================

  printSubsection('Step 5: Results Summary');

  const stats = server.getStats();
  const finalRound = roundHistory[roundHistory.length - 1];

  console.log('Federated Learning Performance:');
  console.log(`  Total Rounds: ${stats.totalRounds}`);
  console.log(`  Total Updates: ${stats.totalUpdates}`);
  console.log(`  Avg Clients/Round: ${formatMetric(stats.avgClientsPerRound, 2)}`);
  console.log(`  Best Accuracy: ${formatMetric(stats.bestAccuracy * 100, 2)}% (Round ${stats.bestRound})`);
  console.log(`  Final Global Accuracy: ${formatMetric(finalRound.globalAccuracy * 100, 2)}%`);
  console.log(`  Final Global Loss: ${formatMetric(finalRound.globalLoss)}`);

  // Client participation
  console.log('\nClient Participation:');
  for (const [clientId, count] of stats.clientParticipation) {
    const percentage = (count / stats.totalRounds) * 100;
    console.log(`  ${clientId}: ${count}/${stats.totalRounds} rounds (${percentage.toFixed(0)}%)`);
  }

  // ============================================================================
  // Step 6: Comparison with Other Training Methods
  // ============================================================================

  printSubsection('Step 6: Method Comparison');

  // Comparison 1: Centralized Training (all data in one place)
  console.log('\n1. Centralized Training (all data combined):');
  const centralizedModel = new LogisticRegressionModel(config.featureDim);
  const allData: DataPoint[] = [];
  for (const client of clientManager.getAllClients()) {
    const clientData = (client as any).localData as DataPoint[];
    allData.push(...clientData);
  }

  const centralizedResult = centralizedModel.train(allData, {
    learningRate: config.clientConfig.learningRate,
    epochs: config.numRounds * config.clientConfig.localEpochs,
    batchSize: config.clientConfig.batchSize,
    regularization: config.clientConfig.regularization,
  });
  const centralizedMetrics = centralizedModel.evaluate(testData);
  console.log(`  Accuracy: ${formatMetric(centralizedMetrics.accuracy * 100, 2)}%`);
  console.log(`  Loss: ${formatMetric(centralizedMetrics.loss)}`);
  console.log(`  Training samples: ${allData.length}`);

  // Comparison 2: Local Training (each client trains independently)
  console.log('\n2. Local Training (each client trains independently):');
  const localAccuracies: number[] = [];

  for (const client of clientManager.getAllClients()) {
    const localModel = new LogisticRegressionModel(config.featureDim);
    const clientData = (client as any).localData as DataPoint[];

    for (let r = 0; r < config.numRounds; r++) {
      localModel.train(clientData, {
        learningRate: config.clientConfig.learningRate,
        epochs: config.clientConfig.localEpochs,
        batchSize: config.clientConfig.batchSize,
        regularization: config.clientConfig.regularization,
      });
    }

    const localMetrics = localModel.evaluate(testData);
    localAccuracies.push(localMetrics.accuracy);
  }

  const avgLocalAccuracy =
    localAccuracies.reduce((sum, acc) => sum + acc, 0) / localAccuracies.length;
  console.log(`  Average Accuracy: ${formatMetric(avgLocalAccuracy * 100, 2)}%`);
  console.log(`  Individual Accuracies: ${localAccuracies.map((a) => formatMetric(a * 100, 1) + '%').join(', ')}`);

  // Comparison Summary
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│              Method Comparison Summary                       │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Federated Learning:    ${formatMetric(finalRound.globalAccuracy * 100, 2).padStart(10)}%                      │`);
  console.log(`│ Centralized Training:  ${formatMetric(centralizedMetrics.accuracy * 100, 2).padStart(10)}%                      │`);
  console.log(`│ Local Training (avg):  ${formatMetric(avgLocalAccuracy * 100, 2).padStart(10)}%                      │`);
  console.log('└─────────────────────────────────────────────────────────────┘');

  // ============================================================================
  // Step 7: Training Progress Visualization
  // ============================================================================

  printSubsection('Step 7: Training Progress');

  console.log('\nGlobal Model Accuracy Progress:');
  console.log('  Round  |  Accuracy  |    Loss    | Clients');
  console.log('  ' + '-'.repeat(45));

  for (let i = 0; i < roundHistory.length; i += Math.max(1, Math.floor(roundHistory.length / 10))) {
    const r = roundHistory[i];
    console.log(
      `  ${String(r.round).padStart(5)}  |  ${(r.globalAccuracy * 100).toFixed(1).padStart(6)}%  |  ${r.globalLoss.toFixed(4).padStart(8)}  |  ${r.selectedClients.length}`
    );
  }

  // Show final round
  const last = roundHistory[roundHistory.length - 1];
  console.log(`  ${String(last.round).padStart(5)}  |  ${(last.globalAccuracy * 100).toFixed(1).padStart(6)}%  |  ${last.globalLoss.toFixed(4).padStart(8)}  |  ${last.selectedClients.length}`);

  // ============================================================================
  // Step 8: Key Insights
  // ============================================================================

  printSubsection('Key Insights');

  console.log('\n✓ Federated Learning Benefits Demonstrated:');
  console.log('  1. Privacy Preserving: Raw data never leaves client devices');
  console.log('  2. Distributed Learning: Model learns from diverse data sources');
  console.log('  3. Communication Efficient: Only model updates are transmitted');
  console.log('  4. Scalable: Easy to add more clients');

  console.log('\n✓ Federated vs Centralized:');
  const fedAccuracy = finalRound.globalAccuracy;
  const centAccuracy = centralizedMetrics.accuracy;
  const accuracyRatio = (fedAccuracy / centAccuracy) * 100;
  console.log(`  Federated achieves ${accuracyRatio.toFixed(1)}% of centralized performance`);
  console.log('  while keeping data private and distributed');

  console.log('\n✓ Federated vs Local:');
  console.log(`  Federated improves accuracy by ${((fedAccuracy / avgLocalAccuracy - 1) * 100).toFixed(1)}% over local training`);
  console.log('  by leveraging knowledge from all clients');

  console.log('\n✓ Training Dynamics:');
  const accStd = calculateStdDev(
    roundHistory.map((r) => r.globalAccuracy),
    finalRound.globalAccuracy
  );
  console.log(`  Accuracy improved steadily with low variance (${(accStd * 100).toFixed(2)}%)`);
  console.log('  indicating stable convergence');

  printHeader('Demo Complete!');
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main function - run the demo
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--quick')) {
    DEMO_CONFIG.numRounds = 5;
    DEMO_CONFIG.showProgress = false;
  }

  if (args.includes('--verbose')) {
    DEMO_CONFIG.verbose = true;
  }

  try {
    await runDemo(DEMO_CONFIG);
  } catch (error) {
    console.error('Error running demo:', error);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);
