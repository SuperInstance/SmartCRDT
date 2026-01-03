/**
 * @lsi/resolver - Dependency Resolution System Tests
 *
 * Comprehensive test suite for dependency resolution, conflict detection,
 * circular dependency detection, and lock file generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DependencyResolver,
  InMemoryRegistry,
  createGraph,
  addNode,
  addEdge,
  detectCycles,
  createManifest,
  createComponentInfo,
  type ComponentManifest,
  type ComponentInfo,
} from './DependencyResolver';

describe('@lsi/resolver', () => {
  let registry: InMemoryRegistry;

  beforeEach(() => {
    registry = new InMemoryRegistry();
  });

  describe('InMemoryRegistry', () => {
    it('should add and retrieve components', () => {
      const component = createComponentInfo('test-component', '1.0.0');
      registry.addComponent(component);

      expect(registry.hasComponent('test-component')).toBe(true);
      expect(registry.hasComponent('test-component', '1.0.0')).toBe(true);
      expect(registry.hasComponent('test-component', '2.0.0')).toBe(false);

      const retrieved = registry.getComponent('test-component', '1.0.0');
      expect(retrieved).toEqual(component);
    });

    it('should return all versions', () => {
      registry.addComponent(createComponentInfo('test', '1.0.0'));
      registry.addComponent(createComponentInfo('test', '1.1.0'));
      registry.addComponent(createComponentInfo('test', '2.0.0'));

      const versions = registry.getVersions('test');
      expect(versions).toHaveLength(3);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
      expect(versions).toContain('2.0.0');
    });

    it('should search by pattern', () => {
      registry.addComponent(createComponentInfo('cascade-router', '1.0.0'));
      registry.addComponent(createComponentInfo('cascade-cache', '1.0.0'));
      registry.addComponent(createComponentInfo('semantic-cache', '1.0.0'));

      const results = registry.search('cascade');
      expect(results).toHaveLength(2);
    });
  });

  describe('DependencyGraph', () => {
    it('should create empty graph', () => {
      const graph = createGraph();
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
      expect(graph.reverseEdges.size).toBe(0);
    });

    it('should add nodes and edges', () => {
      const graph = createGraph();
      const component = createComponentInfo('test', '1.0.0');

      addNode(graph, component);
      expect(graph.nodes.has('test')).toBe(true);

      addEdge(graph, 'test', 'dep');
      expect(graph.edges.get('test')?.has('dep')).toBe(true);
      expect(graph.reverseEdges.get('dep')?.has('test')).toBe(true);
    });
  });

  describe('detectCycles', () => {
    it('should detect simple cycle', () => {
      const graph = createGraph();

      addNode(graph, createComponentInfo('a', '1.0.0'));
      addNode(graph, createComponentInfo('b', '1.0.0'));
      addNode(graph, createComponentInfo('c', '1.0.0'));

      addEdge(graph, 'a', 'b');
      addEdge(graph, 'b', 'c');
      addEdge(graph, 'c', 'a'); // Cycle

      const cycles = detectCycles(graph);
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('a');
      expect(cycles[0]).toContain('b');
      expect(cycles[0]).toContain('c');
    });

    it('should not detect cycles in DAG', () => {
      const graph = createGraph();

      addNode(graph, createComponentInfo('a', '1.0.0'));
      addNode(graph, createComponentInfo('b', '1.0.0'));
      addNode(graph, createComponentInfo('c', '1.0.0'));

      addEdge(graph, 'a', 'b');
      addEdge(graph, 'a', 'c');
      addEdge(graph, 'b', 'c');

      const cycles = detectCycles(graph);
      expect(cycles).toHaveLength(0);
    });

    it('should detect self-loop', () => {
      const graph = createGraph();
      addNode(graph, createComponentInfo('a', '1.0.0'));
      addEdge(graph, 'a', 'a'); // Self-loop

      const cycles = detectCycles(graph);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('DependencyResolver', () => {
    describe('simple resolution', () => {
      it('should resolve single component with no dependencies', async () => {
        registry.addComponent(createComponentInfo('component-a', '1.0.0'));

        const manifest = createManifest(['component-a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        expect(result.components.get('component-a')).toBe('1.0.0');
        expect(result.conflicts).toHaveLength(0);
      });

      it('should resolve component with single dependency', async () => {
        registry.addComponent(createComponentInfo('component-a', '1.0.0', {
          'component-b': '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('component-b', '1.0.0'));

        const manifest = createManifest(['component-a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        expect(result.components.get('component-a')).toBe('1.0.0');
        expect(result.components.get('component-b')).toBe('1.0.0');
      });

      it('should resolve component with transitive dependencies', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          b: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0', {
          c: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('c', '1.0.0'));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        expect(result.components.get('a')).toBe('1.0.0');
        expect(result.components.get('b')).toBe('1.0.0');
        expect(result.components.get('c')).toBe('1.0.0');
      });
    });

    describe('version constraints', () => {
      it('should select latest compatible version', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          b: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0'));
        registry.addComponent(createComponentInfo('b', '1.1.0'));
        registry.addComponent(createComponentInfo('b', '1.2.0'));
        registry.addComponent(createComponentInfo('b', '2.0.0'));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        // Should select 1.2.0 (latest 1.x), not 2.0.0 (doesn't match ^1.0.0)
        expect(result.components.get('b')).toBe('1.2.0');
      });

      it('should resolve complex constraints', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          shared: '^2.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0', {
          shared: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('shared', '2.0.0'));
        registry.addComponent(createComponentInfo('shared', '1.5.0'));
        registry.addComponent(createComponentInfo('shared', '1.0.0'));

        const manifest = createManifest(['a', 'b']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);
      });
    });

    describe('conflict detection', () => {
      it('should detect version conflicts', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          shared: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0', {
          shared: '^2.0.0',
        }));
        registry.addComponent(createComponentInfo('shared', '1.0.0'));
        registry.addComponent(createComponentInfo('shared', '2.0.0'));

        const manifest = createManifest(['a', 'b']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(false);
        expect(result.conflicts.length).toBeGreaterThan(0);

        const conflict = result.conflicts[0];
        expect(conflict.type).toBe('version');
        expect(conflict.components).toContain('shared');
      });

      it('should detect missing dependencies', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          missing: '^1.0.0',
        }));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(false);
        expect(result.conflicts.some(c => c.type === 'missing')).toBe(true);
      });
    });

    describe('circular dependencies', () => {
      it('should reject circular dependencies', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          b: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0', {
          c: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('c', '1.0.0', {
          a: '^1.0.0',
        }));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(false);
        expect(result.conflicts.some(c => c.type === 'circular')).toBe(true);
      });
    });

    describe('backtracking resolution', () => {
      it('should backtrack to find compatible versions', async () => {
        // a 1.2.0 -> shared ^2.0.0
        // a 1.1.0 -> shared ^1.0.0
        // b 1.0.0 -> shared ^1.5.0

        registry.addComponent(
          createComponentInfo('a', '1.2.0', {
            shared: '^2.0.0',
          })
        );
        registry.addComponent(
          createComponentInfo('a', '1.1.0', {
            shared: '^1.0.0',
          })
        );
        registry.addComponent(
          createComponentInfo('b', '1.0.0', {
            shared: '^1.5.0',
          })
        );
        registry.addComponent(createComponentInfo('shared', '2.0.0'));
        registry.addComponent(createComponentInfo('shared', '1.6.0'));
        registry.addComponent(createComponentInfo('shared', '1.5.0'));
        registry.addComponent(createComponentInfo('shared', '1.0.0'));

        const manifest = createManifest(['a', 'b'], {
          a: '^1.0.0',
        });
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        // Should backtrack from a@1.2.0 to a@1.1.0
        expect(result.components.get('a')).toBe('1.1.0');
        expect(result.components.get('shared')).toBe('1.6.0');
        expect(result.metadata.backtrackingSteps).toBeGreaterThan(0);
      });
    });

    describe('shared dependencies', () => {
      it('should reuse already resolved dependencies', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          shared: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0', {
          shared: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('shared', '1.0.0'));

        const manifest = createManifest(['a', 'b']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        // Both a and b should use the same shared version
        expect(result.components.get('shared')).toBe('1.0.0');
      });
    });

    describe('prerelease versions', () => {
      it('should prefer stable versions', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          b: '^1.0.0',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0-alpha.1'));
        registry.addComponent(createComponentInfo('b', '1.0.0'));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        // Should prefer stable 1.0.0 over 1.0.0-alpha.1
        expect(result.components.get('b')).toBe('1.0.0');
      });

      it('should use prerelease if explicitly requested', async () => {
        registry.addComponent(createComponentInfo('a', '1.0.0', {
          b: '1.0.0-alpha.1',
        }));
        registry.addComponent(createComponentInfo('b', '1.0.0-alpha.1'));

        const manifest = createManifest(['a']);
        const resolver = new DependencyResolver(registry);
        const result = await resolver.resolve(manifest);

        expect(result.success).toBe(true);
        expect(result.components.get('b')).toBe('1.0.0-alpha.1');
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should resolve cascade-router with dependencies', async () => {
      // cascade-router@1.2.0 -> protocol@^1.0.0, embeddings@^1.0.0
      // protocol@1.0.0 -> (no dependencies)
      // embeddings@1.1.0 -> (no dependencies)

      registry.addComponent(
        createComponentInfo('cascade-router', '1.2.0', {
          protocol: '^1.0.0',
          embeddings: '^1.0.0',
        })
      );
      registry.addComponent(createComponentInfo('protocol', '1.0.0', {}));
      registry.addComponent(createComponentInfo('embeddings', '1.1.0', {}));
      registry.addComponent(createComponentInfo('embeddings', '1.0.0', {}));

      const manifest = createManifest(['cascade-router']);
      const resolver = new DependencyResolver(registry);
      const result = await resolver.resolve(manifest);

      expect(result.success).toBe(true);
      expect(result.components.get('cascade-router')).toBe('1.2.0');
      expect(result.components.get('protocol')).toBe('1.0.0');
      expect(result.components.get('embeddings')).toBe('1.1.0'); // Latest matching
    });

    it('should resolve chat-assistant app', async () => {
      // chat-assistant -> cascade-router, rag-pipeline, semantic-cache
      // cascade-router -> protocol, embeddings
      // rag-pipeline -> vector-db, embeddings
      // semantic-cache -> embeddings
      // vector-db -> (no deps)
      // embeddings -> (no deps)
      // protocol -> (no deps)

      registry.addComponent(
        createComponentInfo('chat-assistant', '1.0.0', {
          'cascade-router': '^1.0.0',
          'rag-pipeline': '^2.0.0',
          'semantic-cache': '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('cascade-router', '1.2.0', {
          protocol: '^1.0.0',
          embeddings: '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('rag-pipeline', '2.0.0', {
          'vector-db': '^1.5.0',
          embeddings: '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('semantic-cache', '1.0.0', {
          embeddings: '^1.0.0',
        })
      );
      registry.addComponent(createComponentInfo('vector-db', '1.5.0', {}));
      registry.addComponent(createComponentInfo('embeddings', '1.1.0', {}));
      registry.addComponent(createComponentInfo('protocol', '1.0.0', {}));

      const manifest = createManifest(['chat-assistant']);
      const resolver = new DependencyResolver(registry);
      const result = await resolver.resolve(manifest);

      expect(result.success).toBe(true);
      expect(result.components.size).toBe(7); // All unique components
      expect(result.components.get('chat-assistant')).toBe('1.0.0');
      expect(result.components.get('cascade-router')).toBe('1.2.0');
      expect(result.components.get('rag-pipeline')).toBe('2.0.0');
      expect(result.components.get('semantic-cache')).toBe('1.0.0');
      expect(result.components.get('vector-db')).toBe('1.5.0');
      expect(result.components.get('embeddings')).toBe('1.1.0');
      expect(result.components.get('protocol')).toBe('1.0.0');
    });

    it('should handle diamond dependency pattern', async () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D

      registry.addComponent(
        createComponentInfo('a', '1.0.0', {
          b: '^1.0.0',
          c: '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('b', '1.0.0', {
          d: '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('c', '1.0.0', {
          d: '^1.0.0',
        })
      );
      registry.addComponent(createComponentInfo('d', '1.0.0', {}));

      const manifest = createManifest(['a']);
      const resolver = new DependencyResolver(registry);
      const result = await resolver.resolve(manifest);

      expect(result.success).toBe(true);
      expect(result.components.get('d')).toBe('1.0.0'); // Single shared version
    });
  });

  describe('resolver statistics', () => {
    it('should track backtracking steps', async () => {
      registry.addComponent(
        createComponentInfo('a', '1.2.0', {
          shared: '^2.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('a', '1.1.0', {
          shared: '^1.0.0',
        })
      );
      registry.addComponent(
        createComponentInfo('b', '1.0.0', {
          shared: '^1.5.0',
        })
      );
      registry.addComponent(createComponentInfo('shared', '2.0.0'));
      registry.addComponent(createComponentInfo('shared', '1.6.0'));
      registry.addComponent(createComponentInfo('shared', '1.0.0'));

      const manifest = createManifest(['a', 'b'], { a: '^1.0.0' });
      const resolver = new DependencyResolver(registry);
      await resolver.resolve(manifest);

      const stats = resolver.getStats();
      expect(stats.backtrackingSteps).toBeGreaterThan(0);
    });
  });

  describe('resolver options', () => {
    it('should support progress callbacks', async () => {
      registry.addComponent(createComponentInfo('a', '1.0.0', {}));

      const stages: string[] = [];
      const manifest = createManifest(['a']);
      const resolver = new DependencyResolver(registry, {
        onProgress: (stage) => {
          stages.push(stage);
        },
      });

      await resolver.resolve(manifest);

      expect(stages).toContain('start');
      expect(stages).toContain('building_graph');
      expect(stages).toContain('detecting_cycles');
      expect(stages).toContain('resolving');
    });

    it('should support debug logging', async () => {
      registry.addComponent(createComponentInfo('a', '1.0.0', {}));

      const manifest = createManifest(['a']);
      const resolver = new DependencyResolver(registry, {
        debug: true,
      });

      // Should not throw
      const result = await resolver.resolve(manifest);
      expect(result.success).toBe(true);
    });
  });

  describe('createManifest', () => {
    it('should create manifest from arrays', () => {
      const manifest = createManifest(['a', 'b'], {
        a: '^1.0.0',
        b: '^2.0.0',
      });

      expect(manifest.components).toEqual(['a', 'b']);
      expect(manifest.dependencies.get('a')).toBe('^1.0.0');
      expect(manifest.dependencies.get('b')).toBe('^2.0.0');
    });
  });

  describe('createComponentInfo', () => {
    it('should create component info', () => {
      const component = createComponentInfo('test', '1.0.0', { dep: '^1.0.0' }, {
        description: 'Test component',
      });

      expect(component.name).toBe('test');
      expect(component.version).toBe('1.0.0');
      expect(component.dependencies.get('dep')).toBe('^1.0.0');
      expect(component.metadata.description).toBe('Test component');
    });
  });
});
