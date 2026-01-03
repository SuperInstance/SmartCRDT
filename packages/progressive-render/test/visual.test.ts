/**
 * Visual Feedback Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualFeedbackManager } from '../src/visual.js';
import type { RenderPhase, VisualEffectType, SkeletonConfig } from '../src/types.js';

describe('VisualFeedbackManager', () => {
  let manager: VisualFeedbackManager;

  beforeEach(() => {
    manager = new VisualFeedbackManager();
  });

  describe('Skeleton Configuration', () => {
    it('should create text skeleton config', () => {
      const config = manager.createSkeletonConfig('text');

      expect(config.type).toBe('text');
      expect(config.animation).toBe('shimmer');
      expect(config.lines).toBe(3);
    });

    it('should create button skeleton config', () => {
      const config = manager.createSkeletonConfig('button');

      expect(config.type).toBe('rect');
      expect(config.width).toBe(120);
      expect(config.height).toBe(40);
      expect(config.radius).toBe(4);
    });

    it('should create input skeleton config', () => {
      const config = manager.createSkeletonConfig('input');

      expect(config.type).toBe('rect');
      expect(config.width).toBe('100%');
      expect(config.height).toBe(40);
    });

    it('should create avatar skeleton config', () => {
      const config = manager.createSkeletonConfig('avatar');

      expect(config.type).toBe('circle');
      expect(config.width).toBe(40);
      expect(config.height).toBe(40);
    });

    it('should create image skeleton config', () => {
      const config = manager.createSkeletonConfig('image', { width: 200, height: 150 });

      expect(config.type).toBe('rect');
      expect(config.width).toBe(200);
      expect(config.height).toBe(150);
    });

    it('should create card skeleton config', () => {
      const config = manager.createSkeletonConfig('card');

      expect(config.type).toBe('rect');
      expect(config.radius).toBe(8);
    });

    it('should create list skeleton config', () => {
      const config = manager.createSkeletonConfig('list', { lines: 10 });

      expect(config.type).toBe('custom');
      expect(config.className).toBe('skeleton-list');
      expect(config.lines).toBe(10);
    });

    it('should apply custom options to skeleton', () => {
      const config = manager.createSkeletonConfig('text', {
        lines: 5,
        height: 20,
        animation: 'pulse'
      });

      expect(config.lines).toBe(5);
      expect(config.height).toBe(20);
      expect(config.animation).toBe('pulse');
    });
  });

  describe('Skeleton CSS Generation', () => {
    it('should generate CSS for skeleton', () => {
      const config: SkeletonConfig = {
        type: 'rect',
        animation: 'shimmer',
        width: '100%',
        height: 40,
        radius: 4
      };

      const css = manager.generateSkeletonCSS(config);

      expect(css).toContain('.skeleton');
      expect(css).toContain('background: linear-gradient');
      expect(css).toContain('animation:');
    });

    it('should include animation in CSS', () => {
      const config: SkeletonConfig = {
        type: 'rect',
        animation: 'pulse'
      };

      const css = manager.generateSkeletonCSS(config);

      expect(css).toContain('animation: skeleton-pulse');
    });

    it('should generate different CSS for different skeleton types', () => {
      const textConfig: SkeletonConfig = { type: 'text', lines: 3 };
      const circleConfig: SkeletonConfig = { type: 'circle', width: 40 };

      const textCSS = manager.generateSkeletonCSS(textConfig);
      const circleCSS = manager.generateSkeletonCSS(circleConfig);

      expect(textCSS).toContain('progressive-skeleton-text');
      expect(circleCSS).toContain('border-radius: 50%');
    });
  });

  describe('Visual Effects', () => {
    it('should create fade-in effect', () => {
      const effect = manager.createEffect('fade-in', { duration: 300 });

      expect(effect.type).toBe('fade-in');
      expect(effect.duration).toBe(300);
      expect(effect.easing).toBe('ease-in-out');
    });

    it('should create slide-in effect', () => {
      const effect = manager.createEffect('slide-in', { delay: 100 });

      expect(effect.type).toBe('slide-in');
      expect(effect.delay).toBe(100);
    });

    it('should create scale effect', () => {
      const effect = manager.createEffect('scale');

      expect(effect.type).toBe('scale');
      expect(effect.duration).toBe(300);
    });

    it('should create shimmer effect', () => {
      const effect = manager.createEffect('shimmer');

      expect(effect.type).toBe('shimmer');
    });

    it('should create pulse effect', () => {
      const effect = manager.createEffect('pulse');

      expect(effect.type).toBe('pulse');
    });

    it('should create spin effect', () => {
      const effect = manager.createEffect('spin');

      expect(effect.type).toBe('spin');
    });
  });

  describe('Visual Effect CSS', () => {
    it('should generate CSS for fade-in effect', () => {
      const effect = manager.createEffect('fade-in', { duration: 500 });

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('opacity: 0');
      expect(css).toContain('opacity: 1');
      expect(css).toContain('500ms');
    });

    it('should generate CSS for slide-in effect', () => {
      const effect = manager.createEffect('slide-in');

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('transform: translateY');
    });

    it('should generate CSS for scale effect', () => {
      const effect = manager.createEffect('scale');

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('transform: scale');
    });

    it('should generate CSS for shimmer effect', () => {
      const effect = manager.createEffect('shimmer');

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('::before');
      expect(css).toContain('linear-gradient');
    });

    it('should generate CSS for pulse effect', () => {
      const effect = manager.createEffect('pulse');

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('@keyframes pulse');
      expect(css).toContain('scale(');
    });

    it('should generate CSS for spin effect', () => {
      const effect = manager.createEffect('spin');

      const css = manager.generateEffectCSS(effect);

      expect(css).toContain('@keyframes spin');
      expect(css).toContain('rotate(');
    });
  });

  describe('Phase-Based Feedback', () => {
    it('should return effect for skeleton phase', () => {
      const effect = manager.getPhaseFeedback('skeleton');

      expect(effect.type).toBe('fade-in');
      expect(effect.duration).toBe(200);
    });

    it('should return effect for content phase', () => {
      const effect = manager.getPhaseFeedback('content');

      expect(effect.type).toBe('fade-in');
      expect(effect.delay).toBe(100);
    });

    it('should return effect for interactive phase', () => {
      const effect = manager.getPhaseFeedback('interactive');

      expect(effect.type).toBe('scale');
    });

    it('should return effect for complete phase', () => {
      const effect = manager.getPhaseFeedback('complete');

      expect(effect.type).toBe('shimmer');
      expect(effect.duration).toBe(500);
    });

    const phases: RenderPhase[] = ['skeleton', 'content', 'interactive', 'complete'];

    it.each(phases)('should handle %s phase', (phase) => {
      const effect = manager.getPhaseFeedback(phase);

      expect(effect).toBeDefined();
      expect(effect.type).toBeDefined();
    });
  });

  describe('Loading Indicators', () => {
    it('should generate spinner HTML', () => {
      const html = manager.generateLoadingIndicator('spinner');

      expect(html).toContain('progressive-loading-spinner');
      expect(html).toContain('svg');
      expect(html).toContain('animateTransform');
    });

    it('should generate dots HTML', () => {
      const html = manager.generateLoadingIndicator('dots');

      expect(html).toContain('progressive-loading-dots');
      expect(html).toContain('dot');
    });

    it('should generate bar HTML', () => {
      const html = manager.generateLoadingIndicator('bar');

      expect(html).toContain('progressive-loading-bar');
      expect(html).toContain('progressive-loading-bar-fill');
    });

    it('should generate different sizes for spinner', () => {
      const small = manager.generateLoadingIndicator('spinner', 'small');
      const medium = manager.generateLoadingIndicator('spinner', 'medium');
      const large = manager.generateLoadingIndicator('spinner', 'large');

      expect(small).toContain('width: 32');
      expect(medium).toContain('width: 48');
      expect(large).toContain('width: 64');
    });
  });

  describe('Loading Indicator CSS', () => {
    it('should generate loading indicator CSS', () => {
      const css = manager.getLoadingIndicatorCSS();

      expect(css).toContain('@keyframes progressive-spinner-dash');
      expect(css).toContain('@keyframes progressive-dot-bounce');
      expect(css).toContain('@keyframes progressive-bar-slide');
    });

    it('should include spinner animation', () => {
      const css = manager.getLoadingIndicatorCSS();

      expect(css).toContain('stroke-dasharray');
      expect(css).toContain('stroke-dashoffset');
    });

    it('should include dots animation', () => {
      const css = manager.getLoadingIndicatorCSS();

      expect(css).toContain('transform: scale');
    });

    it('should include bar animation', () => {
      const css = manager.getLoadingIndicatorCSS();

      expect(css).toContain('translateX');
    });
  });

  describe('Complete CSS Bundle', () => {
    it('should generate complete CSS bundle', () => {
      const css = manager.getCompleteCSS();

      expect(css).toContain('/* Skeleton Animations */');
      expect(css).toContain('/* Visual Effects */');
      expect(css).toContain('/* Loading Indicators */');
      expect(css).toContain('/* Progressive Enhancement */');
    });

    it('should include all effect types in complete CSS', () => {
      const css = manager.getCompleteCSS();

      const effectTypes: VisualEffectType[] = ['fade-in', 'fade-out', 'slide-in', 'slide-out', 'scale', 'shimmer', 'pulse', 'spin'];

      for (const effectType of effectTypes) {
        expect(css).toContain(`progressive-effect-${effectType}`);
      }
    });

    it('should include progressive phase classes', () => {
      const css = manager.getCompleteCSS();

      expect(css).toContain('progressive-phase-skeleton');
      expect(css).toContain('progressive-phase-content');
      expect(css).toContain('progressive-phase-interactive');
      expect(css).toContain('progressive-phase-complete');
    });
  });

  describe('Progressive Enhancement', () => {
    it('should apply progressive enhancement to element', () => {
      const element = document.createElement('div');
      const phase: RenderPhase = 'content';

      manager.applyProgressiveEnhancement(element, phase);

      expect(element.classList.contains(`progressive-phase-${phase}`)).toBe(true);
      expect(element.style.transition).toBeDefined();
    });

    it('should remove previous phase classes', () => {
      const element = document.createElement('div');

      manager.applyProgressiveEnhancement(element, 'skeleton');
      expect(element.classList.contains('progressive-phase-skeleton')).toBe(true);

      manager.applyProgressiveEnhancement(element, 'content');
      expect(element.classList.contains('progressive-phase-skeleton')).toBe(false);
      expect(element.classList.contains('progressive-phase-content')).toBe(true);
    });

    const phases: RenderPhase[] = ['skeleton', 'content', 'interactive', 'complete'];

    it.each(phases)('should apply %s phase class', (phase) => {
      const element = document.createElement('div');

      manager.applyProgressiveEnhancement(element, phase);

      expect(element.classList.contains(`progressive-phase-${phase}`)).toBe(true);
    });
  });

  describe('Effect Management', () => {
    it('should clear all active effects', () => {
      manager.clearEffects();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should return null for non-existent active effect', () => {
      const effect = manager.getActiveEffect('non-existent');

      expect(effect).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle custom skeleton options', () => {
      const config = manager.createSkeletonConfig('custom', {
        width: 500,
        height: 300,
        radius: 10,
        animation: 'wave',
        className: 'my-custom-class'
      });

      expect(config.width).toBe(500);
      expect(config.height).toBe(300);
      expect(config.radius).toBe(10);
      expect(config.animation).toBe('wave');
      expect(config.className).toBe('my-custom-class');
    });

    it('should handle custom effect options', () => {
      const effect = manager.createEffect('fade-in', {
        duration: 1000,
        delay: 500,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        className: 'custom-fade'
      });

      expect(effect.duration).toBe(1000);
      expect(effect.delay).toBe(500);
      expect(effect.easing).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
      expect(effect.className).toBe('custom-fade');
    });

    it('should handle unknown component type for skeleton', () => {
      const config = manager.createSkeletonConfig('unknown-type');

      expect(config).toBeDefined();
      expect(config.type).toBe('rect');
    });
  });

  describe('CSS Validity', () => {
    it('should generate valid CSS for skeleton animations', () => {
      const css = manager.getSkeletonAnimations();

      expect(css).toContain('@keyframes');
      expect(css).toContain('skeleton-pulse');
      expect(css).toContain('skeleton-wave');
      expect(css).toContain('skeleton-shimmer');
    });

    it('should generate valid CSS for all visual effects', () => {
      const effectTypes: VisualEffectType[] = ['fade-in', 'fade-out', 'slide-in', 'slide-out', 'scale', 'shimmer', 'pulse', 'spin'];

      for (const effectType of effectTypes) {
        const effect = manager.createEffect(effectType);
        const css = manager.generateEffectCSS(effect);

        expect(css).toBeTruthy();
        expect(css.length).toBeGreaterThan(0);
      }
    });
  });
});
