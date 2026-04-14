# SmartCRDT / SuperInstance

![Version](https://img.shields.io/badge/version-24.0--CLEAN-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Packages](https://img.shields.io/badge/packages-81-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green)

A modular, self-improving infrastructure layer for AI applications powered by **Conflict-free Replicated Data Types (CRDTs)**. SmartCRDT provides distributed state management, a Python bridge, ChromaDB vector integration, real-time observability, and a full Docker-based development stack — all within a TypeScript monorepo with optional Rust native modules for performance-critical operations.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Packages](#packages)
- [CRDT Types](#crdt-types)
- [Benchmarks](#benchmarks)
- [Docker Deployment](#docker-deployment)
- [Python Bridge](#python-bridge)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### Option 1: Docker Compose (Fastest)

Spin up the entire development stack — including PostgreSQL, Redis, ChromaDB, and Ollama — with a single command:

```bash
git clone https://github.com/SuperInstance/SmartCRDT.git
cd SmartCRDT
docker-compose up -d
```

This launches six services on the `lsi-network` bridge:

| Service | Port | Description |
|---------|------|-------------|
| LSI Dev Server | `3000`, `9229` | Main application with hot-reload |
| PostgreSQL 15 | `5432` | Persistent relational database |
| Redis 7 | `6379` | In-memory cache with AOF persistence |
| ChromaDB | `8000` | Vector database for embeddings |
| Adminer | `8080` | Database management UI |
| Ollama | `11434` | Local LLM inference engine |

### Option 2: Local Development

For active development with live editing and test execution:

```bash
# Prerequisites: Node.js >= 18, npm >= 9
git clone https://github.com/SuperInstance/SmartCRDT.git
cd SmartCRDT

# Install all workspace dependencies
npm install

# Build TypeScript packages
npm run build

# Run the test suite
npm test

# Start development with watch mode
npm run test:watch
```

If you have the Rust toolchain installed, native modules are built automatically for 3–30× speedups on CRDT merges, BLAKE3 hashing, and vector similarity operations:

```bash
# Build native Rust modules (optional but recommended)
npm run build:native:release
```

### Install the CLI

```bash
npm install -g @superinstance/cli

# Pull a routing component and run a sample app
superinstance pull router
superinstance app install chat-assistant
superinstance app run chat-assistant
```

---

## Architecture

SmartCRDT implements a layered cognitive orchestration architecture where the CRDT engine forms the foundation for distributed state synchronization. The system routes AI requests through a cascade of complexity analysis, applies privacy-preserving transformations, caches responses semantically, and adapts to hardware constraints — all while maintaining consistency across distributed nodes via CRDTs.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ CLI / API│  │ App Manager  │  │ App Registry │  │ LangGraph    │   │
│  │          │  │              │  │              │  │ Integration  │   │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│       └────────────────┼─────────────────┼─────────────────┘           │
│                        ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    CASCADE ROUTER                                 │   │
│  │  Complexity Scoring → Intent Analysis → Model Selection → Cache   │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PRIVACY LAYER                                  │   │
│  │  Redaction-Addition Protocol · Visual PII Redaction · On-Device   │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              ▼                                           │
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────────────────────┐   │
│  │  EMBEDDINGS  │  │  VECTOR STORE   │  │     OBSERVABILITY           │   │
│  │  OpenAI/     │  │  ChromaDB /     │  │  Prometheus · Grafana       │   │
│  │  Local       │  │  HNSW Index     │  │  Jaeger Tracing            │   │
│  └──────┬──────┘  └───────┬────────┘  └─────────────┬───────────────┘   │
│         └─────────────────┼──────────────────────────┘                   │
│                           ▼                                              │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║                    CRDT ENGINE (Core)                              ║  │
│  ║  G-Counter · PN-Counter · LWW-Register · OR-Set · Merge Protocol ║  │
│  ║         TypeScript (default) · Rust / N-API (native)              ║  │
│  ╚════════════════════════╦══════════════════╦═══════════════════════╝  │
│                           ║                  ║                           │
│  ┌────────────────────────╨──────┐  ┌────────╨──────────────────────┐  │
│  │      PERSISTENCE LAYER        │  │       PYTHON BRIDGE            │  │
│  │  PostgreSQL · Redis · Chroma  │  │  PyO3 → GCounter, PNCounter,  │  │
│  │  WAL · Snapshots · Rollback   │  │  LWWRegister, ORSet           │  │
│  └───────────────────────────────┘  └────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              INFRASTRUCTURE & HARDWARE                            │   │
│  │  NUMA Allocator · GPU (WebGPU/CUDA) · Thermal Manager · Power    │   │
│  │  AutoTuner · SIMD Optimizer · Hardware-Aware Dispatcher           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request Ingestion** — A query arrives via the CLI, REST API, or LangGraph integration.
2. **Cascade Routing** — The cascade router scores query complexity and routes to local models (Ollama) or cloud APIs (OpenAI, Anthropic) based on cost, latency, and hardware.
3. **Privacy Processing** — The Redaction-Addition Protocol strips PII, applies differential privacy (configurable ε), and redacts visual content before forwarding.
4. **Embedding & Cache** — Requests are embedded (768-dim or 1536-dim vectors) and checked against the semantic cache (ChromaDB + in-memory HNSW) for near-duplicate hits.
5. **CRDT State Sync** — All state mutations (counters, registers, sets) are tracked as CRDT operations and merged conflict-free across nodes.
6. **Persistence** — Snapshots are written to PostgreSQL with WAL; hot data stays in Redis; vector embeddings live in ChromaDB.
7. **Observability** — Metrics flow to Prometheus, traces to Jaeger, and dashboards render in Grafana for real-time monitoring.

### Language Strategy

| Layer | Language | Purpose |
|-------|----------|---------|
| Core Infrastructure | Rust (`native/`) | CRDT merges, BLAKE3 hashing, HNSW search — 3–30× faster than TS |
| Business Logic | TypeScript (`packages/`) | Portability, rapid development, type safety |
| Data Science / ML | Python (`python/`) | Training loops, model evaluation, ecosystem integration |
| GPU Compute | WGSL / WebGPU | Browser and edge-device vector operations |

---

## Packages

SmartCRDT is a monorepo containing **81 packages** organized into logical tiers. The dependency hierarchy flows from low-level primitives upward to high-level application orchestration.

### Core Infrastructure

| Package | Description |
|---------|-------------|
| `protocol` | Base types, interfaces, and protocol definitions — zero dependencies, foundation for all packages |
| `core` | Core libcognitive API with hardware-aware dispatch, SIMD vector ops, NUMA allocation, GPU acceleration, power-aware scheduling, thermal management, and an adaptive auto-tuner |
| `config` | Hierarchical configuration management with environment variable interpolation and schema validation |
| `manifest` | Component and cartridge manifest schemas with JSON Schema validation |
| `registry` | Component registry for discovering, storing, and resolving pluggable components |
| `resolver` | Dependency resolution engine that handles version constraints and transitive dependency graphs |
| `manager` | Component lifecycle management — install, start, stop, update, and health-check |
| `utils` | Shared utility functions (string manipulation, formatting, helpers) used across the monorepo |

### CRDT & Distributed State

| Package | Description |
|---------|-------------|
| `crdt-native` | TypeScript bindings to the Rust CRDT engine via N-API/FFI |
| `swarm` | Distributed systems primitives — CRDT type interfaces, cartridge knowledge management, version negotiation, rollback protocol, hypothesis distribution, and a knowledge graph builder |
| `state` | Application state management with CRDT-backed persistence |
| `persistence` | State persistence layer with WAL (Write-Ahead Logging), snapshots, and multi-backend storage |

### Routing & AI Orchestration

| Package | Description |
|---------|-------------|
| `cascade` | Complexity-based cascade router with intent analysis, model selection, and semantic caching |
| `superinstance` | Main orchestration platform with Context Plane, Intention Plane, and LucidDreamer subsystems |
| `langgraph` | LangGraph integration — graph construction, nodes for routing/privacy/generation, and checkpointing |
| `langgraph-state` | CRDT-backed state management for LangGraph workflows with conflict resolution, persistence, and validation middleware |
| `langgraph-patterns` | Reusable execution patterns — Sequential, Parallel, Conditional, Hierarchical, Recursive, Dynamic, and PatternComposer |
| `langgraph-errors` | Error handling and recovery patterns for LangGraph workflows |
| `langgraph-debug` | Debugging tools and visualizers for LangGraph graph execution |
| `langchain` | LangChain integration for chain composition and agent building |
| `llamaindex` | LlamaIndex integration for RAG pipelines and document indexing |
| `coagents` | Cooperative agent framework with checkpoint management, human-in-the-loop (HITL) approval, VLJEPA bridges, and shared state |

### Privacy & Security

| Package | Description |
|---------|-------------|
| `privacy` | Privacy suite — Redaction-Addition Protocol, differential privacy, visual PII redaction, and audit logging |
| `security-audit` | Automated security scanning, vulnerability assessment, and compliance reporting |
| `sanitization` | Input sanitization and output encoding to prevent injection attacks |
| `sso` | Single sign-on integration with OAuth2/OIDC providers |

### Embeddings & Vector Search

| Package | Description |
|---------|-------------|
| `embeddings` | Embedding service abstraction supporting OpenAI, local models, and custom backends |
| `vector-db` | Vector database abstraction layer with support for ChromaDB, in-memory, and remote backends |
| `webgpu-compute` | WebGPU compute shaders for vector operations — matrix multiply, reductions, and embedding kernels |
| `webgpu-profiler` | GPU profiling — kernel timing, memory tracking, transfer analysis, bottleneck detection, and timeline views |
| `webgpu-memory` | GPU memory management with allocation tracking and pool-based recycling |

### Observability & Monitoring

| Package | Description |
|---------|-------------|
| `observability` | Metrics collection, Prometheus exporter, tracing via OpenTelemetry, and alert management with Grafana dashboards |
| `health-check` | System health monitoring with configurable checks, dependency probing, and status reporting |
| `performance-optimizer` | Automatic performance tuning — workload analysis, parameter optimization, anomaly detection, and multi-objective optimization |
| `backpressure` | Flow control and backpressure management for high-throughput pipelines |

### VLJEPA (Vision-Language Joint Embedding Predictive Architecture)

| Package | Description |
|---------|-------------|
| `vljepa` | Core VLJEPA model — X-Encoder (vision), Y-Encoder (text), Predictor, training, WebGPU inference, privacy, caching, and planning |
| `vljepa-training` | Training infrastructure — pipeline, checkpointing, LR scheduling, early stopping, gradient monitoring, WandB/TensorBoard logging, and visualization |
| `vljepa-dataset` | Dataset collection, curation (dedup, quality filter, diversity sampling), JEPA formatting, and pair creation |
| `vljepa-synthetic` | Synthetic data generation — page/component/layout generators, mutators (style, content, layout, color), and HTML/React/Screenshot renderers |
| `vljepa-curriculum` | Curriculum learning — staged training (Basic → Components → Layouts → Applications), adaptive scheduling, and replay buffers |
| `vljepa-quantization` | Model quantization — INT8, post-training, quant-aware training, hybrid strategies, KL-divergence calibration, and edge deployment |
| `vljepa-optimization` | Runtime optimization — graph optimization, dynamic batching, buffer pooling, result caching, profiling, and auto-tuning |
| `vljepa-transfer` | Cross-framework transfer — adapters for React, Vue, Svelte, Angular, Flutter, SwiftUI, and domain-specific fine-tuning |
| `vljepa-edge` | Edge deployment — model management, static deployment, capability detection, secure context, and performance monitoring |
| `vljepa-analytics` | Analytics dashboards — real-time metrics, personalization, experiment tracking, alerts, event processing, anomaly detection, and trend forecasting |
| `vljepa-abtesting` | A/B testing framework — experiment management, user allocation, statistical significance testing, and dashboard reporting |
| `vljepa-federation` | Federated learning support for distributed model training |
| `vljepa-multimodal` | Multimodal input processing and fusion |
| `vljepa-worldmodel` | World model reasoning for action prediction |
| `vljepa-video` | Video understanding and temporal analysis |
| `vljepa-evolution` | Evolutionary optimization strategies |
| `vljepa-preference` | Preference learning and RLHF alignment |
| `vljepa-orpo` | Odds Ratio Preference Optimization |
| `vljepa-registry` | Model registry and version management |
| `vljepa-testing` | Testing utilities and fixtures for VLJEPA components |

### CLI & Developer Tools

| Package | Description |
|---------|-------------|
| `cli` | Command-line interface for pulling, listing, and running components |
| `app-cli` | App management CLI — install, run, list, and info commands |
| `config-cli` | Configuration management CLI for get/set/list operations |
| `manifest-cli` | Manifest validation and creation CLI |
| `compatibility-cli` | Version compatibility checking CLI |
| `downloader` | Parallel download manager with retry logic, progress tracking, and caching |
| `wasm` | WebAssembly compilation target and runtime support |

### Infrastructure & Scaling

| Package | Description |
|---------|-------------|
| `scale-strategy` | Auto-scaling strategies — threshold-based, time-based, cost-optimized, and predictive scaling |
| `container-cache` | Container image caching and layer management |
| `preload-strategy` | Model and component preloading strategies for reduced cold-start latency |
| `progressive-render` | Progressive rendering for streaming UI updates |
| `federated-learning` | Federated learning infrastructure for privacy-preserving distributed training |
| `collaboration` | Multi-user collaboration primitives |
| `a2ui` | Agent-to-UI bridge for rendering AI-generated interfaces |
| `sse-server` / `sse-client` / `sse-reconnect` | Server-Sent Events infrastructure with automatic reconnection |
| `worker-pool` | Managed worker pool for parallel task execution |
| `semver` | Semantic versioning utilities |
| `learning` | Usage-based learning system that profiles patterns and auto-tunes configuration |

### Dependency Hierarchy

```
@lsi/protocol          ← Base types (no dependencies)
    ↓
@lsi/core              ← Core API + hardware abstractions
    ↓
@lsi/cascade           ← Cascade router (depends on protocol, core)
    ↓
@lsi/privacy           ← Privacy suite (depends on protocol)
@lsi/swarm             ← CRDT store (depends on protocol)
@lsi/embeddings        ← Embedding services (depends on protocol)
    ↓
@lsi/superinstance     ← Main platform (depends on all above)
    ↓
@lsi/langgraph         ← LangGraph integration (depends on superinstance)
@lsi/coagents          ← Cooperative agents (depends on langgraph)
```

**Key Rule:** Never create circular dependencies. Always depend on lower-level packages.

---

## CRDT Types

SmartCRDT implements four core CRDT (Conflict-free Replicated Data Type) primitives in Rust with automatic fallback to pure TypeScript. These data structures guarantee eventual consistency without coordination — making them ideal for distributed, offline-first AI applications.

### Supported Types

| CRDT | Full Name | Operation | Conflict Resolution | Use Case |
|------|-----------|-----------|---------------------|----------|
| **G-Counter** | Grow-only Counter | `increment(node, amount)` | `max(per-node counts)` | Counting events, API calls, metrics aggregation |
| **PN-Counter** | Positive-Negative Counter | `increment(node, amount)` / `decrement(node, amount)` | Separate G-Counters for + and − | Page views, inventory, any bidirectional counter |
| **LWW-Register** | Last-Writer-Wins Register | `set(value)` with timestamp | Highest timestamp wins | Configuration values, feature flags, single-value state |
| **OR-Set** | Observed-Remove Set | `add(element, node)` / `remove(element)` | Tombstone-based observed remove | Collections, tags, group membership, whitelists |

### Merge Semantics

All CRDTs implement a commutative, associative, and idempotent `merge` operation. This means:

- **Commutative**: `A.merge(B) == B.merge(A)` — order doesn't matter
- **Associative**: `(A.merge(B)).merge(C) == A.merge(B.merge(C))` — grouping doesn't matter
- **Idempotent**: `A.merge(A) == A` — duplicate merges are harmless

### Usage — TypeScript

```typescript
import { GCounter, PNCounter, LWWRegister, ORSet } from '@lsi/crdt-native';

// G-Counter: distributed event counting
const counter1 = new GCounter();
const counter2 = new GCounter();
counter1.increment('node-A', 5);
counter2.increment('node-B', 3);
counter1.merge(counter2);
console.log(counter1.value()); // 8

// PN-Counter: bidirectional counting
const pn = new PNCounter();
pn.increment('node-A', 10);
pn.decrement('node-A', 3);
console.log(pn.value()); // 7

// LWW-Register: last-write-wins state
const reg1 = new LWWRegister('initial');
const reg2 = new LWWRegister('updated');
reg2.set('conflict'); // Later timestamp
reg1.merge(reg2);
console.log(reg1.get()); // "conflict"

// OR-Set: distributed collections
const set1 = new ORSet();
const set2 = new ORSet();
set1.add('item1', 'node-A');
set2.add('item2', 'node-B');
set1.merge(set2);
console.log(set1.elements()); // ['item1', 'item2']
```

### Usage — Python

```python
from superinstance.crdt import GCounter, PNCounter, LWWRegister, ORSet

# G-Counter
counter1 = GCounter()
counter2 = GCounter()
counter1.increment("node1", 5)
counter2.increment("node2", 3)
counter1.merge(counter2)
print(counter1.value())  # 8

# OR-Set
set1 = ORSet()
set1.add("item1", "node1")
set1.add("item2", "node1")
print(set1.elements())  # ['item1', 'item2']
print(len(set1))        # 2
print("item1" in set1)  # True
```

### Serialization

All CRDTs support binary and JSON serialization for network transmission and persistent storage:

```typescript
// Binary (compact, fast — recommended for network)
const bytes = counter.to_bytes();
const restored = GCounter.from_bytes(bytes);

// JSON (human-readable — good for debugging)
const json = counter.to_json();
const loaded = GCounter.from_json(json);
```

---

## Benchmarks

The `benchmarks/` directory contains head-to-head comparisons between the TypeScript and Rust implementations across CRDT operations, vector math, cryptographic hashing, and HNSW vector search.

### Benchmark Suite

| File | What It Measures | Dimensions / Scales |
|------|-----------------|---------------------|
| `bench-crdt-merge.js` | G-Counter and PN-Counter merge throughput | 2, 5, 10, 50, 100 nodes |
| `bench-vector-operations.js` | Cosine similarity, Euclidean distance, dot product, normalization | 128, 384, 768, 1536 dims |
| `bench-hash.js` | BLAKE3 (Rust) vs SHA-256 / FNV-1a (TypeScript) | 32B, 256B, 1KB, 4KB, 16KB payloads |
| `hnsw_benchmark.ts` | HNSW distance calculations with SIMD-style unrolled loops | 128, 384, 768, 1536 dims |

### Running Benchmarks

```bash
# Run all benchmarks
npm run bench

# Generate a performance comparison report
npm run bench:report

# Run a specific benchmark directly
node benchmarks/bench-crdt-merge.js
npx tsx benchmarks/hnsw_benchmark.ts
```

### Performance Characteristics

Based on the benchmark suite and native module testing (from `CLAUDE.md`):

| Operation | TypeScript | Rust (Native) | Speedup |
|-----------|-----------|---------------|---------|
| **Vector Similarity** (768-dim) | ~280 μs | ~85 μs | **3.3×** |
| **BLAKE3 Hash** (4KB) | ~950 μs | ~45 μs | **21.1×** |
| **CRDT Merge** (100 nodes) | ~980 μs | ~195 μs | **5.0×** |
| **HNSW Search** (100K vectors) | ~28 ms | ~5.8 ms | **4.8×** |

The native Rust modules are **optional** — SmartCRDT gracefully falls back to TypeScript implementations when Rust is not available, ensuring the system works everywhere Node.js runs.

### HNSW Vector Search

The `hnsw_benchmark.ts` benchmark includes a **correctness check** comparing TypeScript SIMD-style unrolled loops against the Rust FFI implementation. Both produce results within `1e-5` tolerance for cosine distance, Euclidean distance, and dot product across all tested dimensions.

---

## Docker Deployment

SmartCRDT provides five composable Docker Compose configurations, each designed for a specific deployment scenario. All files live at the repository root and can be combined with the `docker-compose` `-f` flag.

### Configuration Files

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.yml` | **Local development** — hot-reload, debug ports, optional services | LSI dev server, PostgreSQL, Redis, ChromaDB, Adminer, Ollama |
| `docker-compose.prod.yml` | **Production** — resource limits, health checks, log rotation, Nginx reverse proxy | LSI prod, PostgreSQL, Redis, ChromaDB, Nginx, Watchtower |
| `docker-compose.fullstack.yml` | **Full platform** — all Aequor microservices deployed as separate containers | Protocol, Cascade, Privacy, SuperInstance, Performance, Security, Sanitization, CLI, PostgreSQL, Redis, ChromaDB, Ollama, Prometheus, Grafana, Jaeger |
| `docker-compose.monitoring.yml` | **Monitoring stack** — standalone observability | Prometheus, Grafana, AlertManager |
| `docker-compose.chromadb.yml` | **ChromaDB only** — enhanced vector DB with optional profiles | ChromaDB (+ PostgreSQL metadata, Redis cache, Prometheus/Grafana via profiles) |

### Quick Reference

```bash
# Local development (all optional services)
docker-compose up -d

# Production with auto-updates
docker-compose -f docker-compose.prod.yml up -d

# Full platform — all microservices + observability
docker-compose -f docker-compose.fullstack.yml up -d

# Monitoring stack only
docker-compose -f docker-compose.monitoring.yml up -d

# ChromaDB with optional PostgreSQL metadata backend
docker-compose -f docker-compose.chromadb.yml --profile postgres up -d

# ChromaDB with full monitoring
docker-compose -f docker-compose.chromadb.yml --profile monitoring up -d
```

### Production Highlights (`docker-compose.prod.yml`)

- **Resource limits** on every container (CPU and memory reservations + ceilings)
- **Health checks** with configurable intervals, timeouts, and retry counts
- **JSON-file log driver** with `max-size: 10m` and `max-file: 3` rotation
- **Nginx reverse proxy** on ports 80/443 with SSL support
- **Watchtower** for automatic container image updates (daily poll interval)
- **Environment-based configuration** — all secrets via `${VARIABLE}` interpolation
- **Persistent volumes** for data, logs, and cartridges

### Fullstack Highlights (`docker-compose.fullstack.yml`)

The fullstack configuration decomposes the platform into 15+ independently deployable services connected via the `aequor-network` bridge:

```
┌─────────────────────────────────────────────────────────────────┐
│                     FULLSTACK DEPLOYMENT                         │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Cascade  │ │ Privacy  │ │SuperInstance │ │ Performance  │   │
│  │ :3000    │ │ :3001    │ │ :3002        │ │ :9091        │   │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Security │ │Sanitiz.  │ │Protocol  │ │ Ollama :11434    │   │
│  │ :3003    │ │          │ │          │ │                  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │PostgreSQL│ │  Redis   │ │ ChromaDB │   DATA LAYER           │
│  │ :5432    │ │ :6379    │ │ :8000    │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │Prometheus│ │ Grafana  │ │  Jaeger  │   OBSERVABILITY        │
│  │ :9092    │ │ :3001    │ │ :16686   │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Docker Images

The `docker/` directory contains multi-stage Dockerfiles for optimized builds:

| Dockerfile | Description |
|------------|-------------|
| `Dockerfile.base` | Minimal Node.js 18 Alpine base image |
| `Dockerfile.cli` | CLI-only image for component management |
| `Dockerfile.full` | Full platform image with all dependencies |
| `Dockerfile.optimized` | Production-optimized with layer caching |
| `Dockerfile.optimized.dev` | Development variant of optimized image |

Build all images at once:

```bash
cd docker && ./build-all.sh
```

---

## Python Bridge

SmartCRDT provides a Python bridge via Rust/PyO3 bindings, exposing the native CRDT engine to Python applications. This enables seamless integration with ML training pipelines, data science workflows, and the broader Python ecosystem.

### Installation

```bash
cd python
pip install -e .
```

### Available Modules

```python
from superinstance.crdt import GCounter, PNCounter, LWWRegister, ORSet
from superinstance.cache import VectorCache, SemanticCache
from superinstance.embeddings import EmbeddingService
from superinstance.crypto import blake3_hash, encrypt, decrypt
```

### Example: Distributed CRDT Sync

```python
from superinstance.crdt import GCounter, PNCounter, ORSet

# Simulate two nodes syncing state
node_a_counter = GCounter()
node_b_counter = GCounter()

node_a_counter.increment("node-a", 5)
node_b_counter.increment("node-b", 3)

# Merge (commutative — order doesn't matter)
node_a_counter.merge(node_b_counter)
print(f"Merged value: {node_a_counter.value()}")  # 8

# OR-Set for distributed collections
tags_a = ORSet()
tags_b = ORSet()
tags_a.add("nlp", "node-a")
tags_b.add("vision", "node-b")
tags_a.merge(tags_b)
print(f"All tags: {tags_a.elements()}")  # ['nlp', 'vision']
```

---

## Documentation

Comprehensive documentation is organized across several directories:

| Path | Contents |
|------|----------|
| `docs/architecture/` | System architecture docs — cascade routing, privacy architecture, data flow, SuperInstance architecture |
| `docs/api/` | API reference — cascade, core, protocol, swarm, privacy, embeddings, config, utils |
| `docs/adr/` | Architecture Decision Records — protocol-first design, three-plane separation, cascade routing, intent vectors, CRDT for knowledge, Redaction-Addition Protocol |
| `CLAUDE.md` | AI agent project guide — build commands, native modules, success metrics, development principles |
| `CONTRIBUTING.md` | Contribution guide — coding standards, testing, PR process, commit conventions |
| `TROUBLESHOOTING.md` | Common issues and resolutions |

Generate API docs locally:

```bash
npm run docs:generate
npm run docs:serve
```

---

## Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

### Quick Summary

1. Fork the repository and create a feature branch (`feature/your-feature`)
2. Make changes following our TypeScript coding standards
3. Run tests: `npm test` and linter: `npm run lint`
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: add new routing algorithm"`
5. Push and open a Pull Request

### Development Commands

```bash
npm run build          # Build all packages
npm test               # Run all tests
npm run test:coverage  # Run tests with coverage report
npm run lint           # Lint all packages
npm run format         # Format with Prettier
npm run bench          # Run benchmarks
npm run docs:generate  # Generate API docs
```

---

## License

MIT © SuperInstance

---

<img src="callsign1.jpg" width="128" alt="callsign">
