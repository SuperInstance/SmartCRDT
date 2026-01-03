# SuperInstance - Three-Plane Cognitive Architecture

**Package:** `@lsi/superinstance`

SuperInstance implements Aequor's three-plane cognitive architecture for sovereign AI inference and memory. It combines Context Plane (memory), Intention Plane (inference), and LucidDreamer (learning) into a unified cognitive system.

## Architecture Overview

SuperInstance is built on three independent but coordinated planes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPERINSTANCE COGNITIVE SYSTEM                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │  Context Plane   │  │ Intention Plane  │  │  LucidDreamer   │ │
│  │                  │  │                  │  │                 │ │
│  │  Semantic Graph  │──│ Intent Encoder   │──│ Shadow Logging  │ │
│  │  Vector Embed.   │  │ Model Selection  │  │ ORPO Training   │ │
│  │  Knowledge Cart. │  │ Constraint Res.  │  │ Hypothesis Gen. │ │
│  │  CRDT Storage    │  │ Execution Engine │  │ Adapter Deploy  │ │
│  │  File Watching   │  │ Cloud Fallback   │  │ Rollback Safety │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
│                                                                   │
│           Shared Protocol Layer (@lsi/protocol)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Sovereign First** - All data stays local by default
2. **Privacy by Design** - Intent encoding, redaction, local embeddings
3. **Progressive Enhancement** - Start with Context, add Intention, enable LucidDreamer
4. **Protocol-Based** - All interfaces defined in `@lsi/protocol`
5. **Hardware Aware** - Adapts to available resources

## Features

### Context Plane - Sovereign Memory

- **Semantic Graph** - Knowledge representation with vector embeddings
- **Vector Storage** - 1536-dim embeddings with OpenAI or compatible services
- **Knowledge Cartridges** - Import/export knowledge packages
- **CRDT Storage** - Conflict-free distributed knowledge sync
- **File Watching** - Automatic codebase monitoring and import parsing
- **Domain Extraction** - Automatic domain classification and tagging
- **LRU Caching** - Efficient memory management with configurable limits

### Intention Plane - Sovereign Inference

- **Intent Encoding** - Privacy-preserving query encoding (768-dim vectors)
- **Model Selection** - Automatic routing based on complexity and confidence
- **Constraint Resolution** - Unified optimization for privacy, budget, latency
- **Execution Engine** - Local Ollama inference with cloud fallback
- **Reasoning Mode** - Chain-of-thought for complex queries

### LucidDreamer - Metabolic Learning

- **Shadow Logging** - Privacy-aware query/response collection
- **Preference Pairs** - Automatic training data generation
- **ORPO Training** - Odds Ratio Policy Optimization for fine-tuning
- **LoRA Adapters** - Efficient adapter training and deployment
- **Hypothesis Generation** - Pattern-based improvement suggestions
- **A/B Testing** - Safe validation with automatic rollback

## Installation

```bash
npm install @lsi/superinstance
```

### Peer Dependencies

```bash
npm install @lsi/protocol @lsi/cascade
```

## Quick Start

### Basic Initialization

```typescript
import { SuperInstance } from '@lsi/superinstance';

// Create SuperInstance with all planes
const instance = new SuperInstance({
  contextPlane: {
    knowledgeStore: new Map(), // or your CRDTStore
    openaiApiKey: process.env.OPENAI_API_KEY
  },
  intentionPlane: {
    router: yourCascadeRouter, // optional
    enableReasoning: true
  },
  lucidDreamer: {
    enabled: true,
    shadowLogger: {
      storageDir: './shadow-logs',
      privacyFilterEnabled: true
    }
  }
});

// Initialize all planes
await instance.initialize();

// Query the system
const result = await instance.query('What is the capital of France?');
console.log(result.content);
```

### Progressive Setup

```typescript
// Start with just context plane
const instance = new SuperInstance({
  contextPlane: true,
  intentionPlane: false,
  lucidDreamer: false
});

// Add intention plane later
await instance.intentionPlane.initialize();

// Enable learning when ready
await instance.lucidDreamer.initialize();
```

## The Three Planes

### Context Plane

The Context Plane provides sovereign memory and semantic understanding.

```typescript
import { ContextPlane } from '@lsi/superinstance';

const context = new ContextPlane({
  knowledgeStore: myCRDTStore,
  openaiApiKey: process.env.OPENAI_API_KEY
});

await context.initialize();

// Store knowledge
await context.storeKnowledge({
  key: 'user:123',
  value: { name: 'Alice', preferences: ['privacy', 'security'] }
});

// Retrieve with semantic search
const results = await context.retrieveContext({
  query: 'users who care about privacy'
});
```

#### Features

- **Semantic Search** - Find knowledge by meaning, not just keywords
- **Import Parsing** - AST-based code analysis for dependency tracking
- **File Watching** - Automatic knowledge graph updates from codebase changes
- **Domain Extraction** - Automatic categorization of knowledge entries
- **Dependency Graph** - Track module relationships and reverse dependencies

#### Configuration

```typescript
interface ContextPlaneConfig {
  knowledgeStore?: any;           // CRDTStore or Map
  embeddingModel?: string;        // Default: 'text-embedding-3-small'
  openaiApiKey?: string;          // Required for embeddings
}
```

### Intention Plane

The Intention Plane handles query classification, routing, and execution.

```typescript
import { IntentionPlane } from '@lsi/superinstance';

const intention = new IntentionPlane({
  router: myCascadeRouter,
  enableReasoning: true
});

await intention.initialize();

// Classify query intent
const classification = await intention.classify('What is quantum computing?');
// { intent: 'explain', confidence: 0.92 }

// Route to appropriate backend
const routing = await intention.route({
  query: 'Explain quantum entanglement',
  intent: 'explain'
});
// { backend: 'local', confidence: 0.85 }
```

#### Features

- **Intent Classification** - Understand query purpose (explain, code, analyze, etc.)
- **Smart Routing** - Balance local vs cloud based on complexity
- **Constraint Resolution** - Optimize for privacy, cost, latency
- **Local Inference** - Ollama integration for local models
- **Cloud Fallback** - Graceful degradation when local fails

#### Configuration

```typescript
interface IntentionPlaneConfig {
  router?: any;                   // CascadeRouter instance
  enableReasoning?: boolean;      // Enable chain-of-thought
  localInference?: {
    enabled: boolean;
    defaultModel: string;         // e.g., 'llama2'
    endpoint: string;
  };
  cloudFallback?: {
    enabled: boolean;
    apiKey?: string;
    baseURL?: string;
  };
}
```

### LucidDreamer

LucidDreamer enables continuous learning and self-improvement.

```typescript
import { LucidDreamer } from '@lsi/superinstance';

const dreamer = new LucidDreamer({
  enabled: true,
  shadowLogger: {
    storageDir: './shadow-logs',
    privacyFilterEnabled: true
  },
  training: {
    trainingDir: './adapters',
    baseModel: 'meta-llama/Llama-2-7b-hf'
  }
});

await dreamer.initialize();

// Log query for learning
const sessionId = await dreamer.logInteraction({
  query: 'Explain async/await in JavaScript',
  queryMetadata: {
    intent: 'explain',
    complexity: 0.6,
    backend: 'local',
    model: 'llama2'
  },
  response: 'Async/await is syntax for...',
  responseMetadata: {
    backend: 'local',
    latency: 450
  },
  userRating: 5
});

// Generate preference pairs for training
const pairs = await dreamer.generatePreferencePairs();

// Train a new adapter
const result = await dreamer.trainAdapter({
  adapterName: 'javascript-explainer-v1',
  minPreferencePairs: 100
});

// Deploy with safety checks
await dreamer.deployAdapter(result.adapterId);
```

#### Features

- **Shadow Logging** - Privacy-aware interaction collection
- **Preference Pairs** - Automatic training data from user feedback
- **ORPO Training** - Odds Ratio Policy Optimization
- **LoRA Adapters** - Efficient fine-tuning without full model retraining
- **Hypothesis Generation** - Pattern-based improvement suggestions
- **Safe Deployment** - Shadow testing, safety checks, automatic rollback

#### Configuration

```typescript
interface LucidDreamerConfig {
  enabled?: boolean;

  shadowLogger?: {
    storageDir?: string;
    maxBufferSize?: number;
    privacyFilterEnabled?: boolean;
  };

  preferenceGenerator?: {
    minQualityScore?: number;
    storageDir?: string;
  };

  training?: {
    trainingDir?: string;
    baseModel?: string;
    loraConfig?: {
      r?: number;              // Rank (default: 8)
      alpha?: number;          // Scaling (default: 16)
      dropout?: number;        // Dropout (default: 0.05)
      targetModules?: string[]; // ['q_proj', 'v_proj']
    };
  };

  adapterManager?: {
    adaptersDir?: string;
    quarantineDir?: string;
    autoRollback?: boolean;
  };
}
```

## Usage Examples

### Complete Query Flow

```typescript
import { SuperInstance } from '@lsi/superinstance';

const instance = new SuperInstance({
  contextPlane: {
    knowledgeStore: myCRDTStore,
    openaiApiKey: process.env.OPENAI_API_KEY
  },
  intentionPlane: {
    router: myRouter,
    enableReasoning: true
  },
  lucidDreamer: {
    enabled: true
  }
});

await instance.initialize();

// Query with full pipeline
const result = await instance.query(
  'How do I implement CRDT merge in TypeScript?'
);

// Result includes metadata
console.log(result.content);
console.log(result.metadata.backend);     // 'local' or 'cloud'
console.log(result.metadata.latency);     // milliseconds
console.log(result.metadata.fromCache);   // boolean
```

### libcognitive API

SuperInstance implements the libcognitive 4-primitive API:

```typescript
// Primitive 1: Data → Meaning
const meaning = await instance.transduce('Explain recursion');
// { embedding: [0.1, 0.2, ...], category: 'explain', confidence: 0.9 }

// Primitive 2: Meaning → Context
const context = await instance.recall(meaning);
// { knowledge: [...], context: {...} }

// Primitive 3: Meaning + Context → Thought
const thought = await instance.cogitate(meaning, context);
// { content: 'Recursion is...', confidence: 0.85 }

// Primitive 4: Thought → Action
const action = await instance.effect(thought);
// { output: 'Recursion is...', executed: true }
```

### Learning Loop

```typescript
// Enable continuous learning
const instance = new SuperInstance({
  lucidDreamer: {
    enabled: true,
    shadowLogger: { privacyFilterEnabled: true }
  }
});

// All queries are logged for learning
await instance.query('How do I use React hooks?');
await instance.query('Explain useEffect dependencies');

// Generate training data
const pairs = await instance.lucidDreamer.generatePreferencePairs();

// Train adapter when enough data
if (pairs.length > 100) {
  const { adapterId } = await instance.lucidDreamer.trainAdapter({
    adapterName: 'react-hooks-helper'
  });

  // Deploy with safety checks
  await instance.lucidDreamer.deployAdapter(adapterId);
}

// System improves over time
const improved = await instance.query('Best practices for useEffect');
```

### File Watching for Codebases

```typescript
const context = new ContextPlane({
  openaiApiKey: process.env.OPENAI_API_KEY
});

await context.initialize();

// Watch codebase for changes
await context.watchFiles({
  paths: ['./src'],
  patterns: ['*.ts', '*.tsx'],
  ignorePatterns: ['node_modules', 'dist'],
  debounceMs: 500
});

// Knowledge graph updates automatically
// Import relationships tracked
// Dependencies monitored

// Get dependency stats
const stats = context.getDependencyGraphStats();
console.log(stats.totalSources);
console.log(stats.averageDependenciesPerSource);

// Stop watching when done
await context.stopWatchingFiles();
```

## Configuration

### Environment Variables

```bash
# OpenAI API for embeddings
OPENAI_API_KEY=sk-...

# Ollama for local inference
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Cloud fallback
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4

# Shadow logging
SHADOW_LOGS_DIR=./shadow-logs
TRAINING_DIR=./adapters
```

### TypeScript Configuration

```typescript
// superinstance.config.ts
import { defineConfig } from '@lsi/superinstance';

export default defineConfig({
  contextPlane: {
    embeddingModel: 'text-embedding-3-small',
    maxEmbeddings: 10000,
    maxKnowledge: 5000,
    fileWatcher: {
      debounceMs: 500,
      maxConcurrent: 10
    }
  },
  intentionPlane: {
    enableReasoning: true,
    routingThreshold: 0.7,
    localInference: {
      enabled: true,
      defaultModel: 'llama2',
      timeout: 30000
    }
  },
  lucidDreamer: {
    enabled: true,
    shadowLogger: {
      maxBufferSize: 1000,
      privacyFilterEnabled: true
    },
    training: {
      loraConfig: {
        r: 8,
        alpha: 16,
        dropout: 0.05
      }
    }
  }
});
```

## Architecture Decisions

### Why Three Planes?

**Separation of Concerns**
- **Context** - What do we know? (Memory)
- **Intention** - What do we want? (Inference)
- **LucidDreamer** - How do we improve? (Learning)

**Independent Evolution**
- Use Context without Intention (pure RAG)
- Use Intention without Context (stateless routing)
- Enable LucidDreamer when ready for learning

**Progressive Adoption**
- Start simple: Context only
- Add intelligence: Intention Plane
- Optimize: LucidDreamer learning

### Trade-offs

| Decision | Pro | Con |
|----------|-----|-----|
| **Three separate planes** | Independent testing, deployment | More complex initialization |
| **OpenAI embeddings** | High quality (1536-dim) | Requires API key, cost |
| **CRDT storage** | Offline-first, multi-agent | More complex than simple Map |
| **Ollama local inference** | Privacy, low latency | Hardware requirements |
| **ORPO training** | No negative pairs needed | More complex than PPO |
| **LoRA adapters** | Efficient fine-tuning | Limited to parameter updates |

## API Reference

### Classes

- **[SuperInstance](./dist/index.d.ts)** - Main orchestration class
- **[ContextPlane](./dist/context/)** - Sovereign memory plane
- **[IntentionPlane](./dist/intention/)** - Sovereign inference plane
- **[LucidDreamer](./dist/luciddreamer/)** - Metabolic learning system

### Types

See [`@lsi/protocol`](../protocol/README.md) for shared types:
- `ContextPlaneConfig`
- `IntentionPlaneConfig`
- `LucidDreamerConfig`
- `SuperInstanceConfig`
- `ShadowLogEntry`
- `PreferencePair`
- `TrainingStatus`
- `TrainedAdapter`

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/smartCRDT.git
cd smartCRDT/demo/packages/superinstance

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

### Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

### Building

```bash
# Build all
npm run build

# Build TypeScript only
npm run build:ts

# Clean
npm run clean
```

## Status and Roadmap

### Current Status

| Component | Status | Completion |
|-----------|--------|------------|
| Context Plane | 🚧 In Development | 60% |
| Intention Plane | 🚧 In Development | 50% |
| LucidDreamer | ✅ Complete | 90% |
| File Watching | ✅ Complete | 100% |
| Import Parsing | ✅ Complete | 100% |

### Known Issues

**P0 (Blocking)**
- ContextPlane using hash-based fake embeddings (needs OpenAI service)
- IntentionPlane IntentEncoder using hash fakes (needs real encoder)
- TypeScript module resolution errors (12 errors)

**P1 (Important)**
- ContextPlane no import parsing implementation
- ContextPlane empty domain extraction
- OllamaAdapter wiring incomplete

### Roadmap

**Phase 1: Foundation (Weeks 1-2)**
- [ ] Fix TypeScript module resolution
- [ ] Implement real embeddings service
- [ ] Wire OllamaAdapter
- [ ] Fix all P0 issues

**Phase 2: Enhancement (Weeks 3-8)**
- [ ] ContextPlane AST parsing
- [ ] ContextPlane domain extraction
- [ ] Privacy layer integration
- [ ] IntentEncoder with real embeddings

**Phase 3: Ecosystem (Weeks 9-12)**
- [ ] Semantic cache (80% hit rate)
- [ ] Cartridge marketplace
- [ ] CLI tool
- [ ] Production documentation

**Phase 4: Advanced (Weeks 13-20)**
- [x] LucidDreamer implementation
- [ ] ORPO training pipeline
- [ ] Rollback mechanism
- [ ] Hypothesis validation

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
npm run build
npm test

# Commit
git commit -m "feat: add X to enable Y"

# Push and create PR
git push origin feature/my-feature
```

## Related Packages

- **[@lsi/protocol](../protocol/)** - Shared type definitions
- **[@lsi/cascade](../cascade/)** - Cascade routing with emotional intelligence
- **[@lsi/privacy](../privacy/)** - Privacy layer (IntentEncoder, R-A Protocol)
- **[@lsi/swarm](../swarm/)** - CRDT storage and multi-agent coordination

## License

MIT

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/smartCRDT/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/smartCRDT/discussions)
- **Docs:** [Full Documentation](https://docs.aequor.ai)

---

**Part of the Aequor Cognitive Orchestration Platform**

Built with sovereignty, privacy, and performance in mind.
