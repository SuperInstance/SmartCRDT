/**
 * useVibeCoding Hook
 *
 * Main hook for the vibe coding workflow.
 * Orchestrates VL-JEPA + CoAgents + A2UI integration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVLJEPABridge } from './useVLJEPABridge';
import { useCoAgentsState } from './useCoAgentsState';
import type {
  VibeCodingState,
  VibeCodingActions,
  VibeCodingStep,
  VisualState,
  ActionSequence,
  ExecutionProgress,
  WorkflowMetrics,
} from '../types';

export interface UseVibeCodingOptions {
  /** Debug mode */
  debug?: boolean;
  /** Enable auto-execution (skip approval) */
  autoExecute?: boolean;
  /** Enable collaborative mode */
  enableCollaboration?: boolean;
  /** On workflow complete callback */
  onComplete?: (result: VibeCodingState['result']) => void;
  /** On error callback */
  onError?: (error: string) => void;
}

export interface UseVibeCodingReturn {
  /** Current state */
  state: VibeCodingState;
  /** Available actions */
  actions: VibeCodingActions;
  /** VL-JEPA bridge hook */
  vljepa: ReturnType<typeof useVLJEPABridge>;
  /** CoAgents state hook */
  coagents: ReturnType<typeof useCoAgentsState>;
  /** Workflow metrics */
  metrics: WorkflowMetrics | null;
  /** Reset metrics */
  resetMetrics: () => void;
}

/**
 * Hook for vibe coding workflow
 */
export function useVibeCoding(
  options: UseVibeCodingOptions = {}
): UseVibeCodingReturn {
  const {
    debug = false,
    autoExecute = false,
    enableCollaboration = false,
    onComplete,
    onError,
  } = options;

  // Initialize hooks
  const vljepa = useVLJEPABridge({ debug, useWebGPU: true });
  const coagents = useCoAgentsState({
    enableLearning: true,
    enableCollaboration,
    debug,
  });

  // Main state
  const [state, setState] = useState<VibeCodingState>({
    step: 'idle',
    currentState: null,
    goalState: null,
    plan: null,
    progress: null,
    result: null,
    error: null,
    loading: false,
  });

  // Metrics tracking
  const [metrics, setMetrics] = useState<WorkflowMetrics | null>(null);
  const stepTimesRef = useRef<Partial<Record<VibeCodingStep, number>>>({});
  const workflowStartRef = useRef<number | null>(null);

  // Transition to next step
  const transitionTo = useCallback((newStep: VibeCodingStep) => {
    const now = Date.now();

    setState((prev) => {
      // Record step time
      if (workflowStartRef.current) {
        const stepTime = now - workflowStartRef.current;
        stepTimesRef.current[prev.step] = stepTime;

        if (debug) {
          console.log(`[VibeCoding] Step "${prev.step}" took ${stepTime}ms`);
        }
      }

      return { ...prev, step: newStep, loading: false };
    });

    workflowStartRef.current = now;
  }, [debug]);

  // Capture current UI state
  const captureCurrent = useCallback(async () => {
    if (!vljepa.ready) {
      throw new Error('VL-JEPA not ready');
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (debug) console.log('[VibeCoding] Capturing current UI state...');

      // Capture screenshot (in real implementation)
      // For demo, we create a mock canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(100, 100, 200, 50);

      const imageData = ctx.getImageData(0, 0, 1920, 1080);

      // Encode with VL-JEPA
      const embedding = await vljepa.encodeVision(imageData);

      const visualState: VisualState = {
        id: `state-${Date.now()}`,
        timestamp: Date.now(),
        imageData,
        embedding,
        url: window.location.href,
        title: document.title,
      };

      setState((prev) => ({
        ...prev,
        currentState: visualState,
      }));

      // Update CoAgents state
      coagents.state.currentEmbedding = embedding;

      transitionTo('captured');

      if (debug) {
        console.log('[VibeCoding] Current state captured');
        console.log(`  Embedding: ${embedding.length}-dim`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, step: 'error', loading: false }));
      onError?.(message);
    }
  }, [vljepa, coagents, debug, onError, transitionTo]);

  // Upload goal image
  const uploadGoal = useCallback(async (file: File) => {
    if (!vljepa.ready) {
      throw new Error('VL-JEPA not ready');
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (debug) console.log('[VibeCoding] Uploading goal image...');

      // Load image from file
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.src = imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Draw to canvas and get image data
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Encode with VL-JEPA
      const embedding = await vljepa.encodeVision(imageData);

      const visualState: VisualState = {
        id: `goal-${Date.now()}`,
        timestamp: Date.now(),
        imageData,
        embedding,
        url: imageUrl,
        title: file.name,
      };

      setState((prev) => ({
        ...prev,
        goalState: visualState,
      }));

      // Update CoAgents state
      coagents.state.goalEmbedding = embedding;

      transitionTo('uploaded');

      if (debug) {
        console.log('[VibeCoding] Goal image uploaded');
        console.log(`  File: ${file.name}`);
        console.log(`  Size: ${img.width}x${img.height}`);
      }

      URL.revokeObjectURL(imageUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, step: 'error', loading: false }));
      onError?.(message);
    }
  }, [vljepa, coagents, debug, onError, transitionTo]);

  // Generate action plan
  const generatePlan = useCallback(async () => {
    if (!state.currentState?.embedding || !state.goalState?.embedding) {
      throw new Error('Both current and goal states must be captured');
    }

    if (!vljepa.ready) {
      throw new Error('VL-JEPA not ready');
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (debug) console.log('[VibeCoding] Generating action plan...');

      const startTime = performance.now();

      // Generate intent description from goal state
      const intentText = 'Transform current UI to match goal design';

      // Encode intent
      const intentEmbedding = await vljepa.encodeLanguage(intentText);

      // Predict goal state and actions
      const prediction = await vljepa.predict(
        state.currentState.embedding,
        intentEmbedding
      );

      // Create action sequence
      const plan = vljepa.createActionSequence(
        prediction,
        state.currentState,
        state.goalState
      );

      const duration = performance.now() - startTime;

      setState((prev) => ({ ...prev, plan }));

      // Update CoAgents actions
      coagents.state.actions = plan.actions;

      transitionTo('planned');

      if (debug) {
        console.log('[VibeCoding] Action plan generated');
        console.log(`  Actions: ${plan.actions.length}`);
        console.log(`  Confidence: ${(plan.confidence * 100).toFixed(1)}%`);
        console.log(`  Est. time: ${plan.estimatedTime}ms`);
        console.log(`  Generation took ${duration.toFixed(1)}ms`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, step: 'error', loading: false }));
      onError?.(message);
    }
  }, [state.currentState, state.goalState, vljepa, coagents, debug, onError, transitionTo]);

  // Approve plan
  const approvePlan = useCallback(() => {
    if (!state.plan) return;

    setState((prev) => ({
      ...prev,
      plan: prev.plan ? {
        ...prev.plan,
        actions: prev.plan.actions.map((a) => ({ ...a, approved: true })),
      } : null,
    }));

    transitionTo('approved');

    if (debug) console.log('[VibeCoding] Plan approved');

    // Auto-execute if enabled
    if (autoExecute) {
      executePlan();
    }
  }, [state.plan, autoExecute, debug, transitionTo]);

  // Modify actions
  const modifyActions = useCallback((
    modifications: { id: string; changes: Partial<typeof state.plan.actions[0]> }[]
  ) => {
    if (!state.plan) return;

    setState((prev) => ({
      ...prev,
      plan: prev.plan ? {
        ...prev.plan,
        actions: prev.plan.actions.map((action) => {
          const mod = modifications.find((m) => m.id === action.id);
          return mod ? { ...action, ...mod.changes } : action;
        }),
      } : null,
    }));

    if (debug) console.log(`[VibeCoding] Modified ${modifications.length} actions`);
  }, [state.plan, debug]);

  // Reject plan
  const rejectPlan = useCallback(() => {
    transitionTo('idle');
    setState((prev) => ({
      ...prev,
      plan: null,
      currentState: null,
      goalState: null,
    }));

    if (debug) console.log('[VibeCoding] Plan rejected');
  }, [debug, transitionTo]);

  // Execute plan
  const executePlan = useCallback(async () => {
    if (!state.plan) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (debug) console.log('[VibeCoding] Executing plan...');

      const startTime = Date.now();
      const actions = [...state.plan.actions];
      let completed = 0;
      let failed = 0;

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];

        // Update progress
        const progress: ExecutionProgress = {
          total: actions.length,
          completed,
          failed,
          current: i,
          percentage: (i / actions.length) * 100,
          elapsed: Date.now() - startTime,
          remaining: (actions.length - i) * 200,
        };

        setState((prev) => ({ ...prev, progress }));

        // Execute action (mock implementation)
        action.status = 'running';

        try {
          // Simulate action execution
          await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

          action.status = 'completed';
          action.executionTime = 150 + Math.random() * 100;
          completed++;

          // Record feedback to CoAgents
          coagents.recordFeedback(action.id, true);

          if (debug) {
            console.log(`  [${i + 1}/${actions.length}] ${action.description} - OK`);
          }
        } catch (err) {
          action.status = 'failed';
          action.error = err instanceof Error ? err.message : 'Unknown error';
          failed++;

          coagents.recordFeedback(action.id, false, action.error);

          if (debug) {
            console.log(`  [${i + 1}/${actions.length}] ${action.description} - FAILED`);
          }
        }

        // Update state with action progress
        setState((prev) => ({
          ...prev,
          plan: prev.plan ? { ...prev.plan, actions: [...actions] } : null,
        }));
      }

      // Final progress update
      const finalProgress: ExecutionProgress = {
        total: actions.length,
        completed,
        failed,
        current: actions.length,
        percentage: 100,
        elapsed: Date.now() - startTime,
        remaining: 0,
      };

      // Create result
      const result = {
        before: state.currentState!,
        after: state.goalState!,
        actions,
        timestamp: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        progress: finalProgress,
        result,
      }));

      transitionTo('executed');

      // Calculate metrics
      const totalTime = Date.now() - (workflowStartRef.current || Date.now());
      setMetrics({
        totalTime,
        stepTimes: stepTimesRef.current,
        inferenceTimes: {
          xEncoder: 18,
          yEncoder: 12,
          predictor: 12,
          total: 42,
        },
        avgConfidence: state.plan.confidence,
        interventions: 0,
      });

      if (debug) {
        console.log('[VibeCoding] Plan executed');
        console.log(`  Completed: ${completed}/${actions.length}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Total time: ${finalProgress.elapsed}ms`);
      }

      onComplete?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: message, step: 'error', loading: false }));
      onError?.(message);
    }
  }, [state.plan, state.currentState, state.goalState, coagents, debug, onError, onComplete, transitionTo]);

  // Reset workflow
  const reset = useCallback(() => {
    setState({
      step: 'idle',
      currentState: null,
      goalState: null,
      plan: null,
      progress: null,
      result: null,
      error: null,
      loading: false,
    });
    setMetrics(null);
    stepTimesRef.current = {};
    workflowStartRef.current = null;

    coagents.reset();

    if (debug) console.log('[VibeCoding] Workflow reset');
  }, [coagents, debug]);

  // Cancel current operation
  const cancel = useCallback(() => {
    setState((prev) => ({ ...prev, loading: false }));

    if (debug) console.log('[VibeCoding] Operation cancelled');
  }, [debug]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    setMetrics(null);
    stepTimesRef.current = {};
  }, []);

  // Compose actions object
  const actions: VibeCodingActions = {
    captureCurrent,
    uploadGoal,
    generatePlan,
    approvePlan,
    modifyActions,
    rejectPlan,
    executePlan,
    reset,
    cancel,
  };

  return {
    state,
    actions,
    vljepa,
    coagents,
    metrics,
    resetMetrics,
  };
}
