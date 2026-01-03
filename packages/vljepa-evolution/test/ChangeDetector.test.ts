/**
 * ChangeDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeDetector } from '../src/tracker/ChangeDetector.js';
import type { UIState } from '../src/types.js';

describe('ChangeDetector', () => {
  let detector: ChangeDetector;
  let mockState: UIState;

  beforeEach(() => {
    detector = new ChangeDetector({
      visual: true,
      structural: true,
      behavioral: true,
      semantic: true,
      threshold: 0.3
    });

    mockState = {
      components: [
        {
          id: 'comp1',
          type: 'button',
          props: { label: 'Click me' },
          children: [],
          styles: { backgroundColor: 'blue', color: 'white' }
        }
      ],
      styles: {
        css: { primaryColor: 'blue', secondaryColor: 'gray' },
        theme: 'dark',
        variables: {}
      },
      layout: {
        type: 'flex',
        dimensions: { width: 100, height: 50 },
        position: { top: 0, left: 0 },
        children: []
      },
      behavior: {
        events: [
          { event: 'click', handler: 'onClick' },
          { event: 'hover', handler: 'onHover' }
        ],
        actions: [{ type: 'navigate', payload: { to: '/home' } }],
        stateMachine: undefined
      },
      metadata: {
        version: '1.0.0',
        timestamp: Date.now(),
        hash: 'abc123',
        author: 'test'
      }
    };
  });

  describe('initialization', () => {
    it('should create detector with default config', () => {
      const defaultDetector = new ChangeDetector();
      expect(defaultDetector).toBeDefined();
    });

    it('should create detector with custom config', () => {
      const customDetector = new ChangeDetector({
        visual: false,
        structural: true,
        threshold: 0.5
      });
      expect(customDetector).toBeDefined();
    });
  });

  describe('detectChanges', () => {
    it('should detect all changes', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';
      newState.layout.type = 'grid';

      const changes = detector.detectChanges(mockState, newState);

      expect(changes.length).toBeGreaterThan(0);
    });

    it('should return empty array for identical states', () => {
      const changes = detector.detectChanges(mockState, mockState);
      expect(changes).toHaveLength(0);
    });

    it('should only detect enabled change types', () => {
      const visualOnlyDetector = new ChangeDetector({
        visual: true,
        structural: false,
        behavioral: false,
        semantic: false
      });

      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const changes = visualOnlyDetector.detectChanges(mockState, newState);
      expect(changes.length).toBeGreaterThan(0);
    });
  });

  describe('detectVisualChanges', () => {
    it('should detect style changes', () => {
      const newState = { ...mockState };
      newState.styles.css.primaryColor = 'red';

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('primaryColor'))).toBe(true);
    });

    it('should detect theme changes', () => {
      const newState = { ...mockState };
      newState.styles.theme = 'light';

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('Theme'))).toBe(true);
    });

    it('should detect layout type changes', () => {
      const newState = { ...mockState };
      newState.layout.type = 'grid';

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('Layout type'))).toBe(true);
    });

    it('should detect dimension changes', () => {
      const newState = { ...mockState };
      newState.layout.dimensions.width = 200;

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.path.includes('dimensions'))).toBe(true);
    });

    it('should detect position changes', () => {
      const newState = { ...mockState };
      newState.layout.position.top = 10;

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.path.includes('position'))).toBe(true);
    });

    it('should detect component style changes', () => {
      const newState = { ...mockState };
      newState.components[0].styles.backgroundColor = 'red';

      const changes = detector.detectVisualChanges(mockState, newState);

      expect(changes.some(c => c.path.includes('comp1'))).toBe(true);
    });
  });

  describe('detectStructuralChanges', () => {
    it('should detect added components', () => {
      const newState = { ...mockState };
      newState.components = [
        ...mockState.components,
        {
          id: 'comp2',
          type: 'text',
          props: { text: 'Hello' },
          children: [],
          styles: {}
        }
      ];

      const changes = detector.detectStructuralChanges(mockState, newState);

      expect(changes.some(c => c.type === 'structural' && c.description.includes('added'))).toBe(true);
    });

    it('should detect removed components', () => {
      const newState = { ...mockState };
      newState.components = [];

      const changes = detector.detectStructuralChanges(mockState, newState);

      expect(changes.some(c => c.type === 'structural' && c.description.includes('removed'))).toBe(true);
    });

    it('should detect component moves', () => {
      const newState = { ...mockState };
      newState.components[0].id = 'comp2';

      const changes = detector.detectStructuralChanges(mockState, newState);

      expect(changes.some(c => c.type === 'structural')).toBe(true);
    });
  });

  describe('detectBehavioralChanges', () => {
    it('should detect added events', () => {
      const newState = { ...mockState };
      newState.behavior.events = [
        ...mockState.behavior.events,
        { event: 'focus', handler: 'onFocus' }
      ];

      const changes = detector.detectBehavioralChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('added'))).toBe(true);
    });

    it('should detect removed events', () => {
      const newState = { ...mockState };
      newState.behavior.events = [];

      const changes = detector.detectBehavioralChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('removed'))).toBe(true);
    });

    it('should detect added actions', () => {
      const newState = { ...mockState };
      newState.behavior.actions = [
        ...mockState.behavior.actions,
        { type: 'submit', payload: {} }
      ];

      const changes = detector.detectBehavioralChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('added'))).toBe(true);
    });

    it('should detect removed actions', () => {
      const newState = { ...mockState };
      newState.behavior.actions = [];

      const changes = detector.detectBehavioralChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('removed'))).toBe(true);
    });

    it('should detect state machine additions', () => {
      const newState = { ...mockState };
      newState.behavior.stateMachine = {
        initialState: 'idle',
        states: {
          idle: { onEntry: [], onExit: [], actions: [] }
        },
        transitions: {}
      };

      const changes = detector.detectBehavioralChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('State machine added'))).toBe(true);
    });

    it('should detect state machine removals', () => {
      const stateWithMachine = { ...mockState };
      stateWithMachine.behavior.stateMachine = {
        initialState: 'idle',
        states: { idle: { onEntry: [], onExit: [], actions: [] } },
        transitions: {}
      };

      const newState = { ...mockState };

      const changes = detector.detectBehavioralChanges(stateWithMachine, newState);

      expect(changes.some(c => c.description.includes('State machine removed'))).toBe(true);
    });
  });

  describe('detectSemanticChanges', () => {
    it('should detect new component types', () => {
      const newState = { ...mockState };
      newState.components = [
        ...mockState.components,
        { id: 'comp2', type: 'slider', props: {}, children: [], styles: {} }
      ];

      const changes = detector.detectSemanticChanges(mockState, newState);

      expect(changes.some(c => c.type === 'semantic')).toBe(true);
    });

    it('should detect removed component types', () => {
      const newState = { ...mockState };
      newState.components = [];

      const changes = detector.detectSemanticChanges(mockState, newState);

      expect(changes.some(c => c.type === 'semantic')).toBe(true);
    });

    it('should detect interaction pattern changes', () => {
      const newState = { ...mockState };
      newState.behavior.events = [
        { event: 'drag', handler: 'onDrag' }
      ];

      const changes = detector.detectSemanticChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('pattern'))).toBe(true);
    });

    it('should detect accessibility prop changes', () => {
      const newState = { ...mockState };
      newState.components[0].props = {
        ...mockState.components[0].props,
        'aria-label': 'Click button'
      };

      const changes = detector.detectSemanticChanges(mockState, newState);

      expect(changes.some(c => c.description.includes('Accessibility'))).toBe(true);
    });
  });

  describe('calculateSeverity', () => {
    it('should return breaking for deletions', () => {
      const changes = [
        { type: 'structural' as const, severity: 'breaking' as const, description: '', confidence: 1, before: null, after: null }
      ];

      const severity = detector.calculateSeverity(changes);
      expect(severity).toBe('breaking');
    });

    it('should return major for major changes', () => {
      const changes = [
        { type: 'visual' as const, severity: 'major' as const, description: '', confidence: 1, before: null, after: null }
      ];

      const severity = detector.calculateSeverity(changes);
      expect(severity).toBe('major');
    });

    it('should return minor for minor changes', () => {
      const changes = [
        { type: 'visual' as const, severity: 'minor' as const, description: '', confidence: 1, before: null, after: null }
      ];

      const severity = detector.calculateSeverity(changes);
      expect(severity).toBe('minor');
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0 for no changes', () => {
      const confidence = detector.calculateConfidence([]);
      expect(confidence).toBe(0);
    });

    it('should calculate average confidence', () => {
      const changes = [
        { type: 'visual' as const, severity: 'minor' as const, description: '', confidence: 0.5, before: null, after: null },
        { type: 'visual' as const, severity: 'minor' as const, description: '', confidence: 1.0, before: null, after: null }
      ];

      const confidence = detector.calculateConfidence(changes);
      expect(confidence).toBe(0.75);
    });
  });

  describe('edge cases', () => {
    it('should handle empty components', () => {
      const emptyState: UIState = {
        ...mockState,
        components: []
      };

      const changes = detector.detectChanges(mockState, emptyState);
      expect(changes.length).toBeGreaterThan(0);
    });

    it('should handle missing state machine', () => {
      const changes = detector.detectChanges(mockState, mockState);
      expect(changes).toBeDefined();
    });

    it('should handle deep nesting', () => {
      const nestedState: UIState = {
        ...mockState,
        components: [
          {
            id: 'comp1',
            type: 'container',
            props: {},
            children: [
              {
                id: 'comp2',
                type: 'button',
                props: {},
                children: [],
                styles: {}
              }
            ],
            styles: {}
          }
        ]
      };

      const changes = detector.detectChanges(mockState, nestedState);
      expect(changes).toBeDefined();
    });
  });
});
