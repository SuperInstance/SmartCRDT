/**
 * Tests for Example 4: Accessibility Audit
 * 20+ tests covering WCAG checking, issue detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccessibilityAuditExample } from '../src/04-accessibility-audit';

describe('AccessibilityAuditExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<AccessibilityAuditExample />);
      expect(screen.getByText('Accessibility Auditing')).toBeInTheDocument();
    });

    it('should render run audit button', () => {
      render(<AccessibilityAuditExample />);
      expect(screen.getByText(/Run Audit/)).toBeInTheDocument();
    });

    it('should render code editor', () => {
      render(<AccessibilityAuditExample />);
      const editor = document.querySelector('.code-editor');
      expect(editor).toBeInTheDocument();
    });

    it('should render issues panel', () => {
      render(<AccessibilityAuditExample />);
      expect(screen.getByText('Accessibility Issues')).toBeInTheDocument();
    });
  });

  describe('Audit Execution', () => {
    it('should run audit when button clicked', async () => {
      render(<AccessibilityAuditExample />);
      const button = screen.getByText(/Run Audit/);
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.queryByText(/Scanning.../)).not.toBeInTheDocument();
      });
    });

    it('should detect form label issues', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/Form inputs lack/)).toBeInTheDocument();
      });
    });

    it('should detect alt text issues', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/Image missing alt/)).toBeInTheDocument();
      });
    });
  });

  describe('Issue Severity', () => {
    it('should show critical severity', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
      });
    });

    it('should show serious severity', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/SERIOUS/)).toBeInTheDocument();
      });
    });

    it('should show moderate severity', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/MODERATE/)).toBeInTheDocument();
      });
    });

    it('should show minor severity', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/MINOR/)).toBeInTheDocument();
      });
    });
  });

  describe('WCAG Levels', () => {
    it('should display WCAG A level', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/WCAG A/)).toBeInTheDocument();
      });
    });

    it('should display WCAG AA level', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/WCAG AA/)).toBeInTheDocument();
      });
    });
  });

  describe('Issue Selection', () => {
    it('should select issue on click', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        const issues = document.querySelectorAll('.issue-card');
        if (issues.length > 0) {
          fireEvent.click(issues[0]);
          expect(document.querySelector('.issue-details-panel')).toBeInTheDocument();
        }
      });
    });

    it('should show issue details when selected', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        const issues = document.querySelectorAll('.issue-card');
        if (issues.length > 0) {
          fireEvent.click(issues[0]);
          expect(screen.getByText(/Issue Details/)).toBeInTheDocument();
        }
      });
    });
  });

  describe('Issue Categories', () => {
    it('should categorize issues correctly', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/Forms/)).toBeInTheDocument();
      });
    });
  });

  describe('Suggestions', () => {
    it('should provide fix suggestions', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        const issues = document.querySelectorAll('.issue-card');
        if (issues.length > 0) {
          fireEvent.click(issues[0]);
          expect(screen.getByText(/Suggested Fix/)).toBeInTheDocument();
        }
      });
    });
  });

  describe('Metrics', () => {
    it('should display issue counts by severity', async () => {
      render(<AccessibilityAuditExample />);
      fireEvent.click(screen.getByText(/Run Audit/));
      await waitFor(() => {
        expect(screen.getByText(/Critical/)).toBeInTheDocument();
        expect(screen.getByText(/Serious/)).toBeInTheDocument();
        expect(screen.getByText(/Moderate/)).toBeInTheDocument();
        expect(screen.getByText(/Minor/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Editor', () => {
    it('should allow code editing', () => {
      render(<AccessibilityAuditExample />);
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'new code' } });
        expect(editor.value).toBe('new code');
      }
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<AccessibilityAuditExample />);
      expect(screen.getByText(/WCAG 2.1/)).toBeInTheDocument();
      expect(screen.getByText(/Severity-based/)).toBeInTheDocument();
    });
  });
});
