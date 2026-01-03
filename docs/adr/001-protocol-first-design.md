# ADR 001: Protocol-First Design

**Status:** Accepted
**Date:** 2025-01-15
**Deciders:** Aequor Core Team
**Related:** ADR-002 (Three-Plane Separation), ADR-003 (Cascade Routing)

---

## Context

The Aequor Cognitive Orchestration Platform aims to be a universal, interoperable system for AI request routing and orchestration. We face several challenges:

1. **Ecosystem Growth:** Multiple packages (@lsi/cascade, @lsi/superinstance, @lsi/privacy, @lsi/perf) need to communicate
2. **Version Stability:** Breaking changes in one package shouldn't cascade to others
3. **Clear Contracts:** Implementations need well-defined interfaces without ambiguity
4. **Testability:** Components should be testable in isolation without coupling to implementations
5. **Third-Party Integration:** External vendors should be able to implement our protocols

**Previous Approach (Anti-Pattern):**
```typescript
// ❌ Wrong: Implementation without protocol
// In @lsi/cascade/src/router/CascadeRouter.ts
export interface RouteDecision {
  model: string;
  confidence: number;
  // Types defined inline, not reusable
}

// In @lsi/superinstance/src/intention/IntentionPlane.ts
export interface RouteDecision {
  model: string;
  confidence: number;
  reason?: string;  // Different from above!
  // Duplicated with slight changes
}
```

**Problems with Previous Approach:**
- Type duplication across packages
- Inconsistent interfaces for same concepts
- Tight coupling between packages
- Impossible to swap implementations
- Breaking changes propagate unpredictably

---

## Decision

**Define all interfaces and types in @lsi/protocol with zero dependencies before implementing anywhere else.**

### Protocol Package Structure

```typescript
// packages/protocol/src/index.ts
// Pure TypeScript types - NO dependencies, NO implementations

// ========== Core Types ==========
export interface RouterConfig {
  providers: ProviderProfile[];
  constraints: ConstraintSet;
  cache: CacheConfig;
}

export interface RouteDecision {
  target: ModelReference;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
}

export interface RouteRequest {
  query: string;
  constraints: ConstraintSet;
  context?: RequestContext;
}

// ========== Provider Types ==========
export interface ProviderProfile {
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  cost: CostStructure;
  endpoint: string;
  apiVersion: string;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  modalities: Modality[];
  complexity: ComplexityRange;
}

// ========== Constraint Types ==========
export interface ConstraintSet {
  privacy?: PrivacyConstraint;
  budget?: BudgetConstraint;
  thermal?: ThermalConstraint;
  latency?: LatencyConstraint;
}

export interface PrivacyConstraint {
  level: 'LOGIC' | 'STYLE' | 'SECRET';
  requireRedaction: boolean;
  epsilon?: number;  // For differential privacy
}

export interface BudgetConstraint {
  maxCost: number;
  currency: string;
  perQuery?: number;
}

// ========== Cognitive Types ==========
export interface Meaning {
  embedding: number[];
  complexity: number;
  type: QueryType;
  sentiment?: Sentiment;
}

export interface Context {
  relevantKnowledge: KnowledgeFragment[];
  similarQueries: QueryHistory[];
  domainContext: DomainInfo;
}

export interface Thought {
  response: string;
  confidence: number;
  reasoning: string;
  sources: string[];
}

export interface Action {
  formatted: string;
  executionResult?: unknown;
  metadata: ActionMetadata;
}

// ========== Protocol Buffers ==========
export interface ATPRequest {
  protocol: 'ATP';  // Autonomous Task Processing
  version: string;
  query: string;
  encodedIntent?: number[];  // For privacy
  constraints: ConstraintSet;
}

export interface ACPRequest {
  protocol: 'ACP';  // Assisted Collaborative Processing
  version: string;
  tasks: ATPRequest[];
  orchestration: OrchestrationStrategy;
}
```

### Implementation Protocol

```typescript
// ✅ Correct: Protocol-first implementation

// Step 1: Define in packages/protocol/src/index.ts
export interface SemanticCache {
  get(key: string): Promise<CachedResponse | null>;
  set(key: string, value: CachedResponse): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Step 2: Implement in packages/cascade/src/cache/SemanticCache.ts
import { SemanticCache as ISemanticCache, CachedResponse } from '@lsi/protocol';

export class SemanticCache implements ISemanticCache {
  private redis: Redis;
  private embeddingService: EmbeddingService;

  async get(key: string): Promise<CachedResponse | null> {
    // Implementation details...
  }

  async set(key: string, value: CachedResponse): Promise<void> {
    // Implementation details...
  }

  async invalidate(pattern: string): Promise<void> {
    // Implementation details...
  }
}

// Step 3: Use elsewhere
import { SemanticCache } from '@lsi/protocol';
import { SemanticCacheImpl } from '@lsi/cascade';

function createCache(config: CacheConfig): SemanticCache {
  return new SemanticCacheImpl(config);
}
```

---

## Consequences

### Positive Consequences

**1. Ecosystem Enablement**
- Third parties can implement Aequor protocols without depending on our code
- Vendors can provide adapters that "just work"
- Community contributions follow clear contracts

**2. Version Stability**
- Protocol versioning (v1, v2) allows breaking changes with migration paths
- Implementations can be upgraded independently
- Semantic versioning becomes meaningful

**3. Type Safety Across Boundaries**
- TypeScript compilation catches contract violations
- No runtime type mismatches between packages
- IDE autocomplete works across packages

**4. Testing in Isolation**
- Mock implementations can implement protocol interfaces
- Unit tests don't require real implementations
- Integration tests use protocol definitions as source of truth

**5. Documentation as Code**
- Protocol definitions serve as living documentation
- Examples embedded in types via JSDoc
- Auto-generated API documentation

**6. Zero-Circular Dependencies**
- @lsi/protocol has NO dependencies (by design)
- All other packages depend on @lsi/protocol
- Dependency graph is a DAG (Directed Acyclic Graph)

### Negative Consequences

**1. Upfront Design Overhead**
- Must think about interfaces before implementing
- Can feel like "bureaucracy" for rapid prototyping
- May require interface revisions

**2. Indirection Layer**
- One more file to check when debugging
- Type definitions can become large
- Need to keep protocol and implementation in sync

**3. Learning Curve**
- New contributors must understand protocol-first philosophy
- Need to enforce via code review
- Easy to "just implement" and skip protocol

### Neutral Consequences

**1. File Count**
- More files overall (protocol + implementation)
- Tradeoff: More files, clearer organization

**2. Build Time**
- Slightly longer builds (more type checking)
- Tradeoff: Catch errors at compile time vs. runtime

---

## Examples

### Example 1: Router Protocol

```typescript
// ========== Protocol Definition ==========
// packages/protocol/src/index.ts

export interface Router {
  route(request: RouteRequest): Promise<RouteDecision>;
  updateProfile(profile: ProviderProfile): Promise<void>;
  getStats(): Promise<RouterStats>;
}

export interface RouteRequest {
  query: string;
  constraints: ConstraintSet;
  context?: RequestContext;
}

export interface RouteDecision {
  target: ModelReference;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
}

// ========== Implementation ==========
// packages/cascade/src/router/CascadeRouter.ts

import { Router, RouteRequest, RouteDecision } from '@lsi/protocol';

export class CascadeRouter implements Router {
  constructor(
    private config: RouterConfig,
    private complexityScorer: ComplexityScorer,
    private motivationEncoder: MotivationEncoder
  ) {}

  async route(request: RouteRequest): Promise<RouteDecision> {
    const complexity = await this.complexityScorer.score(request.query);
    const motivation = await this.motivationEncoder.encode(request.query);

    if (complexity < 0.7 && motivation.urgency < 0.5) {
      return {
        target: { provider: 'local', model: 'llama3.2' },
        confidence: 0.85,
        reasoning: 'Simple query with low urgency',
        estimatedCost: 0,
        estimatedLatency: 50
      };
    }

    return {
      target: { provider: 'openai', model: 'gpt-4' },
      confidence: 0.92,
      reasoning: 'Complex query requires advanced reasoning',
      estimatedCost: 0.03,
      estimatedLatency: 1500
    };
  }

  async updateProfile(profile: ProviderProfile): Promise<void> {
    // Update provider profile
  }

  async getStats(): Promise<RouterStats> {
    return {
      totalRequests: 1000,
      localRequests: 800,
      cloudRequests: 200,
      cacheHitRate: 0.75
    };
  }
}

// ========== Usage ==========
// packages/superinstance/src/intention/IntentionPlane.ts

import { Router, RouteRequest } from '@lsi/protocol';
import { CascadeRouter } from '@lsi/cascade';

// Can swap implementations without changing code
const router: Router = new CascadeRouter(config);

const decision = await router.route({
  query: 'What is the capital of France?',
  constraints: { budget: { maxCost: 0.01 } }
});
```

### Example 2: Privacy Protocol

```typescript
// ========== Protocol Definition ==========
// packages/protocol/src/index.ts

export interface PrivacyProtocol {
  classify(query: string): Promise<PrivacyLevel>;
  redact(query: string, level: PrivacyLevel): Promise<RedactedQuery>;
  rehydrate(response: string, metadata: RedactionMetadata): Promise<string>;
}

export type PrivacyLevel = 'LOGIC' | 'STYLE' | 'SECRET';

export interface RedactedQuery {
  query: string;
  metadata: RedactionMetadata;
  encodedIntent?: number[];  // Alternative to query text
}

export interface RedactionMetadata {
  redactions: Redaction[];
  intentHash: string;
}

export interface Redaction {
  start: number;
  end: number;
  type: 'PII' | 'SECRET' | 'CONFIDENTIAL';
  replacement: string;
}

// ========== Implementation ==========
// packages/privacy/src/protocol/RedactionAdditionProtocol.ts

import { PrivacyProtocol, RedactedQuery, PrivacyLevel } from '@lsi/protocol';

export class RedactionAdditionProtocol implements PrivacyProtocol {
  async classify(query: string): Promise<PrivacyLevel> {
    // Classify query sensitivity
    if (this.containsSecret(query)) return 'SECRET';
    if (this.containsStyle(query)) return 'STYLE';
    return 'LOGIC';
  }

  async redact(query: string, level: PrivacyLevel): Promise<RedactedQuery> {
    if (level === 'SECRET') {
      return {
        query: '',  // Send only intent vector
        encodedIntent: await this.encodeIntent(query),
        metadata: {
          redactions: [],
          intentHash: this.hash(query)
        }
      };
    }

    const redactions = await this.findRedactions(query, level);
    const redactedQuery = this.applyRedactions(query, redactions);

    return {
      query: redactedQuery,
      metadata: {
        redactions,
        intentHash: this.hash(query)
      }
    };
  }

  async rehydrate(response: string, metadata: RedactionMetadata): Promise<string> {
    // Restore redacted information based on metadata
    return this.restoreContext(response, metadata);
  }
}
```

---

## Implementation Guidelines

### When to Create Protocol Types

**Create protocol types when:**
1. Multiple packages need to share a type definition
2. External integrators need to implement an interface
3. The type represents a "contract" between components
4. The type will appear in public APIs

**Don't create protocol types when:**
1. The type is used only within a single package
2. The type is an implementation detail
3. The type is likely to change frequently

### Protocol Versioning

```typescript
// Version 1
export interface RouteRequest {
  query: string;
  constraints: ConstraintSet;
}

// Version 2 (breaking change)
export interface RouteRequestV2 {
  query: string;
  constraints: ConstraintSet;
  priority: Priority;  // New required field
}

// Migration helper
export function migrateV1ToV2(v1: RouteRequest): RouteRequestV2 {
  return {
    ...v1,
    priority: 'normal'  // Default value
  };
}
```

### Protocol Documentation

```typescript
/**
 * RouteRequest represents a request for model routing.
 *
 * @example
 * ```typescript
 * const request: RouteRequest = {
 *   query: 'Explain quantum computing',
 *   constraints: {
 *     budget: { maxCost: 0.05 },
 *     privacy: { level: 'LOGIC' }
 *   }
 * };
 * ```
 */
export interface RouteRequest {
  /**
   * The natural language query to route
   */
  query: string;

  /**
   * Constraints for routing decision
   */
  constraints: ConstraintSet;

  /**
   * Optional context for routing (user history, session info)
   */
  context?: RequestContext;
}
```

---

## Testing Strategy

### Protocol Compliance Tests

```typescript
// packages/protocol/src/__tests__/compliance.ts

import { Router } from '../index';

export function testRouterCompliance(router: Router) {
  describe('Router Protocol Compliance', () => {
    it('should route valid requests', async () => {
      const request: RouteRequest = {
        query: 'test query',
        constraints: {}
      };

      const decision = await router.route(request);

      expect(decision).toBeDefined();
      expect(decision.target).toBeDefined();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should update profiles', async () => {
      const profile: ProviderProfile = {
        id: 'test',
        name: 'Test Provider',
        capabilities: { /* ... */ },
        cost: { perToken: 0.001 },
        endpoint: 'https://test.com',
        apiVersion: 'v1'
      };

      await expect(router.updateProfile(profile)).resolves.not.toThrow();
    });
  });
}
```

---

## References

1. [ADR GitHub](https://adr.github.io/) - Architecture Decision Records format
2. [Protocol Buffers](https://developers.google.com/protocol-buffers) - Google's data interchange format
3. [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript documentation
4. [Semantic Versioning 2.0.0](https://semver.org/) - Versioning specification
5. [Interface Segregation Principle](https://en.wikipedia.org/wiki/Interface_segregation_principle) - SOLID principles

---

## Related ADRs

- **ADR-002:** Three-Plane Separation (uses protocol types)
- **ADR-003:** Cascade Routing (implements Router protocol)
- **ADR-004:** Intent Vectors for Privacy (defines PrivacyProtocol)
- **ADR-006:** Redaction-Addition Protocol (implements PrivacyProtocol)

---

**Status:** Accepted
**Last Updated:** 2025-01-15
**Maintained by:** Aequor Core Team
