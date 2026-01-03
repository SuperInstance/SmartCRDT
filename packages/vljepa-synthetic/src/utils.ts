/**
 * @lsi/vljepa-synthetic - Utility Functions
 *
 * Random number generation, color utilities, and helper functions.
 *
 * @module utils
 */

import type { SeededRandom, ColorUtils } from "./types.js";

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Create a seeded random number generator
 * Uses Mulberry32 algorithm for good randomness and performance
 *
 * @param seed - Random seed
 * @returns Seeded random generator
 */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed;

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    return Math.floor(next() * (max - min + 1)) + min;
  };

  const float = (min: number, max: number): number => {
    return next() * (max - min) + min;
  };

  const pick = <T>(array: T[]): T => {
    return array[int(0, array.length - 1)];
  };

  const pickN = <T>(array: T[], n: number): T[] => {
    const shuffled = shuffle([...array]);
    return shuffled.slice(0, Math.min(n, array.length));
  };

  const shuffle = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const getSeed = (): number => seed;

  const fn = next as SeededRandom;
  fn.int = int;
  fn.float = float;
  fn.pick = pick;
  fn.pickN = pickN;
  fn.shuffle = shuffle;
  fn.getSeed = getSeed;

  return fn;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
    }
  }

  return { h, s, l };
}

/**
 * Calculate relative luminance
 */
function calculateLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculate Delta E (CIE76)
 */
function calculateDeltaE(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const lab1 = rgbToLab(color1.r, color1.g, color1.b);
  const lab2 = rgbToLab(color2.r, color2.g, color2.b);

  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
      Math.pow(lab1.a - lab2.a, 2) +
      Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * Convert RGB to LAB
 */
function rgbToLab(
  r: number,
  g: number,
  b: number
): { l: number; a: number; b: number } {
  // First convert to XYZ
  let [vr, vg, vb] = [r, g, b].map(v => {
    v /= 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  });

  vr *= 100;
  vg *= 100;
  vb *= 100;

  const x = vr * 0.4124 + vg * 0.3576 + vb * 0.1805;
  const y = vr * 0.2126 + vg * 0.7152 + vb * 0.0722;
  const z = vr * 0.0193 + vg * 0.1192 + vb * 0.9505;

  // Then convert XYZ to LAB
  const [xn, yn, zn] = [95.047, 100.0, 108.883];

  const fx = x / xn;
  const fy = y / yn;
  const fz = z / zn;

  const [fx3, fy3, fz3] = [fx, fy, fz].map(v =>
    v > 0.008856 ? Math.pow(v, 1 / 3) : 7.787 * v + 16 / 116
  );

  return {
    l: 116 * fy3 - 16,
    a: 500 * (fx3 - fy3),
    b: 200 * (fy3 - fz3),
  };
}

/**
 * Create color utilities
 *
 * @param seed - Random seed
 * @returns Color utilities
 */
export function createColorUtils(seed: number): ColorUtils {
  const rng = createSeededRandom(seed);

  const random = (): string => {
    const r = rng.int(0, 255);
    const g = rng.int(0, 255);
    const b = rng.int(0, 255);
    return rgbToHex(r, g, b);
  };

  const randomHue = (minHue: number, maxHue: number): string => {
    const h = rng.float(minHue / 360, maxHue / 360);
    const s = rng.float(0.4, 0.9);
    const l = rng.float(0.3, 0.7);
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  };

  const complementary = (color: string): string => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const compHsl = { h: (hsl.h + 0.5) % 1, s: hsl.s, l: hsl.l };
    const compRgb = hslToRgb(compHsl.h, compHsl.s, compHsl.l);
    return rgbToHex(compRgb.r, compRgb.g, compRgb.b);
  };

  const analogous = (color: string, steps: number = 2): string[] => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors: string[] = [];

    for (let i = -steps; i <= steps; i++) {
      if (i === 0) {
        colors.push(color);
      } else {
        const newH = (hsl.h + i * 0.083 + 1) % 1;
        const rgb = hslToRgb(newH, hsl.s, hsl.l);
        colors.push(rgbToHex(rgb.r, rgb.g, rgb.b));
      }
    }

    return colors;
  };

  const triadic = (color: string): string[] => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors: string[] = [color];

    for (let i = 1; i <= 2; i++) {
      const newH = (hsl.h + (i * 1) / 3) % 1;
      const rgb = hslToRgb(newH, hsl.s, hsl.l);
      colors.push(rgbToHex(rgb.r, rgb.g, rgb.b));
    }

    return colors;
  };

  const monochromatic = (color: string, steps: number): string[] => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors: string[] = [];

    for (let i = 0; i < steps; i++) {
      const newL = 0.2 + (i / (steps - 1)) * 0.6;
      const rgb = hslToRgb(hsl.h, hsl.s, newL);
      colors.push(rgbToHex(rgb.r, rgb.g, rgb.b));
    }

    return colors;
  };

  const distance = (color1: string, color2: string): number => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    return calculateDeltaE(rgb1, rgb2);
  };

  const luminance = (color: string): number => {
    const rgb = hexToRgb(color);
    return calculateLuminance(rgb.r, rgb.g, rgb.b);
  };

  const isDark = (color: string): boolean => {
    return luminance(color) < 0.5;
  };

  const contrastRatio = (color1: string, color2: string): number => {
    const lum1 = luminance(color1);
    const lum2 = luminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  return {
    random,
    randomHue,
    complementary,
    analogous,
    triadic,
    monochromatic,
    distance,
    luminance,
    isDark,
    contrastRatio,
  };
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Generate a random ID
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Escape HTML
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, char => htmlEntities[char]);
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Flatten nested arrays
 */
export function flatten<T>(arrays: T[][]): T[] {
  return arrays.flat();
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array by key
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}
