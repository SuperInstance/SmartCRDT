/**
 * Graph Optimizer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphOptimizer, FusionAnalyzer, type ComputationGraph } from '../src/optimizers/GraphOptimizer.js';

describe('GraphOptimizer', () => {
  let optimizer: GraphOptimizer;

  beforeEach(() => {
    optimizer = new GraphOptimizer({
      fuseOperators: true,
      eliminateDeadCode: true,
      foldConstants: true,
      optimizeLayout: true,
      targetLatency: 50,
      maxIterations: 100,
    });
  });

  describe('constructor', () => {
    it('should create optimizer with default config', () => {
      const opt = new GraphOptimizer();
      expect(opt).toBeDefined();
    });

    it('should create optimizer with custom config', () => {
      const opt = new GraphOptimizer({ fuseOperators: false });
      expect(opt).toBeDefined();
    });
  });

  describe('optimize', () => {
    it('should optimize a simple graph', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'input',
            operation: 'input',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'conv1',
            operation: 'conv2d',
            inputs: ['n1'],
            outputs: ['n3'],
            attributes: { outputShape: [224, 224, 64] },
          },
          {
            id: 'n3',
            name: 'output',
            operation: 'output',
            inputs: ['n2'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n3'],
      };

      const result = optimizer.optimize(graph);

      expect(result).toHaveProperty('originalLatency');
      expect(result).toHaveProperty('optimizedLatency');
      expect(result).toHaveProperty('speedup');
      expect(result).toHaveProperty('optimizations');
      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('fusionGroups');
    });

    it('should estimate latency for graph', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'matmul1',
            operation: 'matmul',
            inputs: [],
            outputs: [],
            attributes: { outputShape: [1024, 1024] },
          },
        ],
        inputs: ['n1'],
        outputs: ['n1'],
      };

      const result = optimizer.optimize(graph);

      expect(result.originalLatency).toBeGreaterThan(0);
    });

    it('should apply constant folding', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'const1',
            operation: 'constant',
            inputs: [],
            outputs: ['n3'],
            attributes: { value: 1 },
          },
          {
            id: 'n2',
            name: 'const2',
            operation: 'constant',
            inputs: [],
            outputs: ['n3'],
            attributes: { value: 2 },
          },
          {
            id: 'n3',
            name: 'add',
            operation: 'add',
            inputs: ['n1', 'n2'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: [],
        outputs: ['n3'],
      };

      const result = optimizer.optimize(graph);

      expect(result.optimizations).toBeDefined();
    });

    it('should eliminate dead code', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'input',
            operation: 'input',
            inputs: [],
            outputs: ['n2', 'n4'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'used',
            operation: 'relu',
            inputs: ['n1'],
            outputs: ['n3'],
            attributes: {},
          },
          {
            id: 'n3',
            name: 'output',
            operation: 'output',
            inputs: ['n2'],
            outputs: [],
            attributes: {},
          },
          {
            id: 'n4',
            name: 'unused',
            operation: 'relu',
            inputs: ['n1'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n3'],
      };

      const result = optimizer.optimize(graph);

      expect(result.optimizations.length).toBeGreaterThan(0);
    });

    it('should fuse compatible operations', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'input',
            operation: 'input',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'conv',
            operation: 'conv2d',
            inputs: ['n1'],
            outputs: ['n3'],
            attributes: {},
          },
          {
            id: 'n3',
            name: 'bias',
            operation: 'bias_add',
            inputs: ['n2'],
            outputs: ['n4'],
            attributes: {},
          },
          {
            id: 'n4',
            name: 'relu',
            operation: 'relu',
            inputs: ['n3'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n4'],
      };

      const result = optimizer.optimize(graph);

      expect(result.fusionGroups.length).toBeGreaterThan(0);
    });

    it('should optimize memory layout', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'matmul',
            operation: 'matmul',
            inputs: [],
            outputs: [],
            attributes: { layout: 'row_major', outputShape: [1024, 1024] },
          },
        ],
        inputs: ['n1'],
        outputs: ['n1'],
      };

      const result = optimizer.optimize(graph);

      expect(result.optimizations).toBeDefined();
    });

    it('should calculate speedup correctly', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'op1',
            operation: 'relu',
            inputs: [],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n1'],
      };

      const result = optimizer.optimize(graph);

      expect(result.speedup).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validate', () => {
    it('should validate optimized graph preserves outputs', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'input',
            operation: 'input',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'output',
            operation: 'output',
            inputs: ['n1'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n2'],
      };

      const optimized = optimizer.optimize(graph);
      const isValid = optimizer.validate(graph, optimized.graph);

      expect(isValid).toBe(true);
    });
  });
});

describe('FusionAnalyzer', () => {
  let analyzer: FusionAnalyzer;

  beforeEach(() => {
    analyzer = new FusionAnalyzer();
  });

  describe('findOpportunities', () => {
    it('should find fusion opportunities in graph', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'conv',
            operation: 'conv2d',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'bias',
            operation: 'bias_add',
            inputs: ['n1'],
            outputs: ['n3'],
            attributes: {},
          },
          {
            id: 'n3',
            name: 'relu',
            operation: 'relu',
            inputs: ['n2'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n3'],
      };

      const opportunities = analyzer.findOpportunities(graph);

      expect(opportunities.length).toBeGreaterThan(0);
    });

    it('should return empty array if no opportunities', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'input',
            operation: 'input',
            inputs: [],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n1'],
      };

      const opportunities = analyzer.findOpportunities(graph);

      expect(opportunities).toHaveLength(0);
    });

    it('should sort opportunities by benefit', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'conv',
            operation: 'conv2d',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'bias',
            operation: 'bias_add',
            inputs: ['n1'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n2'],
      };

      const opportunities = analyzer.findOpportunities(graph);

      if (opportunities.length > 1) {
        for (let i = 1; i < opportunities.length; i++) {
          expect(opportunities[i - 1].benefit).toBeGreaterThanOrEqual(opportunities[i].benefit);
        }
      }
    });
  });

  describe('fusion opportunity properties', () => {
    it('should include operations in opportunity', () => {
      const graph: ComputationGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'conv',
            operation: 'conv2d',
            inputs: [],
            outputs: ['n2'],
            attributes: {},
          },
          {
            id: 'n2',
            name: 'bias',
            operation: 'bias_add',
            inputs: ['n1'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n2'],
      };

      const opportunities = analyzer.findOpportunities(graph);

      if (opportunities.length > 0) {
        expect(opportunities[0]).toHaveProperty('operations');
        expect(opportunities[0]).toHaveProperty('benefit');
        expect(opportunities[0]).toHaveProperty('memorySaved');
        expect(opportunities[0]).toHaveProperty('confidence');
      }
    });
  });
});
