# Data Flow Architecture

**Version:** 4.0
**Status:** Production Ready
**Purpose:** End-to-end request processing flows for Aequor

---

## Overview

This document describes the complete data flow through the Aequor system, from user query to response, including all caching, error handling, and optimization paths.

---

## End-to-End Request Flow

```mermaid
sequenceDiagram
    participant User
    participant API as API Gateway
    participant Cascade as CascadeRouter
    participant Refiner as QueryRefiner
    participant Cache as SemanticCache
    participant Privacy as PrivacyFirewall
    participant Intent as IntentEncoder
    participant Ollama as OllamaAdapter
    participant Cloud as CloudAdapter
    participant Lucid as LucidDreamer
    participant Context as ContextPlane

    User->>API: POST /query {query, context}
    API->>Cascade: route(query, context)

    Cascade->>Refiner: refine(query)
    Refiner-->>Cascade: RefinedQuery

    Cascade->>Cache: get(refinedQuery)

    alt Cache Hit
        Cache-->>Cascade: CachedResult
        Cascade-->>API: RouteDecision (cached)
        API-->>User: Response (cached)
    else Cache Miss
        Cascade->>Privacy: classify(query)
        Privacy-->>Cascade: PrivacyLevel

        Cascade->>Cascade: calculateComplexity()

        alt PrivacyLevel = SECRET
            Cascade->>Intent: encode(query)
            Intent-->>Cascade: IntentVector
            Cascade->>Privacy: redact(query)
            Privacy-->>Cascade: RedactedQuery
        end

        Cascade->>Cascade: makeRoutingDecision()

        alt Route = Local
            Cascade->>Ollama: healthCheck()
            Ollama-->>Cascade: Healthy

            alt Healthy
                Cascade->>Ollama: generate(query)
                Ollama-->>Cascade: Response
            else Unhealthy
                Cascade->>Cloud: generate(query)
                Cloud-->>Cascade: Response
            end
        else Route = Cloud
            Cascade->>Cloud: generate(query or intent)
            Cloud-->>Cascade: Response
        end

        Cascade->>Cache: set(refinedQuery, response)
        Cascade->>Lucid: log(query, response)
        Cascade->>Context: store(query, response)

        Cascade-->>API: RouteDecision
        API-->>User: Response
    end
```

---

## Error Handling Flow

```mermaid
graph TD
    Start[Request Received] --> TryExecute[Try Execute]

    TryExecute --> Success{Success?}

    Success -->|Yes| ReturnSuccess[Return Result]
    Success -->|No| ClassifyError[Classify Error]

    ClassifyError -->|Timeout| TimeoutFlow[Timeout Flow]
    ClassifyError -->|Rate Limit| RateLimitFlow[Rate Limit Flow]
    ClassifyError -->|Network| NetworkFlow[Network Flow]
    ClassifyError -->|Validation| ValidationFlow[Validation Flow]

    TimeoutFlow --> Retry{Retry < Max?}
    RateLimitFlow --> Retry
    NetworkFlow --> Retry

    Retry -->|Yes| Wait[Wait Backoff]
    Wait --> TryExecute

    Retry -->|No| Fallback{Fallback Available?}

    Fallback -->|Yes| ExecuteFallback[Execute Fallback]
    Fallback -->|No| CircuitOpen{Circuit Open?}

    CircuitOpen -->|Yes| ReturnError[Return Error]
    CircuitOpen -->|No| ExecuteFallback

    ExecuteFallback --> FallbackSuccess{Fallback Success?}

    FallbackSuccess -->|Yes| LogFallback[Log Fallback Success]
    FallbackSuccess -->|No| LogFailure[Log Failure]

    LogFallback --> ReturnSuccess
    LogFailure --> ReturnError

    ValidationFlow --> ValidationError[Return Validation Error]

    style Start fill:#4a90d9
    style ReturnSuccess fill:#7ed321
    style ReturnError fill:#d0021b
    style ExecuteFallback fill:#f5a623
```

---

## Cache Hit/Miss Flows

### Cache Hit Flow

```mermaid
sequenceDiagram
    participant User
    participant Router
    participant Cache
    participant Analytics

    User->>Router: query
    Router->>Router: refineQuery()

    Router->>Cache: get(refinedQuery)

    Note over Cache: Check L1 Memory Cache
    Cache->>Cache: Search L1

    alt L1 Hit
        Cache-->>Router: Cached Result
        Router->>Analytics: logCacheHit(L1)
        Router-->>User: Response (< 5ms)
    else L1 Miss
        Note over Cache: Check L2 Redis Cache
        Cache->>Cache: Search L2

        alt L2 Hit
            Cache-->>Router: Cached Result
            Cache->>Cache: Promote to L1
            Router->>Analytics: logCacheHit(L2)
            Router-->>User: Response (< 50ms)
        else L2 Miss
            Cache-->>Router: Cache Miss
            Router->>Router: Execute Query
            Router->>Cache: set(result)
            Cache->>Cache: Store L1 + L2
            Router-->>User: Response
        end
    end
```

### Cache Miss Flow

```mermaid
graph TD
    Start[Cache Miss] --> RouteQuery[Route Query]
    RouteQuery --> ExecuteQuery[Execute Query]
    ExecuteQuery --> QuerySuccess{Success?}

    QuerySuccess -->|Yes| ProcessResponse[Process Response]
    QuerySuccess -->|No| LogError[Log Error]

    ProcessResponse --> ValidateResponse[Validate Response]
    ValidateResponse --> Valid{Valid?}

    Valid -->|Yes| CacheResult[Cache Result]
    Valid -->|No| LogError

    CacheResult --> L1Store[Store in L1]
    L1Store --> L2Store[Store in L2]
    L2Store --> LogCache[Log Cache Metrics]
    LogCache --> Return[Return Response]

    LogError --> ReturnError[Return Error]

    style Start fill:#d0021b
    style CacheResult fill:#7ed321
    style ReturnError fill:#d0021b
```

---

## Privacy Flow

```mermaid
graph TD
    Query[User Query] --> Firewall[Privacy Firewall]

    Firewall --> Classify[Classify Privacy]

    Classify --> LOGIC{LOGIC?}
    Classify --> STYLE{STYLE?}
    Classify --> SECRET{SECRET?}

    LOGIC -->|Yes| DirectRoute[Direct Route]
    STYLE -->|Yes| Rewrite[Rewrite Query]
    SECRET -->|Yes| EncodeRoute[Encode Route]

    Rewrite --> RouteRewritten[Route Rewritten]

    EncodeRoute --> DetectPII[Detect PII]
    DetectPII --> Redact[Redact Locally]
    Redact --> StoreContext[Store Context]
    StoreContext --> EncodeIntent[Encode Intent]
    EncodeIntent --> AddNoise[Add DP Noise]
    AddNoise --> SendIntent[Send Intent Vector]

    SendIntent --> Cloud[Cloud Processing]
    Cloud --> ReceiveResponse[Receive Response]
    ReceiveResponse --> Rehydrate[Re-hydrate]
    Rehydrate --> ReturnSecure[Return Secure Response]

    DirectRoute --> Process[Process Query]
    RouteRewritten --> Process
    Process --> ReturnNormal[Return Response]

    style Firewall fill:#f5a623
    style EncodeRoute fill:#9013fe
    style ReturnSecure fill:#7ed321
```

---

## Fallback Flow

```mermaid
graph LR
    subgraph "Primary Route"
        A[Primary Request] --> B{Primary Success?}
        B -->|Yes| C[Return Result]
        B -->|No| D[Fallback Triggered]
    end

    subgraph "Fallback Decision"
        D --> E{Fallback Type?}
        E -->|Immediate| F[Immediate Fallback]
        E -->|Delayed| G[Delayed Fallback]
        E -->|Conditional| H[Conditional Fallback]
        E -->|Circuit| I[Circuit Breaker]
    end

    subgraph "Fallback Execution"
        F --> J[Execute Fallback]
        G --> K[Wait Delay]
        K --> J
        H --> L{Condition Met?}
        L -->|Yes| J
        L -->|No| M[Skip Fallback]
        I --> N{Circuit Open?}
        N -->|Yes| M
        N -->|No| J
    end

    subgraph "Fallback Result"
        J --> O{Fallback Success?}
        O -->|Yes| P[Return Fallback Result]
        O -->|No| Q[Fallback Failed]
        M --> R[Return Original Error]
        Q --> R
    end

    style A fill:#4a90d9
    style D fill:#f5a623
    style J fill:#9013fe
    style P fill:#7ed321
    style R fill:#d0021b
```

---

## Learning Flow

```mermaid
graph TD
    subgraph "Shadow Logging"
        Query[Query] --> PrivacyFilter[Privacy Filter]
        PrivacyFilter --> Safe{Safe to Log?}
        Safe -->|Yes| LogBuffer[Log to Buffer]
        Safe -->|No| Discard[Discard]
    end

    subgraph "Preference Generation"
        LogBuffer --> PairGen[Preference Pair Generator]
        PairGen --> Pairs[Preference Pairs]
    end

    subgraph "Hypothesis Generation"
        Pairs --> HypothesisGen[Hypothesis Generator]
        HypothesisGen --> Hypothesis[Hypothesis]
        Hypothesis --> TestPlan[Test Plan]
    end

    subgraph "Training"
        TestPlan --> Split[Split Data]
        Split --> Train[Training Set]
        Split --> Validate[Validation Set]

        Train --> ORPO[ORPO Training]
        ORPO --> LoRA[LoRA Adapter]

        Validate --> Metrics[Validation Metrics]
    end

    subgraph "Evaluation"
        LoRA --> Compare[Compare Metrics]
        Metrics --> Compare

        Compare --> Improved{Improved?}
        Improved -->|Yes| Deploy[Deploy Adapter]
        Improved -->|No| Rollback[Rollback]
    end

    Deploy --> LogSuccess[Log Success]
    Rollback --> LogFailure[Log Failure]

    style PrivacyFilter fill:#f5a623
    style HypothesisGen fill:#4a90d9
    style ORPO fill:#9013fe
    style Deploy fill:#7ed321
    style Rollback fill:#d0021b
```

---

## Multi-Model Collaboration Flow

```mermaid
sequenceDiagram
    participant Client
    participant Router
    participant ACP as ACPHandshake
    participant Model1 as Model 1
    participant Model2 as Model 2
    participant Model3 as Model 3
    participant Aggregator as Aggregator

    Client->>Router: query (complex)

    Router->>ACP: initiateHandshake(query)

    ACP->>ACP: analyzeComplexity(query)
    ACP->>ACP: selectModels()

    ACP->>Model1: canHandle(query)?
    Model1-->>ACP: CapabilityProfile

    ACP->>Model2: canHandle(query)?
    Model2-->>ACP: CapabilityProfile

    ACP->>Model3: canHandle(query)?
    Model3-->>ACP: CapabilityProfile

    ACP->>ACP: createExecutionPlan()

    ACP-->>Router: ExecutionPlan {
        models: [Model1, Model2],
        aggregation: "weighted_vote"
    }

    par Parallel Execution
        Router->>Model1: execute(query)
        Router->>Model2: execute(query)
    end

    Model1-->>Router: response1
    Model2-->>Router: response2

    Router->>Aggregator: aggregate([response1, response2])

    Aggregator->>Aggregator: applyWeights()
    Aggregator->>Aggregator: resolveConflicts()
    Aggregator->>Aggregator: synthesize()

    Aggregator-->>Router: aggregatedResponse

    Router-->>Client: finalResponse
```

---

## Cartridge Loading Flow

```mermaid
graph TD
    Start[Cartridge Request] --> Resolve[Resolve Dependencies]

    Resolve --> CheckLocal{Cartridge Local?}
    CheckLocal -->|Yes| LoadLocal[Load Local Cartridge]
    CheckLocal -->|No| FetchRemote[Fetch Remote]

    FetchRemote --> Download[Download Cartridge]
    Download --> VerifySignature[Verify Signature]
    VerifySignature --> Valid{Valid?}

    Valid -->|Yes| LoadLocal
    Valid -->|No| Reject[Reject Cartridge]

    LoadLocal --> CheckVersion{Version Compatible?}
    CheckVersion -->|Yes| LoadManifest[Load Manifest]
    CheckVersion -->|No| ResolveVersion[Resolve Version]

    ResolveVersion --> Negotiate[Version Negotiation]
    Negotiate --> LoadManifest

    LoadManifest --> CheckDeps{Dependencies Satisfied?}
    CheckDeps -->|Yes| Initialize[Initialize Cartridge]
    CheckDeps -->|No| FetchDeps[Fetch Dependencies]

    FetchDeps --> LoadManifest

    Initialize --> Register[Register Cartridge]
    Register --> WarmCache[Warm Cache]
    WarmCache --> Ready[Cartridge Ready]

    style Start fill:#4a90d9
    style LoadLocal fill:#7ed321
    style Reject fill:#d0021b
    style Ready fill:#9013fe
```

---

## Tenant Isolation Flow

```mermaid
graph TD
    Request[Incoming Request] --> ExtractTenant[Extract Tenant ID]

    ExtractTenant --> TenantFound{Tenant Found?}
    TenantFound -->|Yes| CheckStatus{Tenant Active?}
    TenantFound -->|No| ReturnUnauthorized[Return 401]

    CheckStatus -->|Yes| CheckQuotas[Check Quotas]
    CheckStatus -->|No| ReturnSuspended[Return 403]

    CheckQuotas --> WithinQuota{Within Quota?}
    WithinQuota -->|Yes| ApplyIsolation[Apply Tenant Isolation]
    WithinQuota -->|No| ReturnRateLimit[Return 429]

    ApplyIsolation --> ConfigNamespace[Config Namespace]
    ApplyIsolation --> DataNamespace[Data Namespace]
    ApplyIsolation --> ResourceAllocation[Resource Allocation]

    ConfigNamespace --> ProcessRequest[Process Request]
    DataNamespace --> ProcessRequest
    ResourceAllocation --> ProcessRequest

    ProcessRequest --> TrackUsage[Track Usage]
    TrackUsage --> UpdateMetrics[Update Metrics]
    UpdateMetrics --> ReturnResponse[Return Response]

    style ExtractTenant fill:#4a90d9
    style ApplyIsolation fill:#f5a623
    style ReturnResponse fill:#7ed321
    style ReturnUnauthorized fill:#d0021b
    style ReturnSuspended fill:#d0021b
    style ReturnRateLimit fill:#d0021b
```

---

## Performance Optimization Flow

```mermaid
graph TD
    Request[Request] --> Measure[Measure Baseline]

    Measure --> PredictCost[Predict Cost]
    PredictCost --> EstimateLatency[Estimate Latency]

    EstimateLatency --> WithinSLA{Within SLA?}
    WithinSLA -->|Yes| DirectProcess[Process Normally]
    WithinSLA -->|No| Optimize[Apply Optimizations]

    Optimize --> CacheStrategy{Use Cache?}
    CacheStrategy -->|Yes| CheckCache[Check Cache]
    CacheStrategy -->|No| ModelStrategy{Switch Model?}

    CheckCache --> CacheHit{Cache Hit?}
    CacheHit -->|Yes| ReturnCached[Return Cached]
    CacheHit -->|No| ModelStrategy

    ModelStrategy -->|Yes| SelectFaster[Select Faster Model]
    ModelStrategy -->|No| ParallelStrategy{Parallelize?}

    SelectFaster --> ExecuteFast[Execute Fast Model]
    ParallelStrategy -->|Yes| ExecuteParallel[Execute Parallel]
    ParallelStrategy -->|No| BatchStrategy{Batch?}

    ExecuteFast --> ReturnResult[Return Result]
    ExecuteParallel --> AggregateParallel[Aggregate Results]
    AggregateParallel --> ReturnResult

    BatchStrategy -->|Yes| AddToBatch[Add to Batch]
    BatchStrategy -->|No| QueueStrategy{Queue?}

    AddToBatch --> ReturnResult

    QueueStrategy -->|Yes| AddToQueue[Add to Queue]
    QueueStrategy -->|No| ReturnResult

    AddToQueue --> ProcessAsync[Process Async]

    style Request fill:#4a90d9
    style Optimize fill:#f5a623
    style ReturnCached fill:#7ed321
    style ReturnResult fill:#7ed321
```

---

## Metrics Collection Flow

```mermaid
graph LR
    subgraph "Request Processing"
        A[Request] --> B[Process]
        B --> C[Response]
    end

    subgraph "Metrics Collection"
        B --> D[Latency Timer]
        B --> E[Token Counter]
        B --> F[Cost Tracker]
        B --> G[Cache Hit Counter]
        B --> H[Error Counter]
    end

    subgraph "Aggregation"
        D --> I[Metrics Collector]
        E --> I
        F --> I
        G --> I
        H --> I
    end

    subgraph "Storage"
        I --> J[In-Memory Buffer]
        J --> K[Periodic Flush]
        K --> L[Metrics Store]
    end

    subgraph "Analytics"
        L --> M[Dashboard]
        L --> N[Alerting]
        L --> O[Optimization Engine]
    end

    style A fill:#4a90d9
    style C fill:#7ed321
    style I fill:#f5a623
    style M fill:#9013fe
```

---

## Flow State Diagrams

### Request Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Received: Request Arrives
    Received --> Validating: Validate Input
    Validating --> Authenticated: Auth Success
    Validating --> Rejected: Auth Fail

    Authenticated --> Classifying: Classify Privacy
    Classifying --> Encoding: Encode Intent
    Classifying --> Direct: Direct Route

    Encoding --> Routing: Route to Cloud
    Direct --> Routing: Route to Local/Cloud

    Routing --> Caching: Check Cache
    Caching --> Cached: Cache Hit
    Caching --> Processing: Cache Miss

    Cached --> Responding: Return Cached
    Processing --> Executing: Execute Query
    Executing --> Success: Success
    Executing --> Error: Failure

    Success --> Logging: Log Result
    Error --> Logging: Log Error

    Logging --> Learning: Update Learning
    Learning --> Responding: Format Response
    Responding --> [*]: Response Sent

    Rejected --> [*]: Error Returned
```

---

## Configuration Flows

### Configuration Loading Flow

```mermaid
graph TD
    Start[Application Start] --> LoadDefaults[Load Default Config]
    LoadDefaults --> CheckEnv{Check Environment}

    CheckEnv --> LoadEnv[Load Env Variables]
    LoadEnv --> CheckConfigFile{Config File?}

    CheckConfigFile -->|Yes| LoadFile[Load Config File]
    CheckConfigFile -->|No| Merge[Merge Configs]

    LoadFile --> Validate[Validate Config]
    Validate --> Valid{Valid?}

    Valid -->|Yes| Merge
    Valid -->|No| UseDefaults[Use Defaults]

    Merge --> Apply[Apply Config]
    Apply --> Initialize[Initialize Components]
    Initialize --> Ready[Ready]

    style Start fill:#4a90d9
    style LoadFile fill:#f5a623
    style Ready fill:#7ed321
```

---

## References

- **Cascade Router:** `cascade-architecture.md`
- **Privacy Suite:** `privacy-architecture.md`
- **SuperInstance:** `superinstance-architecture.md`
- **Protocol Types:** `/mnt/c/users/casey/smartCRDT/demo/packages/protocol/src/index.ts`

---

**Last Updated:** 2026-01-02
**Maintainer:** Aequor Core Team
