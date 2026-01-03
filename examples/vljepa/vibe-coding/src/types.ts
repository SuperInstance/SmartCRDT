/**
 * Vibe Coding Demo - Type Definitions
 *
 * Core types for the VL-JEPA + CoAgents + A2UI integration demo.
 */

import type { Float32Array } from '@lsi/vljepa';
import type { VLJEPAPrediction, VLJEPAAction } from '@lsi/vljepa/src/protocol';
import type { A2UIComponent } from '@lsi/protocol';

// ============================================================================
// VIBE CODING WORKFLOW STATE
// ============================================================================

/**
 * Vibe Coding Workflow Steps
 *
 * Represents the sequential steps in the "Show, Don't Tell" workflow.
 */
export type VibeCodingStep =
  | 'idle'           // Initial state, nothing captured
  | 'captured'       // Current UI captured
  | 'uploaded'       // Goal image uploaded
  | 'planned'        // VL-JEPA generated action plan
  | 'approved'       // User approved the plan
  | 'executed'       // Plan executed successfully
  | 'error';         // Error occurred

/**
 * Visual State
 *
 * Represents a snapshot of UI state at a point in time.
 */
export interface VisualState {
  /** Unique identifier */
  id: string;
  /** Timestamp of capture */
  timestamp: number;
  /** Image data (canvas or screenshot) */
  imageData: ImageData | null;
  /** Embedding from VL-JEPA X-Encoder */
  embedding: Float32Array | null;
  /** URL of the page */
  url?: string;
  /** Page title */
  title?: string;
  /** DOM snapshot (optional, for advanced analysis) */
  domSnapshot?: {
    html: string;
    styles: Record<string, string>;
  };
}

/**
 * Planned Action
 *
 * A single action in the generated plan.
 */
export interface PlannedAction {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: VLJEPAAction['type'];
  /** Target (CSS selector, component ID, etc.) */
  target: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable description */
  description: string;
  /** Expected outcome */
  expectedOutcome?: string;
  /** Whether user approved this action */
  approved: boolean;
  /** Execution status */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  executionTime?: number;
}

/**
 * Action Sequence
 *
 * Ordered sequence of actions to achieve the goal state.
 */
export interface ActionSequence {
  /** Unique sequence ID */
  id: string;
  /** Actions in execution order */
  actions: PlannedAction[];
  /** Overall confidence (0-1) */
  confidence: number;
  /** Estimated execution time (ms) */
  estimatedTime: number;
  /** Semantic distance between current and goal */
  semanticDistance: number;
  /** Created timestamp */
  createdAt: number;
  /** VL-JEPA prediction result */
  prediction: VLJEPAPrediction;
}

/**
 * Execution Progress
 *
 * Tracks execution progress of the action sequence.
 */
export interface ExecutionProgress {
  /** Total number of actions */
  total: number;
  /** Number of completed actions */
  completed: number;
  /** Number of failed actions */
  failed: number;
  /** Current action index */
  current: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Elapsed time in ms */
  elapsed: number;
  /** Remaining time estimate in ms */
  remaining: number;
}

// ============================================================================
// VIBE CODING STATE
// ============================================================================

/**
 * Vibe Coding State
 *
 * Complete state for the vibe coding workflow.
 */
export interface VibeCodingState {
  /** Current workflow step */
  step: VibeCodingStep;
  /** Current UI state (what we have now) */
  currentState: VisualState | null;
  /** Goal state (what we want) */
  goalState: VisualState | null;
  /** Generated action plan */
  plan: ActionSequence | null;
  /** Execution progress */
  progress: ExecutionProgress | null;
  /** Final result after execution */
  result: {
    before: VisualState;
    after: VisualState;
    actions: PlannedAction[];
    timestamp: number;
  } | null;
  /** Error message if in error state */
  error: string | null;
  /** Loading state */
  loading: boolean;
}

/**
 * Vibe Coding Actions
 *
 * Available actions in the vibe coding workflow.
 */
export interface VibeCodingActions {
  /** Capture current UI state */
  captureCurrent: () => Promise<void>;
  /** Upload goal image */
  uploadGoal: (file: File) => Promise<void>;
  /** Generate action plan */
  generatePlan: () => Promise<void>;
  /** Approve all actions */
  approvePlan: () => void;
  /** Modify specific actions */
  modifyActions: (modifications: { id: string; changes: Partial<PlannedAction> }[]) => void;
  /** Reject plan */
  rejectPlan: () => void;
  /** Execute approved plan */
  executePlan: () => Promise<void>;
  /** Reset workflow */
  reset: () => void;
  /** Cancel current operation */
  cancel: () => void;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * VibeCodingCanvas Props
 */
export interface VibeCodingCanvasProps {
  /** Initial state (for testing) */
  initialState?: Partial<VibeCodingState>;
  /** On workflow complete callback */
  onComplete?: (result: VibeCodingState['result']) => void;
  /** On error callback */
  onError?: (error: string) => void;
  /** Debug mode */
  debug?: boolean;
}

/**
 * VibeCodingFlow Props
 */
export interface VibeCodingFlowProps {
  /** State update callback */
  onStateChange: (state: VibeCodingState) => void;
  /** Debug mode */
  debug?: boolean;
}

// ============================================================================
// A2UI INTEGRATION TYPES
// ============================================================================

/**
 * A2UI Component from VL-JEPA Action
 *
 * Converts VL-JEPA actions to A2UI components.
 */
export interface A2UIFromAction {
  /** VL-JEPA action */
  action: VLJEPAAction;
  /** Generated A2UI component */
  component: A2UIComponent;
  /** Conversion confidence */
  confidence: number;
}

/**
 * A2UI Renderer Config
 */
export interface A2UIRendererConfig {
  /** Whether to stream updates */
  streaming: boolean;
  /** Animation duration in ms */
  animationDuration: number;
  /** Whether to show debug info */
  showDebug: boolean;
  /** Theme */
  theme: 'light' | 'dark' | 'auto';
}

// ============================================================================
// COAGENTS INTEGRATION TYPES
// ============================================================================

/**
 * CoAgents State for Vibe Coding
 *
 * State shared between CoAgents and VL-JEPA.
 */
export interface CoAgentsVibeCodingState {
  /** Current embedding */
  currentEmbedding: Float32Array | null;
  /** Goal embedding */
  goalEmbedding: Float32Array | null;
  /** Planned actions */
  actions: PlannedAction[];
  /** User feedback history */
  feedbackHistory: {
    actionId: string;
    accepted: boolean;
    timestamp: number;
    comment?: string;
  }[];
  /** Workflow patterns learned */
  patterns: {
    type: string;
    frequency: number;
    lastUsed: number;
  }[];
}

/**
 * CoAgents Config for Vibe Coding
 */
export interface CoAgentsVibeCodingConfig {
  /** Enable learning from feedback */
  enableLearning: boolean;
  /** Number of suggestions to generate */
  suggestionCount: number;
  /** Minimum confidence for suggestions */
  minConfidence: number;
  /** Enable collaborative mode */
  enableCollaboration: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Step Info
 *
 * Information about each workflow step.
 */
export interface StepInfo {
  /** Step identifier */
  step: VibeCodingStep;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Estimated duration in ms */
  estimatedDuration?: number;
  /** Whether step can be skipped */
  skippable: boolean;
}

/**
 * Workflow Metrics
 *
 * Metrics collected during workflow execution.
 */
export interface WorkflowMetrics {
  /** Total time from start to finish */
  totalTime: number;
  /** Time spent in each step */
  stepTimes: Partial<Record<VibeCodingStep, number>>;
  /** VL-JEPA inference times */
  inferenceTimes: {
    xEncoder: number;
    yEncoder: number;
    predictor: number;
    total: number;
  };
  /** Average confidence scores */
  avgConfidence: number;
  /** Number of user interventions */
  interventions: number;
  /** User satisfaction score (0-1) */
  satisfaction?: number;
}
