/**
 * Tests for Example 11: Video Interaction Analysis
 * 20+ tests covering interaction tracking, pattern detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoInteractionAnalysisExample } from '../src/11-video-interaction-analysis';

describe('VideoInteractionAnalysisExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText('Video Interaction Analysis')).toBeInTheDocument();
    });

    it('should render upload area', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText(/Upload Screen Recording/)).toBeInTheDocument();
    });

    it('should render upload button', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText(/Analyze Demo Video/)).toBeInTheDocument();
    });

    it('should display upload icon', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText(/📹/)).toBeInTheDocument();
    });
  });

  describe('Video Upload', () => {
    it('should analyze demo video when button clicked', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Detected Interactions/)).toBeInTheDocument();
      });
    });

    it('should show progress during analysis', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Analyzing.../)).toBeInTheDocument();
      });
    });

    it('should show progress bar', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        const progressBar = document.querySelector('.progress-bar');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should update progress percentage', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/%/)).toBeInTheDocument();
      });
    });
  });

  describe('Interaction Detection', () => {
    it('should detect click interactions', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/click/)).toBeInTheDocument();
      });
    });

    it('should detect input interactions', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/input/)).toBeInTheDocument();
      });
    });

    it('should detect scroll interactions', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/scroll/)).toBeInTheDocument();
      });
    });

    it('should detect hover interactions', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/hover/)).toBeInTheDocument();
      });
    });

    it('should detect drag interactions', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/drag/)).toBeInTheDocument();
      });
    });
  });

  describe('Interaction Timeline', () => {
    it('should show interaction timestamps', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        const times = document.querySelectorAll('.interaction-time');
        expect(times.length).toBeGreaterThan(0);
      });
    });

    it('should show interaction elements', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        const elements = document.querySelectorAll('.interaction-element');
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('should show interaction duration', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        const durations = document.querySelectorAll('.interaction-duration');
        expect(durations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Pattern Detection', () => {
    it('should detect rage clicking pattern', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Rage Clicking/)).toBeInTheDocument();
      });
    });

    it('should detect hesitation pattern', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Hesitation/)).toBeInTheDocument();
      });
    });

    it('should show pattern frequency', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/occurrences/)).toBeInTheDocument();
      });
    });

    it('should show pattern significance', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/significance/)).toBeInTheDocument();
      });
    });
  });

  describe('Insights Generation', () => {
    it('should generate insights', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Insights & Recommendations/)).toBeInTheDocument();
      });
    });

    it('should categorize insights', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/ISSUE/)).toBeInTheDocument();
        expect(screen.getByText(/OPPORTUNITY/)).toBeInTheDocument();
        expect(screen.getByText(/PATTERN/)).toBeInTheDocument();
      });
    });

    it('should provide recommendations', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Recommendation:/)).toBeInTheDocument();
      });
    });
  });

  describe('Metrics', () => {
    it('should display interactions detected', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Interactions/)).toBeInTheDocument();
      });
    });

    it('should display patterns found', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Patterns/)).toBeInTheDocument();
      });
    });

    it('should display analysis accuracy', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Accuracy/)).toBeInTheDocument();
      });
    });

    it('should display analysis duration', async () => {
      render(<VideoInteractionAnalysisExample />);
      fireEvent.click(screen.getByText(/Analyze Demo Video/));
      await waitFor(() => {
        expect(screen.getByText(/Duration/)).toBeInTheDocument();
      });
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<VideoInteractionAnalysisExample />);
      expect(screen.getByText(/Computer vision/)).toBeInTheDocument();
      expect(screen.getByText(/Pattern recognition/)).toBeInTheDocument();
    });
  });
});
