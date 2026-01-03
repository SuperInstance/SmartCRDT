/**
 * VibeCodingCanvas Component
 *
 * Main demo canvas showing the complete VL-JEPA "Show, Don't Tell" workflow.
 * Displays current UI, goal image, generated plan, and execution progress.
 */

import React, { useEffect, useRef } from 'react';
import { useVibeCoding } from '../hooks/useVibeCoding';
import { VibeCodingStep, StepInfo } from '../types';
import CurrentUIPreview from './CurrentUIPreview';
import GoalImageUploader from './GoalImageUploader';
import ActionPlanViewer from './ActionPlanViewer';
import ExecutionTimeline from './ExecutionTimeline';
import BeforeAfterComparison from './BeforeAfterComparison';
import '../styles/vibe-coding.css';

export interface VibeCodingCanvasProps {
  /** Initial state (for testing) */
  initialState?: Partial<typeof import('../types').VibeCodingState>;
  /** On workflow complete callback */
  onComplete?: (result: any) => void;
  /** On error callback */
  onError?: (error: string) => void;
  /** Debug mode */
  debug?: boolean;
}

/**
 * Step definitions
 */
const STEPS: Record<VibeCodingStep, StepInfo> = {
  idle: {
    step: 'idle',
    name: 'Ready',
    description: 'Capture your current UI to begin',
    skippable: false,
  },
  captured: {
    step: 'captured',
    name: 'Current State Captured',
    description: 'Now upload your goal image',
    skippable: false,
  },
  uploaded: {
    step: 'uploaded',
    name: 'Goal Uploaded',
    description: 'VL-JEPA will analyze the differences',
    skippable: false,
  },
  planned: {
    step: 'planned',
    name: 'Plan Generated',
    description: 'Review and approve the action plan',
    skippable: false,
  },
  approved: {
    step: 'approved',
    name: 'Plan Approved',
    description: 'Executing the approved actions',
    skippable: false,
  },
  executed: {
    step: 'executed',
    name: 'Complete!',
    description: 'Your UI has been transformed',
    skippable: false,
  },
  error: {
    step: 'error',
    name: 'Error',
    description: 'Something went wrong',
    skippable: false,
  },
};

/**
 * VibeCodingCanvas Component
 */
export default function VibeCodingCanvas({
  initialState,
  onComplete,
  onError,
  debug = false,
}: VibeCodingCanvasProps) {
  const { state, actions, vljepa, coagents, metrics } = useVibeCoding({
    debug,
    onComplete,
    onError,
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize VL-JEPA on mount
  useEffect(() => {
    const init = async () => {
      if (!vljepa.ready && !vljepa.processing) {
        try {
          // Bridge initialization happens in the hook
        } catch (err) {
          console.error('Failed to initialize VL-JEPA:', err);
        }
      }
    };

    init();
  }, [vljepa.ready, vljepa.processing]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await actions.uploadGoal(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await actions.uploadGoal(file);
    }
  };

  // Get current step info
  const currentStep = STEPS[state.step];

  // Calculate progress percentage
  const stepProgress = {
    idle: 0,
    captured: 20,
    uploaded: 40,
    planned: 60,
    approved: 80,
    executed: 100,
    error: 0,
  }[state.step];

  return (
    <div
      ref={canvasRef}
      className="vibe-coding-canvas"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="vibe-coding-header">
        <div className="header-content">
          <div className="title">
            <h1>VL-JEPA Vibe Coding</h1>
            <p className="subtitle">Show, Don't Tell UI Editing with AI</p>
          </div>

          {/* Status indicator */}
          <div className={`status status-${state.step}`}>
            <span className="status-dot"></span>
            <span className="status-text">{currentStep.name}</span>
          </div>

          {/* Health check */}
          {vljepa.ready && (
            <div className="health-indicator">
              <span className="health-dot health-ok"></span>
              <span>VL-JEPA Ready</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="progress-bar-container">
          <div className="progress-label">
            <span>Progress</span>
            <span>{stepProgress}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${stepProgress}%` }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="vibe-coding-main">
        {/* Step description */}
        <div className="step-description">
          <h2>{currentStep.name}</h2>
          <p>{currentStep.description}</p>
        </div>

        {/* Two-column layout for capture and goal */}
        {(state.step === 'idle' || state.step === 'captured' || state.step === 'uploaded') && (
          <div className="capture-goal-layout">
            {/* Current UI Preview */}
            <div className="capture-section">
              <CurrentUIPreview
                state={state.currentState}
                onCapture={actions.captureCurrent}
                loading={state.loading}
                captured={state.step !== 'idle'}
              />
            </div>

            {/* Goal Image Uploader */}
            <div className="goal-section">
              <GoalImageUploader
                state={state.goalState}
                onUpload={handleFileUpload}
                onDrop={handleDrop}
                loading={state.loading}
                uploaded={['uploaded', 'planned', 'approved', 'executed'].includes(state.step)}
              />
            </div>
          </div>
        )}

        {/* Action Plan Viewer */}
        {(state.step === 'planned' || state.step === 'approved' || state.step === 'executed') && state.plan && (
          <ActionPlanViewer
            plan={state.plan}
            onApprove={actions.approvePlan}
            onModify={actions.modifyActions}
            onReject={actions.rejectPlan}
            canModify={state.step === 'planned'}
            executing={state.step === 'approved' || state.step === 'executed'}
          />
        )}

        {/* Execution Timeline */}
        {(state.step === 'approved' || state.step === 'executed') && state.progress && (
          <ExecutionTimeline
            progress={state.progress}
            plan={state.plan}
          />
        )}

        {/* Before/After Comparison */}
        {state.step === 'executed' && state.result && (
          <BeforeAfterComparison
            before={state.result.before}
            after={state.result.after}
            actions={state.result.actions}
          />
        )}

        {/* Error display */}
        {state.step === 'error' && (
          <div className="error-display">
            <h3>Something went wrong</h3>
            <p>{state.error}</p>
            <button onClick={actions.reset} className="btn-primary">
              Start Over
            </button>
          </div>
        )}

        {/* Debug info */}
        {debug && (
          <div className="debug-info">
            <h4>Debug Info</h4>
            <pre>
              {JSON.stringify(
                {
                  step: state.step,
                  ready: vljepa.ready,
                  processing: vljepa.processing,
                  coagentsReady: coagents.ready,
                  metrics,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </main>

      {/* Footer with controls */}
      <footer className="vibe-coding-footer">
        {/* Context from CoAgents */}
        {coagents.ready && state.step !== 'idle' && (
          <div className="workflow-context">
            <span className="context-label">Workflow Context:</span>
            <span className="context-style">{coagents.getWorkflowContext().style}</span>
            {coagents.getPatterns().length > 0 && (
              <span className="context-patterns">
                {coagents.getPatterns().length} patterns learned
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="footer-actions">
          {/* Generate Plan button */}
          {state.step === 'uploaded' && (
            <button
              onClick={actions.generatePlan}
              disabled={state.loading || !vljepa.ready}
              className="btn-primary btn-large"
            >
              {state.loading ? 'Analyzing...' : 'Generate Action Plan'}
            </button>
          )}

          {/* Reset button */}
          {(state.step === 'executed' || state.step === 'error') && (
            <button onClick={actions.reset} className="btn-secondary">
              Start New Workflow
            </button>
          )}

          {/* Cancel button */}
          {state.loading && (
            <button onClick={actions.cancel} className="btn-ghost">
              Cancel
            </button>
          )}
        </div>

        {/* Metrics display */}
        {metrics && (
          <div className="metrics-display">
            <span>Total time: {(metrics.totalTime / 1000).toFixed(1)}s</span>
            <span>Avg confidence: {(metrics.avgConfidence * 100).toFixed(0)}%</span>
            <span>Inference: {metrics.inferenceTimes.total}ms</span>
          </div>
        )}
      </footer>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
}
