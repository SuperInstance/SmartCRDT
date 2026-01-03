/**
 * Tests for Example 8: Design Advisor
 * 20+ tests covering natural language input, design options
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignAdvisorExample } from '../src/08-design-advisor';

describe('DesignAdvisorExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<DesignAdvisorExample />);
      expect(screen.getByText('AI Design Advisor')).toBeInTheDocument();
    });

    it('should render input textarea', () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input');
      expect(textarea).toBeInTheDocument();
    });

    it('should render get advice button', () => {
      render(<DesignAdvisorExample />);
      expect(screen.getByText(/Get Design Advice/)).toBeInTheDocument();
    });

    it('should render sample requests', () => {
      render(<DesignAdvisorExample />);
      expect(screen.getByText(/I need a dashboard/)).toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('should accept text input', () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a login form' } });
        expect(textarea.value).toBe('Need a login form');
      }
    });

    it('should enable button with input', () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'test' } });
        const button = screen.getByText(/Get Design Advice/);
        expect(button).toBeEnabled();
      }
    });

    it('should disable button without input', () => {
      render(<DesignAdvisorExample />);
      const button = screen.getByText(/Get Design Advice/);
      expect(button).toBeDisabled();
    });
  });

  describe('Sample Requests', () => {
    it('should have multiple sample requests', () => {
      render(<DesignAdvisorExample />);
      const samples = screen.queryAllByText(/I need|Create|Design|Build|Make/);
      expect(samples.length).toBeGreaterThan(0);
    });

    it('should populate input when sample clicked', () => {
      render(<DesignAdvisorExample />);
      const sample = screen.queryAllByText(/I need a dashboard/)[0];
      if (sample) {
        fireEvent.click(sample);
        const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
        expect(textarea?.value).toContain('dashboard');
      }
    });
  });

  describe('Analysis', () => {
    it('should analyze request when button clicked', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/Design Options/)).toBeInTheDocument();
        });
      }
    });

    it('should generate design options', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          const options = document.querySelectorAll('.option-card');
          expect(options.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Design Options', () => {
    it('should display option name', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/Layout/)).toBeInTheDocument();
        });
      }
    });

    it('should show option description', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          const descriptions = document.querySelectorAll('.option-description');
          expect(descriptions.length).toBeGreaterThan(0);
        });
      }
    });

    it('should show match confidence', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/match/)).toBeInTheDocument();
        });
      }
    });

    it('should show option preview', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          const previews = document.querySelectorAll('.option-preview');
          expect(previews.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Pros and Cons', () => {
    it('should show pros for each option', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/✓ Pros:/)).toBeInTheDocument();
        });
      }
    });

    it('should show cons for each option', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/✗ Cons:/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Option Selection', () => {
    it('should select option on click', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          const options = document.querySelectorAll('.option-card');
          if (options.length > 0) {
            fireEvent.click(options[0]);
            expect(options[0].classList.contains('selected')).toBeTruthy();
          }
        });
      }
    });

    it('should show generated code when selected', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          const options = document.querySelectorAll('.option-card');
          if (options.length > 0) {
            fireEvent.click(options[0]);
            expect(screen.getByText(/Generated Code/)).toBeInTheDocument();
          }
        });
      }
    });
  });

  describe('Metrics', () => {
    it('should display relevance score', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/Relevance/)).toBeInTheDocument();
        });
      }
    });

    it('should display options count', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'Need a dashboard' } });
        fireEvent.click(screen.getByText(/Get Design Advice/));
        await waitFor(() => {
          expect(screen.getByText(/Options/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<DesignAdvisorExample />);
      expect(screen.getByText(/Natural language input/)).toBeInTheDocument();
      expect(screen.getByText(/design options/)).toBeInTheDocument();
    });
  });
});
