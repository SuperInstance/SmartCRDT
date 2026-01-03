/**
 * @lsi/resolver - Dependency Resolution System
 *
 * Provides dependency resolution for Aequor components using a PubGrub-inspired
 * backtracking algorithm. Handles version constraints, conflict detection, and
 * circular dependency prevention.
 *
 * @version 1.0.0
 */

import { parse, parseConstraint, satisfies, compare, Semver, VersionConstraint, increment } from '@lsi/semver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Component metadata
 */
export interface ComponentMetadata {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Component description */
  description?: string;
  /** Component author */
  author?: string;
  /** Component license */
  license?: string;
  /** Component homepage */
  homepage?: string;
  /** Component repository */
  repository?: string;
  /** Component tags */
  tags?: string[];
  /** Component capabilities */
  capabilities?: string[];
}

/**
 * Component information
 */
export interface ComponentInfo {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Component dependencies (name -> constraint) */
  dependencies: Map<string, string>;
  /** Component metadata */
  metadata: ComponentMetadata;
}

/**
 * Component manifest (user input)
 */
export interface ComponentManifest {
  /** Root components to resolve */
  components: string[];
  /** Dependency constraints (name -> constraint) */
  dependencies: Map<string, string>;
  /** Manifest metadata */
  metadata?: {
    name?: string;
    version?: string;
    description?: string;
  };
}

/**
 * Component registry (available components)
 */
export interface ComponentRegistry {
  /** Get component by name and version */
  getComponent(name: string, version: string): ComponentInfo | null;
  /** Get all versions of a component */
  getVersions(name: string): string[];
  /** Get all components */
  getAllComponents(): ComponentInfo[];
  /** Check if component exists */
  hasComponent(name: string, version?: string): boolean;
  /** Search for components by name pattern */
  search(pattern: string): ComponentInfo[];
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  /** Graph nodes (name -> info) */
  nodes: Map<string, ComponentInfo>;
  /** Forward edges (name -> dependencies) */
  edges: Map<string, Set<string>>;
  /** Reverse edges (name -> dependents) */
  reverseEdges: Map<string, Set<string>>;
}

/**
 * Resolution conflict
 */
export interface Conflict {
  /** Conflict type */
  type: 'version' | 'circular' | 'missing';
  /** Conflict message */
  message: string;
  /** Components involved in conflict */
  components: string[];
  /** Incompatible versions (for version conflicts) */
  incompatibleVersions?: string[];
  /** Required constraint (for version conflicts) */
  requiredConstraint?: string;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** Whether resolution succeeded */
  success: boolean;
  /** Resolved components (name -> version) */
  components: Map<string, string>;
  /** Conflicts (if resolution failed) */
  conflicts: Conflict[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Resolution metadata */
  metadata: {
    /** Number of components resolved */
    componentsResolved: number;
    /** Number of backtracking steps */
    backtrackingSteps: number;
    /** Resolution time (ms) */
    resolutionTime: number;
  };
}

/**
 * Backtracking point for conflict resolution
 */
interface BacktrackPoint {
  /** Component name */
  name: string;
  /** Versions tried */
  triedVersions: Set<string>;
  /** Parent backtrack point */
  parent: BacktrackPoint | null;
}

// ============================================================================
// DEPENDENCY GRAPH
// ============================================================================

/**
 * Create an empty dependency graph
 */
export function createGraph(): DependencyGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };
}

/**
 * Add a node to the dependency graph
 */
export function addNode(graph: DependencyGraph, component: ComponentInfo): void {
  graph.nodes.set(component.name, component);
  if (!graph.edges.has(component.name)) {
    graph.edges.set(component.name, new Set());
  }
  if (!graph.reverseEdges.has(component.name)) {
    graph.reverseEdges.set(component.name, new Set());
  }
}

/**
 * Add an edge to the dependency graph
 */
export function addEdge(graph: DependencyGraph, from: string, to: string): void {
  if (!graph.edges.has(from)) {
    graph.edges.set(from, new Set());
  }
  graph.edges.get(from)!.add(to);

  if (!graph.reverseEdges.has(to)) {
    graph.reverseEdges.set(to, new Set());
  }
  graph.reverseEdges.get(to)!.add(from);
}

/**
 * Detect cycles in the dependency graph using DFS
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const WHITE = 0; // Unvisited
  const GRAY = 1;  // Visiting (in current path)
  const BLACK = 2; // Visited (fully processed)

  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];

  // Initialize all nodes as WHITE
  for (const nodeName of graph.nodes.keys()) {
    color.set(nodeName, WHITE);
    parent.set(nodeName, null);
  }

  function dfs(node: string): void {
    color.set(node, GRAY);

    const dependencies = graph.edges.get(node) || new Set();
    for (const dep of dependencies) {
      if (color.get(dep) === GRAY) {
        // Found cycle - reconstruct path
        const cycle = reconstructCycle(node, dep, parent);
        cycles.push(cycle);
      } else if (color.get(dep) === WHITE) {
        parent.set(dep, node);
        dfs(dep);
      }
    }

    color.set(node, BLACK);
  }

  // Run DFS from each unvisited node
  for (const nodeName of graph.nodes.keys()) {
    if (color.get(nodeName) === WHITE) {
      dfs(nodeName);
    }
  }

  return cycles;
}

/**
 * Reconstruct cycle path from DFS traversal
 */
function reconstructCycle(
  start: string,
  end: string,
  parent: Map<string, string | null>
): string[] {
  const path: string[] = [end];

  let current = start;
  while (current !== end && current !== null) {
    path.unshift(current);
    current = parent.get(current)!;
  }

  path.push(end); // Close the cycle
  return path;
}

// ============================================================================
// DEPENDENCY RESOLVER
// ============================================================================

/**
 * Dependency resolver options
 */
export interface ResolverOptions {
  /** Enable caching (default: true) */
  enableCache?: boolean;
  /** Maximum resolution time in ms (default: 30000) */
  timeout?: number;
  /** Progress callback */
  onProgress?: (stage: string, data: any) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Dependency resolver class
 */
export class DependencyResolver {
  private registry: ComponentRegistry;
  private options: ResolverOptions;
  private cache: Map<string, boolean>;
  private stats: {
    backtrackingSteps: number;
    cacheHits: number;
    cacheMisses: number;
  };

  constructor(registry: ComponentRegistry, options: ResolverOptions = {}) {
    this.registry = registry;
    this.options = {
      enableCache: options.enableCache ?? true,
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
      onProgress: options.onProgress,
    };
    this.cache = new Map();
    this.stats = {
      backtrackingSteps: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Resolve all dependencies for a manifest
   */
  async resolve(manifest: ComponentManifest): Promise<ResolutionResult> {
    const startTime = Date.now();
    this.stats = {
      backtrackingSteps: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    if (this.options.onProgress) {
      this.options.onProgress('start', { manifest });
    }

    try {
      // Step 1: Build dependency graph
      if (this.options.onProgress) {
        this.options.onProgress('building_graph', {});
      }

      const graph = this.buildGraph(manifest);

      if (this.options.debug) {
        console.log('[Resolver] Dependency graph built:', {
          nodes: graph.nodes.size,
          edges: Array.from(graph.edges.values()).reduce((sum, set) => sum + set.size, 0),
        });
      }

      // Step 2: Detect cycles
      if (this.options.onProgress) {
        this.options.onProgress('detecting_cycles', {});
      }

      const cycles = detectCycles(graph);
      if (cycles.length > 0) {
        const conflicts: Conflict[] = cycles.map(cycle => ({
          type: 'circular',
          message: `Circular dependency: ${cycle.join(' → ')}`,
          components: cycle,
        }));

        return {
          success: false,
          components: new Map(),
          conflicts,
          warnings: [],
          metadata: {
            componentsResolved: 0,
            backtrackingSteps: this.stats.backtrackingSteps,
            resolutionTime: Date.now() - startTime,
          },
        };
      }

      // Step 3: Resolve dependencies
      if (this.options.onProgress) {
        this.options.onProgress('resolving', {});
      }

      const result = await this.backtrackResolve(manifest);

      if (this.options.debug) {
        console.log('[Resolver] Resolution complete:', {
          success: result.success,
          components: result.components.size,
          backtrackingSteps: this.stats.backtrackingSteps,
          cacheHits: this.stats.cacheHits,
          cacheMisses: this.stats.cacheMisses,
        });
      }

      return {
        ...result,
        metadata: {
          componentsResolved: result.components.size,
          backtrackingSteps: this.stats.backtrackingSteps,
          resolutionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      if (this.options.debug) {
        console.error('[Resolver] Resolution error:', error);
      }

      return {
        success: false,
        components: new Map(),
        conflicts: [
          {
            type: 'missing',
            message: `Resolution error: ${error instanceof Error ? error.message : String(error)}`,
            components: [],
          },
        ],
        warnings: [],
        metadata: {
          componentsResolved: 0,
          backtrackingSteps: this.stats.backtrackingSteps,
          resolutionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Build dependency graph from manifest
   */
  private buildGraph(manifest: ComponentManifest): DependencyGraph {
    const graph = createGraph();
    const queue: string[] = [...manifest.components];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const componentName = queue.shift()!;

      if (visited.has(componentName)) continue;
      visited.add(componentName);

      // Get constraint for this component
      const constraint = manifest.dependencies.get(componentName) || '*';

      // Find latest matching version
      const component = this.findLatestMatching(componentName, constraint);
      if (!component) {
        throw new Error(`No version found for ${componentName}@${constraint}`);
      }

      // Add node to graph
      addNode(graph, component);

      // Add dependencies
      for (const [depName, depConstraint] of component.dependencies) {
        addEdge(graph, componentName, depName);

        // Queue dependency for processing
        if (!visited.has(depName)) {
          queue.push(depName);
        }
      }
    }

    return graph;
  }

  /**
   * Find the latest version matching a constraint
   */
  private findLatestMatching(
    name: string,
    constraint: string
  ): ComponentInfo | null {
    const versions = this.registry.getVersions(name);

    if (versions.length === 0) {
      return null;
    }

    // Filter versions by constraint
    const matching = versions.filter(v => satisfies(v, constraint));

    if (matching.length === 0) {
      return null;
    }

    // Sort descending and return latest
    matching.sort((a, b) => {
      const semverA = parse(a);
      const semverB = parse(b);
      return compare(semverB, semverA);
    });

    const latestVersion = matching[0];
    return this.registry.getComponent(name, latestVersion);
  }

  /**
   * Get all versions matching a constraint
   */
  private getMatchingVersions(name: string, constraint: string): string[] {
    const versions = this.registry.getVersions(name);

    if (versions.length === 0) {
      return [];
    }

    return versions.filter(v => satisfies(v, constraint));
  }

  /**
   * Backtracking resolution algorithm
   */
  private async backtrackResolve(
    manifest: ComponentManifest
  ): Promise<ResolutionResult> {
    const resolved = new Map<string, string>();
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];
    const backtrackStack: BacktrackPoint[] = [];

    const resolveComponent = async (componentName: string): Promise<boolean> => {
      // Skip if already resolved
      if (resolved.has(componentName)) {
        return true;
      }

      // Get constraint
      const constraint = manifest.dependencies.get(componentName) || '*';

      // Get matching versions
      const versions = this.getMatchingVersions(componentName, constraint);

      if (versions.length === 0) {
        conflicts.push({
          type: 'missing',
          message: `No version found for ${componentName}@${constraint}`,
          components: [componentName],
        });
        return false;
      }

      // Sort by heuristic (newest first, prefer stable)
      const sortedVersions = this.sortByHeuristic(versions);

      // Try each version
      for (const version of sortedVersions) {
        // Check if compatible with resolved dependencies
        if (!this.isCompatible(componentName, version, resolved)) {
          this.stats.backtrackingSteps++;
          continue;
        }

        // Tentatively resolve
        resolved.set(componentName, version);

        // Get component info
        const component = this.registry.getComponent(componentName, version);
        if (!component) {
          resolved.delete(componentName);
          continue;
        }

        // Resolve dependencies
        let allDepsOk = true;
        for (const [depName, depConstraint] of component.dependencies) {
          if (resolved.has(depName)) {
            // Check if resolved version is compatible
            const resolvedVersion = resolved.get(depName)!;
            if (!satisfies(resolvedVersion, depConstraint)) {
              conflicts.push({
                type: 'version',
                message: `Version conflict for ${depName}: ${resolvedVersion} does not satisfy ${depConstraint} (required by ${componentName}@${version})`,
                components: [componentName, depName],
                incompatibleVersions: [resolvedVersion],
                requiredConstraint: depConstraint,
              });
              allDepsOk = false;
              break;
            }
          } else {
            // Recursively resolve dependency
            const success = await resolveComponent(depName);
            if (!success) {
              allDepsOk = false;
              break;
            }
          }
        }

        if (allDepsOk) {
          return true; // Success!
        }

        // Backtrack
        resolved.delete(componentName);
        this.stats.backtrackingSteps++;
      }

      return false; // No version worked
    };

    // Resolve all root components
    for (const componentName of manifest.components) {
      const success = await resolveComponent(componentName);
      if (!success) {
        return {
          success: false,
          components: resolved,
          conflicts,
          warnings,
        };
      }
    }

    return {
      success: true,
      components: resolved,
      conflicts: [],
      warnings,
    };
  }

  /**
   * Check if a component version is compatible with resolved dependencies
   */
  private isCompatible(
    name: string,
    version: string,
    resolved: Map<string, string>
  ): boolean {
    const component = this.registry.getComponent(name, version);
    if (!component) {
      return false;
    }

    // Check all dependencies
    for (const [depName, depConstraint] of component.dependencies) {
      if (resolved.has(depName)) {
        const resolvedVersion = resolved.get(depName)!;
        if (!satisfies(resolvedVersion, depConstraint)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sort versions by heuristic (newest first, prefer stable)
   */
  private sortByHeuristic(versions: string[]): string[] {
    return [...versions].sort((a, b) => {
      const semverA = parse(a);
      const semverB = parse(b);

      // Prefer stable versions (non-prerelease)
      const aStable = semverA.prerelease.length === 0;
      const bStable = semverB.prerelease.length === 0;

      if (aStable && !bStable) return -1;
      if (!aStable && bStable) return 1;

      // Prefer newer versions
      return compare(semverB, semverA);
    });
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get resolver statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
    };
  }
}

// ============================================================================
// IN-MEMORY REGISTRY IMPLEMENTATION
// ============================================================================

/**
 * In-memory component registry implementation
 */
export class InMemoryRegistry implements ComponentRegistry {
  private components: Map<string, Map<string, ComponentInfo>> = new Map();

  /**
   * Add a component to the registry
   */
  addComponent(component: ComponentInfo): void {
    if (!this.components.has(component.name)) {
      this.components.set(component.name, new Map());
    }
    this.components.get(component.name)!.set(component.version, component);
  }

  /**
   * Remove a component from the registry
   */
  removeComponent(name: string, version: string): boolean {
    const versions = this.components.get(name);
    if (!versions) {
      return false;
    }
    return versions.delete(version);
  }

  /**
   * Get component by name and version
   */
  getComponent(name: string, version: string): ComponentInfo | null {
    const versions = this.components.get(name);
    if (!versions) {
      return null;
    }
    return versions.get(version) || null;
  }

  /**
   * Get all versions of a component
   */
  getVersions(name: string): string[] {
    const versions = this.components.get(name);
    if (!versions) {
      return [];
    }
    return Array.from(versions.keys());
  }

  /**
   * Get all components
   */
  getAllComponents(): ComponentInfo[] {
    const all: ComponentInfo[] = [];
    for (const versions of this.components.values()) {
      all.push(...Array.from(versions.values()));
    }
    return all;
  }

  /**
   * Check if component exists
   */
  hasComponent(name: string, version?: string): boolean {
    const versions = this.components.get(name);
    if (!versions) {
      return false;
    }
    if (version === undefined) {
      return true;
    }
    return versions.has(version);
  }

  /**
   * Search for components by name pattern
   */
  search(pattern: string): ComponentInfo[] {
    const regex = new RegExp(pattern, 'i');
    const results: ComponentInfo[] = [];

    for (const [name, versions] of this.components) {
      if (regex.test(name)) {
        results.push(...Array.from(versions.values()));
      }
    }

    return results;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a component manifest from object
 */
export function createManifest(
  components: string[],
  dependencies: Record<string, string> = {}
): ComponentManifest {
  return {
    components,
    dependencies: new Map(Object.entries(dependencies)),
  };
}

/**
 * Create component info from object
 */
export function createComponentInfo(
  name: string,
  version: string,
  dependencies: Record<string, string> = {},
  metadata: Partial<ComponentMetadata> = {}
): ComponentInfo {
  return {
    name,
    version,
    dependencies: new Map(Object.entries(dependencies)),
    metadata: {
      name,
      version,
      ...metadata,
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DependencyResolver,
  InMemoryRegistry,
  createGraph,
  addNode,
  addEdge,
  detectCycles,
  createManifest,
  createComponentInfo,
};
