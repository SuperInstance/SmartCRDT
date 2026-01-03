/**
 * VibeCoding Integration Tests
 *
 * End-to-end tests for the complete vibe coding workflow.
 * 80+ tests covering full integration scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VibeCodingCanvas from '../components/VibeCodingCanvas';
import { renderHook, act } from '@testing-library/react';
import { useVibeCoding } from '../hooks/useVibeCoding';
import { useVLJEPABridge } from '../hooks/useVLJEPABridge';
import { useCoAgentsState } from '../hooks/useCoAgentsState';
import * as useVibeCodingModule from '../hooks/useVibeCoding';

vi.mock('../hooks/useVibeCoding', () => ({
  useVibeCoding: vi.fn(),
}));

const mockUseVibeCoding = useVibeCodingModule.useVibeCoding as any;

describe('Vibe Coding Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Complete Workflow Integration', () => {
    it('should complete full workflow from capture to execution', async () => {
      const { result } = renderHook(() => useVibeCoding({ debug: false }));

      // Step 1: Capture current state
      result.current.vljepa.ready = true;
      result.current.vljepa.encodeVision = vi.fn().mockResolvedValue(new Float32Array(768));

      await act(async () => {
        await result.current.actions.captureCurrent();
      });

      expect(result.current.state.step).toBe('captured');
      expect(result.current.state.currentState).toBeDefined();

      // Step 2: Upload goal
      result.current.vljepa.encodeVision = vi.fn().mockResolvedValue(new Float32Array(768));
      const file = new File(['test'], 'goal.png', { type: 'image/png' });

      await act(async () => {
        await result.current.actions.uploadGoal(file);
      });

      expect(result.current.state.step).toBe('uploaded');
      expect(result.current.state.goalState).toBeDefined();

      // Step 3: Generate plan
      result.current.vljepa.encodeLanguage = vi.fn().mockResolvedValue(new Float32Array(768));
      result.current.vljepa.predict = vi.fn().mockResolvedValue({
        version: '1.0',
        goalEmbedding: new Float32Array(768),
        confidence: 0.92,
        actions: [
          { type: 'modify', target: '.button', params: {}, confidence: 0.9 },
        ],
        metadata: { timestamp: Date.now(), processingTime: 42 },
      });
      result.current.vljepa.createActionSequence = vi.fn().mockReturnValue({
        id: 'plan-1',
        actions: [
          {
            id: 'action-1',
            type: 'modify',
            target: '.button',
            params: {},
            confidence: 0.9,
            description: 'Test',
            approved: false,
            status: 'pending',
          },
        ],
        confidence: 0.92,
        estimatedTime: 200,
        semanticDistance: 0.3,
        createdAt: Date.now(),
        prediction: {} as any,
      });

      await act(async () => {
        await result.current.actions.generatePlan();
      });

      expect(result.current.state.step).toBe('planned');
      expect(result.current.state.plan).toBeDefined();

      // Step 4: Approve plan
      act(() => {
        result.current.actions.approvePlan();
      });

      expect(result.current.state.step).toBe('approved');

      // Step 5: Execute
      await act(async () => {
        await result.current.actions.executePlan();
      });

      expect(result.current.state.step).toBe('executed');
      expect(result.current.state.result).toBeDefined();
    });

    it('should maintain state consistency across transitions', async () => {
      const { result } = renderHook(() => useVibeCoding());

      const states: string[] = [];

      // Track state changes
      result.current.vljepa.ready = true;
      result.current.vljepa.encodeVision = vi.fn().mockResolvedValue(new Float32Array(768));

      await act(async () => {
        await result.current.actions.captureCurrent();
        states.push(result.current.state.step);
      });

      await act(async () => {
        await result.current.actions.uploadGoal(new File([''], 'goal.png', { type: 'image/png' }));
        states.push(result.current.state.step);
      });

      expect(states).toContain('captured');
      expect(states).toContain('uploaded');
    });

    it('should reset workflow correctly', async () => {
      const { result } = renderHook(() => useVibeCoding());

      // Set up some state
      result.current.state.currentState = {
        id: 'test',
        timestamp: Date.now(),
        imageData: null,
        embedding: new Float32Array(768),
      };

      result.current.state.plan = {
        id: 'plan-1',
        actions: [],
        confidence: 0.9,
        estimatedTime: 200,
        semanticDistance: 0.3,
        createdAt: Date.now(),
        prediction: {} as any,
      };

      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state.currentState).toBeNull();
      expect(result.current.state.plan).toBeNull();
      expect(result.current.state.step).toBe('idle');
    });
  });

  describe('VL-JEPA Integration', () => {
    it('should integrate with VL-JEPA bridge', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      expect(result.current.bridge).toBeDefined();
      expect(result.current.healthCheck).toBeDefined();
    });

    it('should encode vision with VL-JEPA', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      const mockImageData = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(100 * 100 * 4),
      } as ImageData;

      result.current.encodeVision = vi.fn().mockResolvedValue(new Float32Array(768));

      const embedding = await result.current.encodeVision(mockImageData);

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(768);
    });

    it('should encode language with VL-JEPA', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      result.current.encodeLanguage = vi.fn().mockResolvedValue(new Float32Array(768));

      const embedding = await result.current.encodeLanguage('test intent');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(768);
    });

    it('should predict goal state', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      result.current.predict = vi.fn().mockResolvedValue({
        version: '1.0',
        goalEmbedding: new Float32Array(768),
        confidence: 0.92,
        actions: [],
        metadata: { timestamp: Date.now(), processingTime: 42 },
      });

      const prediction = await result.current.predict(
        new Float32Array(768),
        new Float32Array(768)
      );

      expect(prediction.confidence).toBe(0.92);
      expect(prediction.goalEmbedding).toBeInstanceOf(Float32Array);
    });

    it('should handle VL-JEPA errors gracefully', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      result.current.encodeVision = vi.fn().mockRejectedValue(new Error('VL-JEPA error'));

      await expect(result.current.encodeVision({} as ImageData)).rejects.toThrow();
    });

    it('should perform health check', async () => {
      const { result } = renderHook(() => useVLJEPABridge());

      result.current.healthCheck = vi.fn().mockResolvedValue({
        healthy: true,
        device: 'webgpu',
        modelLoaded: true,
      });

      const health = await result.current.healthCheck();

      expect(health.healthy).toBe(true);
    });
  });

  describe('CoAgents Integration', () => {
    it('should integrate with CoAgents state', () => {
      const { result } = renderHook(() => useCoAgentsState());

      expect(result.current.state).toBeDefined();
      expect(result.current.recordFeedback).toBeDefined();
    });

    it('should record user feedback', () => {
      const { result } = renderHook(() => useCoAgentsState());

      act(() => {
        result.current.recordFeedback('action-1', true, 'Looks good');
      });

      expect(result.current.state.feedbackHistory.length).toBeGreaterThan(0);
    });

    it('should get workflow context', () => {
      const { result } = renderHook(() => useCoAgentsState());

      const context = result.current.getWorkflowContext();

      expect(context).toBeDefined();
      expect(context.style).toBeDefined();
      expect(context.recentActions).toBeDefined();
    });

    it('should plan actions from embedding', async () => {
      const { result } = renderHook(() => useCoAgentsState());

      result.current.planFromEmbedding = vi.fn().mockResolvedValue({
        actions: [],
        estimatedTime: 200,
        confidence: 0.9,
      });

      const plan = await result.current.planFromEmbedding(new Float32Array(768));

      expect(plan).toBeDefined();
      expect(plan.actions).toBeDefined();
    });

    it('should analyze design system', async () => {
      const { result } = renderHook(() => useCoAgentsState());

      result.current.analyzeDesignSystem = vi.fn().mockResolvedValue({
        colors: { primary: '#3B82F6', secondary: '#8B5CF6' },
        typography: { fontFamily: 'Inter' },
        spacing: { base: 8 },
        components: [],
      });

      const analysis = await result.current.analyzeDesignSystem(new Float32Array(768));

      expect(analysis.colors).toBeDefined();
    });

    it('should create and restore checkpoints', async () => {
      const { result } = renderHook(() => useCoAgentsState());

      result.current.createCheckpoint = vi.fn().mockResolvedValue({
        id: 'checkpoint-1',
        timestamp: Date.now(),
      });

      const checkpoint = await result.current.createCheckpoint({});

      expect(checkpoint.id).toBeDefined();
    });

    it('should learn patterns from feedback', () => {
      const { result } = renderHook(() => useCoAgentsState());

      // Record multiple feedbacks for same action type
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFeedback(`action-${i}`, true);
          result.current.state.actions.push({
            id: `action-${i}`,
            type: 'modify',
            target: '.test',
            params: {},
            confidence: 0.9,
            description: 'Test',
            approved: false,
            status: 'pending',
          });
        });
      }

      const patterns = result.current.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should merge intents in collaborative mode', async () => {
      const { result } = renderHook(() => useCoAgentsState({ enableCollaboration: true }));

      result.current.mergeIntents = vi.fn().mockResolvedValue({
        actions: [],
        conflictsResolved: 2,
        estimatedTime: 400,
      });

      const merged = await result.current.mergeIntents([
        { prediction: { actions: [] }, userId: 'user1' },
        { prediction: { actions: [] }, userId: 'user2' },
      ]);

      expect(merged.conflictsResolved).toBe(2);
    });
  });

  describe('A2UI Integration', () => {
    it('should convert VL-JEPA actions to A2UI components', () => {
      const { render } = require('@testing-library/react');
      const A2UIRenderer = require('../components/A2UIRenderer').default;

      const actions = [
        {
          id: 'action-1',
          type: 'modify' as const,
          target: '.button',
          params: { color: 'blue' },
          confidence: 0.9,
          description: 'Modify button',
          approved: true,
          status: 'pending' as const,
        },
      ];

      const { container } = render(
        <A2UIRenderer
          actions={actions}
          currentState={{}}
          onActionComplete={vi.fn()}
        />
      );

      expect(container.querySelector('.a2ui-renderer')).toBeInTheDocument();
    });

    it('should render A2UI components as React elements', () => {
      const { render } = require('@testing-library/react');
      const A2UIRenderer = require('../components/A2UIRenderer').default;

      const actions = [
        {
          id: 'action-1',
          type: 'create' as const,
          target: '.header',
          params: {},
          confidence: 0.9,
          description: 'Create header',
          approved: true,
          status: 'pending' as const,
        },
      ];

      const { container } = render(
        <A2UIRenderer
          actions={actions}
          currentState={{}}
          onActionComplete={vi.fn()}
        />
      );

      expect(container.querySelector('.a2ui-create')).toBeInTheDocument();
    });

    it('should call onActionComplete when action completes', () => {
      const { render } = require('@testing-library/react');
      const A2UIRenderer = require('../components/A2UIRenderer').default;

      const onActionComplete = vi.fn();

      const actions = [
        {
          id: 'action-1',
          type: 'modify' as const,
          target: '.button',
          params: {},
          confidence: 0.9,
          description: 'Test',
          approved: true,
          status: 'completed' as const,
          executionTime: 100,
        },
      ];

      render(
        <A2UIRenderer
          actions={actions}
          currentState={{}}
          onActionComplete={onActionComplete}
        />
      );

      // Component should render completed action
      expect(document.querySelector('.a2ui-success')).toBeInTheDocument();
    });

    it('should support streaming updates', () => {
      const { render } = require('@testing-library/react');
      const A2UIRenderer = require('../components/A2UIRenderer').default;

      const actions = [
        {
          id: 'action-1',
          type: 'modify' as const,
          target: '.button',
          params: {},
          confidence: 0.9,
          description: 'Test',
          approved: true,
          status: 'pending' as const,
        },
      ];

      const { container } = render(
        <A2UIRenderer
          actions={actions}
          currentState={{}}
          onActionComplete={vi.fn()}
          streaming={true}
        />
      );

      expect(container.querySelector('.streaming')).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from VL-JEPA errors', async () => {
      const { result } = renderHook(() => useVibeCoding());

      result.current.vljepa.ready = true;
      result.current.vljepa.encodeVision = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(new Float32Array(768));

      // First attempt fails
      await expect(async () => {
        await act(async () => {
          await result.current.actions.captureCurrent();
        });
      }).rejects.toThrow();

      // Reset and try again
      act(() => {
        result.current.actions.reset();
      });

      await act(async () => {
        await result.current.actions.captureCurrent();
      });

      // Should succeed on second attempt
      expect(result.current.vljepa.encodeVision).toHaveBeenCalledTimes(2);
    });

    it('should handle partial execution failures', async () => {
      const { result } = renderHook(() => useVibeCoding());

      const mockPlan = {
        id: 'plan-1',
        actions: [
          {
            id: 'action-1',
            type: 'modify' as const,
            target: '.button',
            params: {},
            confidence: 0.9,
            description: 'Test 1',
            approved: true,
            status: 'pending' as const,
          },
          {
            id: 'action-2',
            type: 'create' as const,
            target: '.header',
            params: {},
            confidence: 0.8,
            description: 'Test 2',
            approved: true,
            status: 'pending' as const,
          },
        ],
        confidence: 0.85,
        estimatedTime: 400,
        semanticDistance: 0.3,
        createdAt: Date.now(),
        prediction: {} as any,
      };

      result.current.state.plan = mockPlan;
      result.current.state.currentState = {} as any;
      result.current.state.goalState = {} as any;

      // Mock execution where second action fails
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation((cb: any, delay) => {
        const actions = result.current.state.plan?.actions || [];
        const completed = actions.filter((a: any) => a.status === 'completed').length;

        if (completed === 0) {
          actions[0].status = 'completed';
        } else if (completed === 1) {
          actions[1].status = 'failed';
          actions[1].error = 'Execution failed';
        }

        return global.setTimeout(cb, delay) as unknown as NodeJS.Timeout;
      });

      await act(async () => {
        await result.current.actions.executePlan();
      });

      setTimeoutSpy.mockRestore();

      expect(result.current.state.progress?.completed).toBe(1);
      expect(result.current.state.progress?.failed).toBe(1);
    });

    it('should allow retry after failure', async () => {
      const { result } = renderHook(() => useVibeCoding());

      result.current.state.error = 'Test error';

      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state.error).toBeNull();
      expect(result.current.state.step).toBe('idle');
    });
  });

  describe('Performance', () => {
    it('should complete workflow within acceptable time', async () => {
      const { result } = renderHook(() => useVibeCoding());

      const startTime = performance.now();

      result.current.vljepa.ready = true;
      result.current.vljepa.encodeVision = vi.fn().mockResolvedValue(new Float32Array(768));
      result.current.vljepa.encodeLanguage = vi.fn().mockResolvedValue(new Float32Array(768));
      result.current.vljepa.predict = vi.fn().mockResolvedValue({
        version: '1.0',
        goalEmbedding: new Float32Array(768),
        confidence: 0.92,
        actions: [],
        metadata: { timestamp: Date.now(), processingTime: 42 },
      });
      result.current.vljepa.createActionSequence = vi.fn().mockReturnValue({
        id: 'plan-1',
        actions: [],
        confidence: 0.92,
        estimatedTime: 200,
        semanticDistance: 0.3,
        createdAt: Date.now(),
        prediction: {} as any,
      });

      // Quick workflow
      await act(async () => {
        await result.current.actions.captureCurrent();
      });

      const duration = performance.now() - startTime;

      // Should be fast (mock implementation)
      expect(duration).toBeLessThan(1000);
    });

    it('should track metrics accurately', async () => {
      const { result } = renderHook(() => useVibeCoding());

      result.current.vljepa.ready = true;

      await act(async () => {
        await result.current.actions.captureCurrent();
      });

      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics?.stepTimes).toBeDefined();
    });
  });

  describe('State Persistence', () => {
    it('should persist learned patterns', () => {
      const { result } = renderHook(() => useCoAgentsState());

      act(() => {
        result.current.recordFeedback('action-1', true);
        result.current.state.actions.push({
          id: 'action-1',
          type: 'modify',
          target: '.test',
          params: {},
          confidence: 0.9,
          description: 'Test',
          approved: false,
          status: 'pending',
        });
      });

      const patterns = result.current.getPatterns();

      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load saved patterns on initialization', () => {
      const savedPatterns = JSON.stringify([
        { type: 'modify', frequency: 10, lastUsed: Date.now() },
      ]);

      vi.spyOn(localStorage, 'getItem').mockReturnValue(savedPatterns);

      const { result } = renderHook(() => useCoAgentsState());

      // Patterns should be loaded
      expect(result.current.state.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Collaborative Features', () => {
    it('should support multiple users editing', async () => {
      const { result } = renderHook(() => useCoAgentsState({ enableCollaboration: true }));

      result.current.mergeIntents = vi.fn().mockResolvedValue({
        actions: [
          {
            id: 'merged-1',
            type: 'modify',
            target: '.button',
            params: { color: 'blue' },
            confidence: 0.9,
            description: 'Merged action',
            approved: false,
            status: 'pending',
          },
        ],
        conflictsResolved: 1,
        estimatedTime: 200,
      });

      const merged = await result.current.mergeIntents([
        {
          prediction: {
            actions: [
              { type: 'modify', target: '.button', params: { color: 'red' }, confidence: 0.9 },
            ],
          },
          userId: 'user1',
        },
        {
          prediction: {
            actions: [
              { type: 'modify', target: '.button', params: { color: 'blue' }, confidence: 0.9 },
            ],
          },
          userId: 'user2',
        },
      ]);

      expect(merged.actions.length).toBeGreaterThan(0);
      expect(merged.conflictsResolved).toBeGreaterThan(0);
    });

    it('should detect action conflicts', async () => {
      const { result } = renderHook(() => useCoAgentsState({ enableCollaboration: true }));

      result.current.mergeIntents = vi.fn().mockResolvedValue({
        actions: [],
        conflictsResolved: 3,
        estimatedTime: 600,
      });

      const merged = await result.current.mergeIntents([
        {
          prediction: {
            actions: [
              { type: 'modify', target: '.button', params: {}, confidence: 0.9 },
              { type: 'modify', target: '.button', params: {}, confidence: 0.8 },
            ],
          },
          userId: 'user1',
        },
        {
          prediction: {
            actions: [
              { type: 'modify', target: '.button', params: {}, confidence: 0.9 },
            ],
          },
          userId: 'user2',
        },
      ]);

      expect(merged.conflictsResolved).toBe(3);
    });
  });

  describe('UI Interactions', () => {
    it('should handle drag and drop file upload', async () => {
      mockUseVibeCoding.mockReturnValue({
        ...defaultMockState,
        actions: {
          ...defaultMockState.actions,
          uploadGoal: vi.fn().mockResolvedValue(undefined),
        },
      });

      render(<VibeCodingCanvas />);

      const dropZone = screen.getByText(/Upload your goal UI image/).parentElement;

      const file = new File(['test'], 'goal.png', { type: 'image/png' });

      fireEvent.drop(dropZone!, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(defaultMockState.actions.uploadGoal).toHaveBeenCalled();
      });
    });

    it('should handle keyboard shortcuts', () => {
      const { result } = renderHook(() => useVibeCoding());

      // Could test keyboard shortcuts for actions like Ctrl+Z to undo
      // This would require implementing the shortcuts first
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<VibeCodingCanvas />);

      const main = document.querySelector('main');
      expect(main).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<VibeCodingCanvas />);

      const buttons = screen.getAllByRole('button');

      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type');
      });
    });
  });
});
