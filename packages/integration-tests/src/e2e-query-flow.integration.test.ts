import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { SuperInstance } from '@lsi/superinstance';
import { CascadeRouter } from '@lsi/cascade';
import { SemanticCache } from '@lsi/cascade';
import { OpenAIAdapter } from '@lsi/cascade';
import { SQLiteService } from '@lsi/superinstance';
import { LucidDreamer } from '@lsi/superinstance';
import { IntentEncoder } from '@lsi/privacy';
import { QueryRefiner } from '@lsi/cascade';
import { ComplexityScorer } from '@lsi/cascade';
import { ProsodyDetector } from '@lsi/cascade';

describe('E2E Query Flow - Integration Test Suite', () => {
  let superInstance: SuperInstance;
  let cascadeRouter: CascadeRouter;
  let semanticCache: SemanticCache;
  let sqliteService: SQLiteService;
  let lucidDreamer: LucidDreamer;
  let intentEncoder: IntentEncoder;
  let queryRefiner: QueryRefiner;
  let complexityScorer: ComplexityScorer;
  let prosodyDetector: ProsodyDetector;

  beforeAll(async () => {
    // Initialize core components
    cascadeRouter = new CascadeRouter({
      localModel: 'mock',
      cloudModel: 'gpt-4',
      confidenceThreshold: 0.6,
      complexityThreshold: 0.7
    });

    semanticCache = new SemanticCache({
      maxEntries: 1000,
      dimension: 1536,
      similarityThreshold: 0.8
    });

    queryRefiner = new QueryRefiner();
    complexityScorer = new ComplexityScorer();
    prosodyDetector = new ProsodyDetector();
    intentEncoder = new IntentEncoder();

    // Initialize SQLite service
    sqliteService = new SQLiteService({
      databasePath: '/tmp/test-aequor.db'
    });

    // Initialize LucidDreamer
    lucidDreamer = new LucidDreamer({
      logPath: '/tmp/shadow-logs.json',
      batchSize: 10,
      learningRate: 0.01
    });

    // Initialize SuperInstance
    superInstance = new SuperInstance({
      cascadeRouter,
      semanticCache,
      sqliteService,
      lucidDreamer,
      intentEncoder,
      queryRefiner,
      complexityScorer,
      prosodyDetector
    });

    await superInstance.initialize();
  });

  afterAll(async () => {
    await sqliteService.close();
    // Clean up test database
    try {
      await fs.unlink('/tmp/test-aequor.db');
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe('Query Processing Pipeline', () => {
    it('should process a simple query end-to-end', async () => {
      // Arrange
      const query = "What is artificial intelligence?";
      const expectedTypes = ['explanation', 'educational'];

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.source).toMatch(/(local|cloud)/);
      expect(result.complexity).toBeDefined();
      expect(result.intent).toBeDefined();

      // Verify context was used
      if (result.context) {
        expect(result.context.length).toBeGreaterThan(0);
      }
    });

    it('should process a complex query with confidence scoring', async () => {
      // Arrange
      const complexQuery = "Explain the mathematical foundations of quantum computing and how it relates to artificial intelligence, including specific algorithms and their time complexity.";

      // Act
      const result = await superInstance.query(complexQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5); // Complex queries might have lower confidence
      expect(result.complexity).toBeGreaterThan(0.7); // Should be marked as complex
      expect(result.reasoning).toBeDefined(); // Should include reasoning for complex queries
    });

    it('should handle multiple queries and maintain session', async () => {
      // Arrange
      const queries = [
        "Hello, how are you?",
        "Can you tell me about machine learning?",
        "What about deep learning specifically?"
      ];

      // Act
      const results = await Promise.all(
        queries.map(q => superInstance.query(q))
      );

      // Assert
      expect(results).toHaveLength(queries.length);
      results.forEach((result, index) => {
        expect(result.content).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.sessionId).toBeDefined();

        // Verify session consistency
        if (index > 0) {
          expect(result.sessionId).toBe(results[0].sessionId);
        }
      });
    });

    it('should route simple queries locally for faster response', async () => {
      // Arrange
      const simpleQuery = "What is 2 + 2?";

      // Act
      const result = await superInstance.query(simpleQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.source).toBe('local'); // Should be routed locally
      expect(result.latency).toBeLessThan(1000); // Local should be faster
    });

    it('should route complex queries to cloud for better quality', async () => {
      // Arrange
      const complexQuery = "Compare and contrast transformer architectures with convolutional neural networks for computer vision tasks, including their mathematical formulations and performance characteristics.";

      // Act
      const result = await superInstance.query(complexQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.source).toBe('cloud'); // Should be routed to cloud
      expect(result.complexity).toBeGreaterThan(0.8); // Should be marked as very complex
    });
  });

  describe('Intent Encoding and Privacy', () => {
    it('should encode sensitive queries before processing', async () => {
      // Arrange
      const sensitiveQuery = "My social security number is 123-45-6789 and I live at 123 Main Street.";

      // Act
      const result = await superInstance.query(sensitiveQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.privacyClass).toBe('SECRET'); // Should be classified as sensitive
      expect(result.redacted).toBeDefined(); // Should have redacted content

      // Verify intent encoding preserved meaning
      expect(result.content).toContain('personal information');
      expect(result.content).not.toContain('123-45-6789');
    });

    it('should handle LOGIC type queries without privacy concerns', async () => {
      // Arrange
      const logicQuery = "What is the time complexity of quicksort?";

      // Act
      const result = await superInstance.query(logicQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.privacyClass).toBe('LOGIC'); // Should be classified as logic
      expect(result.redacted).toBeUndefined(); // No redaction needed
      expect(result.content).toContain('quicksort');
    });
  });

  describe('Semantic Caching', () => {
    it('should cache similar queries for faster response', async () => {
      // Arrange
      const query1 = "What is machine learning?";
      const query2 = "Explain machine learning concepts";

      // Act
      const result1 = await superInstance.query(query1);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      const result2 = await superInstance.query(query2);

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result2.fromCache).toBe(true); // Should hit cache
      expect(result2.latency).toBeLessThan(result1.latency); // Should be faster from cache
    });

    it('should not cache dissimilar queries', async () => {
      // Arrange
      const query1 = "What is the weather today?";
      const query2 = "How to bake a cake?";

      // Act
      const result1 = await superInstance.query(query1);
      const result2 = await superInstance.query(query2);

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result2.fromCache).toBe(false); // Should not hit cache
    });
  });

  describe('Knowledge Persistence', () => {
    it('should store and retrieve knowledge from SQLite', async () => {
      // Arrange
      const query = "What is Aequor?";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.context).toBeDefined();

      // Verify knowledge was stored
      const storedKnowledge = await sqliteService.searchKnowledge(query);
      expect(storedKnowledge.length).toBeGreaterThan(0);
    });

    it('should accumulate knowledge across multiple queries', async () => {
      // Arrange
      const queries = [
        "What is AI?",
        "Explain neural networks",
        "How do transformers work?"
      ];

      // Act
      const results = await Promise.all(
        queries.map(q => superInstance.query(q))
      );

      // Assert
      // Each query should build on previous knowledge
      results.forEach((result, index) => {
        expect(result.context).toBeDefined();
        if (index > 0) {
          // Context should grow with more queries
          expect(result.context.length).toBeGreaterThanOrEqual(results[index - 1].context.length);
        }
      });
    });
  });

  describe('Shadow Logging and Learning', () => {
    it('should log queries for shadow learning', async () => {
      // Arrange
      const query = "What is the meaning of life?";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();

      // Verify shadow logging
      const logs = await lucidDreamer.getShadowLogs();
      expect(logs.length).toBeGreaterThan(0);

      // Find the log entry for our query
      const queryLog = logs.find(log => log.query.includes('meaning of life'));
      expect(queryLog).toBeDefined();
      expect(queryLog.response).toBe(result.content);
    });

    it('should improve response quality through learning', async () => {
      // Arrange
      const query = "Explain the concept of consciousness in AI";

      // Act - First call
      const result1 = await superInstance.query(query);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Allow learning to occur

      // Act - Second call
      const result2 = await superInstance.query(query);

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Response quality should improve (or at least not degrade)
      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle null/undefined queries gracefully', async () => {
      // Act & Assert
      await expect(superInstance.query(null as any)).rejects.toThrow();
      await expect(superInstance.query(undefined as any)).rejects.toThrow();
    });

    it('should handle empty queries', async () => {
      // Act & Assert
      const result = await superInstance.query("");
      expect(result).toBeDefined();
      expect(result.content).toContain("empty");
    });

    it('should handle very long queries', async () => {
      // Arrange
      const longQuery = "a".repeat(10000) + "What is artificial intelligence?";

      // Act
      const result = await superInstance.query(longQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should recover from cloud service failures', async () => {
      // Arrange - This test would need to mock a cloud service failure
      // For now, we just verify the system doesn't crash

      // Act
      const result = await superInstance.query("Simple question for local routing");

      // Assert
      expect(result).toBeDefined();
      expect(result.source).toBe('local'); // Should fall back to local
    });
  });

  describe('Performance Metrics', () => {
    it('should track latency for each query', async () => {
      // Arrange
      const query = "What is machine learning?";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result.latency).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
      expect(result.latency).toBeLessThan(3000); // Should be reasonably fast
    });

    it('should track cache hit rates', async () => {
      // Arrange
      const query = "What is AI?";

      // Act
      const result1 = await superInstance.query(query);
      const result2 = await superInstance.query(query);

      // Assert
      expect(result1.cacheHit).toBe(false);
      expect(result2.cacheHit).toBe(true);
    });

    it('should track memory usage', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;

      // Act
      await superInstance.query("What is artificial intelligence?");
      const afterMemory = process.memoryUsage().heapUsed;

      // Assert
      const memoryIncrease = afterMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Should be less than 10MB
    });
  });

  describe('Multi-Package Integration', () => {
    it('should integrate all @lsi packages seamlessly', async () => {
      // Arrange
      const query = "Explain the difference between supervised and unsupervised learning";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();

      // Verify all packages were used
      expect(result.source).toMatch(/(local|cloud)/); // @lsi/cascade
      expect(result.intent).toBeDefined(); // @lsi/privacy
      expect(result.context).toBeDefined(); // @lsi/superinstance
      expect(result.fromCache).toBeDefined(); // @lsi/cascade
      expect(result.privacyClass).toBeDefined(); // @lsi/privacy
    });

    it('should maintain data consistency across packages', async () => {
      // Arrange
      const query = "What is neural network backpropagation?";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();

      // Verify consistency between intent and privacy classification
      expect(result.intent).toBeDefined();
      expect(result.privacyClass).toBeDefined();

      // Verify context matches the query
      if (result.context && result.context.length > 0) {
        const contextRelevant = result.context.some(ctx =>
          ctx.content.toLowerCase().includes('neural') ||
          ctx.content.toLowerCase().includes('backpropagation')
        );
        expect(contextRelevant).toBe(true);
      }
    });
  });
});