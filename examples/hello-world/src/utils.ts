/**
 * Utility functions for the hello world example.
 * These demonstrate various helper patterns used in TypeScript applications.
 */

/**
 * Validate that a value is a number
 * @param value Value to validate
 * @returns True if valid number, false otherwise
 */
export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Format a number with fixed decimal places
 * @param num Number to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

/**
 * Clamp a number between min and max values
 * @param value Value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a random number between min and max
 * @param min Minimum value (inclusive)
 * @param max Maximum value (exclusive)
 * @returns Random number
 */
export function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Calculate average of an array of numbers
 * @param numbers Array of numbers
 * @returns Average value, or 0 if array is empty
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

/**
 * Check if a number is even
 * @param num Number to check
 * @returns True if even, false otherwise
 */
export function isEven(num: number): boolean {
  return num % 2 === 0;
}

/**
 * Check if a number is odd
 * @param num Number to check
 * @returns True if odd, false otherwise
 */
export function isOdd(num: number): boolean {
  return num % 2 !== 0;
}

/**
 * Get the sign of a number as a string
 * @param num Number to check
 * @returns '-' for negative, '+' for positive, '0' for zero
 */
export function getSign(num: number): string {
  if (num < 0) return '-';
  if (num > 0) return '+';
  return '0';
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param radians Angle in radians
 * @returns Angle in degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}