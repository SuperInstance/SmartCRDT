/**
 * Tests for Example 1: Voice UI Editing
 * 20+ tests covering voice recognition, intent processing, code transformation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceUIEditingExample } from '../src/01-voice-ui-editing';

describe('VoiceUIEditingExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText('Voice UI Editing')).toBeInTheDocument();
    });

    it('should render description', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/voice-controlled UI editing/)).toBeInTheDocument();
    });

    it('should render control buttons', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Start Listening/)).toBeInTheDocument();
      expect(screen.getByText(/Reset/)).toBeInTheDocument();
    });

    it('should render sample commands', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText('Make the button blue')).toBeInTheDocument();
      expect(screen.getByText('Add email address')).toBeInTheDocument();
    });

    it('should render comparison view', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText('Original UI')).toBeInTheDocument();
      expect(screen.getByText('Modified UI')).toBeInTheDocument();
    });
  });

  describe('Voice Recognition', () => {
    it('should start listening when button clicked', async () => {
      render(<VoiceUIEditingExample />);
      const startButton = screen.getByText(/Start Listening/);
      fireEvent.click(startButton);
      await waitFor(() => {
        expect(screen.getByText(/Stop Listening/)).toBeInTheDocument();
      });
    });

    it('should process voice commands', async () => {
      render(<VoiceUIEditingExample />);
      const sampleButton = screen.getByText('Make the button blue');
      fireEvent.click(sampleButton);
      await waitFor(() => {
        expect(screen.getByText(/Last command/)).toBeInTheDocument();
      });
    });

    it('should display command transcript', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/Make the button blue/)).toBeInTheDocument();
      });
    });

    it('should show confidence score', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/confidence/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Transformation', () => {
    it('should transform button color command', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/backgroundColor/)).toBeInTheDocument();
      });
    });

    it('should add email field command', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Add email address'));
      await waitFor(() => {
        expect(screen.getByText(/email/)).toBeInTheDocument();
      });
    });

    it('should apply center alignment command', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Center the content'));
      await waitFor(() => {
        expect(screen.getByText(/textAlign/)).toBeInTheDocument();
      });
    });

    it('should track changes made', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/Applied Changes/)).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Display', () => {
    it('should display accuracy metric', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
    });

    it('should display latency metric', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Latency/)).toBeInTheDocument();
    });

    it('should display confidence metric', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Confidence/)).toBeInTheDocument();
    });

    it('should update metrics after processing', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/ms/)).toBeInTheDocument();
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to original state', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Reset/));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Applied Changes/)).not.toBeInTheDocument();
      });
    });

    it('should clear all changes on reset', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Add email address'));
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Reset/));
      });
      await waitFor(() => {
        expect(screen.queryByText(/email/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Comparison View', () => {
    it('should show before code', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/UserProfile/)).toBeInTheDocument();
    });

    it('should show after code when changes applied', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/backgroundColor/)).toBeInTheDocument();
      });
    });

    it('should highlight differences', () => {
      render(<VoiceUIEditingExample />);
      const comparisonView = document.querySelector('.comparison-view');
      expect(comparisonView).toBeInTheDocument();
    });
  });

  describe('Change Types', () => {
    it('should handle ADD changes', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Add email address'));
      await waitFor(() => {
        expect(screen.getByText(/ADD/)).toBeInTheDocument();
      });
    });

    it('should handle MODIFY changes', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Make the button blue'));
      await waitFor(() => {
        expect(screen.getByText(/MODIFY/)).toBeInTheDocument();
      });
    });

    it('should show change reason', async () => {
      render(<VoiceUIEditingExample />);
      fireEvent.click(screen.getByText('Center the content'));
      await waitFor(() => {
        expect(screenByText(/per voice command/)).toBeInTheDocument();
      });
    });
  });

  describe('Features List', () => {
    it('should display all features', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Real-time voice recognition/)).toBeInTheDocument();
      expect(screen.getByText(/Intent understanding/)).toBeInTheDocument();
      expect(screen.getByText(/Automatic code transformation/)).toBeInTheDocument();
    });
  });
});
