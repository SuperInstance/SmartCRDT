/**
 * useCoAgentsState Hook
 *
 * React hook for CoAgents state management in vibe coding workflow.
 * Handles shared state between agents and human-in-the-loop checkpoints.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AgentState,
  AgentAction,
  CheckpointConfig,
} from '@lsi/coagents';
import type { PlannedAction, CoAgentsVibeCodingState, CoAgentsVibeCodingConfig } from '../types';

export interface UseCoAgentsStateOptions {
  /** Enable learning from user feedback */
  enableLearning?: boolean;
  /** Number of suggestions to generate */
  suggestionCount?: number;
  /** Minimum confidence for suggestions */
  minConfidence?: number;
  /** Enable collaborative mode */
  enableCollaboration?: boolean;
  /** Debug mode */
  debug?: boolean;
}

export interface UseCoAgentsStateReturn {
  /** Current CoAgents state */
  state: CoAgentsVibeCodingState;
  /** Whether agents are ready */
  ready: boolean;
  /** Last error */
  error: string | null;
  /** Record user feedback on action */
  recordFeedback: (actionId: string, accepted: boolean, comment?: string) => void;
  /** Get workflow context for suggestions */
  getWorkflowContext: () => {
    style: string;
    recentActions: string[];
    patterns: string[];
  };
  /** Plan actions from embedding */
  planFromEmbedding: (
    goalEmbedding: Float32Array,
    options?: { count?: number; minConfidence?: number }
  ) => Promise<{
    actions: PlannedAction[];
    estimatedTime: number;
    confidence: number;
  }>;
  /** Merge multiple intents (collaborative mode) */
  mergeIntents: (
    intents: Array<{ prediction: any; userId: string }>
  ) => Promise<{
    actions: PlannedAction[];
    conflictsResolved: number;
    estimatedTime: number;
  }>;
  /** Analyze design system from embedding */
  analyzeDesignSystem: (
    embedding: Float32Array
  ) => Promise<{
    colors: { primary: string; secondary: string };
    typography: { fontFamily: string };
    spacing: { base: number };
    components: string[];
  }>;
  /** Create checkpoint for HITL */
  createCheckpoint: (config: CheckpointConfig) => Promise<{
    id: string;
    timestamp: number;
  }>;
  /** Restore from checkpoint */
  restoreCheckpoint: (id: string) => Promise<void>;
  /** Get learned patterns */
  getPatterns: () => CoAgentsVibeCodingState['patterns'];
  /** Reset state */
  reset: () => void;
}

/**
 * Hook for CoAgents state management
 */
export function useCoAgentsState(
  options: UseCoAgentsStateOptions = {}
): UseCoAgentsStateReturn {
  const {
    enableLearning = true,
    suggestionCount = 3,
    minConfidence = 0.6,
    enableCollaboration = false,
    debug = false,
  } = options;

  // Internal state
  const [state, setState] = useState<CoAgentsVibeCodingState>({
    currentEmbedding: null,
    goalEmbedding: null,
    actions: [],
    feedbackHistory: [],
    patterns: [],
  });

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkpointsRef = useRef<Map<string, any>>(new Map());
  const readyRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      if (readyRef.current) return;

      try {
        if (debug) console.log('[CoAgents] Initializing state manager...');

        // Load saved patterns from localStorage
        const savedPatterns = localStorage.getItem('coagents-patterns');
        if (savedPatterns) {
          const patterns = JSON.parse(savedPatterns);
          setState((prev) => ({ ...prev, patterns }));
        }

        setReady(true);
        readyRef.current = true;

        if (debug) console.log('[CoAgents] State manager initialized');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize CoAgents: ${message}`);
        console.error('[CoAgents] Initialization error:', err);
      }
    };

    initialize();
  }, [debug]);

  // Record user feedback
  const recordFeedback = useCallback((
    actionId: string,
    accepted: boolean,
    comment?: string
  ) => {
    setState((prev) => {
      const feedback = {
        actionId,
        accepted,
        timestamp: Date.now(),
        comment,
      };

      const newHistory = [...prev.feedbackHistory, feedback];

      // Update patterns if learning is enabled
      if (enableLearning) {
        const action = prev.actions.find((a) => a.id === actionId);
        if (action && accepted) {
          const patternType = action.type;
          const existing = prev.patterns.find((p) => p.type === patternType);

          let newPatterns;
          if (existing) {
            newPatterns = prev.patterns.map((p) =>
              p.type === patternType
                ? { ...p, frequency: p.frequency + 1, lastUsed: Date.now() }
                : p
            );
          } else {
            newPatterns = [
              ...prev.patterns,
              { type: patternType, frequency: 1, lastUsed: Date.now() },
            ];
          }

          // Persist patterns
          localStorage.setItem('coagents-patterns', JSON.stringify(newPatterns));

          return {
            ...prev,
            feedbackHistory: newHistory,
            patterns: newPatterns,
          };
        }
      }

      return { ...prev, feedbackHistory: newHistory };
    });

    if (debug) {
      console.log(`[CoAgents] Feedback recorded: ${actionId} - ${accepted ? 'accepted' : 'rejected'}`);
    }
  }, [enableLearning, debug]);

  // Get workflow context
  const getWorkflowContext = useCallback(() => {
    const recentActions = state.feedbackHistory
      .slice(-5)
      .map((f) => {
        const action = state.actions.find((a) => a.id === f.actionId);
        return action?.description || 'unknown';
      })
      .filter(Boolean);

    const topPatterns = state.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map((p) => p.type);

    return {
      style: 'predictive',
      recentActions,
      patterns: topPatterns,
    };
  }, [state]);

  // Plan actions from embedding
  const planFromEmbedding = useCallback(async (
    goalEmbedding: Float32Array,
    options: { count?: number; minConfidence?: number } = {}
  ) => {
    const count = options.count || suggestionCount;
    const threshold = options.minConfidence || minConfidence;

    if (debug) {
      console.log('[CoAgents] Planning actions from embedding...');
      console.log(`  Count: ${count}, Min confidence: ${threshold}`);
    }

    // Generate mock suggested actions based on patterns
    const suggestedActions: PlannedAction[] = [];

    // Use learned patterns to generate suggestions
    for (const pattern of state.patterns.slice(0, count)) {
      const confidence = Math.min(0.95, 0.6 + pattern.frequency * 0.05);
      if (confidence >= threshold) {
        suggestedActions.push({
          id: `suggested-${Date.now()}-${suggestedActions.length}`,
          type: pattern.type as any,
          target: '.element',
          params: {},
          confidence,
          description: `Suggested ${pattern.type} based on your workflow`,
          approved: false,
          status: 'pending',
        });
      }
    }

    // Fill remaining with generic suggestions
    while (suggestedActions.length < count) {
      suggestedActions.push({
        id: `suggested-${Date.now()}-${suggestedActions.length}`,
        type: 'modify',
        target: '.element',
        params: { style: 'suggested' },
        confidence: 0.7 + Math.random() * 0.2,
        description: 'Suggested modification',
        approved: false,
        status: 'pending',
      });
    }

    return {
      actions: suggestedActions,
      estimatedTime: suggestedActions.length * 200,
      confidence: suggestedActions.reduce((sum, a) => sum + a.confidence, 0) / suggestedActions.length,
    };
  }, [state.patterns, suggestionCount, minConfidence, debug]);

  // Merge multiple intents (collaborative)
  const mergeIntents = useCallback(async (
    intents: Array<{ prediction: any; userId: string }>
  ) => {
    if (!enableCollaboration) {
      throw new Error('Collaborative mode not enabled');
    }

    if (debug) {
      console.log(`[CoAgents] Merging ${intents.length} intents...`);
    }

    // Collect all actions from all intents
    const allActions: PlannedAction[] = [];
    const actionTargets = new Set<string>();

    for (const intent of intents) {
      for (const action of intent.prediction.actions) {
        // Deduplicate by target
        if (!actionTargets.has(action.target)) {
          actionTargets.add(action.target);
          allActions.push({
            id: `merged-${Date.now()}-${allActions.length}`,
            type: action.type,
            target: action.target,
            params: action.params,
            confidence: action.confidence,
            description: generateActionDescription(action),
            approved: false,
            status: 'pending',
          });
        }
      }
    }

    // Detect and resolve conflicts (same target, different params)
    let conflictsResolved = 0;
    const targetGroups = new Map<string, PlannedAction[]>();
    for (const action of allActions) {
      if (!targetGroups.has(action.target)) {
        targetGroups.set(action.target, []);
      }
      targetGroups.get(action.target)!.push(action);
    }

    // Resolve conflicts by picking highest confidence
    const mergedActions: PlannedAction[] = [];
    for (const [target, actions] of targetGroups) {
      if (actions.length > 1) {
        conflictsResolved++;
        // Pick action with highest confidence
        const best = actions.sort((a, b) => b.confidence - a.confidence)[0];
        mergedActions.push(best);
      } else {
        mergedActions.push(actions[0]);
      }
    }

    if (debug) {
      console.log(`[CoAgents] Merged ${allActions.length} actions into ${mergedActions.length}`);
      console.log(`  Conflicts resolved: ${conflictsResolved}`);
    }

    return {
      actions: mergedActions,
      conflictsResolved,
      estimatedTime: mergedActions.length * 200,
    };
  }, [enableCollaboration, debug]);

  // Analyze design system
  const analyzeDesignSystem = useCallback(async (
    embedding: Float32Array
  ) => {
    if (debug) console.log('[CoAgents] Analyzing design system...');

    // Mock analysis based on embedding
    // In production, this would use ML-based analysis
    return {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      spacing: {
        base: 8,
      },
      components: ['Button', 'Input', 'Card', 'Modal', 'Dropdown'],
    };
  }, [debug]);

  // Create checkpoint
  const createCheckpoint = useCallback(async (config: CheckpointConfig) => {
    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state)),
      config,
    };

    checkpointsRef.current.set(checkpoint.id, checkpoint);

    if (debug) {
      console.log(`[CoAgents] Checkpoint created: ${checkpoint.id}`);
    }

    return {
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
    };
  }, [state, debug]);

  // Restore from checkpoint
  const restoreCheckpoint = useCallback(async (id: string) => {
    const checkpoint = checkpointsRef.current.get(id);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${id}`);
    }

    setState(checkpoint.state);

    if (debug) {
      console.log(`[CoAgents] Restored from checkpoint: ${id}`);
    }
  }, [debug]);

  // Get learned patterns
  const getPatterns = useCallback(() => {
    return state.patterns;
  }, [state.patterns]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      currentEmbedding: null,
      goalEmbedding: null,
      actions: [],
      feedbackHistory: [],
      patterns: state.patterns, // Keep learned patterns
    });
    setError(null);

    if (debug) console.log('[CoAgents] State reset');
  }, [state.patterns, debug]);

  return {
    state,
    ready,
    error,
    recordFeedback,
    getWorkflowContext,
    planFromEmbedding,
    mergeIntents,
    analyzeDesignSystem,
    createCheckpoint,
    restoreCheckpoint,
    getPatterns,
    reset,
  };
}

// Helper function to generate action description
function generateActionDescription(action: any): string {
  const typeMap: Record<string, string> = {
    modify: 'Modify',
    create: 'Create',
    delete: 'Delete',
    move: 'Move',
    resize: 'Resize',
    restyle: 'Restyle',
  };

  const params = Object.keys(action.params || {});
  const paramsStr = params.length > 0 ? params.join(', ') : 'default';

  return `${typeMap[action.type] || 'Modify'} "${action.target}" (${paramsStr})`;
}
