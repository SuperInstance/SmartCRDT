#!/usr/bin/env node

/**
 * Hello World Application - LSI Example Entry Point
 * This demonstrates a simple but well-structured TypeScript application.
 */

import { Calculator } from './calculator';
import {
  isValidNumber,
  formatNumber,
  clamp,
  average,
  isEven
} from './utils';

class HelloWorldApp {
  private calculator: Calculator;
  private name: string;

  constructor() {
    this.calculator = new Calculator();
    this.name = 'LSI Hello World';
  }

  /**
   * Run the main application
   */
  public async run(): Promise<void> {
    console.log(`🚀 ${this.name} Application`);
    console.log('='.repeat(50));

    // Demonstrate basic functionality
    await this.runCalculatorDemo();

    // Show utility functions
    await this.runUtilsDemo();

    // Interactive mode
    await this.interactiveMode();
  }

  /**
   * Demonstrate calculator functionality
   */
  private async runCalculatorDemo(): Promise<void> {
    console.log('\n📊 Calculator Demo');
    console.log('-'.repeat(30));

    // Basic operations
    const addResult = this.calculator.add(10, 5);
    console.log(`10 + 5 = ${addResult}`);

    const multiplyResult = this.calculator.multiply(10, 5);
    console.log(`10 * 5 = ${multiplyResult}`);

    const divideResult = this.calculator.divide(10, 2);
    console.log(`10 / 2 = ${divideResult}`);

    // Sequence of operations
    const sequence = [
      { op: 'add' as const, a: 0, b: 100 },
      { op: 'multiply' as const, a: 0, b: 2 },
      { op: 'subtract' as const, a: 0, b: 20 },
      { op: 'add' as const, a: 0, b: 50 }
    ];
    const finalResult = this.calculator.sequence(sequence);
    console.log(`Sequence result: 100 + 100 - 20 + 50 = ${finalResult}`);

    // Show history
    console.log('\n📝 Calculation History:');
    this.calculator.getHistory().forEach((entry, index) => {
      console.log(`${index + 1}. ${entry}`);
    });
  }

  /**
   * Demonstrate utility functions
   */
  private async runUtilsDemo(): Promise<void> {
    console.log('\n🛠️ Utility Functions Demo');
    console.log('-'.repeat(35));

    const testNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    console.log(`Test numbers: [${testNumbers.join(', ')}]`);
    console.log(`Average: ${average(testNumbers)}`);
    console.log(`Clamped (0-5): ${clamp(average(testNumbers), 0, 5)}`);
    console.log(`Formatted: ${formatNumber(3.14159, 3)}`);

    console.log('\nNumber Properties:');
    testNumbers.forEach(num => {
      console.log(`${num}: ${getSign(num)}, ${isEven(num) ? 'even' : 'odd'}`);
    });
  }

  /**
   * Interactive mode for user input
   */
  private async interactiveMode(): Promise<void> {
    console.log('\n💬 Interactive Mode');
    console.log('-'.repeat(20));
    console.log('Type "exit" to quit, "help" for commands');

    // Simple REPL for demonstration
    // In a real app, you'd use readline or similar
    const prompts = [
      'Try asking: "What does this app do?"',
      'Or: "Show me the calculator methods"',
      'Or: "How are utility functions organized?"'
    ];

    prompts.forEach(prompt => {
      console.log(`💡 ${prompt}`);
    });

    console.log('\nNow try running LSI queries on this codebase!');
    console.log('Example: lsi query "How does the calculator work?"');
  }
}

// Helper function (from utils but used here)
function getSign(num: number): string {
  if (num < 0) return '-';
  if (num > 0) return '+';
  return '0';
}

// Run the application if this file is executed directly
if (require.main === module) {
  const app = new HelloWorldApp();
  app.run().catch(console.error);
}

export { HelloWorldApp };