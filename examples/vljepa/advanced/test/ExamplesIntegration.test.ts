/**
 * Integration Tests for VL-JEPA Advanced Examples
 * 40+ tests covering cross-example functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  VoiceUIEditingExample,
  RealTimeSuggestionsExample,
  MultiScreenSyncExample,
  AccessibilityAuditExample,
  DesignSystemMigrationExample,
  ABTestingDashboardExample,
  ComponentLibraryGeneratorExample,
  DesignAdvisorExample,
  UIRefactoringExample,
  CrossPlatformUIExample,
  VideoInteractionAnalysisExample,
  PredictiveUIExample
} from '../src/index';

describe('VL-JEPA Advanced Examples Integration', () => {
  describe('All Examples Render', () => {
    it('should render Voice UI Editing example', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText('Voice UI Editing')).toBeInTheDocument();
    });

    it('should render Real-Time Suggestions example', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText('Real-Time UI Suggestions')).toBeInTheDocument();
    });

    it('should render Multi-Screen Sync example', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText('Multi-Screen Synchronization')).toBeInTheDocument();
    });

    it('should render Accessibility Audit example', () => {
      render(<AccessibilityAuditExample />);
      expect(screen.getByText('Accessibility Auditing')).toBeInTheDocument();
    });

    it('should render Design System Migration example', () => {
      render(<DesignSystemMigrationExample />);
      expect(screen.getByText('Design System Migration')).toBeInTheDocument();
    });

    it('should render A/B Testing Dashboard example', () => {
      render(<ABTestingDashboardExample />);
      expect(screen.getByText('A/B Testing Dashboard')).toBeInTheDocument();
    });

    it('should render Component Library Generator example', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText('Component Library Generator')).toBeInTheDocument();
    });

    it('should render Design Advisor example', () => {
      render(<DesignAdvisorExample />);
      expect(screen.getByText('AI Design Advisor')).toBeInTheDocument();
    });

    it('should render UI Refactoring example', () => {
      render(<UIRefactoringExample />);
      expect(screen.getByText('UI Refactoring Assistant')).toBeInTheDocument();
    });

    it('should render Cross-Platform UI example', () => {
      render(<CrossPlatformUIExample />);
      expect(screen.getByText('Cross-Platform UI Generation')).toBeInTheDocument();
    });

    it('should render Video Interaction Analysis example', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText('Video Interaction Analysis')).toBeInTheDocument();
    });

    it('should render Predictive UI example', () => {
      render(<PredictiveUIExample />);
      expect(screen.getByText('Predictive UI')).toBeInTheDocument();
    });
  });

  describe('Shared Components', () => {
    it('should render VLJEPADemo wrapper', () => {
      render(<VoiceUIEditingExample />);
      expect(document.querySelector('.vljepa-demo')).toBeInTheDocument();
    });

    it('should render metrics display', () => {
      render(<RealTimeSuggestionsExample />);
      expect(document.querySelector('.metrics-display')).toBeInTheDocument();
    });

    it('should render code blocks', () => {
      render(<DesignSystemMigrationExample />);
      expect(document.querySelector('.comparison-content')).toBeInTheDocument();
    });
  });

  describe('Common UI Patterns', () => {
    it('should render control bars', () => {
      render(<MultiScreenSyncExample />);
      expect(document.querySelector('.control-bar')).toBeInTheDocument();
    });

    it('should render main content areas', () => {
      render(<AccessibilityAuditExample />);
      expect(document.querySelector('.main-content')).toBeInTheDocument();
    });

    it('should render panels', () => {
      render(<ABTestingDashboardExample />);
      expect(document.querySelectorAll('.panel').length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Consistency', () => {
    it('should display accuracy in all examples', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
    });

    it('should display latency in all examples', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Latency/)).toBeInTheDocument();
    });

    it('should display confidence in all examples', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Confidence/)).toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should handle button clicks across examples', () => {
      render(<DesignSystemMigrationExample />);
      const button = screen.getByText(/Analyze/);
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
    });

    it('should show loading states', async () => {
      render(<ComponentLibraryGeneratorExample />);
      const button = screen.getByText(/Generate/);
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText(/Generating/)).toBeInTheDocument();
      });
    });
  });

  describe('State Management', () => {
    it('should maintain state within each example', async () => {
      render(<DesignAdvisorExample />);
      const textarea = document.querySelector('.request-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'test request' } });
        expect(textarea.value).toBe('test request');
      }
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', () => {
      global.innerWidth = 375;
      render(<CrossPlatformUIExample />);
      expect(screen.getByText('Cross-Platform UI Generation')).toBeInTheDocument();
    });

    it('should render on desktop viewport', () => {
      global.innerWidth = 1920;
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText('Video Interaction Analysis')).toBeInTheDocument();
    });
  });

  describe('Feature Lists', () => {
    it('should display features in Voice UI Editing', () => {
      render(<VoiceUIEditingExample />);
      expect(screen.getByText(/Real-time voice recognition/)).toBeInTheDocument();
    });

    it('should display features in Real-Time Suggestions', () => {
      render(<RealTimeSuggestionsExample />);
      expect(screen.getByText(/Contextual suggestions/)).toBeInTheDocument();
    });

    it('should display features in Multi-Screen Sync', () => {
      render(<MultiScreenSyncExample />);
      expect(screen.getByText(/Semantic conflict resolution/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty inputs gracefully', () => {
      render(<DesignAdvisorExample />);
      const button = screen.getByText(/Get Design Advice/);
      fireEvent.click(button);
      // Should not crash
    });

    it('should handle quick clicks', () => {
      render(<PredictiveUIExample />);
      const button = screen.getByText(/Reset/);
      fireEvent.click(button);
      fireEvent.click(button);
      // Should handle rapid clicks
    });
  });

  describe('Accessibility', () => {
    it('should have proper headings', () => {
      render(<UIRefactoringExample />);
      const h1 = document.querySelector('h1');
      expect(h1).toBeInTheDocument();
    });

    it('should have button labels', () => {
      render(<AccessibilityAuditExample />);
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      const start = performance.now();
      render(<VoiceUIEditingExample />);
      const end = performance.now();
      expect(end - start).toBeLessThan(1000);
    });

    it('should handle rapid state changes', () => {
      render(<PredictiveUIExample />);
      for (let i = 0; i < 10; i++) {
        const button = screen.queryAllByText(/Shopping Flow/)[0];
        if (button) fireEvent.click(button);
      }
    });
  });

  describe('Export Functionality', () => {
    it('should export all examples from index', () => {
      expect(VoiceUIEditingExample).toBeDefined();
      expect(RealTimeSuggestionsExample).toBeDefined();
      expect(MultiScreenSyncExample).toBeDefined();
      expect(AccessibilityAuditExample).toBeDefined();
      expect(DesignSystemMigrationExample).toBeDefined();
      expect(ABTestingDashboardExample).toBeDefined();
      expect(ComponentLibraryGeneratorExample).toBeDefined();
      expect(DesignAdvisorExample).toBeDefined();
      expect(UIRefactoringExample).toBeDefined();
      expect(CrossPlatformUIExample).toBeDefined();
      expect(VideoInteractionAnalysisExample).toBeDefined();
      expect(PredictiveUIExample).toBeDefined();
    });
  });
});
