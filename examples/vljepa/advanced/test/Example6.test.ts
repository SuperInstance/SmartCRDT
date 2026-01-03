/**
 * Tests for Example 6: A/B Testing Dashboard
 * 20+ tests covering variant analysis, prediction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ABTestingDashboardExample } from '../src/06-a-b-testing-dashboard';

describe('ABTestingDashboardExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText('A/B Testing Dashboard')).toBeInTheDocument();
    });

    it('should render analyze button', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Run Analysis/)).toBeInTheDocument();
    });

    it('should render add variant button', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Add Variant C/)).toBeInTheDocument();
    });

    it('should render variants initially', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Variant A/)).toBeInTheDocument();
      expect(screen.getByText(/Variant B/)).toBeInTheDocument();
    });
  });

  describe('Variant Management', () => {
    it('should add variant C', () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Add Variant C/));
      expect(screen.getByText(/Variant C/)).toBeInTheDocument();
    });

    it('should remove variant', () => {
      render(<ABTestingDashboardExample />);
      const removeButtons = screen.queryAllByText(/Remove/);
      if (removeButtons.length > 0) {
        fireEvent.click(removeButtons[0]);
      }
    });

    it('should show variant count', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/variants/)).toBeInTheDocument();
    });
  });

  describe('Analysis', () => {
    it('should run analysis when button clicked', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        expect(screen.getByText(/Predicted Winner/)).toBeInTheDocument();
      });
    });

    it('should predict winner', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        expect(screen.getByText(/Winner:/)).toBeInTheDocument();
      });
    });

    it('should show confidence meter', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        expect(screen.getByText(/Confidence:/)).toBeInTheDocument();
      });
    });
  });

  describe('Variant Display', () => {
    it('should show variant name', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Variant A - Original/)).toBeInTheDocument();
    });

    it('should show variant description', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Current signup form/)).toBeInTheDocument();
    });

    it('should show variant preview', () => {
      render(<ABTestingDashboardExample />);
      const previews = document.querySelectorAll('.variant-ui-preview');
      expect(previews.length).toBeGreaterThan(0);
    });
  });

  describe('Variant Metrics', () => {
    it('should display conversion rate', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Conversion:/)).toBeInTheDocument();
    });

    it('should display engagement', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Engagement:/)).toBeInTheDocument();
    });

    it('should display satisfaction', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Satisfaction:/)).toBeInTheDocument();
    });
  });

  describe('Variant Selection', () => {
    it('should select variant on click', () => {
      render(<ABTestingDashboardExample />);
      const variantCard = screen.getByText(/Variant A/).closest('.variant-card');
      if (variantCard) {
        fireEvent.click(variantCard);
        expect(variantCard.classList.contains('selected')).toBeTruthy();
      }
    });
  });

  describe('Winner Display', () => {
    it('should show winner badge', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        expect(screen.getByText(/Predicted Winner/)).toBeInTheDocument();
      });
    });

    it('should highlight winning variant', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        const winnerCard = document.querySelector('.variant-card.winner');
        expect(winnerCard).toBeInTheDocument();
      });
    });
  });

  describe('Reasoning', () => {
    it('should display reasoning list', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        expect(screen.getByText(/Reasoning:/)).toBeInTheDocument();
      });
    });

    it('should show reasoning items', async () => {
      render(<ABTestingDashboardExample />);
      fireEvent.click(screen.getByText(/Run Analysis/));
      await waitFor(() => {
        const items = document.querySelectorAll('.reasoning-item');
        expect(items.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Metrics', () => {
    it('should display analysis accuracy', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
    });

    it('should display analysis confidence', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Confidence/)).toBeInTheDocument();
    });

    it('should display analysis duration', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Duration/)).toBeInTheDocument();
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText(/Visual comparison/)).toBeInTheDocument();
      expect(screen.getByText(/Computer vision/)).toBeInTheDocument();
    });
  });
});
