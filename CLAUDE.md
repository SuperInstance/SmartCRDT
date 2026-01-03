# CLAUDE.md - SuperInstance Infrastructure

**Version:** 24.0-CLEAN
**Status:** Modular Infrastructure Development
**Repository:** https://github.com/SuperInstance/SmartCRDT

---

## What is SuperInstance?

**SuperInstance** is an infrastructure layer for AI applications. It provides modular components that developers pull and combine to build AI-powered software.

Components route requests, manage privacy, cache responses, and adapt to hardware. The system learns from usage and improves over time.

```
# Pull a routing component
superinstance pull router

# Pull a cache component
superinstance pull cache

# Pull an app that uses multiple components
superinstance app install chat-assistant
```

---

## Architecture

**Components** are modular, pluggable units:
- `router` - Routes requests to appropriate models
- `cache` - Stores and retrieves responses
- `privacy` - Handles data privacy
- `embeddings` - Generates text embeddings
- `adapters` - Connects to different AI models

**Apps** are collections of components:
```yaml
# chat-assistant app
components:
  - router
  - cache
  - embeddings
  - rag-pipeline
```

---

## CLI Commands

### Component Commands
```bash
superinstance pull <component>     # Download component
superinstance list                  # List available components
superinstance run <component>       # Run component directly
superinstance info <component>      # Show component details
superinstance update <component>    # Update to latest version
superinstance remove <component>    # Remove installed component
```

### App Commands
```bash
superinstance app install <app>     # Install app with all components
superinstance app run <app>         # Run installed app
superinstance app list              # List available apps
superinstance app info <app>        # Show app details
```

### Configuration Commands
```bash
superinstance config get <key>      # Get configuration value
superinstance config set <key> <val> # Set configuration value
superinstance config list           # List all configuration
```

---

## Component System

Each component has a manifest:

```yaml
name: router
version: 1.0.0
type: routing
language: typescript
dependencies:
  - protocol >= 1.0.0
```

Components are pulled from a registry and installed locally. The system handles:
- Dependency resolution
- Version compatibility
- Hardware adaptation
- Configuration merging

---

## Learning System

SuperInstance learns from usage:

1. **Observation** - The system observes how components are used
2. **Profiling** - Performance metrics are collected
3. **Adaptation** - Configuration is tuned based on patterns
4. **Feedback** - Improvements are applied automatically

Learning data stays local. Each installation develops its own profile based on:

- Hardware characteristics
- Usage patterns
- Performance metrics
- Error rates

---

## Current Status

### Completed (Rounds 14-15)
- Component registry design
- Manifest schema
- Dependency resolution
- Version compatibility tracking
- Lifecycle management

### In Progress
- CLI implementation
- Native modules (Rust/C++)
- Component extraction from existing packages

### Roadmap
```
Round 16: Native Modules (Rust/C++)
Round 17: FFI Bindings (Python/TypeScript)
Round 18: App Registry
```

---

## Development Principles

1. **Modular** - Everything is a component
2. **Hardware Agnostic** - Works on any hardware
3. **Simple CLI** - Pull, install, run
4. **Open Source** - No monetization in repo
5. **Learning** - Adapts to usage patterns
6. **Clean Repository** - Only infrastructure code

---

## Repository Standards

### Keep
- Production modular code
- Component registry and manifests
- CLI tools
- Infrastructure documentation
- Build configs

### Remove from Repo
- Monetization/billing/payment docs (archive locally)
- Marketing materials
- Business plans
- Archives

### Archive Locally (Don't Delete)
- Payment/billing strategies
- Pricing ideas
- Marketing concepts

---

## Language Strategy

| Layer | Language | Purpose |
|-------|----------|---------|
| Core Infrastructure | Rust | Performance, memory safety |
| Bottlenecks | C++ | Maximum performance |
| Business Logic | TypeScript | Portability |
| Data Science | Python | ML ecosystem |

Components start in TypeScript. Bottlenecks are rewritten in Rust/C++.

---

## File Locations

```
demo/
├── components/           # Component definitions
│   ├── router/
│   ├── cache/
│   └── embeddings/
├── apps/                 # App manifests
│   ├── chat-assistant/
│   └── rag-pipeline/
├── packages/             # Implementation packages
│   ├── registry/         # Component registry
│   ├── resolver/         # Dependency resolution
│   ├── manager/          # Component lifecycle
│   └── config/           # Configuration
├── docs/                 # Documentation
└── scripts/              # Build/install scripts
```

---

## Build Commands

```bash
# Build all packages
npm run build

# Build TypeScript only
npm run build:ts

# Build native modules (Rust)
npm run build:native

# Build native modules in release mode
npm run build:native:release

# Clean all build artifacts
npm run clean

# Deep clean (including node_modules)
npm run clean:deep

# Run tests
npm test

# Run native module tests
npm run test:native

# Run benchmarks
npm run bench

# Generate performance report
npm run bench:report
```

---

## Native Modules

SuperInstance uses Rust native modules for performance-critical operations. These are located in `/native/` and provide 3-30x speedups over pure TypeScript implementations.

### Native Module Structure

```
native/
├── core/          # Core data structures and utilities
├── embeddings/    # Vector operations and similarity search
├── crypto/        # Cryptographic primitives (BLAKE3, encryption)
├── crdt/          # Conflict-free replicated data types
└── ffi/           # Node.js FFI bindings
```

### Performance Improvements

| Operation | TypeScript | Rust | Speedup |
|-----------|-----------|------|---------|
| Vector Similarity (768-dim) | 280μs | 85μs | **3.29x** |
| BLAKE3 Hash (4KB) | 950μs | 45μs | **21.11x** |
| CRDT Merge (100 nodes) | 980μs | 195μs | **5.03x** |
| HNSW Search (100K vectors) | 28ms | 5.8ms | **4.83x** |

### Building Native Modules

Native modules are optional and will be automatically built if Rust is installed:

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build native modules
npm run build:native:release
```

If Rust is not available, the system will fall back to TypeScript implementations.

### Using Native Modules

```typescript
// Native modules are automatically used when available
import { SemanticCache } from '@lsi/cascade';

// The cache will use Rust implementations if available
const cache = new SemanticCache();
await cache.set('key', 'value', embedding);
```

### Running Benchmarks

```bash
# Run all benchmarks
npm run bench

# Generate performance comparison report
npm run bench:report

# View results
cat docs/PERFORMANCE_REPORT.md
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Components Extracted | 0 | 50+ |
| CLI Implemented | No | Yes |
| Native Modules | 0 | 5+ |
| Test Pass Rate | 86.7% | 95% |

---

## Known Issues

### P0 (Blocking)
None

### P1 (Important)
- Extract components from existing packages
- Implement CLI commands
- Create example apps

### P2 (Nice to Have)
- Native module optimization
- Python bindings
- App marketplace

---

## Resources

- [Ollama](https://github.com/ollama/ollama) - Model management
- [PyTorch](https://pytorch.org/) - Module system
- [Rust FFI](https://doc.rust-lang.org/nomicon/ffi.html) - Native bindings

---

**Last Updated:** 2026-01-02
**Mode:** Modular Infrastructure Development
**Status:** Round 14-15 Complete, Round 16 Pending
**Positioning:** SuperInstance = Infrastructure Layer for AI Applications
