# @lsi/cascade

**Cascade Router with Emotional Intelligence** - Cost-optimized AI request routing enhanced with temporal awareness, emotional intelligence, and semantic caching.

## Overview

@lsi/cascade is an intelligent routing layer that optimizes AI requests by:

- **Complexity-based routing** - Route simple queries to local models, complex queries to cloud
- **Temporal awareness** - Understand user rhythm and pacing (WPM, acceleration, silence)
- **Emotional intelligence** - Detect user motivation and mood for empathetic decisions
- **Semantic caching** - High-hit-rate caching with 80%+ target hit rate
- **Cost-aware routing** - Budget-conscious routing decisions
- **Shadow logging** - Privacy-preserving analytics for continuous improvement

## Features

- **Complexity-Based Routing** - Automatically assess query complexity and route to optimal model
- **Prosody Detection** - Temporal awareness including words-per-minute, acceleration patterns, and silence detection
- **Motivation Encoding** - 5-dimensional emotional state tracking (Curiosity, Frustration, Confidence, Urgency, Fatigue)
- **Semantic Cache** - Intelligent caching with similarity search and automatic expiration
- **Query Refinement** - Static and semantic query analysis for improvement suggestions
- **Cost Optimization** - Budget tracking and cost-aware routing decisions
- **Shadow Logging** - Privacy-preserving usage analytics with PII detection
- **Health Checks** - Ollama health monitoring and automatic fallback
- **Tier Management** - Request prioritization and queue management
- **Rate Limiting** - Token bucket and sliding window rate limiters

## Installation

```bash
npm install @lsi/cascade
```

## Quick Start

```typescript
import { CascadeRouter } from '@lsi/cascade';

// Initialize router with configuration
const router = new CascadeRouter({
  complexityThreshold: 0.6,  // Route queries below this complexity to local
  enableCache: true,         // Enable semantic caching
  enableCostAware: true,     // Enable budget tracking
  localOnly: false,          // Set to true to disable cloud features
});

// Route a query
const decision = await router.route("Explain quantum computing");

console.log(decision);
// {
//   route: 'local' | 'cloud',
//   confidence: 0.85,
//   reason: 'Query complexity below threshold',
//   suggestedModel: 'llama2',
//   estimatedCost: 0,
//   estimatedLatency: 150
// }

// Provide feedback for learning
await router.feedback({
  queryId: decision.queryId,
  actualLatency: 145,
  satisfied: true
});
```

## Core Components

### CascadeRouter

The main router that orchestrates all routing decisions:

```typescript
import { CascadeRouter, DEFAULT_ROUTER_CONFIG } from '@lsi/cascade';

const router = new CascadeRouter({
  ...DEFAULT_ROUTER_CONFIG,
  complexityThreshold: 0.7,
  enableRefiner: true,
  enableCache: true,
  enableCostAware: true,
  enableShadowLogging: true,
});
```

### QueryRefiner

Analyzes and refines queries for better results:

```typescript
import { QueryRefiner, DEFAULT_REFINER_CONFIG } from '@lsi/cascade';

const refiner = new QueryRefiner(DEFAULT_REFINER_CONFIG);
const refined = await refiner.refine("what is js");

console.log(refined.refinedQuery);
// "What is JavaScript and how does it work?"
```

### ComplexityScorer

Assesses query complexity for routing decisions:

```typescript
import { ComplexityScorer } from '@lsi/cascade';

const scorer = new ComplexityScorer();
const complexity = await scorer.score("Explain quantum entanglement");

console.log(complexity);
// { score: 0.78, factors: { vocabulary: 0.8, length: 0.6, structure: 0.9 } }
```

### ProsodyDetector

Detects temporal patterns and user rhythm:

```typescript
import { ProsodyDetector } from '@lsi/cascade';

const detector = new ProsodyDetector();
const features = await detector.detect({
  wordsPerMinute: 120,
  acceleration: 1.5,
  silenceRatio: 0.1
});

console.log(features);
// { tempo: 'fast', urgency: 'high', suggestedPacing: 'slow-down' }
```

### MotivationEncoder

Encodes emotional state for empathetic routing:

```typescript
import { MotivationEncoder, UserMotivation } from '@lsi/cascade';

const encoder = new MotivationEncoder();
const motivation = await encoder.encode("I'm stuck on this problem");

console.log(motivation);
// {
//   curiosity: 0.8,
//   frustration: 0.9,
//   confidence: 0.3,
//   urgency: 0.7,
//   fatigue: 0.5
// }
```

### SemanticCache

High-hit-rate semantic caching:

```typescript
import { SemanticCache, DEFAULT_SEMANTIC_CACHE_CONFIG } from '@lsi/cascade';

const cache = new SemanticCache(DEFAULT_SEMANTIC_CACHE_CONFIG);

// Store with embedding
await cache.set('query', 'response', embedding);

// Retrieve with similarity search
const result = await cache.get(embedding);
```

## Configuration

### Environment Variables

Create a `.env` file in your project root (copy from `.env.example`):

```bash
# OpenAI Configuration (required for cloud features)
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Ollama Configuration (required for local features)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Model Configuration
EMBEDDING_MODEL=text-embedding-3-small
INFERENCE_MODEL=gpt-4

# Cache Configuration
MAX_CACHE_SIZE=1000
CACHE_TTL=3600

# Logging
LOG_LEVEL=info

# Operation Mode
LOCAL_ONLY=false
```

### Router Config Options

```typescript
interface RouterConfig {
  // Complexity threshold (0-1)
  // Queries below this score route to local models
  complexityThreshold?: number;

  // Enable query refinement
  enableRefiner?: boolean;

  // Enable semantic caching
  enableCache?: boolean;

  // Enable cost-aware routing
  enableCostAware?: boolean;

  // Enable shadow logging for analytics
  enableShadowLogging?: boolean;

  // Disable all cloud features
  localOnly?: boolean;

  // Budget for cost-aware routing (USD)
  monthlyBudget?: number;

  // Rate limiting
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}
```

## Architecture

The Cascade Router implements a **four-layer decision system**:

```
┌─────────────────────────────────────────────────────────────┐
│                      Query Input                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Semantic Cache                             │
│              (Check for similar queries)                     │
└─────────────────────────────────────────────────────────────┘
                            │ (miss)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Complexity Scorer                            │
│           (Assess query complexity 0-1)                      │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Low Complexity     │        │   High Complexity    │
│   (< threshold)      │        │   (>= threshold)     │
│                      │        │                      │
│ Route to Local       │        │ Route to Cloud       │
│ (Ollama)             │        │ (OpenAI)             │
└──────────────────────┘        └──────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Shadow Logger                              │
│              (Privacy-preserving analytics)                  │
└─────────────────────────────────────────────────────────────┘
```

### Decision Factors

1. **Query Complexity** - Vocabulary, structure, and semantic depth
2. **System State** - Thermal, network, and resource availability
3. **Cadence** - User's temporal patterns and pacing
4. **Motivation** - User's emotional state and mood
5. **Budget** - Cost constraints and spending limits
6. **Cache Status** - Previous similar queries

## API Reference

For detailed API documentation, see:

- [Type Definitions](./src/types.ts)
- [Router API](./src/router/CascadeRouter.ts)
- [Refiner API](./src/refiner/QueryRefiner.ts)
- [Cache API](./src/refiner/SemanticCache.ts)

## Usage Examples

### Basic Routing

```typescript
import { CascadeRouter } from '@lsi/cascade';

const router = new CascadeRouter();

const decision = await router.route("What is the capital of France?");
// Routes to local model (simple query)

const decision2 = await router.route("Explain the implications of quantum entanglement on modern cryptography");
// Routes to cloud model (complex query)
```

### With Cost Tracking

```typescript
const router = new CascadeRouter({
  enableCostAware: true,
  monthlyBudget: 100  // $100 USD per month
});

const decision = await router.route("Complex query...");
console.log(decision.estimatedCost);  // Cost in USD
console.log(decision.withinBudget);   // true/false
```

### With Emotional Intelligence

```typescript
const decision = await router.route("I'm so frustrated with this bug");

if (decision.suggestBreak) {
  console.log("The system detected high frustration - suggesting a break");
}

if (decision.suggestBreakdown) {
  console.log("The task seems overwhelming - suggest breaking it down");
}
```

### With Semantic Cache

```typescript
const router = new CascadeRouter({
  enableCache: true,
  cacheConfig: {
    maxSize: 1000,
    ttl: 3600  // 1 hour
  }
});

const decision1 = await router.route("What is JavaScript?");
const decision2 = await router.route("Explain JS");

// Second query hits cache (similar semantic meaning)
console.log(decision2.fromCache);  // true
```

## Performance

Based on research from Dekoninck et al., cascade routing provides:

- **8-14% improvement** in overall system performance
- **90% cost reduction** target through local-first routing
- **Sub-100ms** routing decisions
- **80%+ cache hit rate** with semantic similarity

## Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Submit a pull request

### Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Format code
npm run format

# Build
npm run build
```

## License

MIT License - see LICENSE file for details

## Related Packages

- **@lsi/protocol** - Protocol definitions and type interfaces
- **@lsi/superinstance** - Core cognitive architecture
- **@lsi/privacy** - Privacy-preserving protocols

## Links

- [Main Documentation](../../docs/README.md)
- [Architecture Decisions](../../docs/ARCHITECTURE_DECISIONS.md)
- [Project Roadmap](../../docs/ROADMAP.md)
- [GitHub Repository](https://github.com/SuperInstance/SmartCRDT)

---

**Part of the Aequor Cognitive Orchestration Platform**

For more information, visit [https://github.com/SuperInstance/SmartCRDT](https://github.com/SuperInstance/SmartCRDT)
