# @lsi/protocol

**Shared Type Definitions for the Aequor Cognitive Orchestration Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Protocol Version](https://img.shields.io/badge/protocol-1.0.0-purple)](./src/constants.ts)

---

## Overview

`@lsi/protocol` is the foundation of the Aequor ecosystem. It provides all shared type definitions, interfaces, and protocols used across the Aequor Cognitive Orchestration Platform. Every other package depends on this for type safety and API contracts.

**Design Philosophy:** Protocol-First Design - define interfaces before implementations to enable ecosystem growth, version stability, clear contracts, and testability.

---

## Installation

```bash
npm install @lsi/protocol
```

---

## Type Categories

### 1. Core Common Types
Foundational types used across all packages:

- **Configuration**: `BaseConfig`, `RouterConfig`, `CacheConfig`, `PrivacyConfig`
- **Results**: `BaseResult`, `ValidationResult`, `ExecutionResult`
- **Requests/Responses**: `BaseRequest`, `BaseResponse`, `Adapter`
- **State**: `SystemState`, `AgentState`, `CacheState`
- **Events**: `BaseEvent`, `ErrorEvent`, `SystemEvent`
- **Status**: `StatusInfo`, `HealthStatus`, `HealthCheckResult`
- **Utilities**: `BrandedId`, `DeepPartial`, type guards

### 2. Router Types
Complexity-based routing and model selection:

- `RoutingDecision` - Backend selection with confidence scoring
- `RouterConfig` - Routing behavior configuration
- `ComplexityScorer` - Query complexity assessment
- `CostAwareRoutingResult` - Budget-aware routing decisions

### 3. Cache Types
Semantic caching and invalidation:

- `SemanticCacheConfig` - Cache configuration
- `CacheEntry` - Cached response structure
- `CacheInvalidationStrategy` - TTL, LRU, semantic drift
- `CacheAnalyticsConfig` - Monitoring and optimization
- `CacheWarmingConfig` - Proactive preloading

### 4. Privacy Types
Intent encoding and differential privacy:

- `IntentVector` - Encoded query representation (768-dim)
- `PrivacyLevel` - PUBLIC, LOGIC, STYLE, SECRET
- `PrivacyClassification` - PII detection results
- `PIIType` - Personal data categories
- `RedactionAdditionProtocol` - Functional privacy
- `DifferentialPrivacyConfig` - ε-DP parameters
- `IntentEncoderConfig` - Encoder configuration

### 5. Hardware Types
Hardware-aware resource management:

- `HardwareState` - System hardware profile
- `ThermalState` - Temperature and throttling
- `NUMATopology` - Non-uniform memory access
- `GPUInfo`, `CPUInfo`, `MemoryInfo` - Component details
- `HardwareRoutingDecision` - Hardware-aware dispatch

### 6. ATP/ACP Protocol
Autonomous Task Processing & Assisted Collaborative Processing:

- `ATPacket` - Single-model query format
- `ACPHandshake` - Multi-model collaboration
- `Meaning`, `Context`, `Thought`, `Action` - libcognitive primitives
- `QueryConstraints` - Unified constraint algebra
- `ConstraintSet` - Multi-objective optimization

### 7. CRDT Types
Conflict-free replicated data types:

- `CRDTStore` - Distributed state
- `GCounter`, `PNCounter` - Counters
- `LWWRegister` - Last-write-wins register
- `ORSet` - Observed-remove set

### 8. Federated Learning Types
Distributed privacy-preserving training:

- `FederatedConfig` - Training configuration
- `ModelUpdate` - Client weight updates
- `AggregationResult` - Server aggregation
- `PrivacyBudget` - ε-DP tracking
- `FederatedRound` - Training round metadata

### 9. Adapter Types
Cloud AI provider integrations:

- `OllamaAdapterConfig`, `OllamaGenerateRequest`
- `OpenAIAdapterConfig`, `OpenAIChatRequest`
- `ClaudeAdapterConfig`, `ClaudeChatRequest`
- `GeminiAdapterConfig`, `GeminiChatRequest`
- `CohereAdapterConfig`, `CohereChatRequest`

### 10. Cartridge Protocol
Knowledge cartridge management:

- `CartridgeManifest` - Cartridge metadata
- `CartridgeCapabilities` - Cartridge features
- `CartridgeLifecycle` - Load/unload operations
- `VersionNegotiation` - Version compatibility

### 11. Rollback Protocol
Distributed rollback operations:

- `RollbackRequest` - Rollback trigger
- `ConsensusConfig` - Voting configuration
- `RollbackStrategy` - Rollback approach
- `EmergencyRollbackConfig` - Emergency handling

### 12. Advanced Protocols

**A2UI** - Agent-to-User interface generation
**VL-JEPA** - Vision-language joint embedding architecture
**ZKP** - Zero-knowledge proof protocols
**PHE** - Partially homomorphic encryption
**Input Sanitization** - Injection prevention
**Security Audit** - Vulnerability scanning
**SSO** - Enterprise single sign-on
**Multi-Tenant** - Tenant isolation and quotas

---

## Key Interfaces

### libcognitive API
The 4-primitive API for cognitive operations:

```typescript
// Primitive 1: Data → Meaning
interface Meaning {
  embedding: number[];      // Semantic embedding
  complexity: number;       // 0-1 complexity score
  type: string;            // Query classification
}

// Primitive 2: Meaning → Context
interface Context {
  items: ContextItem[];     // Relevant knowledge
  queries: SimilarQuery[];  // Historical queries
}

// Primitive 3: Meaning + Context → Thought
interface Thought {
  response: string;         // Generated content
  confidence: number;       // Response confidence
  reasoning: string;        // Decision rationale
}

// Primitive 4: Thought → Action
interface Action {
  formatted: string;        // Final output
  execution: string;        // Execution result
}
```

### SuperInstance Interfaces
Three-plane architecture:

```typescript
interface IContextPlane {
  store(key: string, value: unknown): Promise<void>;
  retrieve(query: string): Promise<ContextItem[]>;
  import(path: string): Promise<void>;
}

interface IIntentionPlane {
  encode(query: string): Promise<IntentVector>;
  route(meaning: Meaning): Promise<RoutingDecision>;
}

interface ILucidDreamer {
  train(pair: PreferencePair): Promise<void>;
  hypothesize(): Promise<HypothesisPacket>;
}
```

---

## Usage

### Basic Type Imports

```typescript
import type {
  RouteDecision,
  RouterConfig,
  SemanticCacheConfig,
  IntentVector,
  PrivacyLevel
} from '@lsi/protocol';

// Configure router
const config: RouterConfig = {
  complexityThreshold: 0.6,
  enableCache: true,
  enablePrivacy: true
};

// Use routing decision
const decision: RouteDecision = {
  backend: 'local',
  model: 'llama3.2',
  confidence: 0.85,
  reason: 'Low complexity query',
  appliedPrinciples: ['cost-optimization', 'latency-reduction']
};
```

### Privacy Types

```typescript
import type {
  IntentVector,
  PrivacyClassification,
  RedactionResult
} from '@lsi/protocol';

// Encode query as intent vector
const intent: IntentVector = {
  vector: new Float32Array(768),  // 768-dim embedding
  category: 'QUESTION',
  urgency: 'NORMAL',
  metadata: { originalLength: 42 }
};

// Classify privacy
const classification: PrivacyClassification = {
  level: 'SECRET',
  detectedPII: ['EMAIL', 'PHONE'],
  confidence: 0.92
};
```

### ATP/ACP Protocol

```typescript
import type {
  ATPacket,
  ACPHandshake,
  QueryConstraints
} from '@lsi/protocol';

// Create ATP packet
const packet: ATPacket = {
  id: 'uuid-v4',
  query: 'What is the capital of France?',
  meaning: { /* ... */ },
  constraints: {
    privacy: { level: 'PUBLIC' },
    budget: { maxCost: 0.01 }
  }
};

// Multi-model collaboration
const handshake: ACPHandshake = {
  mode: 'SEQUENTIAL',
  models: ['llama3.2', 'mixtral'],
  aggregation: 'weighted_average'
};
```

### Hardware Types

```typescript
import type {
  HardwareProfile,
  ThermalState,
  HardwareRoutingDecision
} from '@lsi/protocol';

// Hardware profile
const profile: HardwareProfile = {
  gpu: { available: true, model: 'RTX 4090', vram: 24 },
  cpu: { cores: 16, frequency: 3.2 },
  memory: { total: 64, available: 32 },
  thermal: { current: 65, throttling: false }
};

// Hardware-aware routing
const decision: HardwareRoutingDecision = {
  target: 'GPU',
  reason: 'GPU available, thermal headroom sufficient',
  confidence: 0.95
};
```

---

## Extending the Protocol

### Adding New Types

**Step 1: Define in protocol**

```typescript
// packages/protocol/src/my-protocol.ts
export interface MyNewInterface {
  method(input: string): Promise<Result>;
}

export type MyNewType = {
  field: string;
  value: number;
};
```

**Step 2: Export from index**

```typescript
// packages/protocol/src/index.ts
export * from './my-protocol.js';
```

**Step 3: Import elsewhere**

```typescript
// packages/cascade/src/my-module.ts
import type { MyNewInterface, MyNewType } from '@lsi/protocol';

class MyImplementation implements MyNewInterface {
  async method(input: string): Promise<Result> {
    // Implementation
  }
}
```

### Versioning Policy

- **Major versions** indicate breaking changes
- **Minor versions** add new types (backwards compatible)
- **Patch versions** fix doc/comment issues

**Backwards Compatibility:**

```typescript
// ✅ Adding optional fields (backwards compatible)
export interface MyType {
  existing: string;
  newOptional?: number;  // OK
}

// ❌ Changing required fields (breaking change)
export interface MyType {
  existing: string;
  newRequired: number;  // BREAKING - requires major version bump
}

// ❌ Removing fields (breaking change)
export interface MyType {
  // existing: string;  // BREAKING - removed
}
```

---

## Protocol Constants

```typescript
import {
  PROTOCOL_VERSION,
  TYPE_COUNT,
  EMBEDDING_DIMENSIONS,
  DEFAULT_CONSTRAINTS
} from '@lsi/protocol';

console.log(PROTOCOL_VERSION);      // '1.0.0'
console.log(TYPE_COUNT);            // Total number of exported types
console.log(EMBEDDING_DIMENSIONS);  // 768 (OpenAI text-embedding-3)
```

---

## Error Classes

Runtime error handling for protocol violations:

```typescript
import {
  LSIError,
  LSIRoutingError,
  LSISecurityError,
  LSIValidationError
} from '@lsi/protocol';

// Throw protocol errors
throw new LSIRoutingError('No available models', {
  backend: 'local',
  reason: 'Local model not running'
});

throw new LSISecurityError('PII detected in public query', {
  detectedPII: ['EMAIL', 'SSN'],
  confidence: 0.95
});
```

---

## Validation System

```typescript
import {
  ProtocolValidator,
  ValidationResult
} from '@lsi/protocol';

const validator = new ProtocolValidator();

// Validate ATP packet
const result: ValidationResult = validator.validateATPacket(packet);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  console.warn('Warnings:', result.warnings);
}
```

---

## API Reference

Full API documentation is available at:

- **Type Definitions**: [./src/index.ts](./src/index.ts)
- **ATP/ACP Protocol**: [./src/atp-acp.ts](./src/atp-acp.ts)
- **Common Types**: [./src/common.ts](./src/common.ts)
- **Privacy Types**: [./src/atp-acp.ts](./src/atp-acp.ts) (Privacy section)
- **Hardware Types**: [./src/hardware-detection.ts](./src/hardware-detection.ts)
- **Validation**: [./src/validation.ts](./src/validation.ts)

---

## Statistics

- **Total Types**: 500+ (see `TYPE_COUNT` constant)
- **Protocol Modules**: 40+
- **Test Coverage**: 95%+
- **Dependencies**: 0 (zero dependencies by design)

---

## License

MIT

---

## Contributing

When adding new types to `@lsi/protocol`:

1. **Define in protocol first** - Before implementing anywhere else
2. **Document thoroughly** - JSDoc comments on all exports
3. **Version appropriately** - Breaking changes require major version bump
4. **Test validation** - Add validation schemas for complex types
5. **Update this README** - Document new categories

**Design Principles:**

- Zero runtime dependencies
- Pure TypeScript (ESM only)
- Clear contracts over implementation
- Backwards compatibility
- Protocol-first design

---

**Part of the Aequor Cognitive Orchestration Platform**

For more information, see:
- [Main CLAUDE.md](../../CLAUDE.md)
- [Architecture Decisions](../../docs/ARCHITECTURE_DECISIONS.md)
- [Project Roadmap](../../docs/PROJECT_ROADMAP.md)
