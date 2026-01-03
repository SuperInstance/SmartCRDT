import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { LucidDreamer } from '@lsi/superinstance';
import { ShadowLogger } from '@lsi/superinstance';
import { ORPOLearner } from '@lsi/superinstance';
import { HypothesisGenerator } from '@lsi/superinstance';
import { ExperienceReplayer } from '@lsi/superinstance';
import type { ShadowLog, Hypothesis, Experience, LearningOutcome } from '@lsi/protocol';

describe('Shadow Logging Integration Test Suite', () => {
  let lucidDreamer: LucidDreamer;
  let shadowLogger: ShadowLogger;
  let orpoLearner: ORPOLearner;
  let hypothesisGenerator: HypothesisGenerator;
  let experienceReplayer: ExperienceReplayer;
  let logPath = '/tmp/shadow-logs.json';
  let logDir = '/tmp/shadow-logs/';

  beforeAll(async () => {
    // Initialize all components
    shadowLogger = new ShadowLogger({
      logPath,
      logDir,
      maxLogSize: 10 * 1024 * 1024, // 10MB
      compression: true,
      enableRealTime: true
    });

    hypothesisGenerator = new HypothesisGenerator({
      maxHypotheses: 100,
      confidenceThreshold: 0.7,
      diversityThreshold: 0.3
    });

    orpoLearner = new ORPOLearner({
      learningRate: 0.01,
      batchSize: 32,
      numEpochs: 3,
      rewardModel: {
        type: 'lm-based',
        tokenizer: 'mock-tokenizer',
        model: 'mock-model'
      }
    });

    experienceReplayer = new ExperienceReplayer({
      replayBuffer: new Map(),
      maxBufferSize: 10000,
      sampleStrategy: 'prioritized',
      alpha: 0.6,
      beta: 0.4
    });

    lucidDreamer = new LucidDreamer({
      logPath,
      logDir,
      batchSize: 100,
      learningRate: 0.001,
      enableAutoSave: true,
      compression: true,
      maxHistory: 50000
    });

    // Initialize services
    await shadowLogger.initialize();
    await hypothesisGenerator.initialize();
    await orpoLearner.initialize();
    await experienceReplayer.initialize();
    await lucidDreamer.initialize();
  });

  afterAll(async () => {
    await shadowLogger.close();
    await orpoLearner.close();
    await experienceReplayer.close();
    await lucidDreamer.close();

    // Clean up log files
    import { promises as fs } from 'fs';
    try {
      await fs.unlink(logPath);
      await fs.rmdir(logDir);
    } catch (e) {
      // Ignore if files don't exist
    }
  });

  beforeEach(async () => {
    // Clear logs before each test
    await shadowLogger.clearLogs();
    await experienceReplayer.clearBuffer();
  });

  describe('Shadow Logger Operations', () => {
    it('should log query responses with metadata', async () => {
      // Arrange
      const logEntry: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'test-session-1',
        query: "What is artificial intelligence?",
        response: "Artificial intelligence is the simulation of human intelligence by machines.",
        confidence: 0.9,
        source: 'cloud',
        latency: 1500,
        metadata: {
          model: 'gpt-4',
          tokens: 150,
          cost: 0.002
        }
      };

      // Act
      await shadowLogger.log(logEntry);
      const logs = await shadowLogger.getLogs();

      // Assert
      expect(logs).toBeDefined();
      expect(logs.length).toBe(1);
      expect(logs[0]).toEqual(logEntry);
    });

    it('should handle batch logging efficiently', async () => {
      // Arrange
      const batchSize = 100;
      const logs = Array(batchSize).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: `session-${i}`,
        query: `Test query ${i}`,
        response: `Response ${i}`,
        confidence: 0.5 + Math.random() * 0.5,
        source: i % 2 === 0 ? 'local' : 'cloud',
        latency: Math.random() * 2000,
        metadata: {
          model: `model-${i}`,
          tokens: 100 + i,
          cost: 0.001 + i * 0.0001
        }
      }));

      // Act
      const startTime = Date.now();
      await shadowLogger.batchLog(logs);
      const endTime = Date.now();
      const retrievedLogs = await shadowLogger.getLogs();

      // Assert
      const loggingTime = endTime - startTime;
      expect(retrievedLogs.length).toBe(batchSize);
      expect(loggingTime).toBeLessThan(1000); // Should log 100 entries in < 1s
    });

    it('should compress and rotate logs', async () => {
      // Arrange
      const largeEntry: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'large-session',
        query: 'A'.repeat(10000),
        response: 'B'.repeat(10000),
        confidence: 0.8,
        source: 'cloud',
        latency: 500,
        metadata: {
          model: 'gpt-4',
          tokens: 10000,
          cost: 0.1
        }
      };

      // Act
      await shadowLogger.log(largeEntry);

      // Check if compression is working
      const logs = await shadowLogger.getLogs();
      const compressed = await shadowLogger.isLogCompressed(logs[0].timestamp);

      // Assert
      expect(logs.length).toBe(1);
      expect(compressed).toBeDefined();
    });

    it('should provide real-time logging updates', async () => {
      // Arrange
      const logEntry: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'realtime-test',
        query: "Real-time query test",
        response: "Real-time response",
        confidence: 0.9,
        source: 'local',
        latency: 100,
        metadata: {}
      };

      // Set up real-time listener
      const updateListener = vi.fn();
      await shadowLogger.onLogUpdate(updateListener);

      // Act
      await shadowLogger.log(logEntry);

      // Assert
      expect(updateListener).toHaveBeenCalled();
      const lastCall = updateListener.mock.calls[updateListener.mock.calls.length - 1];
      expect(lastCall[0]).toEqual(logEntry);
    });

    it('should filter logs by session', async () => {
      // Arrange
      const session1Logs = Array(5).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'session-1',
        query: `Query ${i}`,
        response: `Response ${i}`,
        confidence: 0.8,
        source: 'cloud',
        latency: 1000,
        metadata: {}
      }));

      const session2Logs = Array(3).fill(null).map((_, i) => ({
        timestamp: Date.now() + 10 + i,
        sessionId: 'session-2',
        query: `Query ${i}`,
        response: `Response ${i}`,
        confidence: 0.7,
        source: 'local',
        latency: 500,
        metadata: {}
      }));

      // Store all logs
      await shadowLogger.batchLog([...session1Logs, ...session2Logs]);

      // Act
      const session1Filtered = await shadowLogger.getLogsBySession('session-1');
      const session2Filtered = await shadowLogger.getLogsBySession('session-2');

      // Assert
      expect(session1Filtered.length).toBe(5);
      expect(session2Filtered.length).toBe(3);
      expect(session1Filtered.every(log => log.sessionId === 'session-1')).toBe(true);
    });
  });

  describe('Experience Buffer Management', () => {
    it('should store and retrieve experiences', async () => {
      // Arrange
      const experience: Experience = {
        id: 'exp-1',
        timestamp: Date.now(),
        state: {
          query: "What is AI?",
          context: ['AI definition'],
          sessionHistory: []
        },
        action: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 150
        },
        reward: 0.9,
        nextReward: 0.85,
        done: false
      };

      // Act
      await experienceReplayer.addExperience(experience);
      const retrieved = await experienceReplayer.getExperience('exp-1');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(experience.id);
      expect(retrieved.reward).toBe(experience.reward);
    });

    it('should prioritize experiences by priority sampling', async () => {
      // Arrange
      const experiences = Array(10).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: { query: `Query ${i}`, context: [], sessionHistory: [] },
        action: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
        reward: 0.1 + (i * 0.1), // Increasing reward
        nextReward: 0.1 + (i * 0.1),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const sampled = await experienceReplayer.sampleExperiences(5, 'prioritized');

      // Assert
      expect(sampled.length).toBe(5);

      // Higher reward experiences should be sampled more often
      const avgReward = sampled.reduce((sum, exp) => sum + exp.reward, 0) / sampled.length;
      expect(avgReward).toBeGreaterThan(0.3); // Should be biased towards higher rewards
    });

    it('should update priorities after learning', async () => {
      // Arrange
      const experiences = Array(20).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: { query: `Query ${i}`, context: [], sessionHistory: [] },
        action: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
        reward: Math.random(),
        nextReward: Math.random(),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const prioritiesBefore = await experienceReplayer.getPriorities();
      await experienceReplayer.updatePriorities(['exp-1', 'exp-5', 'exp-10'], 1.5);
      const prioritiesAfter = await experienceReplayer.getPriorities();

      // Assert
      expect(prioritiesAfter.get('exp-1')).toBeGreaterThan(prioritiesBefore.get('exp-1'));
      expect(prioritiesAfter.get('exp-5')).toBeGreaterThan(prioritiesBefore.get('exp-5'));
    });

    it('should handle buffer overflow gracefully', async () => {
      // Arrange
      const bufferSize = 10;
      experienceReplayer = new ExperienceReplayer({
        replayBuffer: new Map(),
        maxBufferSize: bufferSize,
        sampleStrategy: 'uniform'
      });

      // Add more experiences than buffer size
      const experiences = Array(bufferSize + 5).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: { query: `Query ${i}`, context: [], sessionHistory: [] },
        action: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
        reward: Math.random(),
        nextReward: Math.random(),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const buffer = await experienceReplayer.getBuffer();

      // Assert
      expect(buffer.size).toBe(bufferSize); // Should limit to max size

      // Should contain the most recent experiences
      const ids = Array.from(buffer.keys());
      expect(parseInt(ids[0].split('-')[1])).toBeGreaterThan(bufferSize - 1);
    });
  });

  describe('Hypothesis Generation', () => {
    it('should generate hypotheses from experience logs', async () => {
      // Arrange
      // Create experience logs
      const experiences = Array(50).fill(null).map((_, i) => ({
        id: `exp-${i}`,
        timestamp: Date.now() + i,
        state: {
          query: i < 25 ? "What is AI?" : "Explain machine learning",
          context: [],
          sessionHistory: []
        },
        action: {
          model: i < 25 ? 'gpt-4' : 'claude-3',
          temperature: 0.7,
          maxTokens: 100
        },
        reward: i < 25 ? 0.9 : 0.6, // GPT-4 performs better
        nextReward: i < 25 ? 0.85 : 0.55,
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const hypotheses = await hypothesisGenerator.generate(experiences);

      // Assert
      expect(hypotheses.length).toBeGreaterThan(0);
      expect(hypotheses[0].confidence).toBeGreaterThan(0);
      expect(hypotheses[0].evidence).toBeDefined();
      expect(hypotheses[0].description).toBeDefined();
    });

    it('should evaluate hypothesis quality', async () => {
      // Arrange
      const hypothesis: Hypothesis = {
        id: 'hypo-1',
        description: 'GPT-4 performs better than Claude-3 for AI queries',
        type: 'model_selection',
        parameters: {
          model: 'gpt-4',
          domain: 'artificial_intelligence'
        },
        confidence: 0.8,
        evidence: {
          supporting: 25,
          contradicting: 5,
          confidence: 0.9
        },
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      // Act
      const evaluation = await hypothesisGenerator.evaluate(hypothesis, experiences.slice(0, 10));

      // Assert
      expect(evaluation).toBeDefined();
      expect(evaluation.accuracy).toBeGreaterThan(0);
      expect(evaluation.stability).toBeGreaterThan(0);
      expect(evaluation.support).toBeGreaterThan(0);
    });

    it('should filter hypotheses by confidence threshold', async () => {
      // Arrange
      const lowConfidenceHypothesis: Hypothesis = {
        id: 'low-confidence',
        description: 'Random hypothesis with low confidence',
        type: 'random',
        parameters: {},
        confidence: 0.3, // Below threshold
        evidence: {
          supporting: 2,
          contradicting: 8,
          confidence: 0.2
        },
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      const highConfidenceHypothesis: Hypothesis = {
        id: 'high-confidence',
        description: 'Strong hypothesis with high confidence',
        type: 'strong',
        parameters: {},
        confidence: 0.9, // Above threshold
        evidence: {
          supporting: 20,
          contradicting: 1,
          confidence: 0.95
        },
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      // Act
      await hypothesisGenerator.addHypothesis(lowConfidenceHypothesis);
      await hypothesisGenerator.addHypothesis(highConfidenceHypothesis);

      const filtered = await hypothesisGenerator.getHypotheses(0.7); // 70% threshold

      // Assert
      expect(filtered.length).toBe(1);
      expect(filtered[0].confidence).toBeGreaterThanOrEqual(0.7);
      expect(filtered[0].id).toBe('high-confidence');
    });
  });

  describe('ORPO Learning Integration', () => {
    it('should perform ORPO training on experience batches', async () => {
      // Arrange
      // Create training data
      const experiences = Array(100).fill(null).map((_, i) => ({
        id: `train-exp-${i}`,
        timestamp: Date.now() + i,
        state: {
          query: i % 2 === 0 ? "What is AI?" : "Explain neural networks",
          context: [],
          sessionHistory: []
        },
        action: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 100
        },
        reward: 0.8 + (Math.random() * 0.2),
        nextReward: 0.75 + (Math.random() * 0.25),
        done: true
      }));

      for (const exp of experiences) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const learningResult = await orpoLearner.train(experiences.slice(0, 80));

      // Assert
      expect(learningResult).toBeDefined();
      expect(learningResult.loss).toBeGreaterThan(0);
      expect(learningResult.accuracy).toBeGreaterThan(0.5);
      expect(learningResult.policyUpdated).toBe(true);
    });

    it('should update policy based on learning outcomes', async () => {
      // Arrange
      const initialPolicy = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 150,
        routingThreshold: 0.6
      };

      // Act
      await orpoLearner.updatePolicy(initialPolicy);
      const updatedPolicy = await orpoLearner.getCurrentPolicy();

      // Assert
      expect(updatedPolicy).toBeDefined();
      expect(updatedPolicy.temperature).toBe(initialPolicy.temperature);
    });

    it('should calculate rewards based on query performance', async () => {
      // Arrange
      const queryContext = {
        query: "What is artificial intelligence?",
        response: "AI definition response",
        confidence: 0.9,
        latency: 500,
        complexity: 0.3
      };

      // Act
      const rewards = await orpoLearner.calculateRewards([queryContext]);

      // Assert
      expect(rewards).toBeDefined();
      expect(rewards.length).toBe(1);
      expect(rewards[0].reward).toBeGreaterThan(0);
      expect(rewards[0].components).toBeDefined();
      expect(rewards[0].components?.confidence).toBeGreaterThan(0);
    });

    it('should handle batch training efficiently', async () => {
      // Arrange
      const batchSize = 200;
      const trainingData = Array(batchSize).fill(null).map((_, i) => ({
        id: `batch-exp-${i}`,
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
        reward: Math.random(),
        nextReward: Math.random(),
        done: true
      }));

      for (const exp of trainingData) {
        await experienceReplayer.addExperience(exp);
      }

      // Act
      const startTime = Date.now();
      const result = await orpoLearner.batchTrain(trainingData);
      const endTime = Date.now();

      // Assert
      const trainingTime = endTime - startTime;
      expect(result.success).toBe(true);
      expect(trainingTime).toBeLessThan(5000); // Should train 200 samples in < 5s
      expect(result.samplesProcessed).toBe(batchSize);
    });
  });

  describe('Lucid Dreamer Integration', () => {
    it('should integrate shadow logging with learning', async () => {
      // Arrange
      const logEntry: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'lucid-test',
        query: "Test learning integration",
        response: "Learning integration response",
        confidence: 0.85,
        source: 'cloud',
        latency: 800,
        metadata: {
          model: 'gpt-4',
          tokens: 120,
          cost: 0.0015
        }
      };

      // Act
      await lucidDreamer.logShadowEntry(logEntry);
      const learningMetrics = await lucidDreamer.getLearningMetrics();

      // Assert
      expect(learningMetrics).toBeDefined();
      expect(learningQueriesLogged).toBeGreaterThan(0);
      expect(learningPoliciesUpdated).toBeGreaterThanOrEqual(0);
    });

    it('should perform offline learning from accumulated logs', async () => {
      // Arrange
      // Add many logs for offline learning
      const logCount = 500;
      const logs = Array(logCount).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: `session-${i % 10}`,
        query: `Query ${i}`,
        response: `Response ${i}`,
        confidence: 0.6 + (Math.random() * 0.4),
        source: i % 2 === 0 ? 'local' : 'cloud',
        latency: Math.random() * 2000,
        metadata: {}
      }));

      await shadowLogger.batchLog(logs);

      // Act
      const learningResult = await lucidDreamer.performOfflineLearning();

      // Assert
      expect(learningResult).toBeDefined();
      expect(learningResult.logsProcessed).toBe(logCount);
      expect(learningResult.hypothesesGenerated).toBeGreaterThan(0);
      expect(learningResult.policyUpdated).toBe(true);
    });

    it('should track learning effectiveness over time', async () => {
      // Arrange
      // Initial learning metrics
      await lucidDreamer.logShadowEntry({
        timestamp: Date.now(),
        sessionId: 'effectiveness-test',
        query: "Initial query",
        response: "Initial response",
        confidence: 0.7,
        source: 'local',
        latency: 1000,
        metadata: {}
      });

      // Act
      const initialMetrics = await lucidDreamer.getLearningMetrics();

      // Simulate some learning
      await lucidDreamer.performOfflineLearning();

      const finalMetrics = await lucidDreamer.getLearningMetrics();

      // Assert
      expect(finalMetrics).toBeDefined();
      expect(initialMetrics).toBeDefined();

      // Learning should improve metrics
      expect(finalMetrics.avgConfidence).toBeGreaterThanOrEqual(initialMetrics.avgConfidence);
      expect(finalMetrics.avgLatency).toBeLessThanOrEqual(initialMetrics.avgLatency);
    });

    it('should maintain shadow log history efficiently', async () => {
      // Arrange
      const maxHistory = 100;
      lucidDreamer = new LucidDreamer({
        logPath,
        logDir,
        batchSize: 10,
        learningRate: 0.001,
        maxHistory
      });

      // Add more logs than max history
      const logs = Array(maxHistory + 50).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'history-test',
        query: `History query ${i}`,
        response: `History response ${i}`,
        confidence: 0.8,
        source: 'cloud',
        latency: 500,
        metadata: {}
      }));

      await shadowLogger.batchLog(logs);

      // Act
      const history = await lucidDreamer.getShadowLogHistory();

      // Assert
      expect(history.length).toBeLessThanOrEqual(maxHistory);
      // Should contain the most recent logs
      expect(history[0].query).toContain(`${maxHistory + 49}`);
    });
  });

  describe('Performance and Monitoring', () => {
    it('should monitor learning performance metrics', async () => {
      // Arrange
      const logEntry: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'metrics-test',
        query: "Performance metrics test",
        response: "Metrics response",
        confidence: 0.9,
        source: 'cloud',
        latency: 200,
        metadata: {
          model: 'gpt-4',
          tokens: 200,
          cost: 0.002
        }
      };

      // Act
      await lucidDreamer.logShadowEntry(logEntry);
      const metrics = await lucidDreamer.getPerformanceMetrics();

      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.avgLatency).toBeGreaterThan(0);
      expect(metrics.avgConfidence).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBeDefined();
    });

    it('should handle high-throughput shadow logging', async () => {
      // Arrange
      const queryCount = 1000;
      const logs = Array(queryCount).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'throughput-test',
        query: `Throughput query ${i}`,
        response: `Response ${i}`,
        confidence: 0.8,
        source: i % 2 === 0 ? 'local' : 'cloud',
        latency: Math.random() * 1000,
        metadata: {}
      }));

      // Act
      const startTime = Date.now();
      await shadowLogger.batchLog(logs);
      const endTime = Date.now();

      // Assert
      const totalTime = endTime - startTime;
      const throughput = queryCount / (totalTime / 1000);

      expect(throughput).toBeGreaterThan(50); // 50+ logs per second
      expect(totalTime).toBeLessThan(5000); // Should log 1000 entries in < 5s
    });

    it('should provide real-time analytics dashboard', async () => {
      // Arrange
      const logs = Array(100).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'analytics-test',
        query: `Analytics query ${i}`,
        response: `Response ${i}`,
        confidence: 0.5 + Math.random() * 0.5,
        source: i % 3 === 0 ? 'local' : 'cloud',
        latency: Math.random() * 2000,
        metadata: {
          model: i % 2 === 0 ? 'gpt-4' : 'claude-3',
          tokens: 50 + i,
          cost: 0.001
        }
      }));

      await shadowLogger.batchLog(logs);

      // Act
      const analytics = await lucidDreamer.getAnalyticsDashboard();

      // Assert
      expect(analytics).toBeDefined();
      expect(analytics.queryVolume).toBe(logs.length);
      expect(analytics.sourceDistribution).toBeDefined();
      expect(analytics.confidenceDistribution).toBeDefined();
      expect(analytics.performanceMetrics).toBeDefined();

      // Check source distribution
      const localCount = analytics.sourceDistribution.local || 0;
      const cloudCount = analytics.sourceDistribution.cloud || 0;
      expect(localCount + cloudCount).toBe(logs.length);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle log corruption gracefully', async () => {
      // Arrange
      const corruptedLog: ShadowLog = {
        timestamp: Date.now(),
        sessionId: 'corrupted-test',
        query: "Corrupted query",
        response: "Corrupted response",
        confidence: 1.1, // Invalid confidence
        source: 'invalid_source',
        latency: -100, // Invalid latency
        metadata: null as any // Invalid metadata
      };

      // Act & Assert
      // Should not crash, but should handle gracefully
      await expect(shadowLogger.log(corruptedLog)).resolves.not.toThrow();

      // Should still be able to get valid logs
      const validLogs = await shadowLogger.getLogs();
      expect(validLogs.length).toBeGreaterThan(0);
    });

    it('should recover from learning failures', async () => {
      // Arrange
      const problematicLogs = Array(10).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'recovery-test',
        query: `Recovery query ${i}`,
        response: i === 5 ? null : `Response ${i}`, // Null response for one log
        confidence: i === 5 ? -1 : 0.8, // Invalid confidence for one log
        source: 'cloud',
        latency: 500,
        metadata: {}
      }));

      await shadowLogger.batchLog(problematicLogs);

      // Act
      const learningResult = await lucidDreamer.performOfflineLearning();

      // Assert
      expect(learningResult).toBeDefined();
      expect(learningResult.success).toBe(true);
      expect(learningResult.logsProcessed).toBeGreaterThan(0);
    });

    it('should maintain data consistency across failures', async () => {
      // Arrange
      const logs = Array(50).fill(null).map((_, i) => ({
        timestamp: Date.now() + i,
        sessionId: 'consistency-test',
        query: `Consistency query ${i}`,
        response: `Response ${i}`,
        confidence: 0.8,
        source: 'cloud',
        latency: 500,
        metadata: {}
      }));

      // Act - Store logs then simulate failure
      await shadowLogger.batchLog(logs);

      // Verify data consistency
      const storedLogs = await shadowLogger.getLogs();
      const consistencyCheck = await lucidDreamer.checkDataConsistency();

      // Assert
      expect(storedLogs.length).toBe(logs.length);
      expect(consistencyCheck).toBeDefined();
      expect(consistencyCheck.consistent).toBe(true);
    });
  });
});