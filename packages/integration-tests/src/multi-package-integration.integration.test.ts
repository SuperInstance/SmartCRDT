import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SuperInstance } from '@lsi/superinstance';
import { CascadeRouter, ComplexityScorer, QueryRefiner } from '@lsi/cascade';
import { IntentEncoder, PrivacyClassifier, SemanticPIIRedactor } from '@lsi/privacy';
import { promises as fs } from 'fs';

describe('Multi-Package Integration Test Suite', () => {
  let superInstance: SuperInstance;
  let cascadeRouter: CascadeRouter;
  let queryRefiner: QueryRefiner;
  let complexityScorer: ComplexityScorer;
  let intentEncoder: IntentEncoder;
  let privacyClassifier: PrivacyClassifier;
  let piiRedactor: SemanticPIIRedactor;

  beforeAll(async () => {
    // Initialize all components from different packages
    cascadeRouter = new CascadeRouter({
      complexityThreshold: 0.6,
      confidenceThreshold: 0.6
    });

    queryRefiner = new QueryRefiner();
    complexityScorer = new ComplexityScorer();

    intentEncoder = new IntentEncoder();
    privacyClassifier = new PrivacyClassifier({
      sensitivityThreshold: 0.7,
      piiConfidence: 0.8
    });

    piiRedactor = new SemanticPIIRedactor({
      redactionStrategy: 'replace',
      replaceWith: '[REDACTED]'
    });

    // Initialize all services
    await cascadeRouter.initialize();
    await queryRefiner.initialize();
    await complexityScorer.initialize();
    await intentEncoder.initialize();
    await privacyClassifier.initialize();
    await piiRedactor.initialize();

    // Initialize SuperInstance
    superInstance = new SuperInstance({
      contextPlane: {},
      intentionPlane: {},
      lucidDreamer: { enabled: false }
    });

    await superInstance.initialize();
  });

  afterAll(async () => {
    // Clean up test files
    const filesToClean = [
      '/tmp/test-multi-package.db',
      '/tmp/shadow-logs.json',
      '/tmp/shadow-logs/'
    ];

    for (const file of filesToClean) {
      try {
        if (file.endsWith('.db')) {
          await fs.unlink(file);
        } else if (file.endsWith('/')) {
          await fs.rmdir(file, { recursive: true });
        }
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }

    await superInstance?.shutdown();
    await cascadeRouter?.close();
    await queryRefiner?.close();
    await complexityScorer?.close();
    await intentEncoder?.close();
    await privacyClassifier?.close();
    await piiRedactor?.close();
  });

  describe('End-to-End Multi-Package Flow', () => {
    it('should initialize SuperInstance with all planes', async () => {
      // Assert
      expect(superInstance).toBeDefined();
      expect(superInstance.contextPlane).toBeDefined();
      expect(superInstance.intentionPlane).toBeDefined();
      expect(superInstance.lucidDreamer).toBeDefined();
    });

    it('should process a query through SuperInstance', async () => {
      // Arrange
      const query = "What is artificial intelligence and how does it work?";

      // Act
      const result = await superInstance.query(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content).toContain(query.slice(0, 20));
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.backend).toBeDefined();
    });

    it('should use ContextPlane for embeddings and knowledge', async () => {
      // Arrange
      const query = "machine learning concepts";

      // Act
      const embedding = await superInstance.contextPlane.buildEmbedding(query);

      // Assert
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should use IntentionPlane for routing', async () => {
      // Arrange
      const query = "Explain neural networks";

      // Act
      const route = await superInstance.intentionPlane.route({
        query,
        intent: 'technical'
      });

      // Assert
      expect(route).toBeDefined();
      expect(route.backend).toBeDefined();
      expect(route.confidence).toBeGreaterThan(0);
    });

    it('should classify query privacy with PrivacyClassifier', async () => {
      // Arrange
      const sensitiveQuery = "My email is john@example.com";

      // Act
      const classification = await privacyClassifier.classify(sensitiveQuery);

      // Assert
      expect(classification).toBeDefined();
      expect(classification.level).toBeDefined();
    });

    it('should encode query intent with IntentEncoder', async () => {
      // Arrange
      const query = "What is the capital of France?";

      // Act
      const intent = await intentEncoder.encode(query);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.vector).toBeDefined();
      expect(Array.isArray(intent.vector)).toBe(true);
    });

    it('should redact PII with SemanticPIIRedactor', async () => {
      // Arrange
      const query = "My SSN is 123-45-6789";

      // Act
      const redacted = await piiRedactor.redact(query);

      // Assert
      expect(redacted).toBeDefined();
      expect(redacted.redactedQuery).toBeDefined();
      expect(redacted.redactedQuery).not.toContain('123-45-6789');
    });

    it('should score query complexity with ComplexityScorer', async () => {
      // Arrange
      const simpleQuery = "What is 2 + 2?";
      const complexQuery = "Explain the implications of quantum entanglement on modern cryptography";

      // Act
      const simpleScore = await complexityScorer.score(simpleQuery);
      const complexScore = await complexityScorer.score(complexQuery);

      // Assert
      expect(simpleScore).toBeDefined();
      expect(complexScore).toBeDefined();
      expect(complexScore.complexity).toBeGreaterThan(simpleScore.complexity);
    });

    it('should refine queries with QueryRefiner', async () => {
      // Arrange
      const query = "ai ml";

      // Act
      const refined = await queryRefiner.refine(query);

      // Assert
      expect(refined).toBeDefined();
      expect(refined.refinedQuery).toBeDefined();
      expect(refined.refinedQuery.length).toBeGreaterThan(query.length);
    });

    it('should route queries based on complexity', async () => {
      // Arrange
      const simpleQuery = "What is AI?";
      const complexQuery = "Explain the mathematical foundations of transformer attention mechanisms";

      // Act
      const simpleRoute = await cascadeRouter.route(simpleQuery);
      const complexRoute = await cascadeRouter.route(complexQuery);

      // Assert
      expect(simpleRoute).toBeDefined();
      expect(complexRoute).toBeDefined();
      expect(simpleRoute.backend).toBeDefined();
      expect(complexRoute.backend).toBeDefined();
    });
  });

  describe('Package Dependency Integration', () => {
    it('should demonstrate dependency flow: @lsi/cascade + @lsi/privacy + @lsi/superinstance', async () => {
      // Arrange
      const query = "What is the time complexity of quicksort?";

      // Act
      const complexity = await complexityScorer.score(query);
      const classification = await privacyClassifier.classify(query);
      const embedding = await superInstance.contextPlane.buildEmbedding(query);

      // Assert
      expect(complexity.complexity).toBeGreaterThan(0);
      expect(classification.level).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should handle package composition correctly', async () => {
      // Arrange & Act - All components should work together
      const query = "Explain machine learning";

      const [complexity, classification, embedding] = await Promise.all([
        complexityScorer.score(query),
        privacyClassifier.classify(query),
        superInstance.contextPlane.buildEmbedding(query)
      ]);

      // Assert
      expect(complexity).toBeDefined();
      expect(classification).toBeDefined();
      expect(embedding).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization Across Packages', () => {
    it('should handle concurrent queries efficiently', async () => {
      // Arrange
      const queries = Array(10).fill(null).map((_, i) => `Query ${i}: What is AI?`);

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(query => superInstance.query(query))
      );
      const endTime = Date.now();

      // Assert
      expect(results.length).toBe(queries.length);
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('State Management Across Packages', () => {
    it('should maintain consistent context in ContextPlane', async () => {
      // Arrange
      const knowledge = [
        { key: 'ai', value: 'Artificial Intelligence' },
        { key: 'ml', value: 'Machine Learning' }
      ];

      // Act
      await Promise.all(
        knowledge.map(k => superInstance.contextPlane.storeKnowledge(k))
      );

      const aiKnowledge = await superInstance.contextPlane.retrieveKnowledge('ai');
      const mlKnowledge = await superInstance.contextPlane.retrieveKnowledge('ml');

      // Assert
      expect(aiKnowledge).toBeDefined();
      expect(aiKnowledge?.value).toContain('Intelligence');
      expect(mlKnowledge).toBeDefined();
      expect(mlKnowledge?.value).toContain('Learning');
    });

    it('should extract domains from queries', async () => {
      // Arrange
      const query = "What is the treatment for diabetes?";

      // Act
      const domains = await superInstance.contextPlane.extractDomains(query);

      // Assert
      expect(domains).toBeDefined();
      expect(Array.isArray(domains)).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle empty queries gracefully', async () => {
      // Arrange
      const emptyQuery = "";

      // Act
      const result = await superInstance.query(emptyQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('should handle invalid queries gracefully', async () => {
      // Arrange
      const invalidQuery = null as any;

      // Act & Assert
      try {
        await superInstance.query(invalidQuery);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify system can recover
      const recoveryResult = await superInstance.query("Valid query");
      expect(recoveryResult).toBeDefined();
      expect(recoveryResult.content).toBeDefined();
    });
  });
});
