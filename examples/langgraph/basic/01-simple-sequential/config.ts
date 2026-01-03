/**
 * Simple Sequential Example Configuration
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Sequential Agent State
 */
export interface SequentialState {
  input: string;
  parsed?: Record<string, unknown>;
  analyzed?: Record<string, unknown>;
  output?: string;
  metadata?: Record<string, unknown>;
}

/**
 * State annotation for LangGraph
 */
export const SequentialStateAnnotation = Annotation.Root({
  input: Annotation<string>(),
  parsed: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
  analyzed: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

/**
 * Agent configuration
 */
export const AGENT_CONFIG = {
  parser: {
    name: 'parser',
    description: 'Parse input and extract key information',
  },
  analyzer: {
    name: 'analyzer',
    description: 'Analyze extracted information',
  },
  responder: {
    name: 'responder',
    description: 'Formulate final response',
  },
} as const;

/**
 * Graph configuration
 */
export const GRAPH_CONFIG = {
  entryPoint: 'parser',
  finishPoint: 'responder',
} as const;
