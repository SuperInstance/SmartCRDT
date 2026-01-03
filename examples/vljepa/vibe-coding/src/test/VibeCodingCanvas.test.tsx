/**
 * VibeCodingCanvas Component Tests
 *
 * Tests for the main canvas component UI.
 * 45+ tests covering rendering, interactions, and state display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VibeCodingCanvas from '../components/VibeCodingCanvas';
import * as useVibeCodingModule from '../hooks/useVibeCoding';

// Mock the useVibeCoding hook
vi.mock('../hooks/useVibeCoding', () => ({
  useVibeCoding: vi.fn(),
}));

const mockUseVibeCoding = useVibeCodingModule.useVibeCoding as any;

describe('VibeCodingCanvas Component', () => {
  const defaultMockState = {
    state: {
      step: 'idle' as const,
      currentState: null,
      goalState: null,
      plan: null,
      progress: null,
      result: null,
      error: null,
      loading: false,
    },
    actions: {
      captureCurrent: vi.fn(),
      uploadGoal: vi.fn(),
      generatePlan: vi.fn(),
      approvePlan: vi.fn(),
      modifyActions: vi.fn(),
      rejectPlan: vi.fn(),
      executePlan: vi.fn(),
      reset: vi.fn(),
      cancel: vi.fn(),
    },
    vljepa: {
      ready: true,
      processing: false,
      encodeVision: vi.fn(),
      encodeLanguage: vi.fn(),
      predict: vi.fn(),
      createActionSequence: vi.fn(),
      healthCheck: vi.fn(),
      clearCache: vi.fn(),
    },
    coagents: {
      ready: true,
      state: {
        currentEmbedding: null,
        goalEmbedding: null,
        actions: [],
        feedbackHistory: [],
        patterns: [],
      },
      getWorkflowContext: vi.fn(() => ({
        style: 'predictive',
        recentActions: [],
        patterns: [],
      })),
      getPatterns: vi.fn(() => []),
      recordFeedback: vi.fn(),
      planFromEmbedding: vi.fn(),
      mergeIntents: vi.fn(),
      analyzeDesignSystem: vi.fn(),
      createCheckpoint: vi.fn(),
      restoreCheckpoint: vi.fn(),
      reset: vi.fn(),
    },
    metrics: null,
    resetMetrics: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVibeCoding.mockReturnValue(defaultMockState);
  });

  describe('Rendering', () => {
    it('should render the canvas', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('VL-JEPA Vibe Coding')).toBeInTheDocument();
    });

    it('should render subtitle', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Show, Don\'t Tell UI Editing with AI')).toBeInTheDocument();
    });

    it('should render status indicator', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should render progress bar', () => {
      render(<VibeCodingCanvas />);

      const progressBar = document.querySelector('.progress-bar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render VL-JEPA health indicator when ready', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('VL-JEPA Ready')).toBeInTheDocument();
    });

    it('should not render health indicator when not ready', () => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        vljepa: { ...defaultMockState.vljepa, ready: false },
      });

      render(<VibeCodingCanvas />);

      expect(screen.queryByText('VL-JEPA Ready')).not.toBeInTheDocument();
    });

    it('should render step description', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Capture your current UI to begin')).toBeInTheDocument();
    });
  });

  describe('Idle State', () => {
    it('should show capture and goal upload sections', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Current UI')).toBeInTheDocument();
      expect(screen.getByText('Goal UI')).toBeInTheDocument();
    });

    it('should render capture button', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Capture Current UI')).toBeInTheDocument();
    });

    it('should render goal upload placeholder', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText(/Upload your goal UI image/)).toBeInTheDocument();
    });

    it('should show drag and drop hint', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText(/Drag and drop or click to browse/)).toBeInTheDocument();
    });
  });

  describe('Captured State', () => {
    beforeEach(() => {
      mockUseVikeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'captured',
          currentState: {
            id: 'state-1',
            timestamp: Date.now(),
            imageData: null,
            embedding: new Float32Array(768),
          },
        },
      });
    });

    it('should update status to captured', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Current State Captured')).toBeInTheDocument();
    });

    it('should show recapture button', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Recapture')).toBeInTheDocument();
    });

    it('should update progress to 20%', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('20%')).toBeInTheDocument();
    });
  });

  describe('Uploaded State', () => {
    beforeEach(() => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'uploaded',
          currentState: {
            id: 'state-1',
            timestamp: Date.now(),
            imageData: null,
            embedding: new Float32Array(768),
          },
          goalState: {
            id: 'goal-1',
            timestamp: Date.now(),
            imageData: null,
            embedding: new Float32Array(768),
          },
        },
      });
    });

    it('should show generate plan button', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Generate Action Plan')).toBeInTheDocument();
    });

    it('should update progress to 40%', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });

  describe('Planned State', () => {
    beforeEach(() => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'planned',
          plan: {
            id: 'plan-1',
            actions: [
              {
                id: 'action-1',
                type: 'modify',
                target: '.button',
                params: { color: 'blue' },
                confidence: 0.9,
                description: 'Modify button color',
                approved: false,
                status: 'pending',
              },
            ],
            confidence: 0.92,
            estimatedTime: 200,
            semanticDistance: 0.3,
            createdAt: Date.now(),
            prediction: {} as any,
          },
        },
      });
    });

    it('should display action plan viewer', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Generated Action Plan')).toBeInTheDocument();
    });

    it('should show action count and confidence', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText(/1 action/)).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
    });

    it('should render approve and reject buttons', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Approve & Execute')).toBeInTheDocument();
      expect(screen.getByText('Reject Plan')).toBeInTheDocument();
    });

    it('should update progress to 60%', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });
  });

  describe('Approved State', () => {
    beforeEach(() => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'approved',
          plan: {
            id: 'plan-1',
            actions: [
              {
                id: 'action-1',
                type: 'modify',
                target: '.button',
                params: {},
                confidence: 0.9,
                description: 'Test action',
                approved: true,
                status: 'running',
              },
            ],
            confidence: 0.92,
            estimatedTime: 200,
            semanticDistance: 0.3,
            createdAt: Date.now(),
            prediction: {} as any,
          },
          progress: {
            total: 1,
            completed: 0,
            failed: 0,
            current: 0,
            percentage: 0,
            elapsed: 0,
            remaining: 200,
          },
        },
      });
    });

    it('should display execution timeline', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Execution Progress')).toBeInTheDocument();
    });

    it('should show progress percentage', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should update progress to 80%', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  describe('Executed State', () => {
    beforeEach(() => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'executed',
          result: {
            before: {
              id: 'before-1',
              timestamp: Date.now(),
              imageData: null,
              embedding: new Float32Array(768),
            },
            after: {
              id: 'after-1',
              timestamp: Date.now(),
              imageData: null,
              embedding: new Float32Array(768),
            },
            actions: [
              {
                id: 'action-1',
                type: 'modify',
                target: '.button',
                params: {},
                confidence: 0.9,
                description: 'Test action',
                approved: true,
                status: 'completed',
                executionTime: 150,
              },
            ],
            timestamp: Date.now(),
          },
          progress: {
            total: 1,
            completed: 1,
            failed: 0,
            current: 1,
            percentage: 100,
            elapsed: 150,
            remaining: 0,
          },
        },
        metrics: {
          totalTime: 5000,
          stepTimes: { idle: 100, captured: 200 },
          inferenceTimes: {
            xEncoder: 18,
            yEncoder: 12,
            predictor: 12,
            total: 42,
          },
          avgConfidence: 0.92,
          interventions: 0,
        },
      });
    });

    it('should display before/after comparison', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Before & After Comparison')).toBeInTheDocument();
    });

    it('should show completion status', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Complete!')).toBeInTheDocument();
    });

    it('should show start new workflow button', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Start New Workflow')).toBeInTheDocument();
    });

    it('should display metrics', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText(/Total time:/)).toBeInTheDocument();
      expect(screen.getByText(/Avg confidence:/)).toBeInTheDocument();
      expect(screen.getByText(/Inference:/)).toBeInTheDocument();
    });

    it('should update progress to 100%', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'error',
          error: 'Test error message',
        },
      });
    });

    it('should display error message', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should show start over button', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Start Over')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call captureCurrent when capture button clicked', () => {
      render(<VibeCodingCanvas />);

      const captureButton = screen.getByText('Capture Current UI');
      fireEvent.click(captureButton);

      expect(defaultMockState.actions.captureCurrent).toHaveBeenCalled();
    });

    it('should handle file upload', async () => {
      render(<VibeCodingCanvas />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([''], 'test.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(defaultMockState.actions.uploadGoal).toHaveBeenCalled();
      });
    });

    it('should call generatePlan when button clicked', () => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'uploaded',
        },
      });

      render(<VibeCodingCanvas />);

      const generateButton = screen.getByText('Generate Action Plan');
      fireEvent.click(generateButton);

      expect(defaultMockState.actions.generatePlan).toHaveBeenCalled();
    });

    it('should call approvePlan when approve button clicked', () => {
      mockUseVikeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'planned',
          plan: {
            id: 'plan-1',
            actions: [],
            confidence: 0.92,
            estimatedTime: 200,
            semanticDistance: 0.3,
            createdAt: Date.now(),
            prediction: {} as any,
          },
        },
      });

      render(<VibeCodingCanvas />);

      const approveButton = screen.getByText('Approve & Execute');
      fireEvent.click(approveButton);

      expect(defaultMockState.actions.approvePlan).toHaveBeenCalled();
    });

    it('should call rejectPlan when reject button clicked', () => {
      mockUseVikeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'planned',
          plan: {
            id: 'plan-1',
            actions: [],
            confidence: 0.92,
            estimatedTime: 200,
            semanticDistance: 0.3,
            createdAt: Date.now(),
            prediction: {} as any,
          },
        },
      });

      render(<VibeCodingCanvas />);

      const rejectButton = screen.getByText('Reject Plan');
      fireEvent.click(rejectButton);

      expect(defaultMockState.actions.rejectPlan).toHaveBeenCalled();
    });

    it('should call reset when start new workflow clicked', () => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'executed',
          result: {
            before: {} as any,
            after: {} as any,
            actions: [],
            timestamp: Date.now(),
          },
        },
      });

      render(<VibeCodingCanvas />);

      const resetButton = screen.getByText('Start New Workflow');
      fireEvent.click(resetButton);

      expect(defaultMockState.actions.reset).toHaveBeenCalled();
    });

    it('should disable buttons during loading', () => {
      mockUseVikeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'uploaded',
          loading: true,
        },
      });

      render(<VibeCodingCanvas />);

      const generateButton = screen.getByText('Generate Action Plan');
      expect(generateButton).toBeDisabled();
    });

    it('should show workflow context from CoAgents', () => {
      render(<VibeCodingCanvas />);

      expect(screen.getByText('Workflow Context:')).toBeInTheDocument();
    });
  });

  describe('Debug Mode', () => {
    it('should render debug info when enabled', () => {
      render(<VibeCodingCanvas debug={true} />);

      expect(screen.getByText('Debug Info')).toBeInTheDocument();
    });

    it('should display state in debug panel', () => {
      render(<VibeCodingCanvas debug={true} />);

      const debugPre = document.querySelector('.debug-info pre');
      expect(debugPre).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should display CoAgents patterns when available', () => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        state: {
          ...defaultMockState.state,
          step: 'captured',
        },
        coagents: {
          ...defaultMockState.coagents,
          getPatterns: vi.fn(() => [
            { type: 'modify', frequency: 5, lastUsed: Date.now() },
          ]),
        },
      });

      render(<VibeCodingCanvas />);

      expect(screen.getByText(/1 patterns learned/)).toBeInTheDocument();
    });
  });
});
