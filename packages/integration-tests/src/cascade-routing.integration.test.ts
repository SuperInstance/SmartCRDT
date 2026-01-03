import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { CascadeRouter } from '@lsi/cascade';
import { ComplexityScorer } from '@lsi/cascade';
import { ProsodyDetector } from '@lsi/cascade';
import { MotivationEncoder } from '@lsi/cascade';
import { SemanticCache } from '@lsi/cascade';
import { QueryRefiner } from '@lsi/cascade';
import { LocalModelAdapter } from '@lsi/cascade';
import { OpenAIAdapter } from '@lsi/cascade';
import type { QueryResult, RoutingDecision } from '@lsi/protocol';

describe('Cascade Routing Integration Test Suite', () => {
  let cascadeRouter: CascadeRouter;
  let complexityScorer: ComplexityScorer;
  let prosodyDetector: ProsodyDetector;
  let motivationEncoder: MotivationEncoder;
  let semanticCache: SemanticCache;
  let queryRefiner: QueryRefiner;
  let localModelAdapter: LocalModelAdapter;
  let openAIAdapter: OpenAIAdapter;

  beforeAll(async () => {
    // Initialize components
    complexityScorer = new ComplexityScorer();
    prosodyDetector = new ProsodyDetector();
    motivationEncoder = new MotivationEncoder();
    semanticCache = new SemanticCache({
      maxEntries: 100,
      dimension: 1536,
      similarityThreshold: 0.8
    });
    queryRefiner = new QueryRefiner();

    // Initialize mock adapters
    localModelAdapter = new LocalModelAdapter({
      model: 'mock-local',
      temperature: 0.7,
      maxTokens: 100
    });

    openAIAdapter = new OpenAIAdapter({
      model: 'gpt-4',
      apiKey: 'test-key',
      temperature: 0.7,
      maxTokens: 1000
    });

    // Initialize CascadeRouter
    cascadeRouter = new CascadeRouter({
      localModel: 'mock-local',
      cloudModel: 'gpt-4',
      confidenceThreshold: 0.6,
      complexityThreshold: 0.7
    });

    // Set up the cascade router with all components
    cascadeRouter.initialize({
      complexityScorer,
      prosodyDetector,
      motivationEncoder,
      semanticCache,
      queryRefiner,
      localModelAdapter,
      openAIAdapter
    });
  });

  afterAll(async () => {
    // Clean up adapters
    await localModelAdapter.close();
    await openAIAdapter.close();
  });

  describe('Query Complexity Assessment', () => {
    it('should correctly identify simple queries', async () => {
      // Arrange
      const simpleQueries = [
        "What is 2 + 2?",
        "Hello, how are you?",
        "What is the weather?",
        "Tell me a joke",
        "What time is it?"
      ];

      // Act
      const complexityResults = await Promise.all(
        simpleQueries.map(query => complexityScorer.score(query))
      );

      // Assert
      complexityResults.forEach((complexity, index) => {
        expect(complexity).toBeDefined();
        expect(complexity.value).toBeLessThan(0.7); // Should be simple
        expect(complexity.reasons).toContain('low_word_count');
        expect(complexity.reasons).toContain('simple_structure');
      });
    });

    it('should correctly identify complex queries', async () => {
      // Arrange
      const complexQueries = [
        "Explain the mathematical foundations of quantum computing and how it relates to artificial intelligence, including specific algorithms and their time complexity.",
        "Compare and contrast transformer architectures with convolutional neural networks for computer vision tasks, including their mathematical formulations and performance characteristics.",
        "Analyze the ethical implications of autonomous weapons systems and their impact on international law and human rights.",
        "Provide a comprehensive overview of the history of machine learning from perceptrons to modern deep learning architectures.",
        "Discuss the challenges of implementing artificial general intelligence in resource-constrained environments."
      ];

      // Act
      const complexityResults = await Promise.all(
        complexQueries.map(query => complexityScorer.score(query))
      );

      // Assert
      complexityResults.forEach((complexity, index) => {
        expect(complexity).toBeDefined();
        expect(complexity.value).toBeGreaterThan(0.7); // Should be complex
        expect(complexity.reasons).toContain('high_word_count');
        expect(complexity.reasons).toContain('complex_structure');
      });
    });

    it('should provide nuanced complexity scoring', async () => {
      // Arrange
      const mediumQuery = "What is machine learning and how does it work?";

      // Act
      const complexity = await complexityScorer.score(mediumQuery);

      // Assert
      expect(complexity).toBeDefined();
      expect(complexity.value).toBeGreaterThan(0.4); // More than simple
      expect(complexity.value).toBeLessThan(0.8); // Less than complex
      expect(complexity.reasons).toContain('medium_word_count');
      expect(complexity.details).toBeDefined();
      expect(complexity.details?.wordCount).toBeGreaterThan(0);
    });
  });

  describe('Cascade Routing Decision Making', () => {
    it('should route simple queries to local model', async () => {
      // Arrange
      const simpleQuery = "What is the capital of France?";

      // Act
      const decision = await cascadeRouter.route(simpleQuery);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.target).toBe('local');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.reasons).toContain('low_complexity');
      expect(decision.reasons).toContain('high_confidence');
    });

    it('should route complex queries to cloud model', async () => {
      // Arrange
      const complexQuery = "Analyze the socio-economic impacts of artificial intelligence on global markets and human labor, considering both disruptive and collaborative effects across different industries and regions.";

      // Act
      const decision = await cascadeRouter.route(complexQuery);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.target).toBe('cloud');
      expect(decision.confidence).toBeGreaterThan(0.7);
      expect(decision.reasons).toContain('high_complexity');
      expect(decision.reasons).toContain('requires_expertise');
    });

    it('should route based on confidence threshold', async () => {
      // Arrange
      const ambiguousQuery = "Explain quantum mechanics";

      // Act
      const decision = await cascadeRouter.route(ambiguousQuery);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.target).toMatch(/(local|cloud)/);

      // The decision should be based on the confidence threshold
      if (decision.confidence > 0.6) {
        expect(decision.target).toBe('local');
      } else {
        expect(decision.target).toBe('cloud');
      }
    });

    it('should consider query history for routing', async () => {
      // Arrange
      const query1 = "What is AI?";
      const query2 = "Explain neural networks in detail";

      // Act - First query
      const decision1 = await cascadeRouter.route(query1);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay

      // Act - Second query (similar but more complex)
      const decision2 = await cascadeRouter.route(query2);

      // Assert
      expect(decision1).toBeDefined();
      expect(decision2).toBeDefined();

      // Second query should be more complex
      expect(decision2.complexityScore).toBeGreaterThan(decision1.complexityScore);

      // Second query might be routed to cloud if complexity increases
      if (decision2.complexityScore > 0.7) {
        expect(decision2.target).toBe('cloud');
      }
    });
  });

  describe('Semantic Cache Integration', () => {
    it('should check cache before routing', async () => {
      // Arrange
      const query = "What is machine learning?";

      // Pre-populate cache
      await semanticCache.set("machine learning", {
        embedding: new Float32Array(1536).fill(0.1),
        response: "Machine learning is a subset of AI...",
        timestamp: Date.now(),
        metadata: {
          source: 'cloud',
          confidence: 0.9
        }
      });

      // Act
      const decision = await cascadeRouter.route(query);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.cacheHit).toBe(true);
      expect(decision.reasons).toContain('cache_available');
    });

    it('should bypass cache for high-complexity queries', async () => {
      // Arrange
      const complexQuery = "Explain the mathematical foundations of quantum computing and AI";

      // Pre-populate cache with unrelated content
      await semanticCache.set("unrelated", {
        embedding: new Float32Array(1536).fill(0.1),
        response: "Unrelated response",
        timestamp: Date.now()
      });

      // Act
      const decision = await cascadeRouter.route(complexQuery);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.cacheHit).toBe(false); // Should bypass cache for complex queries
      expect(decision.reasons).toContain('bypass_cache_complexity');
    });
  });

  describe('Query Refinement and Enhancement', () => {
    it('should refine ambiguous queries', async () => {
      // Arrange
      const ambiguousQuery = "What about that thing yesterday?";
      const expectedRefinements = ['context', 'specificity', 'clarity'];

      // Act
      const refined = await queryRefiner.refine(ambiguousQuery);

      // Assert
      expect(refined).toBeDefined();
      expect(refined.refinedQuery).toBeDefined();
      expect(Array.isArray(refined.suggestions)).toBe(true);
      expect(refined.improvements).toBeDefined();
      expect(refined.confidence).toBeGreaterThan(0);

      // Should identify the need for more context
      expect(refined.improvements?.some(imp =>
        imp.includes('context') || imp.includes('specific')
      )).toBe(true);
    });

    it('should not over-refine clear queries', async () => {
      // Arrange
      const clearQuery = "What is artificial intelligence?";

      // Act
      const refined = await queryRefiner.refine(clearQuery);

      // Assert
      expect(refined).toBeDefined();
      expect(refined.refinedQuery).toBe(clearQuery); // Should remain unchanged
      expect(refined.confidence).toBeGreaterThan(0.8);
    });

    it('should maintain query intent during refinement', async () => {
      // Arrange
      const queryWithIntent = "I want to learn about supervised learning algorithms";

      // Act
      const refined = await queryRefiner.refine(queryWithIntent);

      // Assert
      expect(refined).toBeDefined();
      expect(refined.intent).toBeDefined();
      expect(refined.intent?.topic).toBe('machine learning');
      expect(refined.intent?.category).toBe('educational');
    });
  });

  describe('Prosody and Emotional Analysis', () => {
    it('should detect query urgency', async () => {
      // Arrange
      const urgentQuery = "Help! My computer won't start!";
      const normalQuery = "What is the weather today?";

      // Act
      const urgentProsody = await prosodyDetector.analyze(urgentQuery);
      const normalProsody = await prosodyDetector.analyze(normalQuery);

      // Assert
      expect(urgentProsody).toBeDefined();
      expect(normalProsody).toBeDefined();
      expect(urgentProsody.urgency).toBeGreaterThan(normalProsody.urgency);
      expect(urgentProsody.wpm).toBeGreaterThan(0); // Words per minute
    });

    it('should detect query emotional tone', async () => {
      // Arrange
      const frustratedQuery = "I've been trying to fix this for hours and it's not working!";
      const neutralQuery = "How do I reset my password?";

      // Act
      const frustratedEmotion = await prosodyDetector.analyze(frustratedQuery);
      const neutralEmotion = await prosodyDetector.analyze(neutralQuery);

      // Assert
      expect(frustratedEmotion).toBeDefined();
      expect(neutralEmotion).toBeDefined();
      expect(frustratedEmotion.emotion.tension).toBeGreaterThan(neutralEmotion.emotion.tension);
    });

    it('should adapt routing based on emotional state', async () => {
      // Arrange
      const frustratedQuery = "I can't make this work! Why is it so complicated?";

      // Act
      const decision = await cascadeRouter.route(frustratedQuery);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.emotionalConsiderations).toBeDefined();

      // Should consider emotional state in routing
      const emotional = decision.emotionalConsiderations;
      if (emotional?.frustration > 0.5) {
        expect(decision.reasons).toContain('high_frustration');
        // Might prioritize simpler responses or support routing
      }
    });
  });

  describe('Motivation and Intent Analysis', () => {
    it('should identify user motivation patterns', async () => {
      // Arrange
      const curiousQuery = "I'm curious about how neural networks learn";
      const urgentQuery = "I need to fix this bug immediately!";
      const creativeQuery = "I want to build a new app using AI";

      // Act
      const curiousMotivation = await motivationEncoder.encode(curiousQuery);
      const urgentMotivation = await motivationEncoder.encode(urgentQuery);
      const creativeMotivation = await motivationEncoder.encode(creativeQuery);

      // Assert
      expect(curiousMotivation).toBeDefined();
      expect(urgentMotivation).toBeDefined();
      expect(creativeMotivation).toBeDefined();

      // Different motivations should be detected
      expect(curiousMotivation.curiosity).toBeGreaterThan(0.5);
      expect(urgentMotivation.urgency).toBeGreaterThan(0.5);
      expect(creativeMotivation.creativity).toBeGreaterThan(0.5);
    });

    it('should influence routing based on motivation', async () => {
      // Arrange
      const educationalQuery = "Teach me about quantum computing";
      const practicalQuery = "Fix this code error for me";

      // Act
      const educationalDecision = await cascadeRouter.route(educationalQuery);
      const practicalDecision = await cascadeRouter.route(practicalQuery);

      // Assert
      expect(educationalDecision).toBeDefined();
      expect(practicalDecision).toBeDefined();

      // Educational queries might route to more comprehensive sources
      if (educationalDecision.motivation?.creativity > 0.5) {
        expect(educationalDecision.reasons).toContain('educational_content');
      }

      // Practical queries might route to faster, more direct sources
      if (practicalDecision.motivation?.urgency > 0.5) {
        expect(practicalDecision.reasons).toContain('practical_assistance');
      }
    });
  });

  describe('Routing Consistency and Reliability', () => {
    it('should produce consistent routing decisions for same query', async () => {
      // Arrange
      const query = "What is machine learning?";

      // Act
      const decision1 = await cascadeRouter.route(query);
      const decision2 = await cascadeRouter.route(query);

      // Assert
      expect(decision1.target).toBe(decision2.target);
      expect(Math.abs(decision1.confidence - decision2.confidence)).toBeLessThan(0.1);
    });

    it('should handle edge cases gracefully', async () => {
      // Arrange
      const edgeCases = [
        "", // Empty query
        "   ", // Whitespace only
        "a", // Single character
        "a".repeat(10000), // Very long query
        null, // Null query (handled in test)
        undefined // Undefined query (handled in test)
      ];

      // Act & Assert
      for (const query of edgeCases) {
        if (query === null || query === undefined) {
          await expect(cascadeRouter.route(query as any)).rejects.toThrow();
        } else {
          const decision = await cascadeRouter.route(query);
          expect(decision).toBeDefined();
          expect(decision.target).toMatch(/(local|cloud)/);
        }
      }
    });

    it('should provide fallback routing when components fail', async () => {
      // Arrange - This would require mocking component failures
      const query = "What is AI?";

      // Act
      const decision = await cascadeRouter.route(query);

      // Assert
      expect(decision).toBeDefined();
      expect(decision.target).toMatch(/(local|cloud)/);
      expect(decision.fallbackUsed).toBeDefined();

      // Even with fallback, should make a reasonable decision
      if (decision.fallbackUsed) {
        expect(decision.reasons).toContain('fallback_routing');
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should track routing latency', async () => {
      // Arrange
      const query = "What is machine learning?";

      // Act
      const decision = await cascadeRouter.route(query);

      // Assert
      expect(decision.latency).toBeGreaterThan(0);
      expect(decision.latency).toBeLessThan(1000); // Should be fast
    });

    it('should track decision confidence scores', async () => {
      // Arrange
      const queries = [
        "Hello",
        "What is AI?",
        "Explain quantum computing in detail"
      ];

      // Act
      const decisions = await Promise.all(
        queries.map(query => cascadeRouter.route(query))
      );

      // Assert
      decisions.forEach(decision => {
        expect(decision.confidence).toBeGreaterThan(0);
        expect(decision.confidence).toBeLessThanOrEqual(1);
      });

      // More complex queries should have lower confidence
      expect(decisions[0].confidence).toBeGreaterThan(decisions[2].confidence);
    });

    it('should maintain high throughput', async () => {
      // Arrange
      const queryCount = 100;
      const query = "What is AI?";

      // Act
      const startTime = Date.now();
      const decisions = await Promise.all(
        Array(queryCount).fill(null).map(() => cascadeRouter.route(query))
      );
      const endTime = Date.now();

      // Assert
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / queryCount;
      const throughput = queryCount / (totalTime / 1000); // Queries per second

      expect(avgLatency).toBeLessThan(100); // Average latency under 100ms
      expect(throughput).toBeGreaterThan(10); // 10+ queries per second
    });
  });
});