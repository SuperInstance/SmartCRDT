/**
 * Common LangGraph Patterns
 *
 * Reusable graph patterns and workflows
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { StandardAgentState, createStandardStateAnnotation, createAgentNode } from './templates.js';

/**
 * Sequential Pattern
 *
 * Execute nodes one after another
 */
export interface SequentialPatternConfig {
  nodes: Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  }>;
}

export function createSequentialPattern(config: SequentialPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add nodes
  for (const nodeConfig of config.nodes) {
    graph.addNode(nodeConfig.name, createAgentNode({
      name: nodeConfig.name,
      handler: nodeConfig.handler,
    }));
  }

  // Connect nodes sequentially
  for (let i = 0; i < config.nodes.length - 1; i++) {
    graph.addEdge(config.nodes[i].name, config.nodes[i + 1].name);
  }

  // Set entry point
  graph.setEntryPoint(config.nodes[0].name);

  // Set finish point
  graph.setFinishPoint(config.nodes[config.nodes.length - 1].name);

  return graph;
}

/**
 * Parallel Pattern
 *
 * Execute multiple nodes in parallel, then merge results
 */
export interface ParallelPatternConfig {
  parallelNodes: Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  }>;
  mergeNode?: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  };
}

export function createParallelPattern(config: ParallelPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add parallel nodes
  for (const nodeConfig of config.parallelNodes) {
    graph.addNode(nodeConfig.name, createAgentNode({
      name: nodeConfig.name,
      handler: nodeConfig.handler,
    }));
  }

  // Add merge node if provided
  if (config.mergeNode) {
    graph.addNode(config.mergeNode.name, createAgentNode({
      name: config.mergeNode.name,
      handler: config.mergeNode.handler,
    }));

    // Connect parallel nodes to merge
    for (const nodeConfig of config.parallelNodes) {
      graph.addEdge(nodeConfig.name, config.mergeNode.name);
    }

    graph.setEntryPoint('parallel_start');
    // Add virtual start node
    graph.addNode('parallel_start', createAgentNode({
      name: 'parallel_start',
      handler: async (state) => state,
    }));

    for (const nodeConfig of config.parallelNodes) {
      graph.addEdge('parallel_start', nodeConfig.name);
    }

    graph.setFinishPoint(config.mergeNode.name);
  } else {
    graph.setEntryPoint('parallel_start');
    graph.addNode('parallel_start', createAgentNode({
      name: 'parallel_start',
      handler: async (state) => state,
    }));

    for (const nodeConfig of config.parallelNodes) {
      graph.addEdge('parallel_start', nodeConfig.name);
    }

    // All parallel nodes end the graph
    for (const nodeConfig of config.parallelNodes) {
      graph.setFinishPoint(nodeConfig.name);
    }
  }

  return graph;
}

/**
 * Conditional Routing Pattern
 *
 * Route to different nodes based on conditions
 */
export interface ConditionalRoutingPatternConfig {
  entryNode: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  };
  routingCondition: (state: StandardAgentState) => string | Promise<string>;
  branches: Record<string, Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  }>>;
  defaultBranch?: string;
}

export function createConditionalRoutingPattern(config: ConditionalRoutingPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add entry node
  graph.addNode(config.entryNode.name, createAgentNode({
    name: config.entryNode.name,
    handler: config.entryNode.handler,
  }));

  // Add branch nodes
  for (const [branchName, nodes] of Object.entries(config.branches)) {
    for (const nodeConfig of nodes) {
      graph.addNode(nodeConfig.name, createAgentNode({
        name: nodeConfig.name,
        handler: nodeConfig.handler,
      }));
    }
  }

  // Set entry point
  graph.setEntryPoint(config.entryNode.name);

  // Add conditional edges
  const branchTargets: Record<string, string> = {};
  for (const [branchName, nodes] of Object.entries(config.branches)) {
    if (nodes.length > 0) {
      branchTargets[branchName] = nodes[0].name;

      // Connect nodes within branch
      for (let i = 0; i < nodes.length - 1; i++) {
        graph.addEdge(nodes[i].name, nodes[i + 1].name);
      }

      // Set finish point for last node in branch
      graph.setFinishPoint(nodes[nodes.length - 1].name);
    }
  }

  graph.addConditionalEdges(config.entryNode.name, async (state) => {
    const result = await config.routingCondition(state);
    return branchTargets[result] || config.defaultBranch || END;
  });

  return graph;
}

/**
 * Human-in-the-Loop Pattern
 *
 * Allow human intervention at specific points
 */
export interface HumanInTheLoopPatternConfig {
  nodes: Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
    requiresApproval?: boolean;
  }>;
  approvalNode?: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  };
}

export function createHumanInTheLoopPattern(config: HumanInTheLoopPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  const approvalNode = config.approvalNode || {
    name: 'human_approval',
    handler: async (state: StandardAgentState) => {
      // Check for approval in metadata
      const approved = (state.metadata?.approved as boolean) ?? false;

      if (!approved) {
        return {
          output: 'Awaiting human approval...',
          metadata: {
            ...state.metadata,
            status: 'awaiting_approval',
          },
        };
      }

      return {
        metadata: {
          ...state.metadata,
          status: 'approved',
        },
      };
    },
  };

  // Add approval node
  graph.addNode(approvalNode.name, createAgentNode({
    name: approvalNode.name,
    handler: approvalNode.handler,
  }));

  // Add regular nodes
  for (const nodeConfig of config.nodes) {
    graph.addNode(nodeConfig.name, createAgentNode({
      name: nodeConfig.name,
      handler: nodeConfig.handler,
    }));
  }

  // Connect nodes with approval checkpoints
  let lastNode = START;
  for (const nodeConfig of config.nodes) {
    if (lastNode !== START) {
      graph.addEdge(lastNode, nodeConfig.name);
    } else {
      graph.setEntryPoint(nodeConfig.name);
    }

    // Add approval after node if required
    if (nodeConfig.requiresApproval) {
      graph.addEdge(nodeConfig.name, approvalNode.name);
      lastNode = approvalNode.name;
    } else {
      lastNode = nodeConfig.name;
    }
  }

  // Set finish point
  if (lastNode !== START) {
    graph.setFinishPoint(lastNode);
  }

  return graph;
}

/**
 * Recursive Pattern
 *
 * Node can call itself until a base condition is met
 */
export interface RecursivePatternConfig {
  recursiveNode: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
    baseCondition: (state: StandardAgentState) => boolean | Promise<boolean>;
  };
  finalNode?: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  };
}

export function createRecursivePattern(config: RecursivePatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add recursive node
  graph.addNode(config.recursiveNode.name, createAgentNode({
    name: config.recursiveNode.name,
    handler: config.recursiveNode.handler,
  }));

  // Add final node if provided
  if (config.finalNode) {
    graph.addNode(config.finalNode.name, createAgentNode({
      name: config.finalNode.name,
      handler: config.finalNode.handler,
    }));
  }

  // Set entry point
  graph.setEntryPoint(config.recursiveNode.name);

  // Add conditional edge for recursion
  graph.addConditionalEdges(
    config.recursiveNode.name,
    async (state: StandardAgentState) => {
      const shouldContinue = await config.recursiveNode.baseCondition(state);
      if (shouldContinue) {
        return config.recursiveNode.name; // Recurse
      }
      return config.finalNode?.name || END;
    }
  );

  // Set finish point
  if (config.finalNode) {
    graph.setFinishPoint(config.finalNode.name);
  }

  return graph;
}

/**
 * Hierarchical Pattern
 *
 * Sub-graphs within a main graph
 */
export interface HierarchicalPatternConfig {
  mainGraph: {
    nodes: Array<{
      name: string;
      handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
    }>;
  };
  subGraphs: Record<string, {
    nodes: Array<{
      name: string;
      handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
    }>;
  }>;
}

export function createHierarchicalPattern(config: HierarchicalPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Create sub-graphs
  const compiledSubGraphs: Record<string, any> = {};
  for (const [subGraphName, subGraphConfig] of Object.entries(config.subGraphs)) {
    const subGraph = new StateGraph(StateAnnotation);

    for (const nodeConfig of subGraphConfig.nodes) {
      subGraph.addNode(nodeConfig.name, createAgentNode({
        name: nodeConfig.name,
        handler: nodeConfig.handler,
      }));
    }

    // Connect sub-graph nodes sequentially
    for (let i = 0; i < subGraphConfig.nodes.length - 1; i++) {
      subGraph.addEdge(subGraphConfig.nodes[i].name, subGraphConfig.nodes[i + 1].name);
    }

    subGraph.setEntryPoint(subGraphConfig.nodes[0].name);
    subGraph.setFinishPoint(subGraphConfig.nodes[subGraphConfig.nodes.length - 1].name);

    compiledSubGraphs[subGraphName] = subGraph.compile();
  }

  // Add main graph nodes
  for (const nodeConfig of config.mainGraph.nodes) {
    if (compiledSubGraphs[nodeConfig.name]) {
      graph.addNode(nodeConfig.name, compiledSubGraphs[nodeConfig.name]);
    } else {
      graph.addNode(nodeConfig.name, createAgentNode({
        name: nodeConfig.name,
        handler: nodeConfig.handler,
      }));
    }
  }

  // Connect main graph nodes sequentially
  for (let i = 0; i < config.mainGraph.nodes.length - 1; i++) {
    graph.addEdge(config.mainGraph.nodes[i].name, config.mainGraph.nodes[i + 1].name);
  }

  graph.setEntryPoint(config.mainGraph.nodes[0].name);
  graph.setFinishPoint(config.mainGraph.nodes[config.mainGraph.nodes.length - 1].name);

  return graph;
}

/**
 * Dynamic Graph Pattern
 *
 * Modify graph structure at runtime
 */
export interface DynamicGraphPatternConfig {
  initialNodes: Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  }>;
  dynamicNodeFactory: (state: StandardAgentState) => Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  }>;
}

export function createDynamicGraphPattern(config: DynamicGraphPatternConfig) {
  // This is a simplified version - true dynamic graphs require
  // more complex state management and graph rebuilding
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add initial nodes
  for (const nodeConfig of config.initialNodes) {
    graph.addNode(nodeConfig.name, createAgentNode({
      name: nodeConfig.name,
      handler: nodeConfig.handler,
    }));
  }

  // Add a "router" node that determines next steps
  graph.addNode('dynamic_router', createAgentNode({
    name: 'dynamic_router',
    handler: async (state: StandardAgentState) => {
      // Generate dynamic nodes based on state
      const dynamicNodes = config.dynamicNodeFactory(state);

      // Add dynamic nodes to graph
      for (const nodeConfig of dynamicNodes) {
        // Note: In a real implementation, you'd need to
        // rebuild the graph or use a more flexible approach
      }

      return {
        metadata: {
          ...state.metadata,
          dynamicNodes: dynamicNodes.map(n => n.name),
        },
      };
    },
  }));

  graph.setEntryPoint(config.initialNodes[0]?.name || 'dynamic_router');
  graph.setFinishPoint('dynamic_router');

  return graph;
}

/**
 * Multi-Orchestrator Pattern
 *
* Multiple orchestrators coordinating together
 */
export interface MultiOrchestratorPatternConfig {
  orchestrators: Array<{
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
    priority?: number;
  }>;
  coordinator?: {
    name: string;
    handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  };
}

export function createMultiOrchestratorPattern(config: MultiOrchestratorPatternConfig) {
  const StateAnnotation = createStandardStateAnnotation();
  const graph = new StateGraph(StateAnnotation);

  // Add coordinator if provided
  if (config.coordinator) {
    graph.addNode(config.coordinator.name, createAgentNode({
      name: config.coordinator.name,
      handler: config.coordinator.handler,
    }));
    graph.setEntryPoint(config.coordinator.name);
  }

  // Sort orchestrators by priority
  const sortedOrchestrators = [...config.orchestrators].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  );

  // Add orchestrator nodes
  for (const orchestratorConfig of sortedOrchestrators) {
    graph.addNode(orchestratorConfig.name, createAgentNode({
      name: orchestratorConfig.name,
      handler: orchestratorConfig.handler,
    }));

    // Connect from coordinator or previous orchestrator
    if (config.coordinator) {
      graph.addEdge(config.coordinator.name, orchestratorConfig.name);
    }
  }

  // All orchestrators can finish independently
  for (const orchestratorConfig of sortedOrchestrators) {
    graph.setFinishPoint(orchestratorConfig.name);
  }

  return graph;
}
