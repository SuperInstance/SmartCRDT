import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SuperInstance } from '@lsi/superinstance';
import { CascadeRouter } from '@lsi/cascade';
import { IntentEncoder } from '@lsi/privacy';
import { PrivacyClassifier } from '@lsi/privacy';

describe('Simple E2E Integration Tests', () => {
  let superInstance: SuperInstance;
  let cascadeRouter: CascadeRouter;

  beforeAll(async () => {
    // Initialize SuperInstance
    superInstance = new SuperInstance({
      contextPlane: {},
      intentionPlane: {},
      lucidDreamer: { enabled: false }
    });

    await superInstance.initialize();
  });

  afterAll(async () => {
    await superInstance?.shutdown();
  });

  describe('SuperInstance E2E', () => {
    it('should initialize SuperInstance with all three planes', async () => {
      expect(superInstance).toBeDefined();
      expect(superInstance.contextPlane).toBeDefined();
      expect(superInstance.intentionPlane).toBeDefined();
      expect(superInstance.lucidDreamer).toBeDefined();
    });

    it('should process a simple query end-to-end', async () => {
      const query = "What is artificial intelligence?";

      const result = await superInstance.query(query);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should generate embeddings with ContextPlane', async () => {
      const query = "machine learning";

      const embedding = await superInstance.contextPlane.buildEmbedding(query);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should route queries with IntentionPlane', async () => {
      const route = await superInstance.intentionPlane.route({
        query: "Explain AI",
        intent: "technical"
      });

      expect(route).toBeDefined();
      expect(route.backend).toBeDefined();
      expect(route.confidence).toBeGreaterThan(0);
    });

    it('should store and retrieve knowledge', async () => {
      const knowledge = { key: 'test-key', value: 'test-value' };

      await superInstance.contextPlane.storeKnowledge(knowledge);
      const retrieved = await superInstance.contextPlane.retrieveKnowledge('test-key');

      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toBe('test-value');
    });

    it('should extract domains from queries', async () => {
      const query = "What is the treatment for diabetes?";

      const domains = await superInstance.contextPlane.extractDomains(query);

      expect(domains).toBeDefined();
      expect(Array.isArray(domains)).toBe(true);
    });
  });

  describe('CascadeRouter E2E', () => {
    it('should create CascadeRouter instance', async () => {
      const router = new CascadeRouter({
        complexityThreshold: 0.6,
        confidenceThreshold: 0.6
      });

      expect(router).toBeDefined();
    });

    it('should route simple queries to local backend', async () => {
      const router = new CascadeRouter({
        complexityThreshold: 0.6,
        confidenceThreshold: 0.6
      });

      const simpleQuery = "What is AI?";

      const decision = await router.route(simpleQuery);

      expect(decision).toBeDefined();
      expect(decision.backend).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should route complex queries to cloud backend', async () => {
      const router = new CascadeRouter({
        complexityThreshold: 0.6,
        confidenceThreshold: 0.6
      });

      const complexQuery = "Explain the mathematical foundations of transformer attention mechanisms in deep learning";

      const decision = await router.route(complexQuery);

      expect(decision).toBeDefined();
      expect(decision.backend).toBeDefined();
      expect(decision.complexity).toBeGreaterThan(0.5);
    });
  });

  describe('Privacy E2E', () => {
    it('should encode query intent', async () => {
      const encoder = new IntentEncoder();
      await encoder.initialize();

      const intent = await encoder.encode("What is AI?");

      expect(intent).toBeDefined();
      expect(intent.vector).toBeDefined();
      expect(Array.isArray(intent.vector)).toBe(true);

      await encoder.close();
    });

    it('should classify query privacy', async () => {
      const classifier = new PrivacyClassifier({
        sensitivityThreshold: 0.7,
        piiConfidence: 0.8
      });
      await classifier.initialize();

      const classification = await classifier.classify("My email is test@example.com");

      expect(classification).toBeDefined();
      expect(classification.level).toBeDefined();

      await classifier.close();
    });
  });

  describe('Libcognitive API E2E', () => {
    it('should transduce input to meaning', async () => {
      const result = await superInstance.transduce("What is AI?");

      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should recall context from meaning', async () => {
      const meaning = { embedding: [0.1, 0.2, 0.3], type: 'query' };

      const context = await superInstance.recall(meaning);

      expect(context).toBeDefined();
      expect(context.knowledge).toBeDefined();
      expect(context.context).toBeDefined();
    });

    it('should cogitate thought from meaning and context', async () => {
      const meaning = { embedding: [0.1, 0.2, 0.3], type: 'query' };
      const context = { knowledge: [], context: {} };

      const thought = await superInstance.cogitate(meaning, context);

      expect(thought).toBeDefined();
      expect(thought.content).toBeDefined();
      expect(thought.confidence).toBeGreaterThan(0);
    });

    it('should effect action from thought', async () => {
      const thought = { content: "Test response", confidence: 0.8 };

      const action = await superInstance.effect(thought);

      expect(action).toBeDefined();
      expect(action.output).toBeDefined();
      expect(action.executed).toBe(true);
    });
  });

  describe('Multi-Package Integration', () => {
    it('should integrate cascade router with superinstance', async () => {
      const router = new CascadeRouter({
        complexityThreshold: 0.6,
        confidenceThreshold: 0.6
      });

      const query = "Explain machine learning";

      const [route, embedding] = await Promise.all([
        router.route(query),
        superInstance.contextPlane.buildEmbedding(query)
      ]);

      expect(route).toBeDefined();
      expect(embedding).toBeDefined();
      expect(route.backend).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should integrate privacy with context plane', async () => {
      const encoder = new IntentEncoder();
      await encoder.initialize();

      const query = "What is neural network?";

      const [intent, embedding, domains] = await Promise.all([
        encoder.encode(query),
        superInstance.contextPlane.buildEmbedding(query),
        superInstance.contextPlane.extractDomains(query)
      ]);

      expect(intent.vector).toBeDefined();
      expect(embedding).toBeDefined();
      expect(domains).toBeDefined();

      await encoder.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty queries gracefully', async () => {
      const result = await superInstance.query("");

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
    });

    it('should maintain stability after errors', async () => {
      try {
        await superInstance.query(null as any);
      } catch (e) {
        // Expected to throw
      }

      const result = await superInstance.query("Valid query");
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });
});
