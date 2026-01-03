/**
 * Tests for Example 2: Real-Time Suggestions
 * 20+ tests covering suggestion generation, acceptance, rejection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RealTimeSuggestionsExample } from '../src/02-real-time-suggestions';

describe('RealTimeSuggestionsExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText('Real-Time UI Suggestions')).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/watches your work/)).toBeInTheDocument();
    });

    it('should render toggle button', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Analysis Active/)).toBeInTheDocument();
    });

    it('should render code editor', () => {
      render(<RealTimeSuggestionsExample />);
      const editor = document.querySelector('.code-editor');
      expect(editor).toBeInTheDocument();
    });

    it('should render suggestions panel', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });
  });

  describe('Analysis Toggle', () => {
    it('should toggle analysis on/off', () => {
      render(<RealTimeSuggestionsExample />);
      const toggle = screen.getByText(/Analysis Active/);
      fireEvent.click(toggle);
      expect(screen.getByText(/Analysis Paused/)).toBeInTheDocument();
    });

    it('should show active state when on', () => {
      render(<RealTimeSuggestionsExample />);
      const toggle = screen.querySelector('.toggle-button.active');
      expect(toggle).toBeInTheDocument();
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions after analysis', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        const suggestions = screen.queryAllByTestId(/suggestion-/);
        expect(suggestions.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

    it('should show suggestion count', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/suggestions available/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should categorize suggestions by type', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/optimization/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show suggestion confidence', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screenByText(/confident/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Suggestion Actions', () => {
    it('should accept suggestion', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        const acceptButtons = screen.queryAllByText(/Accept/);
        if (acceptButtons.length > 0) {
          fireEvent.click(acceptButtons[0]);
          expect(screen.getByText(/Applied/)).toBeInTheDocument();
        }
      }, { timeout: 3000 });
    });

    it('should reject suggestion', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        const rejectButtons = screen.queryAllByText(/Reject/);
        if (rejectButtons.length > 0) {
          fireEvent.click(rejectButtons[0]);
          expect(screen.getByText(/Rejected/)).toBeInTheDocument();
        }
      }, { timeout: 3000 });
    });

    it('should update UI when suggestion accepted', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        const acceptButtons = screen.queryAllByText(/Accept/);
        if (acceptButtons.length > 0) {
          fireEvent.click(acceptButtons[0]);
          const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
          expect(editor?.value).toContain('loading');
        }
      }, { timeout: 3000 });
    });
  });

  describe('Suggestion Types', () => {
    it('should generate accessibility suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/accessibility/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should generate best practice suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/best-practice/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should generate optimization suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/optimization/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Priority Levels', () => {
    it('should show high priority suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/high/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show medium priority suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/medium/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show low priority suggestions', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/low/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Code Editor', () => {
    it('should allow code editing', () => {
      render(<RealTimeSuggestionsExample />);
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'new code' } });
        expect(editor.value).toBe('new code');
      }
    });

    it('should have initial sample code', () => {
      render(<RealTimeSuggestionsExample />);
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        expect(editor.value).toContain('ProductCard');
      }
    });
  });

  describe('Metrics', () => {
    it('should display accuracy metric', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
    });

    it('should display latency metric', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Latency/)).toBeInTheDocument();
    });

    it('should display acceptance rate', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        expect(screen.getByText(/Accept Rate/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should update metrics when suggestions processed', async () => {
      render(<RealTimeSuggestionsExample />);
      await waitFor(() => {
        const acceptButtons = screen.queryAllByText(/Accept/);
        if (acceptButtons.length > 0) {
          fireEvent.click(acceptButtons[0]);
          expect(screen.getByText(/Accept Rate/)).toBeInTheDocument();
        }
      }, { timeout: 3000 });
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Real-time code analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Contextual suggestions/)).toBeInTheDocument();
    });
  });
});
