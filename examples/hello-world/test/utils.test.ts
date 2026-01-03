import { describe, it, expect } from 'vitest';
import {
  isValidNumber,
  formatNumber,
  clamp,
  randomNumber,
  average,
  isEven,
  isOdd,
  getSign,
  toRadians,
  toDegrees
} from '../src/utils';

describe('Utility Functions', () => {
  describe('isValidNumber', () => {
    it('should validate numbers correctly', () => {
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-1.5)).toBe(true);
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber('42' as any)).toBe(false);
      expect(isValidNumber(null as any)).toBe(false);
      expect(isValidNumber(undefined as any)).toBe(false);
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with specified decimal places', () => {
      expect(formatNumber(3.14159, 2)).toBe('3.14');
      expect(formatNumber(3.14159, 3)).toBe('3.142');
      expect(formatNumber(3.14159, 0)).toBe('3');
      expect(formatNumber(0, 2)).toBe('0.00');
    });
  });

  describe('clamp', () => {
    it('should clamp numbers between min and max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });

  describe('randomNumber', () => {
    it('should generate numbers within specified range', () => {
      const min = 1;
      const max = 10;
      const num = randomNumber(min, max);

      expect(num).toBeGreaterThanOrEqual(min);
      expect(num).toBeLessThan(max);
    });
  });

  describe('average', () => {
    it('should calculate average correctly', () => {
      expect(average([1, 2, 3, 4, 5])).toBe(3);
      expect(average([10, 20])).toBe(15);
      expect(average([5])).toBe(5);
    });

    it('should return 0 for empty array', () => {
      expect(average([])).toBe(0);
    });
  });

  describe('isEven / isOdd', () => {
    it('should check even numbers correctly', () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(0)).toBe(true);
      expect(isEven(-4)).toBe(true);
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(-5)).toBe(false);
    });

    it('should check odd numbers correctly', () => {
      expect(isOdd(1)).toBe(true);
      expect(isOdd(3)).toBe(true);
      expect(isOdd(-5)).toBe(true);
      expect(isOdd(2)).toBe(false);
      expect(isOdd(0)).toBe(false);
      expect(isOdd(-4)).toBe(false);
    });
  });

  describe('getSign', () => {
    it('should return correct sign', () => {
      expect(getSign(5)).toBe('+');
      expect(getSign(-3)).toBe('-');
      expect(getSign(0)).toBe('0');
    });
  });

  describe('angle conversions', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(toRadians(0)).toBe(0);
    });

    it('should convert radians to degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90);
      expect(toDegrees(0)).toBe(0);
    });
  });
});