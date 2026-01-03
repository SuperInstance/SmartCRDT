/**
 * Tests for Example 12: Predictive UI
 * 20+ tests covering behavior prediction, pre-loading
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PredictiveUIExample } from '../src/12-predictive-ui';

describe('PredictiveUIExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText('Predictive UI')).toBeInTheDocument();
    });

    it('should render train model button', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Train Model/)).toBeInTheDocument();
    });

    it('should render reset button', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Reset/)).toBeInTheDocument();
    });

    it('should render test scenarios', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Test Scenarios/)).toBeInTheDocument();
    });
  });

  describe('Model Training', () => {
    it('should train model when button clicked', async () => {
      render(<PredictiveUIExample />);
      fireEvent.click(screen.getByText(/Train Model/));
      await waitFor(() => {
        expect(screen.queryByText(/Training.../)).not.toBeInTheDocument();
      });
    });

    it('should show training progress', async () => {
      render(<PredictiveUIExample />);
      fireEvent.click(screen.getByText(/Train Model/));
      expect(screen.getByText(/Training.../)).toBeInTheDocument();
    });
  });

  describe('Test Scenarios', () => {
    it('should have shopping flow scenario', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Shopping Flow/)).toBeInTheDocument();
    });

    it('should have checkout flow scenario', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Checkout Flow/)).toBeInTheDocument();
    });

    it('should have login flow scenario', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Login Flow/)).toBeInTheDocument();
    });

    it('should run scenario when clicked', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          const actions = document.querySelectorAll('.action-item');
          expect(actions.length).toBeGreaterThan(0);
        }, { timeout: 5000 });
      }
    });
  });

  describe('User Actions', () => {
    it('should track user actions', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/User Actions/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should display action timeline', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          const timeline = document.querySelector('.actions-timeline');
          expect(timeline).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show action type', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/click-home/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show action element', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/nav-home/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });
  });

  describe('Predictions', () => {
    it('should make predictions based on actions', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Current Predictions/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show predicted action', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Predicted Action/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show confidence meter', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Confidence:/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show confidence percentage', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screenByText(/% confidence/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });
  });

  describe('Prediction History', () => {
    it('should track prediction history', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Prediction History/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should show if prediction was correct', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          const historyItems = document.querySelectorAll('.history-item');
          expect(historyItems.length).toBeGreaterThan(0);
        }, { timeout: 5000 });
      }
    });

    it('should display predicted vs actual', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Predicted:/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });
  });

  describe('Reset', () => {
    it('should reset simulation state', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          fireEvent.click(screen.getByText(/Reset/));
        }, { timeout: 5000 });
        await waitFor(() => {
          const actions = document.querySelectorAll('.action-item');
          expect(actions.length).toBe(0);
        });
      }
    });

    it('should clear predictions on reset', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          fireEvent.click(screen.getByText(/Reset/));
        }, { timeout: 5000 });
        await waitFor(() => {
          expect(screen.getByText(/No active predictions/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Metrics', () => {
    it('should display prediction accuracy', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should display predictions count', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Predictions/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });

    it('should display average confidence', async () => {
      render(<PredictiveUIExample />);
      const scenarioButtons = screen.queryAllByText(/Shopping Flow/);
      if (scenarioButtons.length > 0) {
        fireEvent.click(scenarioButtons[0]);
        await waitFor(() => {
          expect(screen.getByText(/Avg Confidence/)).toBeInTheDocument();
        }, { timeout: 5000 });
      }
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText(/Behavior pattern learning/)).toBeInTheDocument();
      expect(screen.getByText(/Real-time prediction/)).toBeInTheDocument();
    });
  });
});
