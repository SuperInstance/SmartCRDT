/**
 * Tests for Example 10: Cross-Platform UI
 * 20+ tests covering multi-platform generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrossPlatformUIExample } from '../src/10-cross-platform-ui';

describe('CrossPlatformUIExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<CrossPlatformUIExample />);
      expect(screen.getByText('Cross-Platform UI Generation')).toBeInTheDocument();
    });

    it('should render description input', () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input');
      expect(textarea).toBeInTheDocument();
    });

    it('should render generate button', () => {
      render(<CrossPlatformUIExample />);
      expect(screen.getByText(/Generate for All Platforms/)).toBeInTheDocument();
    });

    it('should render sample descriptions', () => {
      render(<CrossPlatformUIExample />);
      expect(screen.getByText(/A login screen/)).toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    it('should accept text input', () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button component' } });
        expect(textarea.value).toBe('A button component');
      }
    });

    it('should enable button with input', () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'test' } });
        const button = screen.getByText(/Generate/);
        expect(button).toBeEnabled();
      }
    });
  });

  describe('Sample Descriptions', () => {
    it('should populate input when sample clicked', () => {
      render(<CrossPlatformUIExample />);
      const samples = screen.queryAllByText(/A login screen/);
      if (samples.length > 0) {
        fireEvent.click(samples[0]);
        const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
        expect(textarea?.value).toContain('login');
      }
    });
  });

  describe('Code Generation', () => {
    it('should generate for all platforms', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/React/)).toBeInTheDocument();
          expect(screen.getByText(/Flutter/)).toBeInTheDocument();
        });
      }
    });

    it('should generate React code', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
        });
      }
    });

    it('should generate Flutter code', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Dart/)).toBeInTheDocument();
        });
      }
    });

    it('should generate SwiftUI code', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Swift/)).toBeInTheDocument();
        });
      }
    });

    it('should generate Jetpack Compose code', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Kotlin/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Platform Tabs', () => {
    it('should display platform tabs', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          const tabs = document.querySelectorAll('.platform-tab');
          expect(tabs.length).toBe(4);
        });
      }
    });

    it('should switch platform content', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          const tabs = document.querySelectorAll('.platform-tab');
          if (tabs.length > 1) {
            fireEvent.click(tabs[1]);
            expect(tabs[1].classList.contains('active')).toBeTruthy();
          }
        });
      }
    });
  });

  describe('Code Display', () => {
    it('should show platform description', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Web application/)).toBeInTheDocument();
        });
      }
    });

    it('should display code blocks', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          const codeBlocks = document.querySelectorAll('.code-block');
          expect(codeBlocks.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Metrics', () => {
    it('should display platforms generated', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Platforms/)).toBeInTheDocument();
        });
      }
    });

    it('should display generation time', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Generation Time/)).toBeInTheDocument();
        });
      }
    });

    it('should display code consistency', async () => {
      render(<CrossPlatformUIExample />);
      const textarea = document.querySelector('.description-input') as HTMLTextAreaElement;
      if (textarea) {
        fireEvent.change(textarea, { target: { value: 'A button' } });
        fireEvent.click(screen.getByText(/Generate/));
        await waitFor(() => {
          expect(screen.getByText(/Code Consistency/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<CrossPlatformUIExample />);
      expect(screen.getByText(/Single description/)).toBeInTheDocument();
      expect(screen.getByText(/Platform-specific/)).toBeInTheDocument();
    });
  });
});
