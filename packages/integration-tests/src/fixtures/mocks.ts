import type {
  QueryResult,
  PrivacyClass,
  IntentVector,
  ShadowLog,
  CacheEntry,
  KnowledgeEntryAlias as KnowledgeEntry,
  RoutingDecision,
  Experience,
  Hypothesis,
  TrainingResult,
  Policy
} from '@lsi/protocol';

// Mock adapters and services
export class MockOpenAIAdapter {
  async query(query: string, options?: any): Promise<QueryResult> {
    return {
      success: true,
      data: `Mock AI response to: ${query}`,
      confidence: 0.9,
      latency: 150,
      source: 'cloud',
      complexity: 0.5,
      intent: { category: 'educational', topic: 'ai' },
      context: [],
      timestamp: Date.now()
    };
  }

  async close(): Promise<void> {
    // Mock close
  }
}

export class MockLocalModelAdapter {
  async query(query: string, options?: any): Promise<QueryResult> {
    return {
      data: `Mock local response to: ${query}`,
      confidence: 0.8,
      latency: 50,
      source: 'local',
      complexity: 0.3,
      intent: { category: 'simple', topic: 'general' },
      context: [],
      timestamp: Date.now()
    };
  }

  async close(): Promise<void> {
    // Mock close
  }
}

export class MockEmbeddingService {
  async encode(text: string): Promise<Float32Array> {
    const embedding = new Float32Array(1536);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.random();
    }
    return embedding;
  }

  async similarity(a: Float32Array, b: Float32Array): Promise<number> {
    // Mock similarity calculation
    return Math.random();
  }

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async close(): Promise<void> {
    // Mock close
  }
}

// Mock data fixtures
export const mockQueryResults: QueryResult[] = [
  {
    data: "Artificial intelligence is the simulation of human intelligence by machines.",
    confidence: 0.95,
    latency: 120,
    source: 'cloud',
    complexity: 0.4,
    intent: { category: 'educational', topic: 'ai' },
    context: [],
    timestamp: Date.now()
  },
  {
    data: "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience.",
    confidence: 0.88,
    latency: 95,
    source: 'local',
    complexity: 0.6,
    intent: { category: 'educational', topic: 'ml' },
    context: [],
    timestamp: Date.now()
  }
];

export const mockPrivacyClassifications: PrivacyClass[] = [
  {
    level: 'LOGIC',
    sensitivity: 0.1,
    confidence: 0.95,
    piiData: [],
    analysis: {
      piiRiskLevel: 'LOW',
      compliance: ['GDPR']
    }
  },
  {
    level: 'STYLE',
    sensitivity: 0.4,
    confidence: 0.85,
    piiData: [],
    analysis: {
      piiRiskLevel: 'MEDIUM',
      compliance: ['GDPR']
    }
  },
  {
    level: 'SOVEREIGN',
    sensitivity: 0.9,
    confidence: 0.98,
    piiData: [
      { level: 'ssn', value: '123-45-6789' },
      { level: 'phone', value: '555-123-4567' }
    ],
    analysis: {
      piiRiskLevel: 'HIGH',
      compliance: ['GDPR', 'HIPAA']
    }
  }
];

export const mockIntentVectors: IntentVector[] = [
  {
    embedding: new Float32Array(1536).fill(0.1),
    confidence: 0.9,
    intent: { category: 'educational', topic: 'ai', privacyConcern: 'low' },
    privacyAware: true,
    secure: true,
    piiRisk: 'LOW'
  },
  {
    embedding: new Float32Array(1536).fill(0.7),
    confidence: 0.8,
    intent: { category: 'personal', topic: 'account', privacyConcern: 'high' },
    privacyAware: true,
    secure: true,
    piiRisk: 'HIGH'
  }
];

export const mockShadowLogs: ShadowLog[] = [
  {
    timestamp: Date.now(),
    sessionId: 'session-1',
    query: "What is artificial intelligence?",
    response: "AI is the simulation of human intelligence by machines.",
    confidence: 0.9,
    source: 'cloud',
    latency: 1500,
    metadata: {
      model: 'gpt-4',
      tokens: 150,
      cost: 0.002
    }
  },
  {
    timestamp: Date.now(),
    sessionId: 'session-1',
    query: "How does machine learning work?",
    response: "Machine learning enables computers to learn from data.",
    confidence: 0.85,
    source: 'local',
    latency: 200,
    metadata: {
      model: 'local',
      tokens: 80,
      cost: 0
    }
  }
];

export const mockCacheEntries: CacheEntry[] = [
  {
    key: "What is artificial intelligence?",
    value: "AI definition response",
    metadata: {
      source: 'cloud',
      confidence: 0.9,
      timestamp: Date.now()
    },
    timestamp: Date.now(),
    expiry: Date.now() + 3600000
  },
  {
    key: "Explain machine learning",
    value: "ML explanation response",
    metadata: {
      source: 'cloud',
      confidence: 0.85,
      timestamp: Date.now()
    },
    timestamp: Date.now(),
    expiry: Date.now() + 3600000
  }
];

export const mockKnowledgeEntries: KnowledgeEntry[] = [
  {
    id: 'knowledge-1',
    data: 'Artificial intelligence is intelligence demonstrated by machines',
    level: 'definition',
    source: 'web',
    timestamp: Date.now(),
    metadata: {
      confidence: 0.9,
      tags: ['AI', 'definition']
    }
  },
  {
    id: 'knowledge-2',
    data: 'Machine learning is a method of data analysis that automates analytical model building',
    level: 'explanation',
    source: 'expert',
    timestamp: Date.now(),
    metadata: {
      confidence: 0.85,
      tags: ['ML', 'data analysis']
    }
  }
];

export const mockRoutingDecisions: RoutingDecision[] = [
  {
    target: 'local',
    confidence: 0.85,
    complexityScore: 0.3,
    reasons: ['low_complexity', 'high_confidence'],
    latency: 50,
    fallbackUsed: false
  },
  {
    target: 'cloud',
    confidence: 0.9,
    complexityScore: 0.8,
    reasons: ['high_complexity', 'requires_expertise'],
    latency: 200,
    fallbackUsed: false
  }
];

export const mockExperiences: Experience[] = [
  {
    id: 'exp-1',
    timestamp: Date.now(),
    state: {
      query: 'What is AI?',
      context: ['AI definition'],
      sessionHistory: []
    },
    action: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 100
    },
    reward: 0.9,
    nextReward: 0.85,
    done: true
  },
  {
    id: 'exp-2',
    timestamp: Date.now(),
    state: {
      query: 'Explain neural networks',
      context: ['neural networks'],
      sessionHistory: ['AI definition']
    },
    action: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 150
    },
    reward: 0.8,
    nextReward: 0.75,
    done: true
  }
];

export const mockHypotheses: Hypothesis[] = [
  {
    id: 'hypo-1',
    description: 'GPT-4 performs better than Claude-3 for AI queries',
    level: 'model_selection',
    parameters: {
      model: 'gpt-4',
      domain: 'artificial_intelligence'
    },
    confidence: 0.85,
    evidence: {
      supporting: 25,
      contradicting: 5,
      confidence: 0.9
    },
    createdAt: Date.now(),
    lastUpdated: Date.now()
  },
  {
    id: 'hypo-2',
    description: 'Complexity threshold of 0.7 optimizes routing',
    level: 'routing_optimization',
    parameters: {
      threshold: 0.7,
      domain: 'general'
    },
    confidence: 0.75,
    evidence: {
      supporting: 18,
      contradicting: 7,
      confidence: 0.8
    },
    createdAt: Date.now(),
    lastUpdated: Date.now()
  }
];

export const mockTrainingResults: TrainingResult[] = [
  {
    loss: 0.5,
    accuracy: 0.85,
    reward: 0.8,
    policyUpdated: true,
    totalBatchesProcessed: 100,
    avgBatchTime: 50,
    epochResults: [
      {
        loss: 0.6,
        accuracy: 0.8,
        reward: 0.75
      },
      {
        loss: 0.4,
        accuracy: 0.85,
        reward: 0.8
      }
    ],
    optimizerInfo: {
      learningRate: 0.001,
      weightDecay: 0.01
    }
  }
];

export const mockPolicies: Policy[] = [
  {
    id: 'policy-1',
    version: 1,
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 150,
      routingThreshold: 0.6
    },
    createdAt: Date.now(),
    lastUpdated: Date.now()
  },
  {
    id: 'policy-2',
    version: 2,
    parameters: {
      model: 'gpt-4',
      temperature: 0.6,
      maxTokens: 200,
      routingThreshold: 0.7
    },
    createdAt: Date.now(),
    lastUpdated: Date.now()
  }
];

// Utility functions for test data generation
export function generateMockQueryResult(overrides?: Partial<QueryResult>): QueryResult {
  return {
    data: "Mock response",
    confidence: 0.8,
    latency: 100,
    source: 'mock',
    complexity: 0.5,
    intent: { category: 'general', topic: 'test' },
    context: [],
    timestamp: Date.now(),
    ...overrides
  };
}

export function generateMockPrivacyClassification(overrides?: Partial<PrivacyClass>): PrivacyClass {
  return {
    level: 'LOGIC',
    sensitivity: 0.1,
    confidence: 0.9,
    piiData: [],
    analysis: {
      piiRiskLevel: 'LOW',
      compliance: ['GDPR']
    },
    ...overrides
  };
}

export function generateMockExperience(overrides?: Partial<Experience>): Experience {
  return {
    id: `exp-${Date.now()}`,
    timestamp: Date.now(),
    state: {
      query: 'Mock query',
      context: [],
      sessionHistory: []
    },
    action: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 100
    },
    reward: 0.8,
    nextReward: 0.7,
    done: true,
    ...overrides
  };
}

export function generateMockKnowledgeEntry(overrides?: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: `knowledge-${Date.now()}`,
    data: 'Mock knowledge content',
    level: 'fact',
    source: 'test',
    timestamp: Date.now(),
    metadata: {
      confidence: 0.9,
      tags: ['test']
    },
    ...overrides
  };
}

// Test utility functions
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createTestDatabase(name: string = 'test'): string {
  return `/tmp/${name}-${Date.now()}.db`;
}

export function createTestLogDirectory(): string {
  return `/tmp/test-logs-${Date.now()}/`;
}

export function createTestCacheKey(prefix: string = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// Mock event system for testing
export class MockEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Performance monitoring utilities
export class MockPerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();

  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.timers.delete(name);
    this.setMetric(`${name}_duration`, duration);
    return duration;
  }

  setMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  reset(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}