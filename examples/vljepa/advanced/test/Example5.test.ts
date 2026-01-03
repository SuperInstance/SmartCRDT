/**
 * Tests for Example 5: Design System Migration
 * 20+ tests covering component mapping, migration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignSystemMigrationExample } from '../src/05-design-system-migration';

describe('DesignSystemMigrationExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText('Design System Migration')).toBeInTheDocument();
    });

    it('should render analyze button', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText(/Analyze Design Systems/)).toBeInTheDocument();
    });

    it('should render migrate all button', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText(/Migrate All/)).toBeInTheDocument();
    });

    it('should render comparison view', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText('Design Systems Comparison')).toBeInTheDocument();
    });
  });

  describe('Analysis', () => {
    it('should analyze design systems when button clicked', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Component Mappings/)).toBeInTheDocument();
      });
    });

    it('should create component mappings', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        const mappings = document.querySelectorAll('.mapping-card');
        expect(mappings.length).toBeGreaterThan(0);
      });
    });

    it('should show confidence scores', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/confidence/)).toBeInTheDocument();
      });
    });
  });

  describe('Component Mappings', () => {
    it('should display old component name', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Material UI/)).toBeInTheDocument();
      });
    });

    it('should display new component name', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Mantine/)).toBeInTheDocument();
      });
    });

    it('should list required changes', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Changes required/)).toBeInTheDocument();
      });
    });
  });

  describe('Migration', () => {
    it('should migrate single component', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        const migrateButtons = screen.queryAllByText(/Migrate/);
        if (migrateButtons.length > 0) {
          fireEvent.click(migrateButtons[0]);
          expect(screen.getByText(/Completed/)).toBeInTheDocument();
        }
      });
    });

    it('should migrate all components', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Migrate All/));
      });
      await waitFor(() => {
        const completedBadges = screen.queryAllByText(/Completed/);
        expect(completedBadges.length).toBeGreaterThan(0);
      });
    });

    it('should update progress indicator', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Migrate All/));
      });
      await waitFor(() => {
        expect(screen.getByText(/Progress:/)).toBeInTheDocument();
      });
    });
  });

  describe('Migration Status', () => {
    it('should show pending status initially', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        const pendingCards = document.querySelectorAll('.status-pending');
        expect(pendingCards.length).toBeGreaterThan(0);
      });
    });

    it('should show migrating status during migration', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        const migrateButtons = screen.queryAllByText(/Migrate/);
        if (migrateButtons.length > 0) {
          fireEvent.click(migrateButtons[0]);
          expect(screen.getByText(/Migrating.../)).toBeInTheDocument();
        }
      });
    });

    it('should show completed status after migration', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        const migrateButtons = screen.queryAllByText(/Migrate/);
        if (migrateButtons.length > 0) {
          fireEvent.click(migrateButtons[0]);
        }
      });
      await waitFor(() => {
        expect(screen.getByText(/Completed/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Comparison View', () => {
    it('should show old design system', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText('Old Design System')).toBeInTheDocument();
    });

    it('should show new design system', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText('New Design System')).toBeInTheDocument();
    });
  });

  describe('Metrics', () => {
    it('should display components mapped count', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Components Mapped/)).toBeInTheDocument();
      });
    });

    it('should display confidence score', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Confidence Score/)).toBeInTheDocument();
      });
    });

    it('should display estimated time', async () => {
      render(<DesignSystemMigrationExample />);
      fireEvent.click(screen.getByText(/Analyze Design Systems/));
      await waitFor(() => {
        expect(screen.getByText(/Est. Time Remaining/)).toBeInTheDocument();
      });
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText(/Automatic component mapping/)).toBeInTheDocument();
      expect(screen.getByText(/Confidence-based/)).toBeInTheDocument();
    });
  });
});
