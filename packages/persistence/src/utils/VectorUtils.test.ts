import { describe, it, expect } from 'vitest';
import { VectorUtils } from './VectorUtils';

describe('VectorUtils', () => {
  describe('dotProduct', () => {
    it('should calculate dot product correctly', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);

      const result = VectorUtils.dotProduct(a, b);
      expect(result).toBe(32); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    });

    it('should throw error for vectors with different dimensions', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([1, 2]);

      expect(() => VectorUtils.dotProduct(a, b)).toThrow('Vectors must have the same length');
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity for identical vectors', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array(a);

      const result = VectorUtils.cosineSimilarity(a, b);
      expect(result).toBeCloseTo(1.0, 6);
    });

    it('should calculate cosine similarity for orthogonal vectors', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([0, 1]);

      const result = VectorUtils.cosineSimilarity(a, b);
      expect(result).toBeCloseTo(0.0, 6);
    });

    it('should handle zero vectors', () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);

      const result = VectorUtils.cosineSimilarity(a, b);
      expect(result).toBe(0.0);
    });

    it('should handle negative values correctly', () => {
      const a = new Float32Array([1, -1, 1]);
      const b = new Float32Array([-1, 1, -1]);

      const result = VectorUtils.cosineSimilarity(a, b);
      expect(result).toBeCloseTo(-1.0, 6);
    });
  });

  describe('normalize', () => {
    it('should normalize vector to unit length', () => {
      const vector = new Float32Array([3, 4]);
      const normalized = VectorUtils.normalize(vector);

      const magnitude = Math.sqrt(
        normalized.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1.0, 6);
    });

    it('should handle zero vector', () => {
      const vector = new Float32Array([0, 0, 0]);
      const normalized = VectorUtils.normalize(vector);

      expect(normalized).toEqual(new Float32Array([0, 0, 0]));
    });
  });

  describe('vectorToBuffer and bufferToVector', () => {
    it('should convert vector to buffer and back correctly', () => {
      const original = new Float32Array([1.1, 2.2, 3.3, -4.4]);
      const buffer = VectorUtils.vectorToBuffer(original);
      const converted = VectorUtils.bufferToVector(buffer);

      expect(converted).toEqual(original);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty vector', () => {
      const original = new Float32Array([]);
      const buffer = VectorUtils.vectorToBuffer(original);
      const converted = VectorUtils.bufferToVector(buffer);

      expect(converted).toEqual(original);
    });
  });

  describe('generateRandomVector', () => {
    it('should generate vector with correct dimensions', () => {
      const dimensions = 100;
      const vector = VectorUtils.generateRandomVector(dimensions);

      expect(vector).toBeInstanceOf(Float32Array);
      expect(vector.length).toBe(dimensions);
    });

    it('should generate vectors in range [-1, 1]', () => {
      const vector = VectorUtils.generateRandomVector(1000);

      for (let i = 0; i < vector.length; i++) {
        expect(vector[i]).toBeGreaterThanOrEqual(-1);
        expect(vector[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('validateDimensions', () => {
    it('should not throw for correct dimensions', () => {
      const vector = new Float32Array(1536);
      expect(() => VectorUtils.validateDimensions(vector, 1536)).not.toThrow();
    });

    it('should throw for incorrect dimensions', () => {
      const vector = new Float32Array(100);
      expect(() => VectorUtils.validateDimensions(vector, 1536)).toThrow(
        'Vector must have 1536 dimensions. Got 100'
      );
    });
  });
});