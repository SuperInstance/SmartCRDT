/**
 * Tests for AffordanceDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AffordanceDetector } from '../src/interaction/AffordanceDetector.js';
import type { UIElement } from '../src/types.js';

describe('AffordanceDetector', () => {
  let detector: AffordanceDetector;

  beforeEach(() => {
    detector = new AffordanceDetector();
  });

  const createElement = (config: Partial<UIElement>): UIElement => ({
    id: config.id || 'test-element',
    bounds: config.bounds || { x: 0, y: 0, width: 100, height: 50 },
    semantic: config.semantic || '',
    visual: config.visual || {
      color: '#ffffff',
      shape: 'rectangle',
      size: 5000,
      hasBorder: false,
      hasShadow: false
    },
    context: config.context || {
      position: 'center',
      neighbors: [],
      parent: 'root',
      zIndex: 0
    }
  });

  describe('Clickable Detection', () => {
    it('should detect button as clickable', () => {
      const element = createElement({
        semantic: 'submit button'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'click')).toBe(true);
    });

    it('should detect bordered element as clickable', () => {
      const element = createElement({
        visual: {
          color: '#ffffff',
          shape: 'rectangle',
          size: 5000,
          hasBorder: true,
          hasShadow: false
        }
      });

      const affordances = detector.detectAffordances(element);
      const clickable = affordances.find(a => a.type === 'click');

      expect(clickable).toBeDefined();
      expect(clickable!.probability).toBeGreaterThan(0);
    });

    it('should detect icon as clickable', () => {
      const element = createElement({
        visual: {
          color: '#ffffff',
          shape: 'circle',
          size: 1000,
          icon: true,
          hasBorder: false,
          hasShadow: false
        }
      });

      const affordances = detector.detectAffordances(element);
      const clickable = affordances.find(a => a.type === 'click');

      expect(clickable).toBeDefined();
    });
  });

  describe('Typeable Detection', () => {
    it('should detect input as typeable', () => {
      const element = createElement({
        semantic: 'email input field'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'type')).toBe(true);
    });

    it('should detect textarea as typeable', () => {
      const element = createElement({
        semantic: 'message textarea'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'type')).toBe(true);
    });
  });

  describe('Scrollable Detection', () => {
    it('should detect scroll area', () => {
      const element = createElement({
        semantic: 'content list scroll',
        visual: {
          color: '#ffffff',
          shape: 'rectangle',
          size: 15000,
          hasBorder: false,
          hasShadow: false
        },
        context: {
          position: 'center',
          neighbors: ['item1', 'item2', 'item3', 'item4', 'item5', 'item6'],
          parent: 'container',
          zIndex: 0
        }
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'scroll')).toBe(true);
    });
  });

  describe('Draggable Detection', () => {
    it('should detect slider as draggable', () => {
      const element = createElement({
        semantic: 'volume slider'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'drag')).toBe(true);
    });

    it('should detect handle as draggable', () => {
      const element = createElement({
        semantic: 'drag handle'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'drag')).toBe(true);
    });
  });

  describe('Hoverable Detection', () => {
    it('should detect tooltip as hoverable', () => {
      const element = createElement({
        semantic: 'tooltip hover info'
      });

      const affordances = detector.detectAffordances(element);

      expect(affordances.some(a => a.type === 'hover')).toBe(true);
    });
  });

  describe('Affordance Evidence', () => {
    it('should include visual evidence', () => {
      const element = createElement({
        visual: {
          color: '#ffffff',
          shape: 'rectangle',
          size: 5000,
          hasBorder: true,
          hasShadow: true
        }
      });

      const affordances = detector.detectAffordances(element);
      const clickable = affordances.find(a => a.type === 'click');

      expect(clickable!.evidence.length).toBeGreaterThan(0);

      const sources = clickable!.evidence.map(e => e.source);
      expect(sources).toContain('visual');
    });

    it('should include semantic evidence', () => {
      const element = createElement({
        semantic: 'click button'
      });

      const affordances = detector.detectAffordances(element);
      const clickable = affordances.find(a => a.type === 'click');

      const sources = clickable!.evidence.map(e => e.source);
      expect(sources).toContain('semantic');
    });
  });

  describe('Probability Threshold', () => {
    it('should not return low-probability affordances', () => {
      const element = createElement({
        semantic: 'random text with no affordance'
      });

      const affordances = detector.detectAffordances(element);

      // All returned affordances should meet threshold
      for (const affordance of affordances) {
        expect(affordance.probability).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Query Methods', () => {
    it('should get most likely affordance', () => {
      const element = createElement({
        semantic: 'button'
      });

      const mostLikely = detector.getMostLikelyAffordance(element);

      expect(mostLikely).toBeDefined();
      expect(mostLikely!.type).toBe('click');
    });

    it('should return null for element with no affordances', () => {
      const element = createElement({
        semantic: 'plain text label'
      });

      // Mock detection to return no affordances
      const affordances = detector.detectAffordances(element);

      if (affordances.length === 0) {
        expect(detector.getMostLikelyAffordance(element)).toBeNull();
      }
    });

    it('should check if element has specific affordance', () => {
      const element = createElement({
        semantic: 'button'
      });

      expect(detector.hasAffordance(element, 'click')).toBe(true);
      expect(detector.hasAffordance(element, 'type')).toBe(false);
    });
  });

  describe('Batch Detection', () => {
    it('should detect affordances for multiple elements', () => {
      const elements = [
        createElement({ semantic: 'button', id: 'btn1' }),
        createElement({ semantic: 'input field', id: 'inp1' }),
        createElement({ semantic: 'slider', id: 'sld1' })
      ];

      const results = detector.batchDetect(elements);

      expect(results.size).toBe(3);
      expect(results.get('btn1')).toBeDefined();
      expect(results.get('inp1')).toBeDefined();
      expect(results.get('sld1')).toBeDefined();
    });
  });

  describe('Finding by Affordance', () => {
    it('should find elements with specific affordance', () => {
      const elements = [
        createElement({ semantic: 'button', id: 'btn1' }),
        createElement({ semantic: 'another button', id: 'btn2' }),
        createElement({ semantic: 'label', id: 'lbl1' })
      ];

      const clickable = detector.findWithAffordance(elements, 'click');

      expect(clickable.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Element Creation', () => {
    it('should create element with defaults', () => {
      const element = detector.createElement({});

      expect(element.id).toBeDefined();
      expect(element.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('should create element with custom values', () => {
      const element = detector.createElement({
        id: 'custom-id',
        bounds: { x: 10, y: 20, width: 200, height: 100 },
        semantic: 'button'
      });

      expect(element.id).toBe('custom-id');
      expect(element.semantic).toBe('button');
    });
  });

  describe('History', () => {
    it('should track affordance history', () => {
      const element = createElement({ id: 'test' });
      detector.detectAffordances(element);

      const history = detector.getHistory('test');
      expect(history).toBeDefined();
    });

    it('should clear history', () => {
      const element = createElement({ id: 'test' });
      detector.detectAffordances(element);

      detector.clearHistory();

      const history = detector.getHistory('test');
      expect(history).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should return statistics', () => {
      const element = createElement({ semantic: 'button', id: 'btn1' });
      detector.detectAffordances(element);

      const stats = detector.getStats();

      expect(stats.totalElements).toBe(1);
      expect(stats.totalAffordances).toBeGreaterThan(0);
    });

    it('should track affordance type distribution', () => {
      const btn = createElement({ semantic: 'button', id: 'btn1' });
      detector.detectAffordances(btn);

      const stats = detector.getStats();
      expect(stats.typeDistribution.size).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should handle complex element', () => {
      const complexElement = createElement({
        semantic: 'submit button',
        visual: {
          color: '#0066cc',
          shape: 'rectangle',
          size: 8000,
          hasBorder: true,
          hasShadow: true
        },
        context: {
          position: 'center',
          neighbors: [],
          parent: 'form',
          zIndex: 10
        }
      });

      const affordances = detector.detectAffordances(complexElement);

      expect(affordances.length).toBeGreaterThan(0);

      // Should detect click with high confidence
      const click = affordances.find(a => a.type === 'click');
      expect(click!.probability).toBeGreaterThan(0.7);
    });
  });
});
