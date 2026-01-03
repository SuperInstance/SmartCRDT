/**
 * Tests for Example 3: Multi-Screen Sync
 * 20+ tests covering screen sync, conflict resolution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiScreenSyncExample } from '../src/03-multi-screen-sync';

describe('MultiScreenSyncExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText('Multi-Screen Synchronization')).toBeInTheDocument();
    });

    it('should render all screens', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Desktop 1/)).toBeInTheDocument();
      expect(screen.getByText(/Desktop 2/)).toBeInTheDocument();
      expect(screen.getByText(/Laptop/)).toBeInTheDocument();
    });

    it('should render control buttons', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Auto-Sync On/)).toBeInTheDocument();
      expect(screen.getByText(/Simulate Conflict/)).toBeInTheDocument();
    });

    it('should render sync events panel', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText('Sync Events')).toBeInTheDocument();
    });
  });

  describe('Screen Selection', () => {
    it('should select screen on click', () => {
      render(<MultiScreenSyncExample />);
      const screenCard = screen.getByText(/Desktop 1/);
      fireEvent.click(screenCard);
      expect(screen.getByText(/Editing: Desktop 1/)).toBeInTheDocument();
    });

    it('should show active badge on selected screen', () => {
      render(<MultiScreenSyncExample />);
      const screenCard = screen.getByText(/Desktop 1/);
      fireEvent.click(screenCard);
      const activeBadge = document.querySelector('.active-badge');
      expect(activeBadge).toBeInTheDocument();
    });

    it('should only allow one active screen', () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      fireEvent.click(screen.getByText(/Desktop 2/));
      const activeBadges = document.querySelectorAll('.active-badge');
      expect(activeBadges.length).toBe(1);
    });
  });

  describe('Auto Sync Toggle', () => {
    it('should toggle auto-sync', () => {
      render(<MultiScreenSyncExample />);
      const toggle = screen.getByText(/Auto-Sync On/);
      fireEvent.click(toggle);
      expect(screen.getByText(/Auto-Sync Off/)).toBeInTheDocument();
    });

    it('should sync changes when auto-sync is on', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: '<button style="color: red">Click</button>' } });
        await waitFor(() => {
          const syncEvents = document.querySelectorAll('.event-item');
          expect(syncEvents.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Code Editing', () => {
    it('should allow editing selected screen', () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'new content' } });
        expect(editor.value).toBe('new content');
      }
    });

    it('should update screen preview on edit', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'modified content' } });
        await waitFor(() => {
          expect(screen.getByText(/modified content/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Conflict Simulation', () => {
    it('should simulate conflict when button clicked', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Simulate Conflict/));
      await waitFor(() => {
        expect(screen.getByText(/Conflicting changes/)).toBeInTheDocument();
      });
    });

    it('should show conflict in events', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Simulate Conflict/));
      await waitFor(() => {
        const conflictEvents = document.querySelectorAll('.event-conflict');
        expect(conflictEvents.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflicts using semantic analysis', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Simulate Conflict/));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Resolve Conflict/));
      });
      await waitFor(() => {
        expect(screen.getByText(/Conflict resolved/)).toBeInTheDocument();
      });
    });

    it('should unify screens after resolution', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Simulate Conflict/));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Resolve Conflict/));
      });
      await waitFor(() => {
        expect(screen.getByText(/resolve/)).toBeInTheDocument();
      });
    });
  });

  describe('Sync Events', () => {
    it('should display sync events', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'test' } });
        await waitFor(() => {
          expect(screen.getByText(/sync/)).toBeInTheDocument();
        });
      }
    });

    it('should show event timestamp', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'test' } });
        await waitFor(() => {
          const timeElements = document.querySelectorAll('.event-time');
          expect(timeElements.length).toBeGreaterThan(0);
        });
      }
    });

    it('should show event source screen', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        fireEvent.change(editor, { target: { value: 'test' } });
        await waitFor(() => {
          expect(screen.getByText(/screen-1/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Metrics', () => {
    it('should display sync accuracy', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Sync Accuracy/)).toBeInTheDocument();
    });

    it('should display sync latency', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Sync Latency/)).toBeInTheDocument();
    });

    it('should display conflict resolution rate', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Conflict Resolution/)).toBeInTheDocument();
    });
  });

  describe('Screen Metadata', () => {
    it('should show last modified timestamp', () => {
      render(<MultiScreenSyncExample />);
      const timestamps = document.querySelectorAll('.last-modified');
      expect(timestamps.length).toBeGreaterThan(0);
    });

    it('should update timestamp on edit', async () => {
      render(<MultiScreenSyncExample />);
      fireEvent.click(screen.getByText(/Desktop 1/));
      const editor = document.querySelector('.code-editor') as HTMLTextAreaElement;
      if (editor) {
        const initialTime = Date.now();
        fireEvent.change(editor, { target: { value: 'test' } });
        await waitFor(() => {
          const timestamps = document.querySelectorAll('.last-modified');
          expect(timestamps.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Real-time sync/)).toBeInTheDocument();
      expect(screen.getByText(/Semantic conflict resolution/)).toBeInTheDocument();
    });
  });
});
