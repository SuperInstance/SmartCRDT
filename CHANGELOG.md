# Changelog

All notable changes to the Aequor Cognitive Orchestration Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Native module compilation for performance-critical operations (Rust FFI)
- Real embedding service integration with OpenAI and Ollama adapters
- Comprehensive test suite for all packages

### Changed
- Improved module resolution across all packages
- Enhanced TypeScript configuration for better type checking

### Fixed
- Ongoing fixes for P0 TODO items
- Improved error handling in core components

## [1.0.0] - 2026-01-02

### Added
- **Cascade Router** (@lsi/cascade) - Intelligent routing layer with complexity-based decision making
  - Complexity-based routing (local vs cloud model selection)
  - Prosody detection for temporal awareness (WPM, acceleration, silence patterns)
  - Motivation encoder for emotional intelligence (5-dimensional tracking)
  - Semantic caching with 80%+ target hit rate
  - Query refiner for static and semantic query analysis
  - Cost-aware routing with budget tracking
  - Shadow logging for privacy-preserving analytics
  - Health checks for Ollama integration
  - Tier management and rate limiting (token bucket, sliding window)

- **Privacy Layer** (@lsi/privacy) - Privacy-preserving protocols and intent encoding
  - IntentEncoder for vector-based query encoding (768-dim)
  - RedactionAdditionProtocol for functional privacy
  - PrivacyClassifier for sensitivity detection (LOGIC/STYLE/SECRET)
  - IntentVectorizer for semantic transformation
  - Secure redaction and re-hydration pipeline

- **SuperInstance** (@lsi/superinstance) - Three-plane cognitive architecture
  - ContextPlane for sovereign memory (semantic graph, vectors, knowledge cartridges)
  - IntentionPlane for sovereign inference
  - LucidDreamer for metabolic learning (ORPO training, hypothesis generation)
  - libcognitive 4-primitive API (transduce, recall, cogitate, effect)

- **Protocol Package** (@lsi/protocol) - Protocol definitions with 500+ type interfaces
  - ATP (Autonomous Task Processing) protocol for single-model queries
  - ACP (Assisted Collaborative Processing) protocol for multi-model queries
  - Unified type definitions for ecosystem interoperability
  - Zero-dependency protocol-first design

- **Swarm Package** (@lsi/swarm) - Distributed systems primitives
  - CRDT implementations (G-Counter, PN-Counter, OR-Set, LWW-Register)
  - CRDTStore for distributed knowledge storage
  - Event-sourced architecture for offline-first operation
  - Conflict-free replicated data types

- **Embeddings Package** (@lsi/embeddings) - Production-ready embedding services
  - OpenAI embedding service integration (1536-dim vectors)
  - Ollama embedding service for local inference
  - HNSW indexing for fast similarity search
  - Multiple model support (text-embedding-3-small, etc.)

- **Core Package** (@lsi/core) - Core cognitive architecture
  - libcognitive API implementation
  - Semantic operations and transformations
  - Core data structures and utilities

- **CLI Tool** (@lsi/cli) - Command-line interface for component management
  - Component pull, list, run, info, update, remove commands
  - App install, run, list, info commands
  - Configuration management (get, set, list)
  - Registry integration and dependency resolution

- **Registry and Manager** - Component lifecycle management
  - Component registry with manifest support
  - Dependency resolution engine
  - Version compatibility tracking
  - Lifecycle management (install, update, remove)

- **Hardware-Aware Computing** - Performance optimization suite
  - NUMA-aware memory allocation
  - Thermal monitoring and management
  - SIMD instruction optimizations
  - Hardware fingerprinting

- **Cartridge System** - Extensible knowledge loading
  - Cartridge loading and execution
  - Knowledge cartridge format
  - Dynamic component loading

- **Testing Infrastructure**
  - Integration test framework (E2E tests)
  - Performance test suite and benchmarking tools
  - Coverage reporting with Vitest
  - Unit test infrastructure

- **Build System**
  - TypeScript compilation with project references
  - Native module build support (Rust/C++)
  - ESLint and Prettier configuration
  - Husky pre-commit hooks

- **Documentation**
  - Professional READMEs for all packages
  - Architecture diagrams with Mermaid
  - API documentation for 41+ exported APIs
  - Contributing guide and security policy
  - Architecture decision records (ADRs)
  - Project roadmap and vision documentation

### Changed
- Project evolution from "LSI" through "Cascade" to "Aequor Cognitive Orchestration Platform"
- Strategic pivot to 3-project portfolio (Aequor Core + Privacy Suite + Performance Suite)
- Protocol-first design approach for all new features
- Component extraction strategy for modular architecture

### Fixed
- **Build System** - Resolved all TypeScript compilation errors (4,299 errors → 0)
- **Module Resolution** - Fixed module resolution issues across monorepo
- **Test Infrastructure** - Improved test setup and coverage reporting
- **Type Safety** - Enhanced type definitions across all packages
- **G-Counter Bug** - Documented and addressed CRDT merge behavior

### Security
- Privacy by design with intent encoding
- Redaction-addition protocol for GDPR/HIPAA compliance
- PII detection in shadow logging
- Secure VM isolation planning

### Performance
- Target metrics established:
  - 90% cost reduction through local-first routing
  - 99% quality retention
  - 40% battery extension
  - 80% cache hit rate
  - Sub-100ms routing decisions
- Native module implementation for 3-30x speedups
- Semantic caching with similarity search

### Documentation
- Consolidated documentation from 40+ markdown files
- Content overlap reduced from 67% to <20%
- Created unified roadmap and architecture documentation
- Established canonical sources for project information
- Generated comprehensive code review and component analysis

## [0.1.0] - 2025-12-01

### Added
- Initial project setup as "LSI" (Locally Sovereign Intelligence)
- Basic cognitive architecture concept
- Core infrastructure foundations

[Unreleased]: https://github.com/SuperInstance/SmartCRDT/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/SuperInstance/SmartCRDT/releases/tag/v1.0.0
[0.1.0]: https://github.com/SuperInstance/SmartCRDT/releases/tag/v0.1.0
