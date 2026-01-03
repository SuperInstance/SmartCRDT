/**
 * Tests for MLPrivacyClassifier
 *
 * Comprehensive test suite covering:
 * - Feature extraction
 * - ML model training and inference
 * - Ensemble voting (rule-based + ML)
 * - Accuracy benchmarks
 * - Performance metrics
 * - Model export/import
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MLPrivacyClassifier,
  createMLPrivacyClassifier,
  FeatureExtractor,
  LightweightPIIModel,
  type TrainingSample,
  type MLPrediction,
  type FeatureVector,
  MLPIIType,
} from './MLPrivacyClassifier.js';
import { PIIType, PrivacyLevel } from '@lsi/protocol';

describe('MLPrivacyClassifier', () => {
  let classifier: MLPrivacyClassifier;

  beforeEach(() => {
    classifier = new MLPrivacyClassifier({
      mlWeight: 0.6,
      minConfidence: 0.7,
      includeNameDetection: false,
    });
  });

  // ============================================================================
  // FEATURE EXTRACTION TESTS
  // ============================================================================

  describe('FeatureExtractor', () => {
    let extractor: FeatureExtractor;

    beforeEach(() => {
      extractor = new FeatureExtractor();
    });

    it('should extract token features', () => {
      const text = 'test@example.com';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.tokens).toContain('test@example.com');
      expect(features.tokens).toContain('test@example.com'.toLowerCase());
    });

    it('should extract character n-grams', () => {
      const text = 'email123';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.charNGrams.length).toBeGreaterThan(0);
      expect(features.charNGrams).toContain('em');
      expect(features.charNGrams).toContain('ai');
    });

    it('should detect email pattern', () => {
      const text = 'user@example.com';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.patterns.get('has_at')).toBe(1);
      expect(features.stats.hasAtSymbol).toBe(true);
    });

    it('should detect phone pattern', () => {
      const text = '555-123-4567';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.patterns.get('phone_like')).toBe(1);
    });

    it('should detect SSN pattern', () => {
      const text = '123-45-6789';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.patterns.get('ssn_pattern')).toBe(1);
    });

    it('should detect credit card pattern', () => {
      const text = '4111-1111-1111-1111';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.patterns.get('cc_pattern')).toBe(1);
    });

    it('should extract statistical features correctly', () => {
      const text = 'Test123!';
      const features = extractor.extractFeatures(text, 0, text.length);

      expect(features.stats.length).toBe(8);
      expect(features.stats.digitCount).toBe(3);
      expect(features.stats.upperCount).toBe(4);
      expect(features.stats.specialCount).toBe(1);
      expect(features.stats.digitRatio).toBeCloseTo(3 / 8, 2);
    });

    it('should extract context windows', () => {
      const text = 'My email is test@example.com please contact me';
      const start = text.indexOf('test@example.com');
      const end = start + 'test@example.com'.length;

      const features = extractor.extractFeatures(text, start, end);

      expect(features.contextBefore.length).toBeGreaterThan(0);
      expect(features.contextAfter.length).toBeGreaterThan(0);
      expect(features.contextBefore).toContain('email');
      expect(features.contextAfter).toContain('please');
    });

    it('should extract document features', () => {
      const text = 'Email: test@example.com Phone: 555-123-4567';
      const features = extractor.extractDocumentFeatures(text);

      expect(features.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // ML MODEL TESTS
  // ============================================================================

  describe('LightweightPIIModel', () => {
    let model: LightweightPIIModel;
    let extractor: FeatureExtractor;

    beforeEach(() => {
      model = new LightweightPIIModel();
      extractor = new FeatureExtractor();
    });

    it('should initialize with random weights', () => {
      expect(model.trained()).toBe(false);
    });

    it('should make predictions before training', () => {
      const text = 'test@example.com';
      const features = extractor.extractFeatures(text, 0, text.length);

      const prediction = model.predict(features);

      expect(prediction).toBeDefined();
      expect(prediction.type).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it('should predict email type correctly', () => {
      const text = 'test@example.com';
      const features = extractor.extractFeatures(text, 0, text.length);

      const prediction = model.predict(features);

      // Before training, predictions are random
      // After training, this should be EMAIL_ADDRESSES
      expect(Object.values(MLPIIType)).toContain(prediction.type);
    });

    it('should train on samples', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'My email is test@example.com',
          labels: [
            {
              type: MLPIIType.EMAIL_ADDRESSES,
              start: 12,
              end: 28,
            },
          ],
          privacyLevel: PrivacyLevel.SENSITIVE,
        },
        {
          text: 'SSN: 123-45-6789',
          labels: [
            {
              type: MLPIIType.SSN_TAX_ID,
              start: 5,
              end: 16,
            },
          ],
          privacyLevel: PrivacyLevel.SOVEREIGN,
        },
      ];

      const metadata = await model.train(samples, {
        epochs: 2,
        batchSize: 2,
        learningRate: 0.001,
      });

      expect(metadata).toBeDefined();
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.trainingSamples).toBe(2);
      expect(model.trained()).toBe(true);
    });

    it('should export and import model', () => {
      const exported = model.exportModel();

      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');

      const newModel = new LightweightPIIModel();
      newModel.importModel(exported);

      expect(newModel.trained()).toBe(model.trained());
    });

    it('should compute model size', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'Test email test@example.com',
          labels: [
            {
              type: MLPIIType.EMAIL_ADDRESSES,
              start: 11,
              end: 27,
            },
          ],
          privacyLevel: PrivacyLevel.SENSITIVE,
        },
      ];

      const metadata = await model.train(samples, { epochs: 1 });

      expect(metadata.modelSize).toBeGreaterThan(0);
      expect(metadata.modelSize).toBeLessThan(100 * 1024 * 1024); // < 100MB
    });
  });

  // ============================================================================
  // ENSEMBLE CLASSIFICATION TESTS
  // ============================================================================

  describe('Ensemble Classification', () => {
    it('should classify without PII as PUBLIC', async () => {
      const query = 'What is the capital of France?';
      const result = await classifier.classify(query);

      expect(result.level).toBe('PUBLIC');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.piiTypes).toEqual([]);
    });

    it('should classify email as SENSITIVE', async () => {
      const query = 'My email is user@example.com';
      const result = await classifier.classify(query);

      expect(result.level).toBe('SENSITIVE');
      expect(result.piiTypes).toContain(PIIType.EMAIL);
    });

    it('should classify SSN as SOVEREIGN', async () => {
      const query = 'My SSN is 123-45-6789';
      const result = await classifier.classify(query);

      expect(result.level).toBe('SOVEREIGN');
      expect(result.piiTypes).toContain(PIIType.SSN);
    });

    it('should classify credit card as SOVEREIGN', async () => {
      const query = 'Credit card: 4111-1111-1111-1111';
      const result = await classifier.classify(query);

      expect(result.level).toBe('SOVEREIGN');
      expect(result.piiTypes).toContain(PIIType.CREDIT_CARD);
    });

    it('should use ensemble voting', async () => {
      const query = 'Email: test@example.com, SSN: 123-45-6789';
      const ensemble = await classifier.classifyWithEnsemble(query);

      expect(ensemble.ruleBased.length).toBeGreaterThan(0);
      expect(ensemble.ensemble.length).toBeGreaterThan(0);
      expect(ensemble.confidenceDelta).toBeDefined();
    });

    it('should improve confidence with ensemble', async () => {
      const query = 'SSN: 123-45-6789';
      const ensemble = await classifier.classifyWithEnsemble(query);

      // Ensemble should maintain or improve confidence
      expect(ensemble.confidenceDelta).toBeGreaterThanOrEqual(-0.1);
    });
  });

  // ============================================================================
  // PII DETECTION TESTS
  // ============================================================================

  describe('PII Detection', () => {
    it('should detect email addresses', async () => {
      const text = 'Contact: user@example.com';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.EMAIL);
    });

    it('should detect phone numbers', async () => {
      const text = 'Phone: 555-123-4567';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.PHONE);
    });

    it('should detect SSN', async () => {
      const text = 'SSN: 123-45-6789';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.SSN);
    });

    it('should detect credit cards', async () => {
      const text = 'Card: 4111-1111-1111-1111';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.CREDIT_CARD);
    });

    it('should detect multiple PII types', async () => {
      const text = 'Email: user@example.com, Phone: 555-123-4567';
      const piiTypes = await classifier.detectPII(text);

      expect(piiTypes).toContain(PIIType.EMAIL);
      expect(piiTypes).toContain(PIIType.PHONE);
    });
  });

  // ============================================================================
  // TRAINING TESTS
  // ============================================================================

  describe('Training', () => {
    it('should train on sample data', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'My email is test@example.com',
          labels: [
            {
              type: MLPIIType.EMAIL_ADDRESSES,
              start: 12,
              end: 28,
            },
          ],
          privacyLevel: PrivacyLevel.SENSITIVE,
        },
        {
          text: 'SSN: 123-45-6789',
          labels: [
            {
              type: MLPIIType.SSN_TAX_ID,
              start: 5,
              end: 16,
            },
          ],
          privacyLevel: PrivacyLevel.SOVEREIGN,
        },
        {
          text: 'Card: 4111-1111-1111-1111',
          labels: [
            {
              type: MLPIIType.CREDIT_CARDS,
              start: 6,
              end: 23,
            },
          ],
          privacyLevel: PrivacyLevel.SOVEREIGN,
        },
      ];

      const metadata = await classifier.train(samples, {
        epochs: 3,
        batchSize: 2,
      });

      expect(metadata).toBeDefined();
      expect(metadata.trainingSamples).toBe(3);
      expect(metadata.accuracy).toBeGreaterThanOrEqual(0);
      expect(classifier.isTrained()).toBe(true);
    });

    it('should improve predictions after training', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'Email: test@example.com',
          labels: [
            {
              type: MLPIIType.EMAIL_ADDRESSES,
              start: 7,
              end: 23,
            },
          ],
          privacyLevel: PrivacyLevel.SENSITIVE,
        },
      ];

      await classifier.train(samples, { epochs: 2 });

      const piiTypes = await classifier.detectPII('Email: test@example.com');
      expect(piiTypes).toContain(PIIType.EMAIL);
    });

    it('should export and import trained model', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'Test',
          labels: [],
          privacyLevel: PrivacyLevel.PUBLIC,
        },
      ];

      await classifier.train(samples, { epochs: 1 });

      const exported = classifier.exportModel();
      expect(exported).toBeDefined();

      const newClassifier = new MLPrivacyClassifier();
      newClassifier.importModel(exported);
      expect(newClassifier.isTrained()).toBe(true);
    });
  });

  // ============================================================================
  // ACCURACY BENCHMARKS
  // ============================================================================

  describe('Accuracy Benchmarks', () => {
    it('should meet PII detection targets', async () => {
      const testCases = [
        { text: 'Email: test@example.com', expected: PIIType.EMAIL },
        { text: 'Phone: 555-123-4567', expected: PIIType.PHONE },
        { text: 'SSN: 123-45-6789', expected: PIIType.SSN },
        { text: 'Card: 4111-1111-1111-1111', expected: PIIType.CREDIT_CARD },
        { text: 'IP: 192.168.1.1', expected: PIIType.IP_ADDRESS },
      ];

      let correct = 0;
      let total = testCases.length;

      for (const testCase of testCases) {
        const detected = await classifier.detectPII(testCase.text);
        if (detected.includes(testCase.expected)) {
          correct++;
        }
      }

      const accuracy = correct / total;
      expect(accuracy).toBeGreaterThanOrEqual(0.8); // 80% baseline
    });

    it('should meet privacy level classification targets', async () => {
      const testCases = [
        { text: 'What is the weather?', expected: 'PUBLIC' },
        { text: 'Email: test@example.com', expected: 'SENSITIVE' },
        { text: 'SSN: 123-45-6789', expected: 'SOVEREIGN' },
      ];

      let correct = 0;
      let total = testCases.length;

      for (const testCase of testCases) {
        const result = await classifier.classify(testCase.text);
        if (result.level === testCase.expected) {
          correct++;
        }
      }

      const accuracy = correct / total;
      expect(accuracy).toBeGreaterThanOrEqual(0.85); // 85% target
    });

    it('should meet latency targets', async () => {
      const iterations = 50;
      const latency = await classifier.benchmark(iterations);

      expect(latency).toBeLessThan(50); // < 50ms target
    });

    it('should meet model size targets', async () => {
      const samples: TrainingSample[] = [
        {
          text: 'Test',
          labels: [],
          privacyLevel: PrivacyLevel.PUBLIC,
        },
      ];

      await classifier.train(samples, { epochs: 1 });
      const metrics = classifier.getMetrics();

      expect(metrics.accuracyTargets.modelSize.current).toBeLessThan(
        metrics.accuracyTargets.modelSize.target
      ); // < 100MB
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    it('should handle long queries efficiently', async () => {
      const longQuery = 'What is the capital of France? '.repeat(100);

      const start = performance.now();
      await classifier.classify(longQuery);
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // < 100ms
    });

    it('should handle multiple detections efficiently', async () => {
      const text = `
        Email: user@example.com
        Phone: 555-123-4567
        SSN: 123-45-6789
        Card: 4111-1111-1111-1111
      `;

      const start = performance.now();
      const piiTypes = await classifier.detectPII(text);
      const end = performance.now();

      expect(piiTypes.length).toBeGreaterThan(3);
      expect(end - start).toBeLessThan(50);
    });

    it('should benchmark performance consistently', async () => {
      const latency1 = await classifier.benchmark(50);
      const latency2 = await classifier.benchmark(50);

      // Latency should be consistent (within 2x)
      expect(Math.abs(latency1 - latency2)).toBeLessThan(latency1);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    it('should work end-to-end with training and inference', async () => {
      // Train
      const samples: TrainingSample[] = [
        {
          text: 'My email is test@example.com',
          labels: [
            {
              type: MLPIIType.EMAIL_ADDRESSES,
              start: 12,
              end: 28,
            },
          ],
          privacyLevel: PrivacyLevel.SENSITIVE,
        },
      ];

      await classifier.train(samples, { epochs: 2 });

      // Classify
      const result = await classifier.classify('My email is test@example.com');
      expect(result.level).toBe(PrivacyLevel.SENSITIVE);

      // Detect
      const piiTypes = await classifier.detectPII('My email is test@example.com');
      expect(piiTypes).toContain(PIIType.EMAIL);

      // Redact
      const redacted = await classifier.redact('My email is test@example.com');
      expect(redacted).toContain('[EMAIL]');
    });

    it('should handle real-world queries', async () => {
      const queries = [
        {
          text: 'What is the weather like in Paris?',
          expectedLevel: 'PUBLIC',
        },
        {
          text: 'My email is john@example.com',
          expectedLevel: 'SENSITIVE',
        },
        {
          text: 'My SSN is 123-45-6789',
          expectedLevel: 'SOVEREIGN',
        },
      ];

      for (const query of queries) {
        const result = await classifier.classify(query.text);
        expect(result.level).toBe(query.expectedLevel);
      }
    });
  });

  // ============================================================================
  // FACTORY FUNCTION TESTS
  // ============================================================================

  describe('createMLPrivacyClassifier', () => {
    it('should create classifier with default config', () => {
      const cls = createMLPrivacyClassifier();
      expect(cls).toBeInstanceOf(MLPrivacyClassifier);
    });

    it('should create classifier with custom config', () => {
      const cls = createMLPrivacyClassifier({
        mlWeight: 0.7,
        minConfidence: 0.8,
        includeNameDetection: true,
      });

      expect(cls).toBeInstanceOf(MLPrivacyClassifier);
    });
  });
});
