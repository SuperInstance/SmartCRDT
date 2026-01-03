/**
 * Training Data Generator for MLPrivacyClassifier
 *
 * This module provides utilities for generating and preparing training data
 * for the ML-based privacy classifier.
 *
 * Features:
 * - Sample generation for different PII types
 * - Data augmentation techniques
 * - Cross-validation split generation
 * - Synthetic data generation
 */

import { TrainingSample, MLPIIType } from '../classifier/MLPrivacyClassifier.js';
import { PrivacyLevel as PrivacyLevelEnum } from '@lsi/protocol';

// ============================================================================
// SAMPLE DEFINITIONS
// ============================================================================

/**
 * PII sample templates
 */
const PII_TEMPLATES: Record<MLPIIType, string[]> = {
  [MLPIIType.EMAIL_ADDRESSES]: [
    'My email is {value}',
    'Contact me at {value}',
    'Send to {value}',
    'Email: {value}',
    '{value} is my email',
  ],
  [MLPIIType.PHONE_NUMBERS]: [
    'My phone is {value}',
    'Call me at {value}',
    'Phone: {value}',
    'Contact: {value}',
    '{value} is my number',
  ],
  [MLPIIType.SSN_TAX_ID]: [
    'My SSN is {value}',
    'Social Security: {value}',
    'SSN: {value}',
    'Tax ID: {value}',
    '{value} is my SSN',
  ],
  [MLPIIType.CREDIT_CARDS]: [
    'My credit card is {value}',
    'Card number: {value}',
    'Credit Card: {value}',
    'Pay with {value}',
    '{value} is my card',
  ],
  [MLPIIType.ADDRESSES]: [
    'I live at {value}',
    'Address: {value}',
    'My home is {value}',
    'Location: {value}',
    '{value} is my address',
  ],
  [MLPIIType.MEDICAL_INFO]: [
    'My medical record is {value}',
    'Patient ID: {value}',
    'MRN: {value}',
    'Medical: {value}',
    '{value} is my record',
  ],
  [MLPIIType.FINANCIAL_INFO]: [
    'My bank account is {value}',
    'Account: {value}',
    'Bank: {value}',
    'Financial: {value}',
    '{value} is my account',
  ],
  [MLPIIType.BIOMETRIC_DATA]: [
    'My fingerprint ID is {value}',
    'Biometric: {value}',
    'Face ID: {value}',
    'Scan: {value}',
    '{value} is my biometric',
  ],
  [MLPIIType.NONE]: [],
};

/**
 * Sample PII values for each type
 */
const PII_VALUES: Record<MLPIIType, string[]> = {
  [MLPIIType.EMAIL_ADDRESSES]: [
    'user@example.com',
    'john.doe@company.co.uk',
    'admin@test.org',
    'support@service.net',
    'name+tag@gmail.com',
  ],
  [MLPIIType.PHONE_NUMBERS]: [
    '555-123-4567',
    '+1-800-555-0199',
    '(555) 987-6543',
    '+44 20 7946 0958',
    '555.867.5309',
  ],
  [MLPIIType.SSN_TAX_ID]: [
    '123-45-6789',
    '987-65-4321',
    '555-44-3333',
    '111-22-3333',
    '999-88-7777',
  ],
  [MLPIIType.CREDIT_CARDS]: [
    '4111-1111-1111-1111',
    '5500-0000-0000-0004',
    '3400-0000-0000-009',
    '6011-0000-0000-0004',
    '378282246310005',
  ],
  [MLPIIType.ADDRESSES]: [
    '123 Main St, Anytown, USA',
    '456 Oak Ave, Springfield, IL 62701',
    '789 Pine Rd, Brooklyn, NY 11201',
    '321 Elm Blvd, Austin, TX 78701',
    '654 Maple Ln, Seattle, WA 98101',
  ],
  [MLPIIType.MEDICAL_INFO]: [
    'MRN12345',
    'PAT-98765',
    'HN54321',
    'MED-REC-11223',
    'PATIENT-ID-44556',
  ],
  [MLPIIType.FINANCIAL_INFO]: [
    'ACC123456789',
    'BANK987654321',
    'ACCT555555555',
    'ROUT012345678',
    'IBAN-US123456789',
  ],
  [MLPIIType.BIOMETRIC_DATA]: [
    'FP-A1B2C3D4',
    'FACE-ID-5555',
    'SCAN-7777-8888',
    'BIO-9999-0000',
    'FINGER-1212-3434',
  ],
  [MLPIIType.NONE]: [],
};

/**
 * Non-sensitive query templates
 */
const NON_SENSITIVE_TEMPLATES = [
  'What is the capital of France?',
  'How do I write a for loop in Python?',
  'Explain quantum computing',
  'What are the benefits of exercise?',
  'How does photosynthesis work?',
  'Tell me about the history of Rome',
  'What is machine learning?',
  'How do I bake a chocolate cake?',
  'Explain the theory of relativity',
  'What are the best practices for code review?',
];

// ============================================================================
// TRAINING DATA GENERATOR
// ============================================================================

export class TrainingDataGenerator {
  /**
   * Generate training samples for PII detection
   */
  generatePIISamples(
    piiType: MLPIIType,
    count: number = 50
  ): TrainingSample[] {
    const samples: TrainingSample[] = [];
    const templates = PII_TEMPLATES[piiType] || [];
    const values = PII_VALUES[piiType] || [];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      const value = values[i % values.length];
      const text = template.replace('{value}', value);

      const start = text.indexOf(value);
      const end = start + value.length;

      samples.push({
        text,
        labels: [
          {
            type: piiType,
            start,
            end,
          },
        ],
        privacyLevel: this.getPrivacyLevel(piiType),
      });
    }

    return samples;
  }

  /**
   * Generate non-sensitive samples
   */
  generateNonSensitiveSamples(count: number = 30): TrainingSample[] {
    const samples: TrainingSample[] = [];

    for (let i = 0; i < count; i++) {
      const template = NON_SENSITIVE_TEMPLATES[i % NON_SENSITIVE_TEMPLATES.length];

      samples.push({
        text: template,
        labels: [],
        privacyLevel: 'PUBLIC' as PrivacyLevelEnum,
      });
    }

    return samples;
  }

  /**
   * Generate mixed samples with multiple PII types
   */
  generateMixedSamples(count: number = 20): TrainingSample[] {
    const samples: TrainingSample[] = [];
    const piiTypes = Object.values(MLPIIType).filter(
      t => t !== MLPIIType.NONE
    );

    for (let i = 0; i < count; i++) {
      const numPII = Math.floor(Math.random() * 3) + 1; // 1-3 PII types
      const selectedTypes = this.shuffleArray(piiTypes).slice(0, numPII);

      let text = 'User information: ';
      const labels: TrainingSample['labels'] = [];
      let currentPos = text.length;

      for (const piiType of selectedTypes) {
        const templates = PII_TEMPLATES[piiType];
        const values = PII_VALUES[piiType];

        const template = templates[i % templates.length];
        const value = values[i % values.length];

        const segment = template.replace('{value}', value) + ', ';
        text += segment;

        const start = currentPos + segment.indexOf(value);
        const end = start + value.length;

        labels.push({
          type: piiType,
          start,
          end,
        });

        currentPos += segment.length;
      }

      samples.push({
        text,
        labels,
        privacyLevel: this.getHighestPrivacyLevel(selectedTypes),
      });
    }

    return samples;
  }

  /**
   * Generate complete training dataset
   */
  generateDataset(config?: {
    piiSamplesPerType?: number;
    nonSensitiveSamples?: number;
    mixedSamples?: number;
  }): TrainingSample[] {
    const piiSamplesPerType = config?.piiSamplesPerType || 50;
    const nonSensitiveSamples = config?.nonSensitiveSamples || 30;
    const mixedSamples = config?.mixedSamples || 20;

    const allSamples: TrainingSample[] = [];

    // Generate PII samples for each type
    for (const piiType of Object.values(MLPIIType)) {
      if (piiType !== MLPIIType.NONE) {
        allSamples.push(...this.generatePIISamples(piiType, piiSamplesPerType));
      }
    }

    // Generate non-sensitive samples
    allSamples.push(...this.generateNonSensitiveSamples(nonSensitiveSamples));

    // Generate mixed samples
    allSamples.push(...this.generateMixedSamples(mixedSamples));

    // Shuffle samples
    return this.shuffleArray(allSamples);
  }

  /**
   * Create train/validation/test split
   */
  createTrainValTestSplit(
    samples: TrainingSample[],
    trainRatio: number = 0.7,
    valRatio: number = 0.15,
    testRatio: number = 0.15
  ): {
    train: TrainingSample[];
    val: TrainingSample[];
    test: TrainingSample[];
  } {
    const shuffled = this.shuffleArray([...samples]);
    const total = shuffled.length;

    const trainEnd = Math.floor(total * trainRatio);
    const valEnd = trainEnd + Math.floor(total * valRatio);

    return {
      train: shuffled.slice(0, trainEnd),
      val: shuffled.slice(trainEnd, valEnd),
      test: shuffled.slice(valEnd),
    };
  }

  /**
   * Create cross-validation folds
   */
  createCrossValidationFolds(
    samples: TrainingSample[],
    numFolds: number = 5
  ): TrainingSample[][] {
    const shuffled = this.shuffleArray([...samples]);
    const foldSize = Math.floor(shuffled.length / numFolds);
    const folds: TrainingSample[][] = [];

    for (let i = 0; i < numFolds; i++) {
      const start = i * foldSize;
      const end = i === numFolds - 1 ? shuffled.length : start + foldSize;
      folds.push(shuffled.slice(start, end));
    }

    return folds;
  }

  /**
   * Augment training data with variations
   */
  augmentSamples(samples: TrainingSample[], augmentFactor: number = 3): TrainingSample[] {
    const augmented: TrainingSample[] = [];

    for (const sample of samples) {
      // Add original
      augmented.push(sample);

      // Add augmented versions
      for (let i = 0; i < augmentFactor; i++) {
        augmented.push(this.augmentSample(sample, i));
      }
    }

    return augmented;
  }

  /**
   * Augment a single sample
   */
  private augmentSample(sample: TrainingSample, seed: number): TrainingSample {
    const augmentationType = seed % 4;

    switch (augmentationType) {
      case 0: // Add noise (random spaces)
        return {
          ...sample,
          text: this.addRandomSpaces(sample.text, seed),
        };

      case 1: // Change case
        return {
          ...sample,
          text: this.changeRandomCase(sample.text, seed),
        };

      case 2: // Add punctuation
        return {
          ...sample,
          text: this.addRandomPunctuation(sample.text, seed),
        };

      case 3: // Shuffle words (within context)
        return {
          ...sample,
          text: this.shuffleWords(sample.text, seed),
        };

      default:
        return sample;
    }
  }

  /**
   * Add random spaces to text
   */
  private addRandomSpaces(text: string, seed: number): string {
    const words = text.split(' ');
    const result = [...words];

    for (let i = 0; i < Math.min(seed + 1, words.length); i += 2) {
      result[i] = words[i] + ' ';
    }

    return result.join(' ');
  }

  /**
   * Change random case
   */
  private changeRandomCase(text: string, seed: number): string {
    return text
      .split('')
      .map((char, idx) => {
        if ((idx + seed) % 3 === 0 && char.toLowerCase() !== char.toUpperCase()) {
          return char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase();
        }
        return char;
      })
      .join('');
  }

  /**
   * Add random punctuation
   */
  private addRandomPunctuation(text: string, seed: number): string {
    const punctuation = ['.', ',', '!', '?'];
    const words = text.split(' ');
    const result = [...words];

    for (let i = 1; i < Math.min(seed + 2, words.length); i += 3) {
      result[i] = words[i] + punctuation[seed % punctuation.length];
    }

    return result.join(' ');
  }

  /**
   * Shuffle words (preserving PII spans)
   */
  private shuffleWords(text: string, seed: number): string {
    // Simple implementation: just shuffle non-PII words
    // In production, this should be more sophisticated
    return text; // Placeholder
  }

  /**
   * Get privacy level for PII type
   */
  private getPrivacyLevel(piiType: MLPIIType): PrivacyLevelEnum {
    const highRisk = [
      MLPIIType.SSN_TAX_ID,
      MLPIIType.CREDIT_CARDS,
      MLPIIType.MEDICAL_INFO,
      MLPIIType.BIOMETRIC_DATA,
    ];

    const mediumRisk = [
      MLPIIType.EMAIL_ADDRESSES,
      MLPIIType.PHONE_NUMBERS,
      MLPIIType.ADDRESSES,
    ];

    if (highRisk.includes(piiType)) {
      return PrivacyLevelEnum.SOVEREIGN;
    }

    if (mediumRisk.includes(piiType)) {
      return PrivacyLevelEnum.SENSITIVE;
    }

    return PrivacyLevelEnum.PUBLIC;
  }

  /**
   * Get highest privacy level from multiple PII types
   */
  private getHighestPrivacyLevel(piiTypes: MLPIIType[]): PrivacyLevelEnum {
    for (const type of piiTypes) {
      const level = this.getPrivacyLevel(type);
      if (level === PrivacyLevelEnum.SOVEREIGN) {
        return level;
      }
    }

    for (const type of piiTypes) {
      const level = this.getPrivacyLevel(type);
      if (level === PrivacyLevelEnum.SENSITIVE) {
        return level;
      }
    }

    return PrivacyLevelEnum.PUBLIC;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Export samples to JSON
   */
  exportToJSON(samples: TrainingSample[]): string {
    return JSON.stringify(samples, null, 2);
  }

  /**
   * Import samples from JSON
   */
  importFromJSON(json: string): TrainingSample[] {
    return JSON.parse(json);
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create training data generator
 */
export function createTrainingDataGenerator(): TrainingDataGenerator {
  return new TrainingDataGenerator();
}
