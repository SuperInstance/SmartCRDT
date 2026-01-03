# ADR 002: Three-Plane Separation

**Status:** Accepted
**Date:** 2025-01-20
**Deciders:** Aequor Core Team
**Related:** ADR-001 (Protocol-First Design), ADR-003 (Cascade Routing)

---

## Context

The SuperInstance component serves as the central orchestrator for the Aequor Cognitive Orchestration Platform. Initially designed as a monolithic "agent OS," it grew to 74,000 lines of code with blurred responsibilities and tight coupling between:

1. **Memory/Knowledge:** Long-term storage, semantic search, knowledge cartridges
2. **Inference/Reasoning:** Query processing, model selection, intent encoding
3. **Learning/Adaptation:** Training, feedback, hypothesis generation, ORPO

### Problems with Monolithic Design

**1. Unclear Boundaries**
```typescript
// ❌ Anti-pattern: Mixed responsibilities
class SuperInstance {
  // Memory operations
  async storeMemory(key: string, value: any) { /* ... */ }

  // Inference operations
  async processQuery(query: string) { /* ... */ }

  // Learning operations
  async trainModel(samples: TrainingSample[]) { /* ... */ }

  // Cross-cutting concerns (bad!)
  async processQuery(query: string) {
    const memory = await this.storeMemory(query, { /* ... */ });
    const inference = await this.processQuery(query);
    const training = await this.trainModel([inference]);
    // Three different concerns in one method
  }
}
```

**2. Testing Challenges**
- Cannot test memory without inference
- Cannot test inference without learning
- Integration tests required for everything

**3. Deployment Constraints**
- Must deploy entire system even if only using one component
- Cannot scale memory independently from inference
- All-or-nothing adoption

**4. Progressive Adoption Blocked**
- Users want memory-only (RAG) without inference
- Users want inference-only without local learning
- Users want learning-only with external inference

**5. Team Coordination**
- Multiple teams working on same codebase
- Merge conflicts across unrelated features
- Blocked releases due to unrelated changes

### Industry Examples

Similar separation patterns in other systems:

| System | Separation | Purpose |
|--------|------------|---------|
| **PostgreSQL** | Storage + Query + Planner | Independent optimization |
| **Kubernetes** | etcd + API Server + Scheduler | Scalability |
| **Browser** | Storage + Renderer + JS Engine | Security & Performance |
| **LLM Stack** | Vector DB + Inference + Training | Modularity |

---

## Decision

**Split SuperInstance into three independent planes with clear responsibilities and minimal coupling.**

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         SuperInstance                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │  Context Plane   │  │ Intention Plane  │  │  LucidDreamer   │ │
│  │                  │  │                  │  │                 │ │
│  │  Sovereign Memory│  │Sovereign Inference│ │ Metabolic Lrng  │ │
│  │                  │  │                  │  │                 │ │
│  │  • Semantic Graph│  │  • IntentEncoder │  │  • ORPO Trainer │ │
│  │  • Vector Store  │  │  • Model Router  │  │  • Hypothesis   │ │
│  │  • Knowledge Cart│  │  • Query Refiner │  │  • Shadow Log   │ │
│  │  • CRDT Sync     │  │  • Cascade Route │  │  • Adaptation   │ │
│  │                  │  │                  │  │                 │ │
│  │  recall()        │  │  transduce()     │  │  dream()        │ │
│  │  remember()      │  │  cogitate()      │  │  learn()        │ │
│  │  forget()        │  │  intend()        │  │  hypothesize()  │ │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘ │
│                                                                   │
│                  Protocol Layer (@lsi/protocol)                   │
│                   (Well-defined contracts)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Three Planes Defined

#### 1. Context Plane (Memory)

**Responsibility:** Sovereign memory management

```typescript
// packages/superinstance/src/context/ContextPlane.ts

export interface ContextPlane {
  /**
   * recall - Retrieve relevant context for a query
   * @param signal - The meaning to search for
   * @returns Relevant knowledge fragments
   */
  recall(signal: Meaning): Promise<Context>;

  /**
   * remember - Store new knowledge
   * @param knowledge - The knowledge to store
   */
  remember(knowledge: KnowledgeFragment): Promise<void>;

  /**
   * forget - Remove knowledge
   * @param id - The knowledge ID to forget
   */
  forget(id: string): Promise<void>;

  /**
   * import - Load knowledge cartridge
   * @param cartridge - The cartridge to import
   */
  import(cartridge: KnowledgeCartridge): Promise<void>;

  /**
   * export - Export knowledge as cartridge
   * @param filter - Optional filter for what to export
   */
  export(filter?: ExportFilter): Promise<KnowledgeCartridge>;
}
```

**Key Features:**
- Semantic graph storage (entities, relationships)
- Vector similarity search (embeddings)
- CRDT-based synchronization (multi-device, multi-agent)
- Knowledge cartridges (portable knowledge bundles)
- Domain extraction (AST parsing, import analysis)

**Does NOT:**
- Process queries
- Make routing decisions
- Train models
- Execute inference

#### 2. Intention Plane (Inference)

**Responsibility:** Sovereign inference orchestration

```typescript
// packages/superinstance/src/intention/IntentionPlane.ts

export interface IntentionPlane {
  /**
   * transduce - Convert data to meaning
   * @param input - Raw input (text, audio, image)
   * @returns Parsed meaning with embedding
   */
  transduce(input: string): Promise<Meaning>;

  /**
   * intend - Formulate an intention for a query
   * @param signal - The meaning to intend
   * @param context - Optional context from ContextPlane
   * @returns Intention with routing decision
   */
  intend(signal: Meaning, context?: Context): Promise<Intention>;

  /**
   * cogitate - Reason and generate response
   * @param intention - The intention to cogitate on
   * @returns Generated thought/response
   */
  cogitate(intention: Intention): Promise<Thought>;

  /**
   * effect - Execute an intention
   * @param intention - The intention to effect
   * @returns Execution result
   */
  effect(intention: Intention): Promise<ActionResult>;
}
```

**Key Features:**
- Intent encoding (privacy-preserving query representation)
- Model routing (cascade, intent-based, hardware-aware)
- Query refinement (prosody, motivation, complexity)
- Privacy classification (LOGIC/STYLE/SECRET)
- Constraint satisfaction (privacy, budget, thermal, latency)

**Does NOT:**
- Store long-term memory
- Train models
- Manage knowledge cartridges
- Sync across devices

#### 3. LucidDreamer (Learning)

**Responsibility:** Metabolic learning and adaptation

```typescript
// packages/superinstance/src/luciddreamer/LucidDreamer.ts

export interface LucidDreamer {
  /**
   * dream - Generate and test hypotheses
   * @param observations - Recent observations to dream about
   * @returns Generated hypotheses
   */
  dream(observations: Observation[]): Promise<Hypothesis[]>;

  /**
   * learn - Train from feedback
   * @param samples - Training samples with rewards
   * @returns Training metrics
   */
  learn(samples: TrainingSample[]): Promise<TrainingMetrics>;

  /**
   * hypothesize - Generate new routing strategies
   * @param context - Current system state
   * @returns Proposed strategies
   */
  hypothesize(context: SystemContext): Promise<Strategy[]>;

  /**
   * adapt - Adapt model behavior
   * @param feedback - User feedback
   * @returns Adaptation results
   */
  adapt(feedback: UserFeedback): Promise<AdaptationResult>;
}
```

**Key Features:**
- Shadow logging (record queries/responses without user impact)
- ORPO training (Odds Ratio Policy Optimization)
- Hypothesis generation (automated A/B testing)
- Feedback integration (user preferences, explicit/corrective)
- Model fine-tuning (local model adaptation)

**Does NOT:**
- Process user queries directly
- Store long-term knowledge
- Make routing decisions (only suggests)

### Protocol Definitions

```typescript
// packages/protocol/src/index.ts

// ========== Context Plane Protocol ==========
export interface ContextPlane {
  recall(signal: Meaning): Promise<Context>;
  remember(knowledge: KnowledgeFragment): Promise<void>;
  forget(id: string): Promise<void>;
  import(cartridge: KnowledgeCartridge): Promise<void>;
  export(filter?: ExportFilter): Promise<KnowledgeCartridge>;
}

// ========== Intention Plane Protocol ==========
export interface IntentionPlane {
  transduce(input: string): Promise<Meaning>;
  intend(signal: Meaning, context?: Context): Promise<Intention>;
  cogitate(intention: Intention): Promise<Thought>;
  effect(intention: Intention): Promise<ActionResult>;
}

// ========== LucidDreamer Protocol ==========
export interface LucidDreamer {
  dream(observations: Observation[]): Promise<Hypothesis[]>;
  learn(samples: TrainingSample[]): Promise<TrainingMetrics>;
  hypothesize(context: SystemContext): Promise<Strategy[]>;
  adapt(feedback: UserFeedback): Promise<AdaptationResult>;
}

// ========== Data Flow Types ==========
export interface Meaning {
  embedding: number[];
  complexity: number;
  type: QueryType;
  sentiment?: Sentiment;
  prosody?: Prosody;
}

export interface Context {
  relevantKnowledge: KnowledgeFragment[];
  similarQueries: QueryHistory[];
  domainContext: DomainInfo;
}

export interface Intention {
  encodedQuery: number[];  // Privacy-preserving
  targetModel: ModelReference;
  strategy: RoutingStrategy;
  confidence: number;
}

export interface Thought {
  response: string;
  confidence: number;
  reasoning: string;
  sources: string[];
}

export interface ActionResult {
  success: boolean;
  result: unknown;
  metadata: ActionMetadata;
}
```

### Interaction Patterns

#### Pattern 1: Independent Use

```typescript
// Use Context Plane alone (RAG system)
const contextPlane = new ContextPlane(config);
const context = await contextPlane.recall(meaning);

// Use Intention Plane alone (stateless inference)
const intentionPlane = new IntentionPlane(config);
const thought = await intentionPlane.cogitate(intention);

// Use LucidDreamer alone (training system)
const lucidDreamer = new LucidDreamer(config);
await lucidDreamer.learn(trainingSamples);
```

#### Pattern 2: Context + Intention (RAG + Inference)

```typescript
const contextPlane = new ContextPlane(contextConfig);
const intentionPlane = new IntentionPlane(intentionConfig);

// Step 1: Recall context
const meaning = await intentionPlane.transduce(query);
const context = await contextPlane.recall(meaning);

// Step 2: Cogitate with context
const intention = await intentionPlane.intend(meaning, context);
const thought = await intentionPlane.cogitate(intention);

// Step 3: Remember new knowledge
await contextPlane.remember({
  query,
  response: thought.response,
  timestamp: Date.now()
});
```

#### Pattern 3: Full Pipeline (All Three)

```typescript
const contextPlane = new ContextPlane(contextConfig);
const intentionPlane = new IntentionPlane(intentionConfig);
const lucidDreamer = new LucidDreamer(dreamerConfig);

// Step 1: Recall context
const meaning = await intentionPlane.transduce(query);
const context = await contextPlane.recall(meaning);

// Step 2: Cogitate
const intention = await intentionPlane.intend(meaning, context);
const thought = await intentionPlane.cogitate(intention);

// Step 3: Shadow log for learning
await lucidDreamer.logShadow({
  query,
  intention,
  thought,
  timestamp: Date.now()
});

// Step 4: Learn from feedback
const feedback = await getUserFeedback(query, thought);
await lucidDreamer.learn([feedback]);
```

#### Pattern 4: LucidDreamer Suggestion

```typescript
// LucidDreamer suggests routing strategies
const strategies = await lucidDreamer.hypothesize({
  recentQueries: queryHistory,
  userPreferences: userProfile,
  systemState: currentMetrics
});

// Intention Plane evaluates and applies suggestions
const bestStrategy = strategies[0];  // LucidDreamer's top pick
await intentionPlane.updateStrategy(bestStrategy);
```

---

## Consequences

### Positive Consequences

**1. Independent Evolution**
- Each plane can be developed independently
- Different teams can work on different planes
- Release cycles are decoupled

**2. Progressive Adoption**
```typescript
// Level 1: Memory only
const contextPlane = new ContextPlane(config);

// Level 2: Memory + Inference
const contextPlane = new ContextPlane(config);
const intentionPlane = new IntentionPlane(config);

// Level 3: Full system
const contextPlane = new ContextPlane(config);
const intentionPlane = new IntentionPlane(config);
const lucidDreamer = new LucidDreamer(config);
```

**3. Independent Scaling**
- Scale ContextPlane for large knowledge bases
- Scale IntentionPlane for high query volume
- Scale LucidDreamer for intensive training

**4. Testing in Isolation**
```typescript
// Test ContextPlane without inference
describe('ContextPlane', () => {
  it('should recall relevant knowledge', async () => {
    const contextPlane = new ContextPlane(testConfig);
    const context = await contextPlane.recall(testMeaning);
    expect(context.relevantKnowledge).toHaveLength(5);
  });
});

// Test IntentionPlane without memory
describe('IntentionPlane', () => {
  it('should cogitate intentions', async () => {
    const intentionPlane = new IntentionPlane(testConfig);
    const thought = await intentionPlane.cogitate(testIntention);
    expect(thought.response).toBeDefined();
  });
});

// Test LucidDreamer without query processing
describe('LucidDreamer', () => {
  it('should learn from feedback', async () => {
    const lucidDreamer = new LucidDreamer(testConfig);
    const metrics = await lucidDreamer.learn(testSamples);
    expect(metrics.loss).toBeLessThan(0.5);
  });
});
```

**5. Clear Responsibilities**
- No confusion about where code belongs
- No cross-cutting concerns
- No "god object" anti-pattern

**6. Dependency Injection**
```typescript
// IntentionPlane can use different ContextPlane implementations
class IntentionPlane {
  constructor(
    private contextPlane?: ContextPlane,  // Optional dependency
    private router: Router
  ) {}
}
```

**7. Alternative Implementations**
```typescript
// Different ContextPlane implementations
const memoryContextPlane = new InMemoryContextPlane();
const vectorContextPlane = new VectorDBContextPlane();
const crdtContextPlane = new CRDTContextPlane();

// Same IntentionPlane works with all
const intentionPlane = new IntentionPlane(vectorContextPlane, router);
```

### Negative Consequences

**1. Integration Complexity**
- Need to wire three planes together
- More configuration required
- Potential version mismatches

**2. Data Movement Overhead**
- Data must pass between planes
- Serialization/deserialization costs
- Network calls if planes are distributed

**3. Error Handling Complexity**
```typescript
// Errors can originate from any plane
try {
  const context = await contextPlane.recall(meaning);
  const thought = await intentionPlane.cogitate(intention);
} catch (error) {
  // Which plane failed? How to recover?
  if (error instanceof ContextError) {
    // ContextPlane failed
  } else if (error instanceof IntentionError) {
    // IntentionPlane failed
  }
}
```

**4. Testing Overhead**
- Need to test each plane in isolation
- Need to test integration points
- Need to test all three together

### Neutral Consequences

**1. More Files**
- Three separate packages instead of one
- Tradeoff: Better organization

**2. More Dependencies**
- Each plane has its own dependencies
- Tradeoff: Smaller dependency trees per plane

---

## Implementation Roadmap

### Phase 1: Protocol Definition (Week 1)

```typescript
// Define all three plane protocols in @lsi/protocol
export interface ContextPlane { /* ... */ }
export interface IntentionPlane { /* ... */ }
export interface LucidDreamer { /* ... */ }
```

### Phase 2: ContextPlane Implementation (Week 2-3)

```typescript
// Implement ContextPlane with real embeddings
export class ContextPlane implements ContextPlane {
  constructor(
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStore,
    private crdtStore: CRDTStore
  ) {}

  async recall(signal: Meaning): Promise<Context> {
    // Implement semantic search
  }

  async remember(knowledge: KnowledgeFragment): Promise<void> {
    // Implement CRDT-based storage
  }
}
```

### Phase 3: IntentionPlane Implementation (Week 4-5)

```typescript
// Implement IntentionPlane with router integration
export class IntentionPlane implements IntentionPlane {
  constructor(
    private intentEncoder: IntentEncoder,
    private router: Router,
    private contextPlane?: ContextPlane
  ) {}

  async transduce(input: string): Promise<Meaning> {
    // Implement query parsing and embedding
  }

  async cogitate(intention: Intention): Promise<Thought> {
    // Implement inference execution
  }
}
```

### Phase 4: LucidDreamer Implementation (Week 6-8)

```typescript
// Implement LucidDreamer with training pipeline
export class LucidDreamer implements LucidDreamer {
  constructor(
    private shadowLog: ShadowLog,
    private trainer: ORPOTrainer
  ) {}

  async learn(samples: TrainingSample[]): Promise<TrainingMetrics> {
    // Implement ORPO training
  }

  async hypothesize(context: SystemContext): Promise<Strategy[]> {
    // Implement hypothesis generation
  }
}
```

---

## Migration Strategy

### From Monolithic SuperInstance

```typescript
// Before: Monolithic
class SuperInstance {
  // All three planes mixed together
}

// After: Separated
class SuperInstance {
  constructor(
    private contextPlane: ContextPlane,
    private intentionPlane: IntentionPlane,
    private lucidDreamer: LucidDreamer
  ) {}

  // Delegate to planes
  async processQuery(query: string): Promise<Response> {
    const meaning = await this.intentionPlane.transduce(query);
    const context = await this.contextPlane.recall(meaning);
    const intention = await this.intentionPlane.intend(meaning, context);
    const thought = await this.intentionPlane.cogitate(intention);
    return thought;
  }
}
```

### Backward Compatibility

```typescript
// Provide facade for existing users
export class SuperInstanceFacade {
  private context: ContextPlane;
  private intention: IntentionPlane;
  private dreamer: LucidDreamer;

  constructor(config: SuperInstanceConfig) {
    this.context = new ContextPlane(config.context);
    this.intention = new IntentionPlane(config.intention);
    this.dreamer = new LucidDreamer(config.dreamer);
  }

  // Old API methods delegate to planes
  async query(text: string): Promise<Response> {
    return this.intentionPlane.cogitate(
      await this.intentionPlane.intend(
        await this.intentionPlane.transduce(text),
        await this.context.recall(await this.intentionPlane.transduce(text))
      )
    );
  }
}
```

---

## Testing Strategy

### Unit Tests (Per Plane)

```typescript
describe('ContextPlane', () => {
  it('should recall relevant context', async () => {
    const plane = new ContextPlane(testConfig);
    const context = await plane.recall(testMeaning);
    expect(context.relevantKnowledge).toBeDefined();
  });
});

describe('IntentionPlane', () => {
  it('should cogitate intentions', async () => {
    const plane = new IntentionPlane(testConfig);
    const thought = await plane.cogitate(testIntention);
    expect(thought.response).toBeDefined();
  });
});

describe('LucidDreamer', () => {
  it('should learn from samples', async () => {
    const plane = new LucidDreamer(testConfig);
    const metrics = await plane.learn(testSamples);
    expect(metrics.loss).toBeLessThan(0.5);
  });
});
```

### Integration Tests (Multi-Plane)

```typescript
describe('ContextPlane + IntentionPlane', () => {
  it('should perform RAG', async () => {
    const context = new ContextPlane(contextConfig);
    const intention = new IntentionPlane(intentionConfig);

    const meaning = await intention.transduce(query);
    const ctx = await context.recall(meaning);
    const thought = await intention.cogitate(
      await intention.intend(meaning, ctx)
    );

    expect(thought.response).toBeDefined();
  });
});

describe('All Three Planes', () => {
  it('should perform full pipeline', async () => {
    const system = new SuperInstance({
      context: contextConfig,
      intention: intentionConfig,
      dreamer: dreamerConfig
    });

    const response = await system.query('What is quantum computing?');
    expect(response).toBeDefined();
  });
});
```

---

## References

1. [Layered Architecture](https://en.wikipedia.org/wiki/Layered_architecture) - Architectural pattern
2. [Separation of Concerns](https://en.wikipedia.org/wiki/Separation_of_concerns) - Design principle
3. [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) - Inversion of Control
4. [ADR-001](./001-protocol-first-design.md) - Protocol definitions used
5. [ADR-003](./003-cascade-routing.md) - IntentionPlane routing

---

## Related ADRs

- **ADR-001:** Protocol-First Design (defines plane interfaces)
- **ADR-003:** Cascade Routing (implemented in IntentionPlane)
- **ADR-005:** CRDT for Knowledge (used in ContextPlane)
- **ADR-007:** LucidDreamer ORPO Training (learning system)

---

**Status:** Accepted
**Last Updated:** 2025-01-20
**Maintained by:** Aequor Core Team
