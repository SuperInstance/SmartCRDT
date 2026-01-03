# Aequor Cognitive Orchestration - Usage Examples

This directory contains comprehensive, runnable examples demonstrating the core components of the Aequor Cognitive Orchestration Platform. Each example is fully documented with best practices, error handling, and expected output.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Examples](#examples)
- [Running Examples](#running-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The examples demonstrate:

1. **Cascade Routing** - Intelligent query routing between local and cloud models
2. **Privacy-First AI** - Intent encoding, PII redaction, differential privacy
3. **Semantic Caching** - High-hit-rate caching with similarity matching
4. **Hardware-Aware Dispatch** - GPU/CPU/NPU detection and optimization
5. **SuperInstance** - Complete three-plane architecture (Context, Intention, LucidDreamer)

## Quick Start

```bash
# Navigate to examples directory
cd /mnt/c/users/casey/smartCRDT/demo/examples

# Run a specific example
npx tsx cascade-basic-usage.ts

# Or compile and run
npm run build
node dist/cascade-basic-usage.js
```

## Examples

### 1. cascade-basic-usage.ts

**Basic routing between local and cloud models**

Demonstrates the fundamental usage of `CascadeRouter` for intelligent query routing:

- Basic routing decisions based on query complexity
- Routing with context and session management
- Error handling for invalid inputs
- Production configuration best practices
- Query refinement suggestions

**Key Features:**
- Complexity-based routing (simple → local, complex → cloud)
- Session context for pattern detection
- Emotional intelligence (cadence, motivation)
- Cache integration
- Health checks and fallback

**Expected Output:**
```
=== Example 1: Basic Routing ===
Query: "What is TypeScript?"
Route: local
Confidence: 0.95
Est. Latency: 50ms
Est. Cost: $0.0000
```

**Use Cases:**
- Cost-optimized AI applications
- Hybrid local/cloud deployments
- User experience optimization

---

### 2. privacy-first-bot.ts

**Privacy-preserving AI with intent encoding**

Builds a privacy-first AI bot that protects user data through:

- Intent encoding (768-dim vectors instead of plaintext)
- Privacy classification (LOGIC/STYLE/SECRET levels)
- Redaction-Addition Protocol (R-A)
- Differential privacy (ε-DP)
- Privacy budget tracking

**Key Features:**
- Queries encoded as vectors before cloud transmission
- PII detection and redaction
- GDPR/HIPAA compliance ready
- Calibrated noise injection
- Privacy budget management

**Expected Output:**
```
=== Example 1: Intent Encoding ===
Original: "My email is user@example.com and my phone is 555-1234"
Intent Vector Dimensions: 768
First 5 values: [0.5432, -0.1234, 0.7890, 0.2345, -0.5678]...
Vector norm: 14.2345

✓ Intent encoded successfully
  Cloud receives: [768-dim vector only]
  Original text: Never leaves device
```

**Use Cases:**
- Healthcare AI (HIPAA compliance)
- Financial services (GDPR compliance)
- Enterprise chatbots (data sovereignty)
- Sensitive document analysis

---

### 3. semantic-caching.ts

**High-hit-rate semantic caching**

Demonstrates semantic caching achieving ~80% hit rate:

- Semantic similarity matching (not just exact strings)
- Per-query-type thresholds (code needs higher precision)
- Adaptive threshold optimization
- HNSW index for O(log n) search
- Comprehensive cache statistics

**Key Features:**
- Semantic similarity matching (cosine similarity)
- LRU eviction with semantic awareness
- Hit rate targeting (80% default)
- Per-query-type optimization
- Cache warming strategies

**Expected Output:**
```
=== Example 2: Cache Statistics ===
"How do I optimize database queries?": HIT (similarity: 0.923)
"Database query optimization tips?": HIT (similarity: 0.891)

--- Cache Statistics ---
Size: 10 entries
Hit Rate: 75.0%
Total Hits: 9
Total Misses: 3
Exact Hits: 5
Semantic Hits: 4
Current Threshold: 0.850
```

**Use Cases:**
- Reducing AI API costs by 90%
- Improving response latency
- Offline-first applications
- High-traffic Q&A systems

---

### 4. hardware-aware-dispatch.ts

**Hardware detection and optimization**

Shows hardware-aware AI inference with:

- GPU/CPU/NPU detection and profiling
- Thermal state monitoring
- NUMA-aware scheduling
- Power-aware routing
- Adaptive performance tuning

**Key Features:**
- Automatic hardware capability detection
- Thermal throttling prevention
- Energy efficiency optimization
- NUMA topology awareness
- Performance feedback loops

**Expected Output:**
```
=== Example 1: Hardware Detection ===
Hardware Profile:
  Platform: linux
  Architecture: x64

GPU Detected:
  Type: NVIDIA GeForce RTX 3090
  Vendor: NVIDIA
  Memory: 24GB
  Compute Capability: 8.6

CPU:
  Cores: 16
  Frequency: 3.5GHz
  AVX Support: true
```

**Use Cases:**
- Maximizing hardware utilization
- Energy-efficient inference
- Thermal management in production
- Multi-GPU deployments

---

### 5. superinstance-three-planes.ts

**Complete SuperInstance architecture**

Demonstrates the full three-plane architecture:

- **Context Plane** - Sovereign memory and knowledge retrieval
- **Intention Plane** - Intent encoding and model selection
- **LucidDreamer** - Metabolic learning and hypothesis generation

**Key Features:**
- Unified API for all three planes
- Knowledge graph integration
- Privacy-first design
- ORPO training pipeline
- Hypothesis generation and testing

**Expected Output:**
```
=== Example 1: Basic SuperInstance Initialization ===
✓ SuperInstance initialized successfully
  Context Plane: Ready
  Intention Plane: Ready
  LucidDreamer: Ready

=== Example 5: End-to-End Query Processing ===
Processing Query: "How do I optimize database queries in TypeScript?"

Step 1: Intention Plane
  Privacy Level: PUBLIC
  Intent Vector: [768 dimensions]

Step 2: Context Plane
  Retrieved 3 context items
    1. Database optimization involves indexing strategies...
    2. TypeScript database drivers...
    3. Query performance best practices...

Step 3: Response Generation
  Response: To optimize database queries in TypeScript...
```

**Use Cases:**
- Enterprise AI orchestration
- Knowledge management systems
- Research assistant applications
- Multi-modal AI systems

---

## Running Examples

### Prerequisites

```bash
# Install dependencies
npm install

# Build packages
npm run build
```

### Run Individual Examples

```bash
# Using tsx (recommended for development)
npx tsx cascade-basic-usage.ts
npx tsx privacy-first-bot.ts
npx tsx semantic-caching.ts
npx tsx hardware-aware-dispatch.ts
npx tsx superinstance-three-planes.ts

# Or compile and run with node
npm run build
node dist/examples/cascade-basic-usage.js
```

### Run All Examples

```bash
# Run all examples sequentially
npm run examples
```

### Run Specific Example Function

Each example file exports individual functions that can be run separately:

```typescript
import { basicRoutingExample } from './cascade-basic-usage';

await basicRoutingExample();
```

---

## Best Practices

### 1. Error Handling

Always wrap example code in try-catch blocks:

```typescript
try {
  const decision = await router.route(query);
  console.log('✓ Success:', decision.route);
} catch (error) {
  console.error('✗ Failed:', error);
  // Handle specific error types
}
```

### 2. Configuration

Use production-ready configurations:

```typescript
const router = new CascadeRouter({
  enableRefiner: true,
  enableCache: true,
  enableHealthChecks: true,
  complexityThreshold: 0.7,
});
```

### 3. Resource Cleanup

Clean up resources when done:

```typescript
const instance = new SuperInstance(config);
try {
  await instance.initialize();
  // Use instance
} finally {
  await instance.shutdown();
}
```

### 4. Privacy Protection

Always enable privacy features for sensitive data:

```typescript
const intentionPlane = new IntentionPlane({
  enableIntentEncoding: true,
  enableDifferentialPrivacy: true,
  epsilon: 1.0,
});
```

### 5. Monitoring

Track performance and usage:

```typescript
const stats = cache.getStats();
console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

---

## Troubleshooting

### Common Issues

**Issue:** "Module not found" errors

**Solution:** Ensure packages are built:
```bash
npm run build
```

**Issue:** Ollama connection refused

**Solution:** Start Ollama service:
```bash
ollama serve
```

**Issue:** Out of memory errors

**Solution:** Reduce cache size or batch size:
```typescript
const cache = new SemanticCache({ maxSize: 100 });
```

**Issue:** Privacy budget exhausted

**Solution:** Increase epsilon or reset budget:
```typescript
const encoder = new IntentEncoder({ epsilon: 2.0 });
```

### Debug Mode

Enable debug logging:

```typescript
const router = new CascadeRouter({
  debug: true,
  verbose: true,
});
```

### Health Checks

Check component health:

```typescript
const health = await instance.healthCheck();
console.log('Health:', health);
```

---

## Additional Resources

- [CLAUDE.md](../CLAUDE.md) - Project documentation
- [ARCHITECTURE_DECISIONS.md](../docs/ARCHITECTURE_DECISIONS.md) - Design rationale
- [STATUS.md](../docs/STATUS.md) - Current implementation status
- [ROADMAP.md](../docs/ROADMAP.md) - Development roadmap

---

## Contributing

When adding new examples:

1. **Follow the structure** - Each example should have multiple sub-examples
2. **Add comments** - Explain what each section does
3. **Show output** - Include expected output in comments
4. **Error handling** - Always demonstrate proper error handling
5. **Best practices** - Show production-ready patterns

Example template:

```typescript
/**
 * Example Name - Brief description
 *
 * @package @lsi/package
 * @example
 */

async function exampleName() {
  console.log('=== Example Name ===\n');

  try {
    // Implementation
  } catch (error) {
    console.error('Failed:', error);
  }
}

async function main() {
  await exampleName();
}

if (require.main === module) {
  main();
}

export { exampleName };
```

---

## License

MIT License - See [LICENSE](../LICENSE) for details.

---

**Last Updated:** 2026-01-02
**Version:** 1.0.0
**Status:** Production Ready
