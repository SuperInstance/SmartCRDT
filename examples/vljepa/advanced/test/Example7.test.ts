/**
 * Tests for Example 7: Component Library Generator
 * 20+ tests covering token-based generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComponentLibraryGeneratorExample } from '../src/07-component-library-generator';

describe('ComponentLibraryGeneratorExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the component', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText('Component Library Generator')).toBeInTheDocument();
    });

    it('should render generate button', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/Generate Library/)).toBeInTheDocument();
    });

    it('should render export button', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/Export Library/)).toBeInTheDocument();
    });

    it('should render design tokens panel', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText('Design Tokens')).toBeInTheDocument();
    });
  });

  describe('Design Tokens Display', () => {
    it('should display all tokens', () => {
      render(<ComponentLibraryGeneratorExample />);
      const tokens = document.querySelectorAll('.token-item');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should show token names', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/primary-color/)).toBeInTheDocument();
    });

    it('should show token values', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/#6366f1/)).toBeInTheDocument();
    });

    it('should show token categories', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/color/)).toBeInTheDocument();
      expect(screen.getByText(/spacing/)).toBeInTheDocument();
    });
  });

  describe('Library Generation', () => {
    it('should generate components when button clicked', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText(/components/)).toBeInTheDocument();
      });
    });

    it('should show generation progress', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText(/Generating.../)).toBeInTheDocument();
      });
    });

    it('should create multiple components', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        expect(components.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Generated Components', () => {
    it('should display Button component', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText('Button')).toBeInTheDocument();
      });
    });

    it('should display Card component', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText('Card')).toBeInTheDocument();
      });
    });

    it('should display Input component', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText('Input')).toBeInTheDocument();
      });
    });

    it('should show component descriptions', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const descriptions = document.querySelectorAll('.component-description');
        expect(descriptions.length).toBeGreaterThan(0);
      });
    });

    it('should show component variants', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const variants = document.querySelectorAll('.variant-tag');
        expect(variants.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Component Selection', () => {
    it('should select component on click', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        if (components.length > 0) {
          fireEvent.click(components[0]);
          expect(components[0].classList.contains('selected')).toBeTruthy();
        }
      });
    });

    it('should show component preview when selected', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        if (components.length > 0) {
          fireEvent.click(components[0]);
          expect(screen.getByText(/Props:/)).toBeInTheDocument();
        }
      });
    });

    it('should display component code', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        if (components.length > 0) {
          fireEvent.click(components[0]);
          const codeBlocks = document.querySelectorAll('.code-block');
          expect(codeBlocks.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Component Props', () => {
    it('should list component props', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        if (components.length > 0) {
          fireEvent.click(components[0]);
          const props = document.querySelectorAll('.prop-badge');
          expect(props.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Code Display', () => {
    it('should display TypeScript code', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const components = document.querySelectorAll('.component-card');
        if (components.length > 0) {
          fireEvent.click(components[0]);
          expect(screen.getByText(/interface/)).toBeInTheDocument();
        }
      });
    });
  });

  describe('Export', () => {
    it('should enable export after generation', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        const exportButton = screen.getByText(/Export Library/);
        expect(exportButton).toBeEnabled();
      });
    });
  });

  describe('Metrics', () => {
    it('should display components generated', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText(/Components/)).toBeInTheDocument();
      });
    });

    it('should display generation time', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText(/Generation Time/)).toBeInTheDocument();
      });
    });

    it('should display code quality', async () => {
      render(<ComponentLibraryGeneratorExample />);
      fireEvent.click(screen.getByText(/Generate Library/));
      await waitFor(() => {
        expect(screen.getByText(/Code Quality/)).toBeInTheDocument();
      });
    });
  });

  describe('Features', () => {
    it('should list all features', () => {
      render(<ComponentLibraryGeneratorExample />);
      expect(screen.getByText(/Token-based generation/)).toBeInTheDocument();
      expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    });
  });
});
