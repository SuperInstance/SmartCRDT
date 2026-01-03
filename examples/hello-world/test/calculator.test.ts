import { describe, it, expect, beforeEach } from 'vitest';
import { Calculator } from '../src/calculator';

describe('Calculator', () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  describe('Basic Operations', () => {
    it('should correctly add numbers', () => {
      expect(calculator.add(2, 3)).toBe(5);
      expect(calculator.add(-1, 5)).toBe(4);
      expect(calculator.add(0, 0)).toBe(0);
    });

    it('should correctly subtract numbers', () => {
      expect(calculator.subtract(5, 3)).toBe(2);
      expect(calculator.subtract(3, 5)).toBe(-2);
      expect(calculator.subtract(0, 0)).toBe(0);
    });

    it('should correctly multiply numbers', () => {
      expect(calculator.multiply(2, 3)).toBe(6);
      expect(calculator.multiply(-2, 5)).toBe(-10);
      expect(calculator.multiply(0, 100)).toBe(0);
    });

    it('should correctly divide numbers', () => {
      expect(calculator.divide(10, 2)).toBe(5);
      expect(calculator.divide(9, 3)).toBe(3);
    });

    it('should throw error when dividing by zero', () => {
      expect(() => calculator.divide(5, 0)).toThrow('Division by zero is not allowed');
    });
  });

  describe('History Management', () => {
    it('should track calculation history', () => {
      calculator.add(2, 3);
      calculator.multiply(4, 5);

      const history = calculator.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toBe('2 + 3 = 5');
      expect(history[1]).toBe('4 * 5 = 20');
    });

    it('should clear history', () => {
      calculator.add(1, 1);
      calculator.clearHistory();

      expect(calculator.getHistory()).toHaveLength(0);
    });
  });

  describe('Sequence Operations', () => {
    it('should perform sequence of operations correctly', () => {
      const operations = [
        { op: 'add' as const, a: 0, b: 10 },
        { op: 'multiply' as const, a: 0, b: 2 },
        { op: 'subtract' as const, a: 0, b: 5 }
      ];

      const result = calculator.sequence(operations);
      expect(result).toBe(15); // 10 + 10 - 5 = 15
    });

    it('should handle empty sequence', () => {
      const operations: any[] = [];
      const result = calculator.sequence(operations);
      expect(result).toBe(0);
    });
  });
});