# @lsi/swarm

**Distributed Systems Primitives for the Aequor Cognitive Orchestration Platform**

@lsi/swarm provides foundational distributed systems components for building sovereign, offline-first AI applications. This package implements CRDT-based storage, cartridge knowledge management, version negotiation, distributed rollback protocols, and hypothesis distribution.

## Features

- **CRDT Types** - Type interfaces for conflict-free replicated data types (G-Counter, PN-Counter, OR-Set, LWW-Register)
- **Cartridge System** - Manifest loading, validation, and verification for knowledge cartridges
- **Version Negotiation** - Client-server protocol for version compatibility
- **Rollback Protocol** - Distributed consensus for safe system rollbacks
- **Hypothesis Distribution** - Distributed hypothesis validation across nodes
- **Knowledge Graph** - Codebase relationship graph builder with path analysis

## Installation

```bash
npm install @lsi/swarm
```

## Quick Start

### Cartridge Manifest Loading

```typescript
import { loadManifest, createManifest } from '@lsi/swarm';

// Load an existing cartridge manifest
const result = await loadManifest('./cartridges/medical/cartridge.json', {
  validateChecksum: true,
  validateSignature: true,
  allowUnsigned: false,
});

if (result.isValid) {
  console.log(`Loaded cartridge: ${result.manifest.name}`);
  console.log(`Capabilities: ${result.manifest.capabilities.domains.join(', ')}`);
} else {
  console.error('Validation errors:', result.errors);
}

// Create a new manifest from a directory
const manifest = await createManifest(
  './my-cartridge',
  '@lsi/cartridge-custom',
  '1.0.0',
  'My Custom Cartridge',
  'A specialized knowledge cartridge',
  {
    author: 'Your Name',
    license: 'MIT',
    domains: ['medical', 'diagnostics'],
    queryTypes: ['QUESTION', 'ANALYSIS'],
    privacyLevel: 'sensitive',
  }
);
```

### Knowledge Graph Builder

```typescript
import { KnowledgeGraphBuilder } from '@lsi/swarm';

const builder = new KnowledgeGraphBuilder({
  baseDir: './src',
  includeTests: false,
  language: 'typescript',
});

// Build graph from codebase
const info = await builder.build('./src');

console.log(`Imported ${info.nodesAdded} nodes`);
console.log(`Created ${info.edgesAdded} edges`);

// Find shortest path between two nodes
const path = await builder.findShortestPath({
  source: 'CascadeRouter',
  target: 'OpenAIAdapter',
  algorithm: 'dijkstra',
});

console.log(`Path: ${path.path.join(' -> ')}`);
console.log(`Distance: ${path.distance}`);

// Analyze impact of changing a node
const impact = await builder.analyzeImpact('QueryRefiner');
console.log(`Dependents: ${impact.dependentNodes.length}`);
console.log(`Affected files: ${impact.affectedFiles.join(', ')}`);
```

### Version Negotiation

```typescript
import { NegotiationClient, NegotiationServer } from '@lsi/swarm';

// Server-side version negotiation
const server = new NegotiationServer({
  getCurrentVersion: async () => ({
    version: '2.1.0',
    compatibility: '^2.0.0',
    components: {
      router: '1.5.0',
      cache: '2.0.3',
    },
  }),
});

// Client-side version negotiation
const client = new NegotiationClient({
  clientVersion: '2.0.5',
  requiredCompatibility: '>=2.0.0',
});

const result = await client.negotiate('http://localhost:3000/api/version');

if (result.compatible) {
  console.log('Versions are compatible');
  console.log('Server version:', result.serverVersion);
} else {
  console.error('Version mismatch:', result.reason);
}
```

### Rollback Protocol

```typescript
import { RollbackProtocol, ConsensusManager } from '@lsi/swarm';

const consensus = new ConsensusManager({
  threshold: 0.67, // 67% agreement required
  timeout: 30000,  // 30 second timeout
});

const protocol = new RollbackProtocol({
  consensus,
  maxRollbacks: 3,
  rollbackWindow: 86400000, // 24 hours
});

// Initiate a rollback
const result = await protocol.executeRollback({
  targetVersion: '1.5.0',
  reason: 'Critical bug in query processing',
  initiator: 'admin',
});

if (result.success) {
  console.log('Rollback completed successfully');
  console.log(`Nodes affected: ${result.nodesAffected}`);
} else {
  console.error('Rollback failed:', result.error);
}
```

### Hypothesis Distribution

```typescript
import { HypothesisDistributor } from '@lsi/swarm';

const distributor = new HypothesisDistributor({
  nodes: ['node1', 'node2', 'node3'],
  validationTimeout: 5000,
  aggregationStrategy: 'majority',
});

// Distribute a hypothesis for validation
const hypothesis = {
  id: 'hyp-123',
  claim: 'Query refactoring reduces latency by 15%',
  evidence: ['metric-data-1', 'metric-data-2'],
};

const result = await distributor.distribute(hypothesis);

console.log(`Validation results: ${result.validations.length}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Status: ${result.status}`);
```

## CRDT Types

@lsi/swarm provides TypeScript interfaces for CRDT operations. While the package doesn't include concrete CRDT implementations, it defines the types for compatibility with CRDT stores:

```typescript
import type { CRDTOperation, CRDTSnapshot, CRDTStore } from '@lsi/swarm';

// CRDT operation type
const operation: CRDTOperation = {
  id: 'op-123',
  type: 'add',
  target: 'knowledge-graph',
  value: { node: 'QueryRefiner', edges: [] },
  timestamp: Date.now(),
  nodeId: 'node-1',
};

// CRDT snapshot type
const snapshot: CRDTSnapshot = {
  id: 'snap-456',
  state: { 'knowledge-graph': { ... } },
  version: 5,
  timestamp: Date.now(),
  checksum: 'abc123...',
};
```

### Supported CRDT Types

| CRDT Type | Description | Use Case |
|-----------|-------------|----------|
| **G-Counter** | Grow-only counter | Counting events, metrics |
| **PN-Counter** | Positive-negative counter | Increment/decrement operations |
| **OR-Set** | Observed-remove set | Collections with add/remove |
| **LWW-Register** | Last-writer-wins register | Single-value state with conflicts |

## Cartridge System

The cartridge system provides secure knowledge distribution with manifest validation.

### Manifest Structure

```typescript
interface CartridgeManifest {
  id: string;                    // @lsi/cartridge-name
  version: string;               // Semantic version
  name: string;                  // Human-readable name
  description: string;           // Description
  author?: string;               // Author name
  license?: string;              // License identifier
  capabilities: {
    domains: string[];           // Specialized domains
    queryTypes: QueryType[];     // Supported query types
    embeddingModel?: string;     // Embedding model used
    sizeBytes: number;           // Total size
    loadTimeMs: number;          // Estimated load time
    privacyLevel: 'public' | 'sensitive' | 'sovereign';
  };
  dependencies: string[];        // Required cartridges
  conflicts: string[];           // Conflicting cartridges
  checksum: string;              // SHA-256 checksum
  signature?: string;            // Cryptographic signature
  files: Array<{
    path: string;
    checksum: string;
    size: number;
  }>;
}
```

### Manifest Validation

```typescript
import { ManifestLoader } from '@lsi/swarm';

const loader = new ManifestLoader('./schema/cartridge-manifest.json');

// Validate manifest structure
const result = await loader.validate(manifest);

if (!result.isValid) {
  console.error('Schema errors:', result.errors);
}

// Verify file checksums
const checksumsValid = await loader.verifyChecksums(manifest, './cartridges/medical');

// Verify cryptographic signature
const signatureValid = await loader.verifySignature(manifest);

// Validate directory structure
const dirValid = await loader.validateDirectory('./cartridges/medical');
```

## Knowledge Graph

Build and analyze codebase relationship graphs for impact analysis and dependency tracking.

### Graph Queries

```typescript
import { KnowledgeGraphBuilder } from '@lsi/swarm';

const builder = new KnowledgeGraphBuilder();

// Find all ancestors (dependencies)
const ancestors = await builder.findAncestors({
  node: 'CascadeRouter',
  maxDepth: 5,
});

// Find all descendants (dependents)
const descendants = await builder.findDescendants({
  node: 'QueryRefiner',
  maxDepth: 3,
});

// Find neighbors
const neighbors = await builder.findNeighbors({
  node: 'SemanticCache',
  direction: 'both',
  maxDepth: 2,
});

// Detect cycles
const cycles = await builder.detectCycles();
if (cycles.hasCycles) {
  console.warn('Circular dependencies:', cycles.cycles);
}
```

### Graph Statistics

```typescript
const stats = await builder.getStatistics();

console.log(`Nodes: ${stats.nodeCount}`);
console.log(`Edges: ${stats.edgeCount}`);
console.log(`Average degree: ${stats.averageDegree}`);
console.log(`Diameter: ${stats.diameter}`);
console.log(`Connected components: ${stats.connectedComponents}`);
```

## Configuration

### ManifestLoader Options

```typescript
interface ManifestLoadOptions {
  validateChecksum?: boolean;    // Verify file checksums
  validateSignature?: boolean;   // Verify cryptographic signature
  allowUnsigned?: boolean;       // Allow cartridges without signatures
  basePath?: string;             // Base path for relative files
}
```

### KnowledgeGraphBuilder Options

```typescript
interface GraphBuilderConfig {
  baseDir: string;               // Base directory for imports
  includeTests?: boolean;        // Include test files
  language?: 'typescript' | 'javascript' | 'python';
  maxDepth?: number;             // Maximum import depth
}
```

### RollbackProtocol Options

```typescript
interface RollbackConfig {
  consensus: ConsensusManager;   // Consensus manager
  maxRollbacks?: number;         // Maximum rollbacks per window
  rollbackWindow?: number;       // Time window in milliseconds
  healthCheck?: boolean;         // Run health checks before rollback
}
```

### HypothesisDistributor Options

```typescript
interface DistributorConfig {
  nodes: string[];               // Node identifiers
  validationTimeout?: number;    // Timeout per validation (ms)
  aggregationStrategy?: 'majority' | 'weighted' | 'unanimous';
  quorum?: number;               // Minimum nodes required
}
```

## API Reference

### Cartridge Module

- `ManifestLoader` - Load and validate cartridge manifests
- `loadManifest(path, options)` - Convenience function to load manifest
- `createManifest(dir, id, version, name, description, options)` - Create new manifest
- `writeManifest(manifest, path)` - Write manifest to file

### Version Module

- `NegotiationClient` - Client-side version negotiation
- `NegotiationServer` - Server-side version negotiation
- `VersionSelector` - Select compatible versions

### Rollback Module

- `RollbackProtocol` - Orchestrate distributed rollbacks
- `ConsensusManager` - Manage consensus across nodes
- `RollbackExecutor` - Execute rollback operations
- `HealthVerifier` - Verify system health before/after rollback
- `MetricsCollector` - Collect and aggregate metrics

### Hypothesis Module

- `HypothesisDistributor` - Distribute and validate hypotheses

### Knowledge Graph Module

- `KnowledgeGraphBuilder` - Build and query codebase graphs

## Usage Examples

### Creating a Cartridge

```typescript
import { createManifest, writeManifest } from '@lsi/swarm';

const manifest = await createManifest(
  './cartridges/medical-qa',
  '@lsi/cartridge-medical-qa',
  '1.0.0',
  'Medical Q&A Knowledge',
  'Specialized knowledge for medical question answering',
  {
    author: 'Medical AI Team',
    license: 'MIT',
    homepage: 'https://github.com/lsi/cartridges/medical-qa',
    repository: 'https://github.com/lsi/cartridges/medical-qa.git',
    embeddingModel: 'text-embedding-ada-002',
    privacyLevel: 'sensitive',
    domains: ['medical', 'healthcare', 'diagnostics'],
    queryTypes: ['QUESTION', 'ANALYSIS', 'DIAGNOSIS'],
    sign: true,
  }
);

await writeManifest(manifest, './cartridges/medical-qa/cartridge.json');
```

### Loading and Validating

```typescript
import { loadManifest } from '@lsi/swarm';

const result = await loadManifest(
  './cartridges/medical-qa/cartridge.json',
  {
    validateChecksum: true,
    validateSignature: true,
    allowUnsigned: false,
  }
);

if (result.isValid) {
  console.log('Cartridge loaded successfully');
  console.log('Warnings:', result.warnings);
} else {
  console.error('Failed to load cartridge');
  console.error('Errors:', result.errors);
}
```

### Analyzing Codebase Impact

```typescript
import { KnowledgeGraphBuilder } from '@lsi/swarm';

const builder = new KnowledgeGraphBuilder({
  baseDir: './src',
  language: 'typescript',
});

await builder.build('./src');

// What happens if we change CascadeRouter?
const impact = await builder.analyzeImpact('CascadeRouter');

console.log('Files that would be affected:');
impact.affectedFiles.forEach(file => console.log(`  - ${file}`));

console.log('Nodes that depend on this:');
impact.dependentNodes.forEach(node => console.log(`  - ${node}`));

console.log('Risk level:', impact.riskLevel);
```

## Architecture

@lsi/swarm follows the Aequor architecture principles:

1. **Protocol-First** - All interfaces defined in @lsi/protocol
2. **Offline-First** - CRDTs enable disconnected operation
3. **Privacy by Design** - Sovereign knowledge with cryptographic verification
4. **Distributed** - No single point of failure
5. **Type-Safe** - Full TypeScript support

## Dependencies

- **@lsi/protocol** - Type definitions and protocol interfaces
- **ajv** - JSON Schema validation
- **ajv-formats** - Additional AJV formats

## License

MIT

## Contributing

Contributions are welcome! Please see the [Aequor contribution guidelines](https://github.com/lsi/aequor/blob/main/CONTRIBUTING.md).

## Related Packages

- [@lsi/protocol](https://github.com/lsi/aequor/tree/main/packages/protocol) - Protocol definitions
- [@lsi/core](https://github.com/lsi/aequor/tree/main/packages/core) - Core libcognitive API
- [@lsi/cascade](https://github.com/lsi/aequor/tree/main/packages/cascade) - Routing and caching
- [@lsi/superinstance](https://github.com/lsi/aequor/tree/main/packages/superinstance) - AI orchestration

## Links

- [Aequor Documentation](https://github.com/lsi/aequor)
- [Protocol Specification](https://github.com/lsi/aequor/blob/main/demo/papers/paper3.3.md)
- [Architecture Decisions](https://github.com/lsi/aequor/blob/main/demo/docs/ARCHITECTURE_DECISIONS.md)
