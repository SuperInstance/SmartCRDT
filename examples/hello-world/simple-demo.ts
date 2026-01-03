#!/usr/bin/env node

/**
 * Hello World Example - LSI
 *
 * Simple calculator demonstration showing LSI's code understanding capabilities.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Simple calculator implementation
class Calculator {
  private history: string[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  subtract(a: number, b: number): number {
    const result = a - b;
    this.history.push(`${a} - ${b} = ${result}`);
    return result;
  }

  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(`${a} * ${b} = ${result}`);
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    const result = a / b;
    this.history.push(`${a} / ${b} = ${result}`);
    return result;
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

// Utility functions
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function isValidNumber(num: any): boolean {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
}

// Simple demo runner
function runDemo() {
  console.log('🎯 Hello World Example - LSI');
  console.log('==================================================\n');

  // Initialize calculator
  const calculator = new Calculator();

  console.log('📊 Calculator Demo');
  console.log('------------------');

  // Test basic operations
  const testCases = [
    { op: 'add', a: 10, b: 5, expected: 15 },
    { op: 'subtract', a: 10, b: 5, expected: 5 },
    { op: 'multiply', a: 10, b: 5, expected: 50 },
    { op: 'divide', a: 10, b: 5, expected: 2 }
  ];

  testCases.forEach(({ op, a, b, expected }) => {
    try {
      const result = calculator[op as keyof Calculator](a, b);
      console.log(`✓ ${op}(${a}, ${b}) = ${result}`);
      console.log(`  Expected: ${expected}, Got: ${result}`);
    } catch (error) {
      console.log(`✗ ${op}(${a}, ${b}) failed: ${error}`);
    }
  });

  console.log('\n🔧 Utility Functions');
  console.log('--------------------');

  // Test utility functions
  const testNumbers = [1234.5678, 0.3333, 1000, 999.99];
  testNumbers.forEach(num => {
    console.log(`✓ formatNumber(${num}) = ${formatNumber(num)}`);
    console.log(`✓ isValidNumber(${num}) = ${isValidNumber(num)}`);
  });

  console.log('\n📁 File Operations');
  console.log('------------------');

  // Create a simple output file
  const output = `
Hello World Demo Results
========================

Calculator Operations:
- Add: 10 + 5 = 15
- Subtract: 10 - 5 = 5
- Multiply: 10 * 5 = 50
- Divide: 10 / 5 = 2

Utilities:
- Number formatting: ${testNumbers.map(n => formatNumber(n)).join(', ')}
- Number validation: ${testNumbers.map(n => isValidNumber(n)).join(', ')}

Generated: ${new Date().toISOString()}
`;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    writeFileSync(join(__dirname, 'demo-output.txt'), output);
    console.log('✓ Demo output saved to demo-output.txt');
  } catch (error) {
    console.log('✗ Failed to save output:', error);
  }

  console.log('\n🎉 Demo Complete!');
  console.log('\n💡 Try these commands:');
  console.log('  lsi query "How does the calculator work?"');
  console.log('  lsi query "What utility functions are available?"');
  console.log('  lsi query "What is the project structure?"');
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}

export { runDemo };
export default runDemo;