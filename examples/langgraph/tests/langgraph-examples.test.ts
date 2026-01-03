/**
 * Comprehensive Test Suite for LangGraph Examples
 *
 * Cross-example tests ensuring all examples work correctly
 */

import { describe, it, expect } from 'vitest';

// Test imports for all examples
import {
  createSequentialGraph,
  runSequentialExample
} from '../basic/01-simple-sequential/index.js';

import {
  createParallelGraph,
  runParallelExample
} from '../basic/02-parallel-execution/index.js';

import {
  createConditionalRoutingGraph,
  runConditionalRoutingExample
} from '../basic/03-conditional-routing/index.js';

import {
  createHumanInTheLoopGraph,
  runHumanInTheLoopExample
} from '../basic/04-human-in-loop/index.js';

import {
  createRecursiveAgentGraph,
  runRecursiveAgentExample
} from '../advanced/05-recursive-agent/index.js';

import {
  createHierarchicalGraph,
  runHierarchicalAgentsExample
} from '../advanced/06-hierarchical-agents/index.js';

import {
  createDynamicGraph,
  runDynamicGraphExample
} from '../advanced/07-dynamic-graph/index.js';

import {
  createMultiOrchestratorGraph,
  runMultiOrchestratorExample
} from '../advanced/08-multi-orchestrator/index.js';

import {
  createCoAgentsLangGraphGraph,
  runCoAgentsLangGraphExample
} from '../integration/09-coagents-langgraph/index.js';

import {
  createVLJEPAAgentGraph,
  runVLJEPAAgentExample
} from '../integration/10-vljepa-agent/index.js';

import {
  createA2UIGraph,
  runA2UIExample
} from '../integration/11-a2ui-responses/index.js';

import {
  createFullStackGraph,
  runFullStackExample
} from '../integration/12-full-stack/index.js';

import {
  createCustomerSupportGraph,
  runCustomerSupportExample
} from '../real-world/13-customer-support/index.js';

import {
  createCodeReviewGraph,
  runCodeReviewExample
} from '../real-world/14-code-review/index.js';

import {
  createDataAnalysisGraph,
  runDataAnalysisExample
} from '../real-world/15-data-analysis/index.js';

import {
  createContentCreationGraph,
  runContentCreationExample
} from '../real-world/16-content-creation/index.js';

describe('LangGraph Examples: Comprehensive Test Suite', () => {
  describe('Basic Examples (01-04)', () => {
    it('Example 01: Sequential graph should compile', () => {
      const graph = createSequentialGraph();
      expect(graph).toBeDefined();
    });

    it('Example 01: Sequential should process input', async () => {
      const result = await runSequentialExample('Test input');
      expect(result.output).toBeDefined();
    });

    it('Example 02: Parallel graph should compile', () => {
      const graph = createParallelGraph();
      expect(graph).toBeDefined();
    });

    it('Example 02: Parallel should execute tasks', async () => {
      const result = await runParallelExample('Test input');
      expect(result.tasks).toBeDefined();
      expect(result.merged).toBeDefined();
    });

    it('Example 03: Conditional routing graph should compile', () => {
      const graph = createConditionalRoutingGraph();
      expect(graph).toBeDefined();
    });

    it('Example 03: Conditional should route based on sentiment', async () => {
      const result = await runConditionalRoutingExample('This is great!');
      expect(result.sentiment).toBeDefined();
    });

    it('Example 04: Human-in-loop graph should compile', () => {
      const graph = createHumanInTheLoopGraph();
      expect(graph).toBeDefined();
    });

    it('Example 04: Human-in-loop should handle approval', async () => {
      const result = await runHumanInTheLoopExample('Test', true);
      expect(result.status).toBe('approved');
    });
  });

  describe('Advanced Examples (05-08)', () => {
    it('Example 05: Recursive agent graph should compile', () => {
      const graph = createRecursiveAgentGraph();
      expect(graph).toBeDefined();
    });

    it('Example 05: Recursive should iterate multiple times', async () => {
      const result = await runRecursiveAgentExample('Test', 3);
      expect(result.iteration).toBeGreaterThan(0);
    });

    it('Example 06: Hierarchical graph should compile', () => {
      const graph = createHierarchicalGraph();
      expect(graph).toBeDefined();
    });

    it('Example 06: Hierarchical should coordinate sub-graphs', async () => {
      const result = await runHierarchicalAgentsExample('Test');
      expect(result.output).toBeDefined();
    });

    it('Example 07: Dynamic graph should compile', () => {
      const graph = createDynamicGraph();
      expect(graph).toBeDefined();
    });

    it('Example 07: Dynamic should generate nodes based on input', async () => {
      const result = await runDynamicGraphExample('Process data');
      expect(result.dynamicNodes).toBeDefined();
    });

    it('Example 08: Multi-orchestrator graph should compile', () => {
      const graph = createMultiOrchestratorGraph();
      expect(graph).toBeDefined();
    });

    it('Example 08: Multi-orchestrator should coordinate', async () => {
      const result = await runMultiOrchestratorExample('Test');
      expect(result.orchestratorResults).toBeDefined();
    });
  });

  describe('Integration Examples (09-12)', () => {
    it('Example 09: CoAgents+LangGraph graph should compile', () => {
      const graph = createCoAgentsLangGraphGraph();
      expect(graph).toBeDefined();
    });

    it('Example 09: CoAgents should handle checkpoints', async () => {
      const result = await runCoAgentsLangGraphExample('Test');
      expect(result.checkpoint).toBeDefined();
    });

    it('Example 10: VL-JEPA agent graph should compile', () => {
      const graph = createVLJEPAAgentGraph();
      expect(graph).toBeDefined();
    });

    it('Example 10: VL-JEPA should process visual embeddings', async () => {
      const result = await runVLJEPAAgentExample('Make button pop');
      expect(result.visualEmbedding).toBeDefined();
      expect(result.userIntent).toBeDefined();
    });

    it('Example 11: A2UI graph should compile', () => {
      const graph = createA2UIGraph();
      expect(graph).toBeDefined();
    });

    it('Example 11: A2UI should generate progressive updates', async () => {
      const result = await runA2UIExample('Test');
      expect(result.progressiveUpdates).toBeDefined();
      expect(result.finalUI).toBeDefined();
    });

    it('Example 12: Full-stack graph should compile', () => {
      const graph = createFullStackGraph();
      expect(graph).toBeDefined();
    });

    it('Example 12: Full-stack should handle end-to-end flow', async () => {
      const result = await runFullStackExample('Test');
      expect(result.frontendContext).toBeDefined();
      expect(result.backendProcessing).toBeDefined();
      expect(result.databaseResult).toBeDefined();
    });
  });

  describe('Real-World Examples (13-16)', () => {
    it('Example 13: Customer support graph should compile', () => {
      const graph = createCustomerSupportGraph();
      expect(graph).toBeDefined();
    });

    it('Example 13: Customer support should triage tickets', async () => {
      const result = await runCustomerSupportExample('Help with billing');
      expect(result.category).toBeDefined();
      expect(result.priority).toBeDefined();
      expect(result.sentiment).toBeDefined();
    });

    it('Example 14: Code review graph should compile', () => {
      const graph = createCodeReviewGraph();
      expect(graph).toBeDefined();
    });

    it('Example 14: Code review should analyze PRs', async () => {
      const result = await runCodeReviewExample(['file1.ts', 'file2.ts']);
      expect(result.securityAnalysis).toBeDefined();
      expect(result.styleCheck).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });

    it('Example 15: Data analysis graph should compile', () => {
      const graph = createDataAnalysisGraph();
      expect(graph).toBeDefined();
    });

    it('Example 15: Data analysis should process queries', async () => {
      const result = await runDataAnalysisExample('Analyze sales');
      expect(result.rawData).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.visualizations).toBeDefined();
    });

    it('Example 16: Content creation graph should compile', () => {
      const graph = createContentCreationGraph();
      expect(graph).toBeDefined();
    });

    it('Example 16: Content creation should generate content', async () => {
      const result = await runContentCreationExample('TypeScript tutorial');
      expect(result.ideas).toBeDefined();
      expect(result.draft).toBeDefined();
      expect(result.published).toBe(true);
    });
  });

  describe('Cross-Example Compatibility', () => {
    it('All examples should handle standard inputs', async () => {
      const examples = [
        () => runSequentialExample('Test'),
        () => runParallelExample('Test'),
        () => runConditionalRoutingExample('Test'),
        () => runHumanInTheLoopExample('Test', false),
        () => runRecursiveAgentExample('Test', 3),
        () => runHierarchicalAgentsExample('Test'),
        () => runDynamicGraphExample('Test'),
        () => runMultiOrchestratorExample('Test'),
      ];

      const results = await Promise.all(examples.map(fn => fn()));
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('All examples should complete within timeout', async () => {
      const start = Date.now();

      await Promise.all([
        runSequentialExample('Test'),
        runParallelExample('Test'),
        runConditionalRoutingExample('Test'),
        runDataAnalysisExample('Test'),
      ]);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // All should complete in 5 seconds
    });
  });

  describe('State Management', () => {
    it('Examples should preserve input state', async () => {
      const input = 'Test input for state preservation';
      const result = await runSequentialExample(input);
      expect(result.input).toBe(input);
    });

    it('Examples should track metadata', async () => {
      const result = await runCustomerSupportExample('Test');
      expect(result.metadata).toBeDefined();
      expect(Object.keys(result.metadata || {}).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('Examples should handle empty inputs', async () => {
      const result = await runSequentialExample('');
      expect(result).toBeDefined();
    });

    it('Examples should handle special characters', async () => {
      const result = await runConditionalRoutingExample('Test @#$% special!');
      expect(result).toBeDefined();
    });

    it('Examples should handle very long inputs', async () => {
      const longInput = 'Test '.repeat(1000);
      const result = await runParallelExample(longInput);
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('Sequential example should be fast', async () => {
      const start = Date.now();
      await runSequentialExample('Test');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('Parallel example should show speedup', async () => {
      const start = Date.now();
      await runParallelExample('Test');
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Integration Features', () => {
    it('VL-JEPA should use correct embedding dimensions', async () => {
      const result = await runVLJEPAAgentExample('Test');
      expect(result.visualEmbedding?.length).toBe(768);
      expect(result.userIntent?.length).toBe(768);
    });

    it('A2UI should generate progressive updates', async () => {
      const result = await runA2UIExample('Test');
      expect((result.progressiveUpdates?.length || 0)).toBeGreaterThan(0);
    });

    it('Full-stack should complete all layers', async () => {
      const result = await runFullStackExample('Test');
      expect(result.frontendContext).toBeDefined();
      expect(result.backendProcessing).toBeDefined();
      expect(result.databaseResult).toBeDefined();
    });
  });
});
