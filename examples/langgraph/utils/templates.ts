/**
 * Agent Templates for LangGraph Examples
 *
 * Reusable agent templates with common patterns
 */

import { Annotation, StateGraph } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

/**
 * Standard Agent State Template
 */
export interface StandardAgentState {
  messages: BaseMessage[];
  input: string;
  output?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  iteration?: number;
}

/**
 * Create standard state annotation
 */
export function createStandardStateAnnotation() {
  return Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
    input: Annotation<string>(),
    output: Annotation<string>(),
    metadata: Annotation<Record<string, unknown>>({
      default: () => ({}),
    }),
    error: Annotation<string>(),
    iteration: Annotation<number>({
      default: () => 0,
    }),
  });
}

/**
 * Agent Node Template
 */
export interface AgentNodeTemplate {
  name: string;
  description: string;
  handler: (state: StandardAgentState) => Promise<Partial<StandardAgentState>>;
  transform?: (state: StandardAgentState) => StandardAgentState;
  validate?: (state: StandardAgentState) => boolean;
}

/**
 * Create a standard agent node
 */
export function createAgentNode(template: AgentNodeTemplate) {
  const { name, handler, transform, validate } = template;

  return async (state: StandardAgentState): Promise<Partial<StandardAgentState>> => {
    try {
      // Validate state if validator provided
      if (validate && !validate(state)) {
        return {
          error: `Validation failed in node: ${name}`,
          messages: state.messages,
        };
      }

      // Transform state if transformer provided
      const processedState = transform ? transform(state) : state;

      // Execute handler
      const result = await handler(processedState);

      // Add metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          node: name,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        messages: state.messages,
      };
    }
  };
}

/**
 * Conditional Edge Template
 */
export interface ConditionalEdgeTemplate<T = unknown> {
  name: string;
  condition: (state: StandardAgentState) => string | Promise<string>;
  branches: Record<string, string>;
  default?: string;
}

/**
 * Create a conditional edge
 */
export function createConditionalEdge(template: ConditionalEdgeTemplate) {
  const { condition, branches, default: defaultBranch } = template;

  return async (state: StandardAgentState): Promise<string> => {
    try {
      const result = await condition(state);
      return branches[result] || defaultBranch || '__end__';
    } catch {
      return defaultBranch || '__end__';
    }
  };
}

/**
 * Graph Template Configuration
 */
export interface GraphTemplateConfig {
  name: string;
  description: string;
  nodes: AgentNodeTemplate[];
  edges?: Array<[string, string]>;
  conditionalEdges?: ConditionalEdgeTemplate[];
  entryPoint?: string;
  finishPoint?: string;
}

/**
 * Create a complete graph from template
 */
export function createGraphFromTemplate(config: GraphTemplateConfig) {
  const { name, nodes, edges, conditionalEdges, entryPoint, finishPoint } = config;

  // Create state annotation
  const StateAnnotation = createStandardStateAnnotation();

  // Create graph
  const graph = new StateGraph(StateAnnotation);

  // Add nodes
  for (const nodeTemplate of nodes) {
    const node = createAgentNode(nodeTemplate);
    graph.addNode(nodeTemplate.name, node);
  }

  // Add edges
  if (edges) {
    for (const [from, to] of edges) {
      graph.addEdge(from, to);
    }
  }

  // Add conditional edges
  if (conditionalEdges) {
    for (const edgeTemplate of conditionalEdges) {
      const edge = createConditionalEdge(edgeTemplate);
      graph.addConditionalEdges(
        edgeTemplate.name,
        edge,
        Object.fromEntries(
          Object.entries(edgeTemplate.branches).map(([k, v]) => [k, v])
        )
      );
    }
  }

  // Set entry point
  if (entryPoint) {
    graph.setEntryPoint(entryPoint);
  }

  // Set finish point
  if (finishPoint) {
    graph.setFinishPoint(finishPoint);
  }

  return graph;
}

/**
 * Mock Response Generator
 */
export class MockResponseGenerator {
  private responses: Map<string, string[]> = new Map();

  constructor() {
    // Initialize with common patterns
    this.responses.set('greeting', [
      'Hello! How can I help you today?',
      'Hi there! What can I do for you?',
      'Greetings! How may I assist you?',
    ]);

    this.responses.set('analysis', [
      'Based on my analysis, I found several key points.',
      'After reviewing the data, here are my observations.',
      'I have completed the analysis. Here are the results.',
    ]);

    this.responses.set('error', [
      'I encountered an error while processing your request.',
      'Something went wrong. Please try again.',
      'I apologize, but I could not complete that task.',
    ]);

    this.responses.set('success', [
      'Task completed successfully!',
      'Done! Let me know if you need anything else.',
      'All set! The operation was successful.',
    ]);
  }

  getRandomResponse(category: string): string {
    const categoryResponses = this.responses.get(category);
    if (!categoryResponses || categoryResponses.length === 0) {
      return 'Response received.';
    }
    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  }

  addResponseCategory(category: string, responses: string[]): void {
    this.responses.set(category, responses);
  }

  generateResponse(input: string, category: string): string {
    const base = this.getRandomResponse(category);
    return `${base} (Input: "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}")`;
  }
}

/**
 * Delay utility for simulating async operations
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        await delay(delayMs * (i + 1));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Logging utility
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  log(message: string, data?: unknown): void {
    console.log(`[${this.prefix}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  error(message: string, error?: unknown): void {
    console.error(`[${this.prefix}] ERROR: ${message}`, error);
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[${this.prefix}] WARN: ${message}`, data);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}
