import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { ORPOLearner } from '@lsi/superinstance';
import { RewardModel } from '@lsi/superinstance';
import { PolicyGradientModel } from '@lsi/superinstance';
import { DataLoader } from '@lsi/superinstance';
import { ExperienceReplayer } from '@lsi/superinstance';
import { HyperparameterOptimizer } from '@lsi/superinstance';
import type { TrainingResult, Policy, Experience, Reward, Hyperparameters } from '@lsi/protocol';

describe('ORPO Training Integration Test Suite', () => {
  let orpoLearner: ORPOLearner;
  let rewardModel: RewardModel;
  let policyGradientModel: PolicyGradientModel;
  let dataLoader: DataLoader;
  let experienceReplayer: ExperienceReplayer;
  let hyperparameterOptimizer: HyperparameterOptimizer;

  beforeAll(async () => {
    // Initialize reward model
    rewardModel = new RewardModel({
      type: 'lm-based',
      model: 'mock-reward-model',
      tokenizer: 'mock-tokenizer',
      device: 'cpu'
    });

    // Initialize policy gradient model
    policyGradientModel = new PolicyGradientModel({
      model: 'mock-policy-model',
      policyType: 'transformer',
      hiddenSize: 768,
      numLayers: 12
    });

    // Initialize data loader
    dataLoader = new DataLoader({
      batchSize: 32,
      shuffle: true,
      numWorkers: 2,
      pinMemory: false
    });

    // Initialize experience replayer
    experienceReplayer = new ExperienceReplayer({
      replayBuffer: new Map(),
      maxBufferSize: 10000,
      sampleStrategy: 'prioritized',
      alpha: 0.6,
      beta: 0.4
    });

    // Initialize hyperparameter optimizer
    hyperparameterOptimizer = new HyperparameterOptimizer({
      optimizationMethod: 'bayesian',
      nTrials: 50,
      direction: 'maximize'
    });

    // Initialize ORPO learner
    orpoLearner = new ORPOLearner({
      learningRate: 0.001,
      batchSize: 32,
      numEpochs: 3,
      warmupSteps: 100,
      maxGradNorm: 1.0,
      rewardModel,
      policyGradientModel,
      dataLoader,
      experienceReplayer,
      hyperparameterOptimizer
    });

    // Initialize all components
    await rewardModel.initialize();
    await policyGradientModel.initialize();
    await dataLoader.initialize();
    await experienceReplayer.initialize();
    await hyperparameterOptimizer.initialize();
    await orpoLearner.initialize();
  });

  afterAll(async () => {
    await orpoLearner.close();
    await rewardModel.close();
    await policyGradientModel.close();
    await dataLoader.close();
    await experienceReplayer.close();
    await hyperparameterOptimizer.close();
  });

  beforeEach(async () => {
    // Clear experience buffer
    await experienceReplayer.clearBuffer();
    // Reset policy
    await orpoLearner.resetPolicy();
  });

  describe('ORPO Training Pipeline', () => {
    it('should perform end-to-end ORPO training', async () => {
      // Arrange
      const trainingData = await generateTrainingData(100);

      // Act
      const trainingResult: TrainingResult = await orpoLearner.train(trainingData);

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.loss).toBeGreaterThan(0);
      expect(trainingResult.accuracy).toBeGreaterThan(0.5);
      expect(trainingResult.reward).toBeGreaterThan(0);
      expect(trainingResult.policyUpdated).toBe(true);
      expect(trainingResult.epochResults).toBeDefined();
      expect(trainingResult.epochResults.length).toBeGreaterThan(0);

      // Check each epoch result
      trainingResult.epochResults.forEach(epoch => {
        expect(epoch.loss).toBeGreaterThan(0);
        expect(epoch.accuracy).toBeGreaterThan(0);
        expect(epoch.reward).toBeGreaterThan(0);
      });
    });

    it('should train with multiple epochs and track progress', async () => {
      // Arrange
      const trainingData = await generateTrainingData(200);
      const numEpochs = 5;

      // Act
      const trainingResult = await orpoLearner.train(
        trainingData,
        { numEpochs, validateEvery: 2 }
      );

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.epochResults.length).toBe(numEpochs);

      // Loss should generally decrease over epochs
      const losses = trainingResult.epochResults.map(e => e.loss);
      for (let i = 1; i < losses.length; i++) {
        expect(losses[i]).toBeLessThanOrEqual(losses[i - 1] * 1.1); // Allow some fluctuation
      }

      // Accuracy should generally improve
      const accuracies = trainingResult.epochResults.map(e => e.accuracy);
      for (let i = 1; i < accuracies.length; i++) {
        expect(accuracies[i]).toBeGreaterThanOrEqual(accuracies[i - 1] - 0.1);
      }
    });

    it('should handle mini-batch training efficiently', async () => {
      // Arrange
      const trainingData = await generateTrainingData(500);
      const batchSize = 64;

      // Act
      const trainingResult = await orpoLearner.train(
        trainingData,
        { batchSize, numEpochs: 3 }
      );

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.totalBatchesProcessed).toBeGreaterThan(0);
      expect(trainingResult.avgBatchTime).toBeGreaterThan(0);
      expect(trainingResult.avgBatchTime).toBeLessThan(1000); // Should be fast

      // Should process all data
      const expectedBatches = Math.ceil(trainingData.length / batchSize) * 3; // 3 epochs
      expect(trainingResult.totalBatchesProcessed).toBeGreaterThanOrEqual(expectedBatches);
    });

    it('should apply gradient clipping to prevent exploding gradients', async () => {
      // Arrange
      const trainingData = await generateTrainingData(100);
      const originalPolicy = await orpoLearner.getCurrentPolicy();

      // Act
      const trainingResult = await orpoLearner.train(trainingData);

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.maxGradientNorm).toBeGreaterThan(0);
      expect(trainingResult.maxGradientNorm).toBeLessThan(5.0); // Should be clipped
      expect(trainingResult.gradientClipsApplied).toBeGreaterThanOrEqual(0);

      // Policy should have updated
      const updatedPolicy = await orpoLearner.getCurrentPolicy();
      expect(updatedPolicy).toBeDefined();
    });
  });

  describe('Reward Model Integration', () => {
    it('should calculate rewards for training samples', async () => {
      // Arrange
      const samples = Array(10).fill(null).map((_, i) => ({
        query: `What is AI part ${i}?`,
        response: `AI definition part ${i}`,
        reference: `Standard AI definition part ${i}`
      }));

      // Act
      const rewards = await rewardModel.calculateRewards(samples);

      // Assert
      expect(rewards).toBeDefined();
      expect(rewards.length).toBe(samples.length);
      rewards.forEach((reward, i) => {
        expect(reward.score).toBeDefined();
        expect(reward.score).toBeGreaterThan(0);
        expect(reward.details).toBeDefined();
        expect(reward.tokens).toBeGreaterThan(0);
      });
    });

    it('should provide fine-grained reward components', async () => {
      // Arrange
      const sample = {
        query: "What is artificial intelligence?",
        response: "Artificial intelligence is the simulation of human intelligence by machines.",
        reference: "AI is the ability of machines to think and learn."
      };

      // Act
      const reward = await rewardModel.calculateReward(sample);

      // Assert
      expect(reward).toBeDefined();
      expect(reward.score).toBeGreaterThan(0);
      expect(reward.details).toBeDefined();

      // Check reward components
      const details = reward.details;
      expect(details.accuracy).toBeDefined();
      expect(details.relevance).toBeDefined();
      expect(details.coherence).toBeDefined();
      expect(details.fluency).toBeDefined();
      expect(details.brevity).toBeDefined();

      // All components should be between 0 and 1
      Object.values(details).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should handle diverse reward calculation strategies', async () => {
      // Arrange
      const samples = [
        {
          query: "Simple question",
          response: "Simple answer",
          reference: "Expected simple answer"
        },
        {
          query: "Complex technical question",
          response: "Detailed technical explanation",
          reference: "Comprehensive technical answer"
        }
      ];

      // Test different reward model configurations
      const rewardConfigs = [
        { type: 'exact-match', weight: 1.0 },
        { type: 'rouge', weight: 0.7 },
        { type: 'bert', weight: 0.5 },
        { type: 'custom', weight: 0.8 }
      ];

      // Act
      const results = await Promise.all(
        rewardConfigs.map(config =>
          rewardModel.calculateRewards(samples, { strategy: config })
        )
      );

      // Assert
      expect(results.length).toBe(rewardConfigs.length);
      results.forEach((rewards, i) => {
        expect(rewards.length).toBe(samples.length);
        rewards.forEach(reward => {
          expect(reward.score).toBeGreaterThan(0);
          expect(reward.metadata?.strategy).toBe(rewardConfigs[i].type);
        });
      });
    });

    it('should tokenize inputs efficiently', async () => {
      // Arrange
      const longText = 'This is a '.repeat(100) + 'long text for tokenization';
      const sample = {
        query: longText,
        response: longText,
        reference: longText
      };

      // Act
      const tokenizationStart = Date.now();
      const reward = await rewardModel.calculateReward(sample);
      const tokenizationTime = Date.now() - tokenizationStart;

      // Assert
      expect(reward).toBeDefined();
      expect(reward.tokens).toBeGreaterThan(0);
      expect(tokenizationTime).toBeLessThan(1000); // Should be fast
      expect(reward.metadata?.tokenizationTime).toBeLessThan(100);
    });
  });

  describe('Policy Gradient Optimization', () => {
    it('should update policy based on rewards', async () => {
      // Arrange
      const policyBefore = await orpoLearner.getCurrentPolicy();
      const trainingData = await generateTrainingData(50);

      // Act
      await orpoLearner.train(trainingData);
      const policyAfter = await orpoLearner.getCurrentPolicy();

      // Assert
      expect(policyBefore).toBeDefined();
      expect(policyAfter).toBeDefined();

      // Policy should have updated
      expect(policyAfter.version).toBeGreaterThan(policyBefore.version);

      // Some parameters should have changed
      const paramsBefore = policyBefore.parameters;
      const paramsAfter = policyAfter.parameters;

      expect(paramsAfter.temperature).toBeDefined();
      expect(paramsAfter.maxTokens).toBeDefined();
      expect(paramsAfter.topP).toBeDefined();
    });

    it('should apply policy gradients with optimizer', async () => {
      // Arrange
      const trainingData = await generateTrainingData(30);
      const optimizerConfig = {
        type: 'adamw',
        lr: 0.001,
        weightDecay: 0.01,
        betas: [0.9, 0.999],
        eps: 1e-8
      };

      // Act
      const trainingResult = await orpoLearner.train(
        trainingData,
        { optimizer: optimizerConfig }
      );

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.optimizerInfo).toBeDefined();
      expect(trainingResult.optimizerInfo.learningRate).toBe(optimizerConfig.lr);

      // Should have applied gradients
      expect(trainingResult.gradientsApplied).toBeGreaterThan(0);
      expect(trainingResult.optimizerInfo.weightDecay).toBe(optimizerConfig.weightDecay);
    });

    it('should explore vs exploit balance', async () => {
      // Arrange
      const trainingData = await generateTrainingData(100);
      const explorationRate = 0.2;

      // Act
      await orpoLearner.train(trainingData, { explorationRate });
      const policy = await orpoLearner.getCurrentPolicy();

      // Assert
      expect(policy).toBeDefined();
      expect(policy.parameters.temperature).toBeGreaterThan(0.1); // Some exploration

      // The policy should show balanced exploration-exploitation
      // Higher temperature means more exploration
      const temperature = policy.parameters.temperature;
      expect(temperature).toBeGreaterThanOrEqual(0.1);
      expect(temperature).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Experience Replay Integration', () => {
    it('should store experiences for replay', async () => {
      // Arrange
      const experiences = Array(50).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: {
          query: `Query ${i}`,
          context: [`Context ${i}`],
          sessionHistory: []
        },
        action: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 100
        },
        reward: Math.random(),
        nextReward: Math.random(),
        done: true
      }));

      // Act
      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      const buffer = await experienceReplayer.getBuffer();

      // Assert
      expect(buffer.size).toBe(experiences.length);
      experiences.forEach(exp => {
        expect(buffer.has(exp.id)).toBe(true);
      });
    });

    it('should sample experiences for training', async () => {
      // Arrange
      // Create experiences with varying rewards
      const experiences = Array(100).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: {
          query: `Query ${i}`,
          context: [],
          sessionHistory: []
        },
        action: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 100
        },
        reward: Math.random(), // Random rewards
        nextReward: Math.random(),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const sampled = await experienceReplayer.sampleExperiences(32);

      // Assert
      expect(sampled.length).toBe(32);
      expect(sampled.every(exp => exp.reward >= 0)).toBe(true);

      // With prioritized sampling, should get higher reward experiences
      const avgReward = sampled.reduce((sum, exp) => sum + exp.reward, 0) / sampled.length;
      expect(avgReward).toBeGreaterThan(0.1);
    });

    it('should update experience priorities', async () => {
      // Arrange
      const experiences = Array(20).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: { query: `Query ${i}`, context: [], sessionHistory: [] },
        action: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
        reward: 0.1 + (i * 0.05), // Increasing rewards
        nextReward: 0.1 + (i * 0.05),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const prioritiesBefore = await experienceReplayer.getPriorities();
      await experienceReplayer.updatePriorities(['exp-5', 'exp-10', 'exp-15'], 2.0);
      const prioritiesAfter = await experienceReplayer.getPriorities();

      // Assert
      expect(prioritiesAfter).toBeDefined();
      expect(prioritiesAfter.get('exp-5')).toBeGreaterThan(prioritiesBefore.get('exp-5'));
      expect(prioritiesAfter.get('exp-10')).toBeGreaterThan(prioritiesBefore.get('exp-10'));
      expect(prioritiesAfter.get('exp-15')).toBeGreaterThan(prioritiesBefore.get('exp-15'));
    });

    it('should handle replay buffer efficiently', async () => {
      // Arrange
      const bufferSize = 100;
      experienceReplayer = new ExperienceReplayer({
        replayBuffer: new Map(),
        maxBufferSize: bufferSize,
        sampleStrategy: 'uniform'
      });

      // Add more experiences than buffer size
      const experiences = Array(bufferSize + 50).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: { query: `Query ${i}`, context: [], sessionHistory: [] },
        action: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
        reward: Math.random(),
        nextReward: Math.random(),
        done: true
      }));

      // Act
      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      const buffer = await experienceReplayer.getBuffer();

      // Assert
      expect(buffer.size).toBe(bufferSize); // Should limit to max size

      // Should contain the most recent experiences
      const expIds = Array.from(buffer.keys());
      expect(parseInt(expIds[0].split('-')[1])).toBeGreaterThan(bufferSize - 1);
    });
  });

  describe('Data Loading and Preprocessing', () => {
    it('should load and preprocess training data', async () => {
      // Arrange
      const rawData = await generateRawTrainingData(100);

      // Act
      const processed = await dataLoader.preprocessData(rawData);

      // Assert
      expect(processed).toBeDefined();
      expect(processed.inputs.length).toBe(rawData.length);
      expect(processed.targets.length).toBe(rawData.length);
      expect(processed.masks).toBeDefined();

      // Check data format
      processed.inputs.forEach(input => {
        expect(input.tokens).toBeDefined();
        expect(input.attentionMask).toBeDefined();
        expect(input.inputIds).toBeDefined();
      });
    });

    it('should handle data augmentation', async () => {
      // Arrange
      const originalData = await generateRawTrainingData(20);

      // Act
      const augmented = await dataLoader.augmentData(originalData);

      // Assert
      expect(augmented).toBeDefined();
      expect(augmented.length).toBeGreaterThan(originalData.length);

      // Augmented data should have same structure
      augmented.forEach(sample => {
        expect(sample.query).toBeDefined();
        expect(sample.response).toBeDefined();
        expect(sample.reward).toBeDefined();
      });
    });

    it('should maintain data quality and balance', async () => {
      // Arrange
      const imbalancedData = [
        ...Array(80).fill(null).map((_, i) => ({
          query: `Common query ${i}`,
          response: `Common response ${i}`,
          reward: 0.9,
          category: 'common'
        })),
        ...Array(20).fill(null).map((_, i) => ({
          query: `Rare query ${i}`,
          response: `Rare response ${i}`,
          reward: 0.9,
          category: 'rare'
        }))
      ];

      // Act
      const balanced = await dataLoader.balanceData(imbalancedData);

      // Assert
      expect(balanced).toBeDefined();
      expect(balanced.length).toBeGreaterThan(imbalancedData.length);

      // Should have more balanced representation
      const commonCount = balanced.filter(d => d.category === 'common').length;
      const rareCount = balanced.filter(d => d.category === 'rare').length;
      const ratio = commonCount / rareCount;

      // Should be more balanced than original
      expect(ratio).toBeLessThan(4); // No more than 4:1 ratio
    });

    it('should provide efficient batch loading', async () => {
      // Arrange
      const datasetSize = 1000;
      const batchSize = 64;

      await dataLoader.loadDataset(await generateRawTrainingData(datasetSize));

      // Act
      const loadStartTime = Date.now();
      const batches = [];
      for (let i = 0; i < 10; i++) {
        const batch = await dataLoader.getBatch(batchSize);
        if (batch) batches.push(batch);
      }
      const loadTime = Date.now() - loadStartTime;

      // Assert
      expect(batches.length).toBeGreaterThan(0);
      expect(loadTime).toBeLessThan(2000); // Should load batches quickly

      batches.forEach(batch => {
        expect(batch.inputs).toBeDefined();
        expect(batch.targets).toBeDefined();
        expect(batch.inputs.length).toBe(batchSize);
      });
    });
  });

  describe('Hyperparameter Optimization', () => {
    it('should optimize learning rate with Bayesian optimization', async () => {
      // Arrange
      const hyperparameters: Hyperparameters = {
        learningRate: { min: 1e-5, max: 1e-3, type: 'float' },
        batchSize: { min: 16, max: 128, type: 'int' },
        temperature: { min: 0.1, max: 1.0, type: 'float' }
      };

      const trainingData = await generateTrainingData(50);

      // Act
      const optimizationResult = await hyperparameterOptimizer.optimize(
        hyperparameters,
        async (params) => {
          // Mock training with different parameters
          const mockResult = {
            accuracy: Math.random() * 0.3 + params.learningRate * 1000,
            loss: Math.random() * 0.5
          };
          return mockResult;
        },
        trainingData
      );

      // Assert
      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.bestParameters).toBeDefined();
      expect(optimizationResult.bestValue).toBeGreaterThan(0);
      expect(optimizationResult.trials).toBeGreaterThan(0);

      const bestParams = optimizationResult.bestParameters;
      expect(bestParams.learningRate).toBeGreaterThanOrEqual(hyperparameters.learningRate.min);
      expect(bestParams.learningRate).toBeLessThanOrEqual(hyperparameters.learningRate.max);
    });

    it('should perform grid search for categorical hyperparameters', async () => {
      // Arrange
      const categoricalHyperparameters = {
        optimizer: ['adam', 'sgd', 'rmsprop'] as const,
        model: ['small', 'medium', 'large'] as const,
        dropout: [0.1, 0.2, 0.3]
      };

      const trainingData = await generateTrainingData(30);

      // Act
      const gridSearchResult = await hyperparameterOptimizer.gridSearch(
        categoricalHyperparameters,
        async (params) => {
          // Mock training
          const baseAccuracy = 0.6;
          const accuracy = baseAccuracy +
            (params.optimizer === 'adam' ? 0.1 : 0) +
            (params.model === 'medium' ? 0.05 : params.model === 'large' ? 0.1 : 0) +
            (params.dropout * 0.1);

          return {
            accuracy: Math.min(accuracy, 0.95),
            loss: Math.random() * 0.5
          };
        },
        trainingData
      );

      // Assert
      expect(gridSearchResult).toBeDefined();
      expect(gridSearchResult.bestCombination).toBeDefined();
      expect(gridSearchResult.bestScore).toBeGreaterThan(0);
      expect(gridSearchResult.allResults).toBeDefined();
      expect(gridSearchResult.allResults.length).toBeGreaterThan(0);
    });

    it('should track optimization history and progress', async () => {
      // Arrange
      const hyperparameters = {
        learningRate: { min: 1e-4, max: 1e-2, type: 'float' }
      };

      const trainingData = await generateTrainingData(20);

      // Act
      const optimizationResult = await hyperparameterOptimizer.optimize(
        hyperparameters,
        async (params) => {
          // Mock training with some noise
          return {
            accuracy: 0.5 + Math.random() * 0.3 + params.learningRate * 100,
            loss: Math.random() * 0.5
          };
        },
        trainingData,
        { nTrials: 10 }
      );

      // Assert
      expect(optimizationResult.history).toBeDefined();
      expect(optimizationResult.history.length).toBeGreaterThan(0);

      // History should show improvement over time
      const accuracies = optimizationResult.history.map(h => h.value);
      const firstAccuracy = accuracies[0];
      const lastAccuracy = accuracies[accuracies.length - 1];
      expect(lastAccuracy).toBeGreaterThanOrEqual(firstAccuracy);
    });
  });

  describe('Training Monitoring and Evaluation', () => {
    it('should monitor training progress with metrics', async () => {
      // Arrange
      const trainingData = await generateTrainingData(100);
      const metrics = [];

      // Set up metric collection
      const metricListener = (metric) => {
        metrics.push(metric);
      };

      orpoLearner.onTrainingProgress(metricListener);

      // Act
      await orpoLearner.train(trainingData);

      // Assert
      expect(metrics.length).toBeGreaterThan(0);

      // Check metric format
      const lastMetric = metrics[metrics.length - 1];
      expect(lastMetric).toBeDefined();
      expect(lastMetric.loss).toBeDefined();
      expect(lastMetric.accuracy).toBeDefined();
      expect(lastMetric.reward).toBeDefined();
      expect(lastMetric.epoch).toBeDefined();
      expect(lastMetric.step).toBeDefined();
    });

    it('should evaluate model performance on test set', async () => {
      // Arrange
      const trainingData = await generateTrainingData(80);
      const testData = await generateTrainingData(20);

      // Train first
      await orpoLearner.train(trainingData);

      // Act
      const evaluation = await orpoLearner.evaluate(testData);

      // Assert
      expect(evaluation).toBeDefined();
      expect(evaluation.loss).toBeGreaterThan(0);
      expect(evaluation.accuracy).toBeGreaterThan(0);
      expect(evaluation.reward).toBeGreaterThan(0);
      expect(evaluation.confusionMatrix).toBeDefined();
      expect(evaluation.metrics).toBeDefined();

      // Check detailed metrics
      const metrics = evaluation.metrics;
      expect(metrics.precision).toBeDefined();
      expect(metrics.recall).toBeDefined();
      expect(metrics.f1Score).toBeDefined();
      expect(metrics.auc).toBeDefined();
    });

    it('should provide early stopping based on validation loss', async () => {
      // Arrange
      const trainingData = await generateTrainingData(150);

      // Configure early stopping
      const earlyStoppingConfig = {
        patience: 3,
        minDelta: 0.001,
        monitor: 'val_loss'
      };

      // Act
      const trainingResult = await orpoLearner.train(
        trainingData,
        { earlyStopping: earlyStoppingConfig }
      );

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.earlyStoppingTriggered).toBeDefined();

      if (trainingResult.earlyStoppingTriggered) {
        expect(trainingResult.bestEpoch).toBeGreaterThan(0);
        expect(trainingResult.bestLoss).toBeGreaterThan(0);
      }

      // Should have stopped before full epochs if improvement stalled
      const totalEpochs = trainingResult.epochResults.length;
      if (trainingResult.earlyStoppingTriggered) {
        expect(totalEpochs).toBeLessThan(10); // Should stop early
      }
    });

    it('should track learning curves and visualize trends', async () => {
      // Arrange
      const trainingData = await generateTrainingData(200);
      const history = [];

      // Collect training history
      const historyCollector = (metric) => {
        history.push(metric);
      };

      orpoLearner.onTrainingProgress(historyCollector);

      // Act
      await orpoLearner.train(trainingData);

      // Assert
      expect(history.length).toBeGreaterThan(0);

      // Extract learning curves
      const losses = history.map(h => h.loss);
      const accuracies = history.map(h => h.accuracy);
      const rewards = history.map(h => h.reward);

      // Loss should generally decrease
      const lossTrend = calculateTrend(losses);
      expect(lossTrend).toBeLessThan(0); // Negative trend (decreasing)

      // Accuracy should generally increase
      const accuracyTrend = calculateTrend(accuracies);
      expect(accuracyTrend).toBeGreaterThan(0); // Positive trend (increasing)

      // Rewards should generally increase
      const rewardTrend = calculateTrend(rewards);
      expect(rewardTrend).toBeGreaterThan(0); // Positive trend (increasing)
    });
  });

  describe('Performance and Scalability', () => {
    it('should scale with dataset size', async () => {
      // Arrange
      const datasetSizes = [50, 100, 200, 500];
      const results = [];

      // Act
      for (const size of datasetSizes) {
        const trainingData = await generateTrainingData(size);
        const startTime = Date.now();

        await orpoLearner.train(trainingData);
        const endTime = Date.now();

        results.push({
          size,
          time: endTime - startTime,
          throughput: size / ((endTime - startTime) / 1000)
        });
      }

      // Assert
      expect(results.length).toBe(datasetSizes.length);

      // Check scaling efficiency
      const baseTime = results[0].time;
      const baseThroughput = results[0].throughput;

      results.forEach((result, i) => {
        if (i > 0) {
          // Should scale reasonably well
          expect(result.throughput).toBeGreaterThan(baseThroughput * 0.5);
          expect(result.time).toBeLessThan(baseTime * datasetSizes[i] / datasetSizes[0] * 2);
        }
      });
    });

    it('should maintain performance during continuous training', async () => {
      // Arrange
      const numTrainingCycles = 5;
      const cycleDataSize = 50;

      // Act
      const cycleResults = [];
      for (let i = 0; i < numTrainingCycles; i++) {
        const trainingData = await generateTrainingData(cycleDataSize);
        const startTime = Date.now();

        await orpoLearner.train(trainingData);
        const endTime = Date.now();

        cycleResults.push({
          cycle: i + 1,
          time: endTime - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        });
      }

      // Assert
      expect(cycleResults.length).toBe(numTrainingCycles);

      // Performance should not degrade significantly
      const avgTime = cycleResults.reduce((sum, r) => sum + r.time, 0) / cycleResults.length;
      const maxTime = Math.max(...cycleResults.map(r => r.time));

      expect(maxTime).toBeLessThan(avgTime * 2); // No more than 2x slower

      // Memory usage should be stable
      const firstMemory = cycleResults[0].memoryUsage;
      const lastMemory = cycleResults[cycleResults.length - 1].memoryUsage;
      expect(lastMemory).toBeLessThan(firstMemory * 1.5); // Less than 50% growth
    });

    it('should handle resource constraints gracefully', async () => {
      // Arrange
      const largeDataset = await generateTrainingData(1000);

      // Simulate resource constraints
      vi.spyOn(process, 'memoryUsage').mockReturnValue({
        heapTotal: 100 * 1024 * 1024, // 100MB limit
        heapUsed: 90 * 1024 * 1024,  // 90MB used
        rss: 120 * 1024 * 1024,
        external: 0
      });

      // Act
      const trainingStart = Date.now();
      const trainingResult = await orpoLearner.train(largeDataset, {
        batchSize: 16, // Smaller batch for memory constraints
        gradientAccumulation: 4 // Accumulate gradients
      });
      const trainingTime = Date.now() - trainingStart;

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.success).toBe(true);
      expect(trainingResult.loss).toBeGreaterThan(0);
      expect(trainingTime).toBeLessThan(30000); // Should complete in reasonable time
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle training interruptions gracefully', async () => {
      // Arrange
      const trainingData = await generateTrainingData(100);
      const interruptedPromise = new Promise((resolve) => {
        // Simulate interruption after some training
        setTimeout(() => {
          orpoLearner.interruptTraining();
          resolve(true);
        }, 100);
      });

      // Act
      const trainingPromise = orpoLearner.train(trainingData);
      await Promise.all([trainingPromise, interruptedPromise]);

      // Assert
      const policy = await orpoLearner.getCurrentPolicy();
      expect(policy).toBeDefined();
      expect(policy.lastUpdated).toBeDefined();

      // Should have partial training state preserved
      const trainingState = orpoLearner.getTrainingState();
      expect(trainingState).toBeDefined();
      expect(trainingState.partialProgress).toBe(true);
    });

    it('should recover from gradient explosion', async () => {
      // Arrange
      const problematicData = Array(50).fill(null).map((_, i) => ({
        query: `Query ${i}`,
        response: 'A'.repeat(10000), // Large response causing gradients
        reward: 0.9
      }));

      // Act
      const trainingResult = await orpoLearner.train(problematicData, {
        maxGradNorm: 0.1, // Stricter clipping
        gradientClipStrategy: 'value'
      });

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.success).toBe(true);
      expect(trainingResult.gradientClipsApplied).toBeGreaterThan(0);
      expect(trainingResult.maxGradientNorm).toBeLessThan(1.0);
    });

    it('should validate training data and filter invalid samples', async () => {
      // Arrange
      const invalidData = [
        { query: 'Valid query', response: 'Valid response', reward: 0.9 },
        { query: 'Another valid', response: 'Valid', reward: 0.8 },
        { query: '', response: '', reward: 0 }, // Invalid
        { query: null, response: null, reward: null }, // Invalid
        { query: 'Valid', response: 'Valid', reward: 1.5 } // Invalid reward
      ];

      // Act
      const trainingResult = await orpoLearner.train(invalidData);

      // Assert
      expect(trainingResult).toBeDefined();
      expect(trainingResult.invalidSamplesRemoved).toBeGreaterThan(0);
      expect(trainingResult.validSamplesUsed).toBeGreaterThan(0);
      expect(trainingResult.validSamplesUsed + trainingResult.invalidSamplesRemoved)
        .toBe(invalidData.length);
    });
  });

  // Helper functions
  async function generateTrainingData(count: number): Promise<Experience[]> {
    return Array(count).fill(null).map((_, i) => ({
      id: `train-exp-${i}`,
      timestamp: Date.now() + i,
      state: {
        query: `Training query ${i}`,
        context: [`Context ${i}`],
        sessionHistory: []
      },
      action: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100
      },
      reward: 0.5 + Math.random() * 0.5,
      nextReward: 0.5 + Math.random() * 0.5,
      done: true
    }));
  }

  async function generateRawTrainingData(count: number): Promise<Array<{
    query: string;
    response: string;
    reward: number;
    metadata?: any;
  }>> {
    return Array(count).fill(null).map((_, i) => ({
      query: `Raw training query ${i}`,
      response: `Training response ${i}`,
      reward: 0.5 + Math.random() * 0.5,
      metadata: {
        difficulty: Math.random(),
        category: `category-${i % 5}`
      }
    }));
  }

  function calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = values.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }
});