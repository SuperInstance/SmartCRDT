# Quick Start Guide - Aequor Examples

Get started with Aequor Cognitive Orchestration Platform examples in 5 minutes.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- (Optional) Ollama for local model inference

## Installation

```bash
# From the demo directory
cd /mnt/c/users/casey/smartCRDT/demo

# Install dependencies
npm install

# Build all packages
npm run build
```

## Run Your First Example

### Option 1: Using npm scripts (Recommended)

```bash
cd examples

# Run cascade routing example
npm run cascade

# Run privacy-first bot example
npm run privacy

# Run semantic caching example
npm run caching

# Run hardware-aware dispatch example
npm run hardware

# Run SuperInstance example
npm run superinstance
```

### Option 2: Using tsx directly

```bash
cd examples

# Install tsx locally
npm install -D tsx

# Run any example
npx tsx cascade-basic-usage.ts
```

### Option 3: Compile and run with Node

```bash
cd examples

# Compile examples
npm run build

# Run compiled example
node dist/cascade-basic-usage.js
```

## Example Overview

### 1. Cascade Routing (`cascade-basic-usage.ts`)

**What it demonstrates:** Intelligent routing between local and cloud AI models

**Key concepts:**
- Query complexity analysis
- Local vs cloud routing decisions
- Session-based routing
- Emotional intelligence (cadence, motivation)
- Cache integration

**Run it:**
```bash
npm run cascade
```

**Expected output:**
```
=== Example 1: Basic Routing ===

Query: "What is TypeScript?"
Route: local
Confidence: 0.95
Est. Latency: 50ms
Est. Cost: $0.0000
Reason: Simple query - using local model
```

---

### 2. Privacy-First Bot (`privacy-first-bot.ts`)

**What it demonstrates:** Privacy-preserving AI with intent encoding

**Key concepts:**
- Intent encoding (768-dim vectors)
- PII detection and redaction
- Differential privacy (ε-DP)
- Privacy budget tracking
- Redaction-Addition Protocol

**Run it:**
```bash
npm run privacy
```

**Expected output:**
```
=== Example 1: Intent Encoding ===

Original: "My email is user@example.com"
Intent Vector Dimensions: 768
Vector norm: 14.2345

✓ Intent encoded successfully
  Cloud receives: [768-dim vector only]
  Original text: Never leaves device
```

---

### 3. Semantic Caching (`semantic-caching.ts`)

**What it demonstrates:** High-hit-rate semantic caching (~80%)

**Key concepts:**
- Semantic similarity matching
- Adaptive threshold optimization
- Per-query-type thresholds
- HNSW index for fast search
- Cache statistics

**Run it:**
```bash
npm run caching
```

**Expected output:**
```
=== Example 2: Cache Statistics ===

Cache size: 10 entries
Hit Rate: 75.0%
Total Hits: 9
Total Misses: 3
Exact Hits: 5
Semantic Hits: 4
```

---

### 4. Hardware-Aware Dispatch (`hardware-aware-dispatch.ts`)

**What it demonstrates:** Hardware detection and optimization

**Key concepts:**
- GPU/CPU/NPU detection
- Thermal monitoring
- NUMA-aware scheduling
- Power-aware routing
- Adaptive performance tuning

**Run it:**
```bash
npm run hardware
```

**Expected output:**
```
=== Example 1: Hardware Detection ===

Hardware Profile:
  Platform: linux
  Architecture: x64

GPU Detected:
  Type: NVIDIA GeForce RTX 3090
  Vendor: NVIDIA
  Memory: 24GB
```

---

### 5. SuperInstance (`superinstance-three-planes.ts`)

**What it demonstrates:** Complete three-plane architecture

**Key concepts:**
- Context Plane (memory, knowledge graph)
- Intention Plane (intent encoding, routing)
- LucidDreamer (hypothesis generation, learning)
- End-to-end query processing
- ORPO training

**Run it:**
```bash
npm run superinstance
```

**Expected output:**
```
=== Example 1: Basic SuperInstance Initialization ===

✓ SuperInstance initialized successfully
  Context Plane: Ready
  Intention Plane: Ready
  LucidDreamer: Ready
```

---

## Next Steps

1. **Explore the code** - Each example is heavily commented
2. **Modify parameters** - Experiment with different configurations
3. **Build your own** - Use examples as templates for your applications
4. **Read the docs** - Check out [README.md](./README.md) for detailed documentation

## Common Issues

### "Module not found" error

**Solution:** Build packages first:
```bash
npm run build
```

### "Ollama connection refused"

**Solution:** Start Ollama service:
```bash
ollama serve
```

### Examples run slowly

**Solution:** Some examples simulate delays. Reduce iterations in the code.

## Need Help?

- Check [README.md](./README.md) for detailed documentation
- Review [CLAUDE.md](../CLAUDE.md) for project context
- Open an issue on GitHub

## License

MIT License - See [LICENSE](../LICENSE) for details.

---

**Happy coding!** 🚀
