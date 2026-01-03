/**
 * @lsi/vljepa-synthetic - Design Validator
 *
 * Validates UI components against design principles.
 *
 * @module validators
 */

import type {
  DesignValidationResult,
  GeneratedComponent,
  ValidationError,
  ValidationWarning,
} from "../types.js";

export class DesignValidator {
  /**
   * Validate component design
   */
  validate(component: GeneratedComponent): DesignValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    const principles = {
      hierarchy: this.checkHierarchy(component, errors, warnings, suggestions),
      spacing: this.checkSpacing(component, errors, warnings, suggestions),
      color: this.checkColorHarmony(component, errors, warnings, suggestions),
      typography: this.checkTypography(
        component,
        errors,
        warnings,
        suggestions
      ),
      balance: this.checkBalance(component, errors, warnings, suggestions),
    };

    const overallScore =
      Object.values(principles).reduce((a, b) => a + b, 0) / 5;

    return {
      passed: errors.length === 0,
      score: overallScore,
      errors,
      warnings,
      suggestions,
      principles,
    };
  }

  /**
   * Check visual hierarchy
   */
  private checkHierarchy(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): number {
    const styles = component.styles;
    let score = 0.8;

    const fontSize = styles.fontSize as string | undefined;
    const fontWeight = styles.fontWeight as number | undefined;

    if (fontSize && fontWeight) {
      // Has font size and weight - good hierarchy
      score += 0.1;
    } else {
      warnings.push({
        category: "hierarchy",
        message: "Component lacks clear visual hierarchy",
        location: component.metadata.id,
      });
      suggestions.push("Use font size and weight to establish hierarchy");
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check spacing consistency
   */
  private checkSpacing(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): number {
    const styles = component.styles;
    let score = 0.8;

    const padding = styles.padding as string | undefined;
    const margin = styles.margin as string | undefined;

    if (padding) {
      score += 0.1;
    } else {
      suggestions.push("Add padding for better spacing");
      score -= 0.1;
    }

    // Check for consistent spacing (multiples of 4, 8, etc.)
    if (padding && this.isConsistentSpacing(padding)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check color harmony
   */
  private checkColorHarmony(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): number {
    const styles = component.styles;
    let score = 0.8;

    const color = styles.color as string | undefined;
    const backgroundColor = styles.backgroundColor as string | undefined;

    if (color && backgroundColor) {
      // Has both foreground and background colors
      score += 0.2;
    } else {
      suggestions.push("Define both text and background colors");
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check typography
   */
  private checkTypography(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): number {
    const styles = component.styles;
    let score = 0.8;

    const fontSize = styles.fontSize as string | undefined;
    const lineHeight = styles.lineHeight as string | undefined;
    const fontFamily = styles.fontFamily as string | undefined;

    if (fontSize) score += 0.1;
    if (lineHeight) score += 0.05;
    if (fontFamily) score += 0.05;

    if (!fontSize) {
      suggestions.push("Set a font size for the component");
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check visual balance
   */
  private checkBalance(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): number {
    const styles = component.styles;
    let score = 0.8;

    const borderRadius = styles.borderRadius as string | undefined;
    const boxShadow = styles.boxShadow as string | undefined;

    // Has some visual treatment
    if (borderRadius || boxShadow) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if spacing follows consistent scale (multiples of 4 or 8)
   */
  private isConsistentSpacing(spacing: string): boolean {
    const value = parseInt(spacing.replace(/\D/g, ""));
    return value % 4 === 0 || value % 8 === 0;
  }
}
