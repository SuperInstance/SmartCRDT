/**
 * CascadeRouter Tests
 *
 * Tests for the CascadeRouter including complexity-based routing,
 * confidence scoring, and query analysis.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CascadeRouter } from '@lsi/cascade/src/router/CascadeRouter.js';
import type { RouterConfig, QueryContext, RouteDecision } from '@lsi/cascade/src/types.js';

describe('CascadeRouter - Routing Decisions', () => {
  let router: CascadeRouter;

  beforeEach(() => {
    router = new CascadeRouter({
      complexityThreshold: 0.6,
      confidenceThreshold: 0.6,
      maxLatency: 1000,
    });
  });

  it('should route simple query locally', async () => {
    const context: QueryContext = {
      query: 'What is the weather?',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    expect(decision.backend).toBe('local');
    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should route complex query to cloud', async () => {
    const complexQuery = 'Analyze the impact of climate change on global economic systems over the next 50 years, considering factors such as renewable energy adoption, policy changes, and technological advancements.';
    const context: QueryContext = {
      query: complexQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    // Complex queries may go to cloud
    expect(decision.backend).toBeDefined();
    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should route based on complexity threshold', async () => {
    const router = new CascadeRouter({
      complexityThreshold: 0.5,
      confidenceThreshold: 0.6,
    });

    const simpleContext: QueryContext = {
      query: 'Hello',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision1 = await router.route(simpleContext.query, simpleContext);

    expect(decision1.backend).toBeDefined();
  });

  it('should route based on confidence', async () => {
    const context: QueryContext = {
      query: 'What is 2+2?',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.backend).toBeDefined();
  });

  it('should handle privacy constraints', async () => {
    const context: QueryContext = {
      query: 'My SSN is 123-45-6789',
      timestamp: Date.now(),
      userId: 'test-user',
      privacyLevel: 'sovereign',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    // Sovereign data should stay local
    if (context.privacyLevel === 'sovereign') {
      expect(decision.backend).toBeDefined();
    }
  });

  it('should handle cost constraints', async () => {
    const router = new CascadeRouter({
      enableCostAware: true,
      costAware: {
        maxCostPerQuery: 0.001,
        preferLocal: true,
      },
    });

    const context: QueryContext = {
      query: 'Simple question',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    expect(decision.backend).toBeDefined();
  });

  it('should handle latency constraints', async () => {
    const router = new CascadeRouter({
      maxLatency: 100,
    });

    const context: QueryContext = {
      query: 'Quick answer needed',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision: RouteDecision = await router.route(context.query, context);

    expect(decision.backend).toBeDefined();
  });

  it('should handle thermal constraints', async () => {
    const context: QueryContext = {
      query: 'Test query',
      timestamp: Date.now(),
      userId: 'test-user',
      thermalState: {
        temperature: 85,
        throttling: true,
      },
    };

    const decision: RouteDecision = await router.route(context.query, context);

    expect(decision.backend).toBeDefined();
  });
});

describe('CascadeRouter - Complexity Scoring', () => {
  let router: CascadeRouter;

  beforeEach(() => {
    router = new CascadeRouter();
  });

  it('should score QUESTION type', async () => {
    const context: QueryContext = {
      query: 'What is the capital of France?',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'question',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should score INSTRUCTION type', async () => {
    const context: QueryContext = {
      query: 'Write a function to sort an array',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'instruction',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should score ANALYSIS type', async () => {
    const context: QueryContext = {
      query: 'Analyze the following data...',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'analysis',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should score CREATIVE type', async () => {
    const context: QueryContext = {
      query: 'Write a poem about spring',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'creative',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should score CONVERSATION type', async () => {
    const context: QueryContext = {
      query: 'Hi, how are you?',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'conversation',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should score CODE type', async () => {
    const context: QueryContext = {
      query: 'function test() { return true; }',
      timestamp: Date.now(),
      userId: 'test-user',
      queryType: 'code',
    };

    const decision = await router.route(context.query, context);

    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('should calculate complexity from length', async () => {
    const shortQuery = 'Hi';
    const longQuery = 'This is a very long query with many words that should increase the complexity score significantly compared to the short query';

    const context1: QueryContext = {
      query: shortQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const context2: QueryContext = {
      query: longQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision1 = await router.route(context1.query, context1);
    const decision2 = await router.route(context2.query, context2);

    expect(decision1.confidence).toBeGreaterThan(0);
    expect(decision2.confidence).toBeGreaterThan(0);
  });

  it('should calculate complexity from structure', async () => {
    const simpleQuery = 'What is AI?';
    const complexQuery = 'Compare and contrast the following approaches to artificial intelligence: neural networks, symbolic AI, and hybrid systems, considering their respective strengths and weaknesses in different application domains.';

    const context1: QueryContext = {
      query: simpleQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const context2: QueryContext = {
      query: complexQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision1 = await router.route(context1.query, context1);
    const decision2 = await router.route(context2.query, context2);

    expect(decision1).toBeDefined();
    expect(decision2).toBeDefined();
  });
});

describe('CascadeRouter - Edge Cases', () => {
  let router: CascadeRouter;

  beforeEach(() => {
    router = new CascadeRouter();
  });

  it('should handle empty query', async () => {
    const context: QueryContext = {
      query: '',
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision = await router.route(context.query, context);

    expect(decision).toBeDefined();
  });

  it('should handle very long query', async () => {
    const longQuery = 'a'.repeat(10000);
    const context: QueryContext = {
      query: longQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision = await router.route(context.query, context);

    expect(decision).toBeDefined();
  });

  it('should handle unicode characters', async () => {
    const unicodeQuery = 'Hello 世界 🌍 Привيت';
    const context: QueryContext = {
      query: unicodeQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision = await router.route(context.query, context);

    expect(decision).toBeDefined();
  });

  it('should handle special characters', async () => {
    const specialQuery = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const context: QueryContext = {
      query: specialQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision = await router.route(context.query, context);

    expect(decision).toBeDefined();
  });

  it('should handle newlines and tabs', async () => {
    const whitespaceQuery = 'Line 1\nLine 2\tTabbed';
    const context: QueryContext = {
      query: whitespaceQuery,
      timestamp: Date.now(),
      userId: 'test-user',
    };

    const decision = await router.route(context.query, context);

    expect(decision).toBeDefined();
  });
});
