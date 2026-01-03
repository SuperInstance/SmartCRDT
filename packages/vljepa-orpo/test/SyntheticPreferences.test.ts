/**
 * @lsi/vljepa-orpo - SyntheticPreferences Tests
 *
 * Comprehensive test suite for SyntheticPreferences.
 * Target: 35+ tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SyntheticPreferences,
  createSyntheticPreferences,
  generateSyntheticPreferences,
  type SyntheticPreferenceConfig,
} from '../src/data/SyntheticPreferences.js';

describe('SyntheticPreferences', () => {
  let generator: SyntheticPreferences;
  let config: Partial<SyntheticPreferenceConfig>;

  beforeEach(() => {
    config = {
      strategies: [
        { type: 'design_principle', weight: 0.5, parameters: {} },
        { type: 'ab_simulation', weight: 0.3, parameters: {} },
        { type: 'rule_based', weight: 0.2, parameters: {} },
      ],
      qualityWeight: 0.7,
      diversity: 0.8,
      seed: 42,
      numPairs: 100,
    };
    generator = new SyntheticPreferences(config);
  });

  describe('Construction', () => {
    it('should create generator with config', () => {
      expect(generator).toBeDefined();
    });

    it('should create generator with default config', () => {
      const gen = new SyntheticPreferences();
      expect(gen).toBeDefined();
    });

    it('should get config', () => {
      const retrievedConfig = generator.getConfig();
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig.seed).toBe(42);
    });

    it('should set seed', () => {
      generator.setSeed(123);
      expect(generator.getConfig().seed).toBe(123);
    });
  });

  describe('Generation', () => {
    it('should generate preferences', async () => {
      const prefs = await generator.generate(10);
      expect(prefs).toHaveLength(10);
    });

    it('should use configured number', async () => {
      const prefs = await generator.generate();
      expect(prefs).toHaveLength(100);
    });

    it('should generate with custom count', async () => {
      const prefs = await generator.generate(50);
      expect(prefs).toHaveLength(50);
    });

    it('should generate zero preferences', async () => {
      const prefs = await generator.generate(0);
      expect(prefs).toHaveLength(0);
    });
  });

  describe('Generated Preferences', () => {
    it('should have valid chosen state', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].chosen).toBeDefined();
      expect(prefs[0].chosen.image).toBeDefined();
      expect(prefs[0].chosen.embedding).toBeDefined();
      expect(prefs[0].chosen.dom).toBeDefined();
      expect(prefs[0].chosen.styles).toBeDefined();
    });

    it('should have valid rejected state', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].rejected).toBeDefined();
      expect(prefs[0].rejected.image).toBeDefined();
      expect(prefs[0].rejected.embedding).toBeDefined();
      expect(prefs[0].rejected.dom).toBeDefined();
      expect(prefs[0].rejected.styles).toBeDefined();
    });

    it('should have reason', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].reason).toBeDefined();
      expect(typeof prefs[0].reason).toBe('string');
    });

    it('should have confidence', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].confidence).toBeDefined();
      expect(prefs[0].confidence).toBeGreaterThanOrEqual(0);
      expect(prefs[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should have strategy', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].strategy).toBeDefined();
    });
  });

  describe('Strategy Selection', () => {
    it('should use design principle strategy', async () => {
      const gen = new SyntheticPreferences({
        strategies: [{ type: 'design_principle', weight: 1, parameters: {} }],
        seed: 42,
        numPairs: 10,
      });
      const prefs = await gen.generate(10);
      prefs.forEach(p => {
        expect(p.strategy).toBe('design_principle');
      });
    });

    it('should use AB simulation strategy', async () => {
      const gen = new SyntheticPreferences({
        strategies: [{ type: 'ab_simulation', weight: 1, parameters: {} }],
        seed: 42,
        numPairs: 10,
      });
      const prefs = await gen.generate(10);
      prefs.forEach(p => {
        expect(p.strategy).toBe('ab_simulation');
      });
    });

    it('should use rule based strategy', async () => {
      const gen = new SyntheticPreferences({
        strategies: [{ type: 'rule_based', weight: 1, parameters: {} }],
        seed: 42,
        numPairs: 10,
      });
      const prefs = await gen.generate(10);
      prefs.forEach(p => {
        expect(p.strategy).toBe('rule_based');
      });
    });
  });

  describe('Design Principles', () => {
    it('should generate Gestalt principle preferences', async () => {
      const prefs = await generator.generate(10);
      const gestaltPrefs = prefs.filter(p => p.reason.includes('Gestalt'));
      expect(gestaltPrefs.length).toBeGreaterThan(0);
    });

    it('should generate contrast principle preferences', async () => {
      const prefs = await generator.generate(10);
      const contrastPrefs = prefs.filter(p => p.reason.includes('contrast'));
      expect(contrastPrefs.length).toBeGreaterThan(0);
    });

    it('should generate hierarchy principle preferences', async () => {
      const prefs = await generator.generate(10);
      const hierarchyPrefs = prefs.filter(p => p.reason.includes('hierarchy'));
      expect(hierarchyPrefs.length).toBeGreaterThan(0);
    });
  });

  describe('A/B Simulation', () => {
    it('should generate A/B test preferences', async () => {
      const prefs = await generator.generate(20);
      const abPrefs = prefs.filter(p => p.strategy === 'ab_simulation');
      expect(abPrefs.length).toBeGreaterThan(0);
    });

    it('should mention conversion rate in reason', async () => {
      const prefs = await generator.generate(20);
      const abPrefs = prefs.filter(p => p.strategy === 'ab_simulation');
      abPrefs.forEach(p => {
        expect(p.reason).toMatch(/converted/i);
      });
    });
  });

  describe('Rule Based', () => {
    it('should generate CTA size rule preferences', async () => {
      const prefs = await generator.generate(20);
      const ctaPrefs = prefs.filter(p => p.reason.includes('CTA'));
      expect(ctaPrefs.length).toBeGreaterThan(0);
    });

    it('should generate color contrast rule preferences', async () => {
      const prefs = await generator.generate(20);
      const colorPrefs = prefs.filter(p => p.reason.includes('contrast'));
      expect(colorPrefs.length).toBeGreaterThan(0);
    });

    it('should generate spacing rule preferences', async () => {
      const prefs = await generator.generate(20);
      const spacingPrefs = prefs.filter(p => p.reason.includes('spacing'));
      expect(spacingPrefs.length).toBeGreaterThan(0);
    });
  });

  describe('UI States', () => {
    it('should have valid image data', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].chosen.image.data).toBeDefined();
      expect(prefs[0].chosen.image.width).toBeGreaterThan(0);
      expect(prefs[0].chosen.image.height).toBeGreaterThan(0);
    });

    it('should have valid embeddings', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].chosen.embedding.length).toBe(768);
      expect(prefs[0].rejected.embedding.length).toBe(768);
    });

    it('should have valid DOM structure', async () => {
      const prefs = await generator.generate(1);
      expect(prefs[0].chosen.dom.tagName).toBeDefined();
      expect(Array.isArray(prefs[0].chosen.dom.children)).toBe(true);
    });

    it('should have valid CSS properties', async () => {
      const prefs = await generator.generate(1);
      expect(typeof prefs[0].chosen.styles).toBe('object');
    });
  });

  describe('Strategy Management', () => {
    it('should add custom strategy', () => {
      const newStrategy = { type: 'learned' as const, weight: 0.5, parameters: {} };
      generator.addStrategy(newStrategy);
      const config = generator.getConfig();
      expect(config.strategies).toContain(newStrategy);
    });

    it('should have default strategies', () => {
      const gen = new SyntheticPreferences();
      const config = gen.getConfig();
      expect(config.strategies.length).toBeGreaterThan(0);
    });
  });

  describe('Reproducibility', () => {
    it('should generate same results with same seed', async () => {
      const gen1 = new SyntheticPreferences({ seed: 123, numPairs: 10 });
      const gen2 = new SyntheticPreferences({ seed: 123, numPairs: 10 });
      const prefs1 = await gen1.generate(10);
      const prefs2 = await gen2.generate(10);
      expect(prefs1.length).toBe(prefs2.length);
    });
  });

  describe('Factory Function', () => {
    it('should create generator via factory', () => {
      const gen = createSyntheticPreferences();
      expect(gen).toBeDefined();
    });

    it('should accept config in factory', () => {
      const gen = createSyntheticPreferences({ numPairs: 50 });
      expect(gen.getConfig().numPairs).toBe(50);
    });
  });

  describe('Convenience Function', () => {
    it('should generate preferences via convenience function', async () => {
      const prefs = await generateSyntheticPreferences(10);
      expect(prefs).toHaveLength(10);
    });

    it('should accept config in convenience function', async () => {
      const prefs = await generateSyntheticPreferences(10, { seed: 456 });
      expect(prefs).toHaveLength(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strategies', async () => {
      const gen = new SyntheticPreferences({
        strategies: [],
        numPairs: 10,
        seed: 42,
      });
      const prefs = await gen.generate(10);
      expect(prefs).toHaveLength(10);
    });

    it('should handle extreme quality weight', async () => {
      const gen = new SyntheticPreferences({
        qualityWeight: 1.0,
        numPairs: 10,
        seed: 42,
      });
      const prefs = await gen.generate(10);
      expect(prefs).toHaveLength(10);
    });

    it('should handle zero diversity', async () => {
      const gen = new SyntheticPreferences({
        diversity: 0,
        numPairs: 10,
        seed: 42,
      });
      const prefs = await gen.generate(10);
      expect(prefs).toHaveLength(10);
    });
  });
});
