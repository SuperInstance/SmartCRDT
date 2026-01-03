/**
 * A2UI Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { A2UIProgressiveConverter } from '../src/a2ui.js';
import type { A2UIComponent, A2UILayout, A2UIResponse, RenderStrategy } from '../src/types.js';

describe('A2UIProgressiveConverter', () => {
  let converter: A2UIProgressiveConverter;

  beforeEach(() => {
    converter = new A2UIProgressiveConverter();
  });

  afterEach(() => {
    converter.clearCache();
  });

  describe('Response Conversion', () => {
    it('should convert A2UI response to chunks', () => {
      const response: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: [
          {
            type: 'text',
            id: 'text-1',
            props: { text: 'Hello World' }
          }
        ]
      };

      const chunks = converter.convertResponseToChunks(response, 'critical-first');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('chunk_id');
      expect(chunks[0]).toHaveProperty('phase');
      expect(chunks[0]).toHaveProperty('content');
      expect(chunks[0]).toHaveProperty('priority');
    });

    it('should include layout chunk when layout is present', () => {
      const response: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: [],
        layout: {
          type: 'vertical',
          spacing: 16
        }
      };

      const chunks = converter.convertResponseToChunks(response, 'top-down');

      const layoutChunk = chunks.find(c => c.content.type === 'layout');
      expect(layoutChunk).toBeDefined();
      expect(layoutChunk?.priority).toBe(100); // Layout is high priority
    });

    it('should convert multiple components', () => {
      const response: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: [
          {
            type: 'text',
            id: 'text-1',
            props: { text: 'First' }
          },
          {
            type: 'button',
            id: 'button-1',
            props: { label: 'Click Me' }
          },
          {
            type: 'input',
            id: 'input-1',
            props: { placeholder: 'Enter text' }
          }
        ]
      };

      const chunks = converter.convertResponseToChunks(response, 'streaming');

      expect(chunks.length).toBeGreaterThan(3); // Skeleton + content for each
    });
  });

  describe('Component Conversion', () => {
    it('should convert single component to chunks', () => {
      const component: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Test' }
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');

      expect(chunks.length).toBeGreaterThan(0);

      // Should have skeleton
      const skeleton = chunks.find(c => c.phase === 'skeleton');
      expect(skeleton).toBeDefined();

      // Should have content
      const content = chunks.find(c => c.phase === 'content');
      expect(content).toBeDefined();
      expect(content?.content.type).toBe('component');
    });

    it('should convert nested components', () => {
      const component: A2UIComponent = {
        type: 'container',
        id: 'container-1',
        props: {},
        children: [
          {
            type: 'text',
            id: 'text-1',
            props: { text: 'Child 1' }
          },
          {
            type: 'text',
            id: 'text-2',
            props: { text: 'Child 2' }
          }
        ]
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'top-down');

      // Should have chunks for parent and children
      expect(chunks.length).toBeGreaterThan(2);

      // Check parent-child relationships
      const parentChunk = chunks.find(c => c.chunk_id.includes(component.id));
      expect(parentChunk?.child_ids).toBeDefined();
      expect(parentChunk?.child_ids?.length).toBe(2);
    });

    it('should set parent references for children', () => {
      const component: A2UIComponent = {
        type: 'container',
        id: 'parent',
        props: {},
        children: [
          {
            type: 'text',
            id: 'child',
            props: { text: 'Child' }
          }
        ]
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'top-down');

      const childChunks = chunks.filter(c => c.parent_id === component.id);
      expect(childChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Priority Calculation', () => {
    it('should calculate higher priority for critical components', () => {
      const criticalComponent: A2UIComponent = {
        type: 'alert',
        id: 'alert-1',
        props: { message: 'Critical!' }
      };

      const normalComponent: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Normal' }
      };

      const criticalPriority = converter.calculatePriority(criticalComponent, 'content');
      const normalPriority = converter.calculatePriority(normalComponent, 'content');

      expect(criticalPriority).toBeGreaterThan(normalPriority);
    });

    it('should prioritize skeleton phase', () => {
      const component: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Test' }
      };

      const skeletonPriority = converter.calculatePriority(component, 'skeleton');
      const contentPriority = converter.calculatePriority(component, 'content');

      expect(skeletonPriority).toBeGreaterThan(contentPriority);
    });

    it('should assign priority based on component type', () => {
      const button: A2UIComponent = {
        type: 'button',
        id: 'button-1',
        props: { label: 'Click' }
      };

      const text: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Text' }
      };

      const buttonPriority = converter.calculatePriority(button, 'content');
      const textPriority = converter.calculatePriority(text, 'content');

      expect(buttonPriority).not.toBe(textPriority);
    });

    it('should boost priority for fixed/sticky positioned elements', () => {
      const fixedComponent: A2UIComponent = {
        type: 'button',
        id: 'fixed-btn',
        props: { label: 'Fixed' },
        style: { position: 'fixed', top: '0' }
      };

      const normalComponent: A2UIComponent = {
        type: 'button',
        id: 'normal-btn',
        props: { label: 'Normal' }
      };

      const fixedPriority = converter.calculatePriority(fixedComponent, 'content');
      const normalPriority = converter.calculatePriority(normalComponent, 'content');

      expect(fixedPriority).toBeGreaterThan(normalPriority);
    });
  });

  describe('Component Versioning', () => {
    it('should increment component version on modifications', () => {
      const componentId = 'test-component';

      const version1 = converter.getComponentVersion(componentId);
      const version2 = converter.getComponentVersion(componentId);
      const version3 = converter.getComponentVersion(componentId);

      expect(version2).toBe(version1 + 1);
      expect(version3).toBe(version2 + 1);
    });

    it('should reset component version', () => {
      const componentId = 'test-component';

      converter.getComponentVersion(componentId);
      converter.getComponentVersion(componentId);
      converter.resetComponentVersion(componentId);

      const version = converter.getComponentVersion(componentId);

      expect(version).toBe(1);
    });
  });

  describe('Skeleton Configuration', () => {
    it('should create text skeleton', () => {
      const component: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Test text', lines: 3 }
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');
      const skeleton = chunks.find(c => c.phase === 'skeleton');

      expect(skeleton?.content.type).toBe('skeleton');
      if (skeleton?.content.type === 'skeleton') {
        expect(skeleton.content.data.type).toBe('text');
        expect(skeleton.content.data.lines).toBe(3);
      }
    });

    it('should create button skeleton', () => {
      const component: A2UIComponent = {
        type: 'button',
        id: 'button-1',
        props: { label: 'Click' }
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');
      const skeleton = chunks.find(c => c.phase === 'skeleton');

      expect(skeleton?.content.type).toBe('skeleton');
      if (skeleton?.content.type === 'skeleton') {
        expect(skeleton.content.data.type).toBe('rect');
      }
    });

    it('should create image skeleton', () => {
      const component: A2UIComponent = {
        type: 'image',
        id: 'image-1',
        props: { src: 'test.jpg', width: 200, height: 200 }
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');
      const skeleton = chunks.find(c => c.phase === 'skeleton');

      expect(skeleton?.content.type).toBe('skeleton');
      if (skeleton?.content.type === 'skeleton') {
        expect(skeleton.content.data.type).toBe('rect');
      }
    });
  });

  describe('Chunk Sorting', () => {
    it('should sort by critical-first strategy', () => {
      const component: A2UIComponent = {
        type: 'container',
        id: 'container-1',
        props: {},
        children: [
          {
            type: 'text',
            id: 'text-1',
            props: { text: 'Normal' }
          },
          {
            type: 'alert',
            id: 'alert-1',
            props: { message: 'Critical!' }
          }
        ]
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');

      // Critical chunks should come first
      const criticalIndex = chunks.findIndex(c => c.critical);
      const normalIndex = chunks.findIndex(c => !c.critical && c.phase === 'content');

      expect(criticalIndex).toBeLessThan(normalIndex);
    });

    it('should sort by top-down strategy', () => {
      const component: A2UIComponent = {
        type: 'container',
        id: 'parent',
        props: {},
        children: [
          {
            type: 'text',
            id: 'child',
            props: { text: 'Child' }
          }
        ]
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'top-down');

      // Parent should come before children
      const parentIndex = chunks.findIndex(c => c.chunk_id.includes('parent'));
      const childIndex = chunks.findIndex(c => c.chunk_id.includes('child'));

      expect(parentIndex).toBeLessThan(childIndex);
    });
  });

  describe('Cache Management', () => {
    it('should cache priority calculations', () => {
      const component: A2UIComponent = {
        type: 'text',
        id: 'text-1',
        props: { text: 'Test' }
      };

      const priority1 = converter.calculatePriority(component, 'content');
      const priority2 = converter.calculatePriority(component, 'content');

      expect(priority1).toBe(priority2);
    });

    it('should provide cache statistics', () => {
      converter.getComponentVersion('comp-1');
      converter.calculatePriority({ type: 'text', id: 'text-1', props: {} }, 'content');

      const stats = converter.getCacheStats();

      expect(stats.versions).toBeGreaterThan(0);
      expect(stats.priorities).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      converter.getComponentVersion('comp-1');
      converter.clearCache();

      const stats = converter.getCacheStats();

      expect(stats.versions).toBe(0);
      expect(stats.priorities).toBe(0);
    });
  });

  describe('Render Strategies', () => {
    const strategies: RenderStrategy[] = ['top-down', 'critical-first', 'lazy', 'streaming'];

    it.each(strategies)('should support %s strategy', (strategy) => {
      const response: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: [
          {
            type: 'text',
            id: 'text-1',
            props: { text: 'Test' }
          }
        ]
      };

      const chunks = converter.convertResponseToChunks(response, strategy);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.metadata.strategy === strategy || c.metadata.strategy === 'critical-first')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty component array', () => {
      const response: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: []
      };

      const chunks = converter.convertResponseToChunks(response, 'streaming');

      expect(chunks).toEqual([]);
    });

    it('should handle deeply nested components', () => {
      const deepComponent: A2UIComponent = {
        type: 'container',
        id: 'level-1',
        props: {},
        children: [
          {
            type: 'container',
            id: 'level-2',
            props: {},
            children: [
              {
                type: 'container',
                id: 'level-3',
                props: {},
                children: [
                  {
                    type: 'text',
                    id: 'deep-text',
                    props: { text: 'Deep' }
                  }
                ]
              }
            ]
          }
        ]
      };

      const chunks = converter.convertComponentToChunks(deepComponent, 'test-component', 'top-down');

      // Should create chunks for all levels
      expect(chunks.length).toBeGreaterThan(3);
    });

    it('should handle component with no props', () => {
      const component: A2UIComponent = {
        type: 'divider',
        id: 'divider-1'
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'critical-first');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle component with custom type', () => {
      const component: A2UIComponent = {
        type: 'custom-widget',
        id: 'widget-1',
        props: { customProp: 'value' }
      };

      const chunks = converter.convertComponentToChunks(component, 'test-component', 'streaming');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.metadata.content_type === 'custom-widget')).toBe(true);
    });
  });
});
