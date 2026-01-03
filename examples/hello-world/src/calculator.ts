/**
 * Simple calculator implementation with basic arithmetic operations.
 * This class demonstrates clean, well-documented code structure.
 */
export class Calculator {
  private history: string[] = [];

  /**
   * Add two numbers together
   * @param a First number
   * @param b Second number
   * @returns Sum of a and b
   */
  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  /**
   * Subtract second number from first
   * @param a First number
   * @param b Second number to subtract
   * @returns Result of a - b
   */
  subtract(a: number, b: number): number {
    const result = a - b;
    this.history.push(`${a} - ${b} = ${result}`);
    return result;
  }

  /**
   * Multiply two numbers
   * @param a First number
   * @param b Second number
   * @returns Product of a and b
   */
  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(`${a} * ${b} = ${result}`);
    return result;
  }

  /**
   * Divide first number by second
   * @param a Dividend
   * @param b Divisor
   * @returns Result of a / b
   * @throws Error if b is zero
   */
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    const result = a / b;
    this.history.push(`${a} / ${b} = ${result}`);
    return result;
  }

  /**
   * Get calculation history
   * @returns Array of calculation strings
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear calculation history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Perform multiple operations in sequence
   * @param operations Array of operation objects
   * @returns Final result after all operations
   */
  sequence(operations: Array<{ op: 'add' | 'subtract' | 'multiply' | 'divide'; a: number; b: number }>): number {
    let result = 0;
    for (const operation of operations) {
      switch (operation.op) {
        case 'add':
          result = this.add(result, operation.b);
          break;
        case 'subtract':
          result = this.subtract(result, operation.b);
          break;
        case 'multiply':
          result = this.multiply(result, operation.b);
          break;
        case 'divide':
          result = this.divide(result, operation.b);
          break;
      }
    }
    return result;
  }
}