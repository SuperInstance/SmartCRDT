/**
 * Libcognitive Types Tests
 *
 * Tests for the 4-primitive libcognitive API types:
 * - Meaning (Data → Meaning)
 * - Context (Meaning → Context)
 * - Thought (Meaning + Context → Thought)
 * - Action (Thought → Action)
 *
 * Also tests ATPResponse/ACPResponse type aliases and QueryConstraints.
 */

import { describe, it, expect } from 'vitest';
import {
  // Libcognitive types
  type Meaning,
  type Context,
  type ContextItem,
  type SimilarQuery,
  type Thought,
  type Action,
  // Query constraints
  type QueryConstraints,
  type PrivacyConstraint,
  type BudgetConstraint,
  type PerformanceConstraint,
  type ThermalConstraint,
  type QualityConstraint,
  type ConstraintValue,
  // Type aliases
  type ATPResponse,
  type ACPResponse,
  // Supporting types
  IntentCategory,
  PrivacyLevel,
  type PrivacyClassification,
  type AequorResponse,
} from '../atp-acp.js';

describe('Libcognitive API Types', () => {
  describe('Meaning - Data → Meaning', () => {
    it('should accept valid Meaning with all required fields', () => {
      const embedding = new Array(768).fill(0.1);
      const meaning: Meaning = {
        id: 'meaning-123',
        embedding,
        complexity: 0.7,
        intent: IntentCategory.QUERY,
        type: 'question',
        timestamp: Date.now(),
      };

      expect(meaning.id).toBe('meaning-123');
      expect(meaning.embedding.length).toBe(768);
      expect(meaning.complexity).toBe(0.7);
      expect(meaning.intent).toBe(IntentCategory.QUERY);
    });

    it('should accept Meaning with optional metadata', () => {
      const meaning: Meaning = {
        id: 'meaning-metadata',
        embedding: new Array(768).fill(0),
        complexity: 0.5,
        intent: IntentCategory.CONVERSATION,
        type: 'chat',
        timestamp: Date.now(),
        metadata: { source: 'user-input', language: 'en' },
      };

      expect(meaning.metadata).toBeDefined();
      expect(meaning.metadata?.source).toBe('user-input');
    });

    it('should accept all IntentCategory values in Meaning', () => {
      const intents = [
        IntentCategory.QUERY,
        IntentCategory.COMMAND,
        IntentCategory.CONVERSATION,
        IntentCategory.CODE_GENERATION,
        IntentCategory.ANALYSIS,
        IntentCategory.CREATIVE,
        IntentCategory.DEBUGGING,
        IntentCategory.SYSTEM,
        IntentCategory.UNKNOWN,
      ];

      intents.forEach((intent) => {
        const meaning: Meaning = {
          id: `meaning-${intent}`,
          embedding: new Array(768).fill(0),
          complexity: 0.5,
          intent,
          type: 'test',
          timestamp: Date.now(),
        };
        expect(meaning.intent).toBe(intent);
      });
    });

    it('should accept minimum complexity (0)', () => {
      const meaning: Meaning = {
        id: 'meaning-min-complexity',
        embedding: new Array(768).fill(0),
        complexity: 0,
        intent: IntentCategory.QUERY,
        type: 'simple',
        timestamp: Date.now(),
      };

      expect(meaning.complexity).toBe(0);
    });

    it('should accept maximum complexity (1)', () => {
      const meaning: Meaning = {
        id: 'meaning-max-complexity',
        embedding: new Array(768).fill(0),
        complexity: 1,
        intent: IntentCategory.ANALYSIS,
        type: 'complex',
        timestamp: Date.now(),
      };

      expect(meaning.complexity).toBe(1);
    });

    it('should accept various embedding values', () => {
      const embedding = new Array(768).fill(0).map((_, i) => i / 768);
      const meaning: Meaning = {
        id: 'meaning-varying-embed',
        embedding,
        complexity: 0.5,
        intent: IntentCategory.QUERY,
        type: 'test',
        timestamp: Date.now(),
      };

      expect(meaning.embedding[0]).toBe(0);
      expect(meaning.embedding[767]).toBeCloseTo(0.9987, 3);
    });

    it('should accept zero timestamp', () => {
      const meaning: Meaning = {
        id: 'meaning-zero-time',
        embedding: new Array(768).fill(0),
        complexity: 0.5,
        intent: IntentCategory.QUERY,
        type: 'test',
        timestamp: 0,
      };

      expect(meaning.timestamp).toBe(0);
    });
  });

  describe('Context - Meaning → Context', () => {
    it('should accept valid Context with knowledge items', () => {
      const knowledge: ContextItem[] = [
        {
          content: 'Paris is the capital of France',
          source: 'knowledge-base',
          relevance: 0.9,
          type: 'fact',
        },
      ];

      const context: Context = {
        id: 'context-123',
        meaningId: 'meaning-123',
        knowledge,
        confidence: 0.85,
        timestamp: Date.now(),
      };

      expect(context.id).toBe('context-123');
      expect(context.knowledge.length).toBe(1);
      expect(context.knowledge[0].content).toBe('Paris is the capital of France');
    });

    it('should accept Context with similar queries', () => {
      const similarQueries: SimilarQuery[] = [
        {
          query: 'What is the capital of France?',
          similarity: 0.95,
          response: 'Paris is the capital of France.',
        },
      ];

      const context: Context = {
        id: 'context-similar',
        meaningId: 'meaning-456',
        knowledge: [],
        similarQueries,
        confidence: 0.9,
        timestamp: Date.now(),
      };

      expect(context.similarQueries).toBeDefined();
      expect(context.similarQueries?.length).toBe(1);
      expect(context.similarQueries![0].similarity).toBe(0.95);
    });

    it('should accept Context with optional metadata', () => {
      const context: Context = {
        id: 'context-metadata',
        meaningId: 'meaning-789',
        knowledge: [],
        confidence: 0.8,
        timestamp: Date.now(),
        metadata: { retrievalMethod: 'semantic-search' },
      };

      expect(context.metadata).toBeDefined();
      expect(context.metadata?.retrievalMethod).toBe('semantic-search');
    });

    it('should accept empty knowledge array', () => {
      const context: Context = {
        id: 'context-empty-knowledge',
        meaningId: 'meaning-empty',
        knowledge: [],
        confidence: 0.5,
        timestamp: Date.now(),
      };

      expect(context.knowledge).toEqual([]);
    });

    it('should accept multiple knowledge items', () => {
      const knowledge: ContextItem[] = [
        {
          content: 'Fact 1',
          source: 'source1',
          relevance: 0.9,
          type: 'fact',
        },
        {
          content: 'Fact 2',
          source: 'source2',
          relevance: 0.8,
          type: 'fact',
        },
        {
          content: 'Fact 3',
          source: 'source3',
          relevance: 0.7,
          type: 'fact',
        },
      ];

      const context: Context = {
        id: 'context-multi-knowledge',
        meaningId: 'meaning-multi',
        knowledge,
        confidence: 0.85,
        timestamp: Date.now(),
      };

      expect(context.knowledge.length).toBe(3);
    });

    it('should accept minimum confidence (0)', () => {
      const context: Context = {
        id: 'context-min-conf',
        meaningId: 'meaning-123',
        knowledge: [],
        confidence: 0,
        timestamp: Date.now(),
      };

      expect(context.confidence).toBe(0);
    });

    it('should accept maximum confidence (1)', () => {
      const context: Context = {
        id: 'context-max-conf',
        meaningId: 'meaning-456',
        knowledge: [],
        confidence: 1,
        timestamp: Date.now(),
      };

      expect(context.confidence).toBe(1);
    });
  });

  describe('ContextItem', () => {
    it('should accept valid ContextItem', () => {
      const item: ContextItem = {
        content: 'Test content',
        source: 'test-source',
        relevance: 0.85,
        type: 'text',
      };

      expect(item.content).toBe('Test content');
      expect(item.source).toBe('test-source');
      expect(item.relevance).toBe(0.85);
      expect(item.type).toBe('text');
    });

    it('should accept minimum relevance (0)', () => {
      const item: ContextItem = {
        content: 'Low relevance',
        source: 'source',
        relevance: 0,
        type: 'text',
      };

      expect(item.relevance).toBe(0);
    });

    it('should accept maximum relevance (1)', () => {
      const item: ContextItem = {
        content: 'High relevance',
        source: 'source',
        relevance: 1,
        type: 'text',
      };

      expect(item.relevance).toBe(1);
    });

    it('should accept various types', () => {
      const types = ['text', 'code', 'fact', 'definition', 'example'];

      types.forEach((type) => {
        const item: ContextItem = {
          content: 'Content',
          source: 'source',
          relevance: 0.5,
          type,
        };
        expect(item.type).toBe(type);
      });
    });
  });

  describe('SimilarQuery', () => {
    it('should accept valid SimilarQuery with response', () => {
      const similar: SimilarQuery = {
        query: 'Previous similar query',
        similarity: 0.92,
        response: 'Previous response',
      };

      expect(similar.query).toBe('Previous similar query');
      expect(similar.similarity).toBe(0.92);
      expect(similar.response).toBe('Previous response');
    });

    it('should accept SimilarQuery without response', () => {
      const similar: SimilarQuery = {
        query: 'Query without cached response',
        similarity: 0.88,
      };

      expect(similar.response).toBeUndefined();
    });

    it('should accept minimum similarity (0)', () => {
      const similar: SimilarQuery = {
        query: 'Dissimilar query',
        similarity: 0,
      };

      expect(similar.similarity).toBe(0);
    });

    it('should accept maximum similarity (1)', () => {
      const similar: SimilarQuery = {
        query: 'Identical query',
        similarity: 1,
        response: 'Same response',
      };

      expect(similar.similarity).toBe(1);
    });
  });

  describe('Thought - Meaning + Context → Thought', () => {
    it('should accept valid Thought with all required fields', () => {
      const thought: Thought = {
        id: 'thought-123',
        response: 'This is the generated response',
        confidence: 0.9,
        model: 'llama3.2',
        backend: 'local',
        latency: 150,
        timestamp: Date.now(),
      };

      expect(thought.id).toBe('thought-123');
      expect(thought.response).toBe('This is the generated response');
      expect(thought.confidence).toBe(0.9);
      expect(thought.backend).toBe('local');
    });

    it('should accept Thought with optional reasoning', () => {
      const thought: Thought = {
        id: 'thought-reasoning',
        response: 'Answer with reasoning',
        confidence: 0.85,
        reasoning: 'Step 1: Analyze input\nStep 2: Generate response',
        model: 'mistral',
        backend: 'cloud',
        latency: 200,
        timestamp: Date.now(),
      };

      expect(thought.reasoning).toBeDefined();
      expect(thought.reasoning).toContain('Step 1');
    });

    it('should accept Thought with optional metadata', () => {
      const thought: Thought = {
        id: 'thought-metadata',
        response: 'Response',
        confidence: 0.9,
        model: 'llama3.2',
        backend: 'local',
        latency: 100,
        timestamp: Date.now(),
        metadata: { temperature: 0.7, topP: 0.9 },
      };

      expect(thought.metadata).toBeDefined();
      expect(thought.metadata?.temperature).toBe(0.7);
    });

    it('should accept all backend types', () => {
      const backends: Array<'local' | 'cloud' | 'hybrid'> = ['local', 'cloud', 'hybrid'];

      backends.forEach((backend) => {
        const thought: Thought = {
          id: `thought-${backend}`,
          response: 'Response',
          confidence: 0.9,
          model: 'model',
          backend,
          latency: 100,
          timestamp: Date.now(),
        };
        expect(thought.backend).toBe(backend);
      });
    });

    it('should accept zero latency', () => {
      const thought: Thought = {
        id: 'thought-zero-latency',
        response: 'Cached response',
        confidence: 1.0,
        model: 'model',
        backend: 'local',
        latency: 0,
        timestamp: Date.now(),
      };

      expect(thought.latency).toBe(0);
    });

    it('should accept minimum confidence (0)', () => {
      const thought: Thought = {
        id: 'thought-zero-conf',
        response: 'Uncertain response',
        confidence: 0,
        model: 'model',
        backend: 'cloud',
        latency: 100,
        timestamp: Date.now(),
      };

      expect(thought.confidence).toBe(0);
    });

    it('should accept maximum confidence (1)', () => {
      const thought: Thought = {
        id: 'thought-perfect-conf',
        response: 'Certain response',
        confidence: 1,
        model: 'model',
        backend: 'local',
        latency: 100,
        timestamp: Date.now(),
      };

      expect(thought.confidence).toBe(1);
    });

    it('should accept empty response string', () => {
      const thought: Thought = {
        id: 'thought-empty',
        response: '',
        confidence: 0.5,
        model: 'model',
        backend: 'local',
        latency: 100,
        timestamp: Date.now(),
      };

      expect(thought.response).toBe('');
    });

    it('should accept very long response', () => {
      const longResponse = 'a'.repeat(10000);
      const thought: Thought = {
        id: 'thought-long',
        response: longResponse,
        confidence: 0.9,
        model: 'model',
        backend: 'cloud',
        latency: 500,
        timestamp: Date.now(),
      };

      expect(thought.response.length).toBe(10000);
    });
  });

  describe('Action - Thought → Action', () => {
    it('should accept valid Action with display type', () => {
      const action: Action = {
        id: 'action-display',
        thoughtId: 'thought-123',
        type: 'display',
        output: 'Formatted output for user',
        timestamp: Date.now(),
      };

      expect(action.type).toBe('display');
      expect(action.output).toBe('Formatted output for user');
    });

    it('should accept valid Action with execute type', () => {
      const action: Action = {
        id: 'action-execute',
        thoughtId: 'thought-456',
        type: 'execute',
        output: 'Command to execute',
        result: { success: true },
        timestamp: Date.now(),
      };

      expect(action.type).toBe('execute');
      expect(action.result).toBeDefined();
    });

    it('should accept valid Action with format type', () => {
      const action: Action = {
        id: 'action-format',
        thoughtId: 'thought-789',
        type: 'format',
        output: '{"formatted": "as JSON"}',
        timestamp: Date.now(),
      };

      expect(action.type).toBe('format');
    });

    it('should accept valid Action with store type', () => {
      const action: Action = {
        id: 'action-store',
        thoughtId: 'thought-abc',
        type: 'store',
        output: 'Data to store',
        result: { stored: true, id: 'stored-123' },
        timestamp: Date.now(),
      };

      expect(action.type).toBe('store');
      expect(action.result).toBeDefined();
    });

    it('should accept Action with optional metadata', () => {
      const action: Action = {
        id: 'action-metadata',
        thoughtId: 'thought-metadata',
        type: 'display',
        output: 'Output',
        timestamp: Date.now(),
        metadata: { format: 'markdown', language: 'en' },
      };

      expect(action.metadata).toBeDefined();
      expect(action.metadata?.format).toBe('markdown');
    });

    it('should accept Action without result', () => {
      const action: Action = {
        id: 'action-no-result',
        thoughtId: 'thought-no-result',
        type: 'display',
        output: 'Output without result',
        timestamp: Date.now(),
      };

      expect(action.result).toBeUndefined();
    });

    it('should accept complex result object', () => {
      const complexResult = {
        status: 'success',
        data: { items: [1, 2, 3] },
        metrics: { time: 100, memory: 50 },
      };

      const action: Action = {
        id: 'action-complex-result',
        thoughtId: 'thought-complex',
        type: 'execute',
        output: 'Executed successfully',
        result: complexResult,
        timestamp: Date.now(),
      };

      expect(action.result).toEqual(complexResult);
    });
  });
});

describe('QueryConstraints', () => {
  describe('QueryConstraints Structure', () => {
    it('should accept empty constraints', () => {
      const constraints: QueryConstraints = {};

      expect(Object.keys(constraints).length).toBe(0);
    });

    it('should accept single privacy constraint', () => {
      const constraints: QueryConstraints = {
        privacy: {
          minLevel: 2,
          allowRedaction: true,
        },
      };

      expect(constraints.privacy).toBeDefined();
      expect(constraints.privacy?.minLevel).toBe(2);
    });

    it('should accept all constraint types', () => {
      const constraints: QueryConstraints = {
        privacy: {
          minLevel: 2,
          allowRedaction: true,
          localOnly: false,
        },
        budget: {
          maxCost: 0.01,
          maxCostPerRequest: 0.001,
        },
        performance: {
          maxLatency: 1000,
          minThroughput: 10,
        },
        thermal: {
          maxTemperature: 80,
          maxPower: 50,
        },
        quality: {
          minQuality: 0.8,
          minConfidence: 0.7,
        },
      };

      expect(constraints.privacy).toBeDefined();
      expect(constraints.budget).toBeDefined();
      expect(constraints.performance).toBeDefined();
      expect(constraints.thermal).toBeDefined();
      expect(constraints.quality).toBeDefined();
    });

    it('should accept custom constraints', () => {
      const constraints: QueryConstraints = {
        custom: {
          maxRetries: 3,
          strategy: 'fast',
          enabled: true,
          features: ['feature1', 'feature2'],
        },
      };

      expect(constraints.custom).toBeDefined();
      expect(constraints.custom?.maxRetries).toBe(3);
      expect(Array.isArray(constraints.custom?.features)).toBe(true);
    });
  });

  describe('PrivacyConstraint', () => {
    it('should accept valid privacy constraint', () => {
      const constraint: PrivacyConstraint = {
        minLevel: 2,
        allowRedaction: true,
      };

      expect(constraint.minLevel).toBe(2);
      expect(constraint.allowRedaction).toBe(true);
    });

    it('should accept privacy constraint with localOnly', () => {
      const constraint: PrivacyConstraint = {
        minLevel: 3,
        allowRedaction: true,
        localOnly: true,
      };

      expect(constraint.localOnly).toBe(true);
    });

    it('should accept privacy constraint without localOnly', () => {
      const constraint: PrivacyConstraint = {
        minLevel: 1,
        allowRedaction: false,
      };

      expect(constraint.localOnly).toBeUndefined();
    });

    it('should accept minimum minLevel (0)', () => {
      const constraint: PrivacyConstraint = {
        minLevel: 0,
        allowRedaction: true,
      };

      expect(constraint.minLevel).toBe(0);
    });

    it('should accept maximum minLevel (3 for SOVEREIGN)', () => {
      const constraint: PrivacyConstraint = {
        minLevel: 3,
        allowRedaction: true,
        localOnly: true,
      };

      expect(constraint.minLevel).toBe(3);
    });
  });

  describe('BudgetConstraint', () => {
    it('should accept valid budget constraint with maxCost only', () => {
      const constraint: BudgetConstraint = {
        maxCost: 0.01,
      };

      expect(constraint.maxCost).toBe(0.01);
      expect(constraint.maxCostPerRequest).toBeUndefined();
    });

    it('should accept budget constraint with both fields', () => {
      const constraint: BudgetConstraint = {
        maxCost: 1.0,
        maxCostPerRequest: 0.001,
      };

      expect(constraint.maxCost).toBe(1.0);
      expect(constraint.maxCostPerRequest).toBe(0.001);
    });

    it('should accept zero maxCost', () => {
      const constraint: BudgetConstraint = {
        maxCost: 0,
      };

      expect(constraint.maxCost).toBe(0);
    });

    it('should accept very large maxCost', () => {
      const constraint: BudgetConstraint = {
        maxCost: 10000,
      };

      expect(constraint.maxCost).toBe(10000);
    });
  });

  describe('PerformanceConstraint', () => {
    it('should accept valid performance constraint with maxLatency only', () => {
      const constraint: PerformanceConstraint = {
        maxLatency: 1000,
      };

      expect(constraint.maxLatency).toBe(1000);
      expect(constraint.minThroughput).toBeUndefined();
    });

    it('should accept performance constraint with both fields', () => {
      const constraint: PerformanceConstraint = {
        maxLatency: 500,
        minThroughput: 10,
      };

      expect(constraint.maxLatency).toBe(500);
      expect(constraint.minThroughput).toBe(10);
    });

    it('should accept zero maxLatency', () => {
      const constraint: PerformanceConstraint = {
        maxLatency: 0,
      };

      expect(constraint.maxLatency).toBe(0);
    });

    it('should accept very large maxLatency', () => {
      const constraint: PerformanceConstraint = {
        maxLatency: 60000, // 1 minute
      };

      expect(constraint.maxLatency).toBe(60000);
    });
  });

  describe('ThermalConstraint', () => {
    it('should accept valid thermal constraint with maxTemperature only', () => {
      const constraint: ThermalConstraint = {
        maxTemperature: 80,
      };

      expect(constraint.maxTemperature).toBe(80);
      expect(constraint.maxPower).toBeUndefined();
    });

    it('should accept thermal constraint with both fields', () => {
      const constraint: ThermalConstraint = {
        maxTemperature: 75,
        maxPower: 50,
      };

      expect(constraint.maxTemperature).toBe(75);
      expect(constraint.maxPower).toBe(50);
    });

    it('should accept reasonable temperature values', () => {
      const temps = [0, 25, 50, 75, 100];

      temps.forEach((temp) => {
        const constraint: ThermalConstraint = {
          maxTemperature: temp,
        };
        expect(constraint.maxTemperature).toBe(temp);
      });
    });

    it('should accept power in Watts', () => {
      const powers = [10, 25, 50, 100, 250];

      powers.forEach((power) => {
        const constraint: ThermalConstraint = {
          maxTemperature: 80,
          maxPower: power,
        };
        expect(constraint.maxPower).toBe(power);
      });
    });
  });

  describe('QualityConstraint', () => {
    it('should accept valid quality constraint with minQuality only', () => {
      const constraint: QualityConstraint = {
        minQuality: 0.8,
      };

      expect(constraint.minQuality).toBe(0.8);
      expect(constraint.minConfidence).toBeUndefined();
    });

    it('should accept quality constraint with both fields', () => {
      const constraint: QualityConstraint = {
        minQuality: 0.9,
        minConfidence: 0.85,
      };

      expect(constraint.minQuality).toBe(0.9);
      expect(constraint.minConfidence).toBe(0.85);
    });

    it('should accept minimum minQuality (0)', () => {
      const constraint: QualityConstraint = {
        minQuality: 0,
      };

      expect(constraint.minQuality).toBe(0);
    });

    it('should accept maximum minQuality (1)', () => {
      const constraint: QualityConstraint = {
        minQuality: 1,
      };

      expect(constraint.minQuality).toBe(1);
    });
  });

  describe('ConstraintValue', () => {
    it('should accept number value', () => {
      const value: ConstraintValue = 42;
      expect(typeof value).toBe('number');
    });

    it('should accept string value', () => {
      const value: ConstraintValue = 'strategy';
      expect(typeof value).toBe('string');
    });

    it('should accept boolean value', () => {
      const value: ConstraintValue = true;
      expect(typeof value).toBe('boolean');
    });

    it('should accept number array value', () => {
      const value: ConstraintValue = [1, 2, 3, 4, 5];
      expect(Array.isArray(value)).toBe(true);
    });

    it('should accept floating point numbers', () => {
      const value: ConstraintValue = 3.14159;
      expect(value).toBeCloseTo(3.14159, 5);
    });

    it('should accept negative numbers', () => {
      const value: ConstraintValue = -10;
      expect(value).toBe(-10);
    });
  });
});

describe('ATPResponse and ACPResponse Type Aliases', () => {
  describe('ATPResponse', () => {
    it('should accept valid ATP response with single model', () => {
      const response: ATPResponse = {
        id: 'atp-resp-123',
        content: 'ATP response content',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
      };

      expect(response.protocol).toBe('ATP');
      expect(typeof response.models).toBe('string');
      expect(response.models).toBe('llama3.2');
    });

    it('should accept ATP response with optional fields', () => {
      const response: ATPResponse = {
        id: 'atp-resp-full',
        content: 'Full ATP response',
        protocol: 'ATP',
        models: 'mistral',
        backend: 'cloud',
        confidence: 0.95,
        latency: 200,
        tokensUsed: 50,
        fromCache: false,
        metadata: { temperature: 0.7 },
      };

      expect(response.tokensUsed).toBe(50);
      expect(response.fromCache).toBe(false);
      expect(response.metadata).toBeDefined();
    });

    it('should accept all backend types for ATP', () => {
      const backends: Array<'local' | 'cloud' | 'hybrid'> = ['local', 'cloud', 'hybrid'];

      backends.forEach((backend) => {
        const response: ATPResponse = {
          id: `atp-${backend}`,
          content: 'Response',
          protocol: 'ATP',
          models: 'model',
          backend,
          confidence: 0.9,
          latency: 100,
        };
        expect(response.backend).toBe(backend);
      });
    });
  });

  describe('ACPResponse', () => {
    it('should accept valid ACP response with model array', () => {
      const response: ACPResponse = {
        id: 'acp-resp-123',
        content: 'ACP response content',
        protocol: 'ACP',
        models: ['llama3.2', 'mistral', 'codellama'],
        backend: 'cloud',
        confidence: 0.88,
        latency: 500,
      };

      expect(response.protocol).toBe('ACP');
      expect(Array.isArray(response.models)).toBe(true);
      expect(response.models.length).toBe(3);
    });

    it('should accept ACP response with single model array', () => {
      const response: ACPResponse = {
        id: 'acp-resp-single',
        content: 'Single model ACP',
        protocol: 'ACP',
        models: ['llama3.2'],
        backend: 'local',
        confidence: 0.92,
        latency: 150,
      };

      expect(response.models.length).toBe(1);
      expect(response.models[0]).toBe('llama3.2');
    });

    it('should accept ACP response with optional fields', () => {
      const response: ACPResponse = {
        id: 'acp-resp-full',
        content: 'Full ACP response',
        protocol: 'ACP',
        models: ['model1', 'model2'],
        backend: 'hybrid',
        confidence: 0.9,
        latency: 300,
        tokensUsed: 100,
        fromCache: false,
        metadata: { aggregationMethod: 'voting' },
      };

      expect(response.tokensUsed).toBe(100);
      expect(response.metadata?.aggregationMethod).toBe('voting');
    });

    it('should accept all backend types for ACP', () => {
      const backends: Array<'local' | 'cloud' | 'hybrid'> = ['local', 'cloud', 'hybrid'];

      backends.forEach((backend) => {
        const response: ACPResponse = {
          id: `acp-${backend}`,
          content: 'Response',
          protocol: 'ACP',
          models: ['model1', 'model2'],
          backend,
          confidence: 0.9,
          latency: 200,
        };
        expect(response.backend).toBe(backend);
      });
    });
  });

  describe('Type Alias Compatibility', () => {
    it('should treat ATPResponse as AequorResponse', () => {
      const atpResponse: ATPResponse = {
        id: 'test-1',
        content: 'Content',
        protocol: 'ATP',
        models: 'model',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
      };

      // Should be assignable to AequorResponse
      const aequorResponse: AequorResponse = atpResponse;
      expect(aequorResponse.protocol).toBe('ATP');
    });

    it('should treat ACPResponse as AequorResponse', () => {
      const acpResponse: ACPResponse = {
        id: 'test-2',
        content: 'Content',
        protocol: 'ACP',
        models: ['model1', 'model2'],
        backend: 'cloud',
        confidence: 0.9,
        latency: 200,
      };

      // Should be assignable to AequorResponse
      const aequorResponse: AequorResponse = acpResponse;
      expect(aequorResponse.protocol).toBe('ACP');
    });

    it('should differentiate ATPResponse (string models) from ACPResponse (array models)', () => {
      const atpResp: ATPResponse = {
        id: 'atp',
        content: 'Content',
        protocol: 'ATP',
        models: 'single-model',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
      };

      const acpResp: ACPResponse = {
        id: 'acp',
        content: 'Content',
        protocol: 'ACP',
        models: ['model1', 'model2'],
        backend: 'cloud',
        confidence: 0.9,
        latency: 200,
      };

      expect(typeof atpResp.models).toBe('string');
      expect(Array.isArray(acpResp.models)).toBe(true);
    });
  });
});
