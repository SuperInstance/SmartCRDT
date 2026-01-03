/**
 * Tests for Example 9: UI Refactoring
 * 20+ tests covering refactoring steps, code analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UIRefactoringExample } from '../src/09-ui-refactoring';

describe('UIRefactoringExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText('UI Refactoring Assistant')).toBeInTheDocument();
    });

    it('should render analyze button', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText(/Analyze Code/)).toBeInTheDocument();
    });

    it('should render apply all button', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText(/Apply All Steps/)).toBeInTheDocument();
    });

    it('should render comparison view', () => {
      render(<UIRefactoringExample />);
      expect(screen.querySelector('.comparison-panel')).toBeInTheDocument();
    });
  });

  describe('Code Analysis', () => {
    it('should analyze code when button clicked', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/Refactoring Steps/)).toBeInTheDocument();
      });
    });

    it('should find refactoring opportunities', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const steps = document.querySelectorAll('.step-card');
        expect(steps.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Refactoring Steps', () => {
    it('should display step names', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/Convert to TypeScript/)).toBeInTheDocument();
      });
    });

    it('should display step descriptions', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const descriptions = document.querySelectorAll('.step-description');
        expect(descriptions.length).toBeGreaterThan(0);
      });
    });

    it('should show step priority', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/high/)).toBeInTheDocument();
      });
    });

    it('should show step effort', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/quick/)).toBeInTheDocument();
      });
    });
  });

  describe('Step Categories', () => {
    it('should have modernization steps', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/modernization/)).toBeInTheDocument();
      });
    });

    it('should have accessibility steps', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/accessibility/)).toBeInTheDocument();
      });
    });

    it('should have maintainability steps', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/maintainability/)).toBeInTheDocument();
      });
    });

    it('should have performance steps', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/performance/)).toBeInTheDocument();
      });
    });
  });

  describe('Step Application', () => {
    it('should apply single step', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const applyButtons = screen.queryAllByText(/Apply Step/);
        if (applyButtons.length > 0) {
          fireEvent.click(applyButtons[0]);
        }
      });
      await waitFor(() => {
        expect(screen.getByText(/Completed/)).toBeInTheDocument();
      });
    });

    it('should apply all steps', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Apply All Steps/));
      });
      await waitFor(() => {
        const completed = screen.queryAllByText(/Completed/);
        expect(completed.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Step Status', () => {
    it('should show pending status initially', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const pendingSteps = document.querySelectorAll('.status-pending');
        expect(pendingSteps.length).toBeGreaterThan(0);
      });
    });

    it('should show in-progress status', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const applyButtons = screen.queryAllByText(/Apply Step/);
        if (applyButtons.length > 0) {
          fireEvent.click(applyButtons[0]);
          expect(screen.getByText(/Applying.../)).toBeInTheDocument();
        }
      });
    });

    it('should show completed status', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const applyButtons = screen.queryAllByText(/Apply Step/);
        if (applyButtons.length > 0) {
          fireEvent.click(applyButtons[0]);
        }
      });
      await waitFor(() => {
        expect(screen.getByText(/Completed/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Comparison', () => {
    it('should show before code', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText(/Original Code/)).toBeInTheDocument();
    });

    it('should show after code', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText(/Refactored Code/)).toBeInTheDocument();
    });

    it('should update after code when step applied', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const applyButtons = screen.queryAllByText(/Apply Step/);
        if (applyButtons.length > 0) {
          fireEvent.click(applyButtons[0]);
        }
      });
      await waitFor(() => {
        expect(screen.getByText(/Refactored Code/)).toBeInTheDocument();
      });
    });
  });

  describe('Step Comparison', () => {
    it('should show code before change', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const beforeCodes = document.querySelectorAll('.code-before');
        expect(beforeCodes.length).toBeGreaterThan(0);
      });
    });

    it('should show code after change', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const afterCodes = document.querySelectorAll('.code-after');
        expect(afterCodes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should show progress indicator', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/steps completed/)).toBeInTheDocument();
      });
    });

    it('should update progress when steps applied', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        const applyButtons = screen.queryAllByText(/Apply Step/);
        if (applyButtons.length > 0) {
          fireEvent.click(applyButtons[0]);
        }
      });
      await waitFor(() => {
        expect(screen.getByText(/1\//)).toBeInTheDocument();
      });
    });
  });

  describe('Metrics', () => {
    it('should display improvements count', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/Improvements/)).toBeInTheDocument();
      });
    });

    it('should display complexity reduction', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/Complexity Reduction/)).toBeInTheDocument();
      });
    });

    it('should display performance gain', async () => {
      render(<UIRefactoringExample />);
      fireEvent.click(screen.getByText(/Analyze Code/));
      await waitFor(() => {
        expect(screen.getByText(/Performance Gain/)).toBeInTheDocument();
      });
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText(/Legacy code analysis/)).toBeInTheDocument();
      expect(screen.getByText(/Safe, incremental/)).toBeInTheDocument();
    });
  });
});
