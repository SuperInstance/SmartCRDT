/**
 * @lsi/vljepa-synthetic - Accessibility Validator
 *
 * Validates UI components for WCAG compliance.
 *
 * @module validators
 */

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AccessibilityValidationResult,
  GeneratedComponent,
  CSSProperties,
} from "../types.js";
import { createColorUtils } from "../utils.js";

export class AccessibilityValidator {
  private colorUtils: ReturnType<typeof createColorUtils>;

  constructor(seed: number = Date.now()) {
    this.colorUtils = createColorUtils(seed);
  }

  /**
   * Validate component accessibility
   */
  validate(component: GeneratedComponent): AccessibilityValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check for semantic HTML
    this.checkSemanticHTML(component, errors, warnings, suggestions);

    // Check color contrast
    this.checkColorContrast(component, errors, warnings, suggestions);

    // Check ARIA attributes
    this.checkARIA(component, errors, warnings, suggestions);

    // Check keyboard accessibility
    this.checkKeyboardAccess(component, errors, warnings, suggestions);

    const score = this.calculateScore(errors, warnings);
    const wcagLevel = this.determineWCAGLevel(errors, warnings);

    return {
      passed:
        errors.filter(e => e.severity === "critical" || e.severity === "high")
          .length === 0,
      score,
      errors,
      warnings,
      suggestions,
      wcagLevel,
      contrastRatios: this.calculateContrastRatios(component),
      ariaCompliant: errors.filter(e => e.category === "aria").length === 0,
      keyboardAccessible:
        errors.filter(e => e.category === "keyboard").length === 0,
    };
  }

  /**
   * Check semantic HTML
   */
  private checkSemanticHTML(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    const code = component.code.toLowerCase();

    // Check for button element for buttons
    if (component.type === "button" && !code.includes("<button")) {
      errors.push({
        category: "semantic",
        message: "Button component should use <button> element",
        severity: "high",
        location: component.metadata.id,
        suggestion: "Replace with <button> element",
      });
    }

    // Check for input label
    if (component.type === "input" && !code.includes("for=")) {
      warnings.push({
        category: "semantic",
        message: "Input should have an associated label",
        location: component.metadata.id,
      });
      suggestions.push(
        "Add <label> element with 'for' attribute matching input 'id'"
      );
    }
  }

  /**
   * Check color contrast
   */
  private checkColorContrast(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    const styles = component.styles;
    const color = styles.color as string | undefined;
    const backgroundColor = styles.backgroundColor as string | undefined;

    if (color && backgroundColor) {
      const contrast = this.colorUtils.contrastRatio(color, backgroundColor);

      // WCAG AA requires 4.5:1 for normal text
      if (contrast < 3) {
        errors.push({
          category: "contrast",
          message: `Insufficient color contrast: ${contrast.toFixed(2)}:1 (minimum 3:1)`,
          severity: "high",
          location: component.metadata.id,
          suggestion: "Increase color contrast to meet WCAG standards",
        });
      } else if (contrast < 4.5) {
        warnings.push({
          category: "contrast",
          message: `Low color contrast: ${contrast.toFixed(2)}:1 (recommended 4.5:1)`,
          location: component.metadata.id,
        });
        suggestions.push(
          "Consider increasing color contrast for better readability"
        );
      }
    }
  }

  /**
   * Check ARIA attributes
   */
  private checkARIA(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    const code = component.code;

    // Check for role attribute on interactive elements
    if (component.type === "button" && !code.includes("role=")) {
      suggestions.push(
        "Consider adding explicit ARIA role for better screen reader support"
      );
    }

    // Check for aria-label on icon-only buttons
    if (
      code.includes("<button") &&
      code.replace(/[^a-zA-Z]/g, "").length < 20 &&
      !code.includes("aria-label")
    ) {
      warnings.push({
        category: "aria",
        message: "Button with little text should have aria-label",
        location: component.metadata.id,
      });
      suggestions.push("Add aria-label attribute to describe button action");
    }
  }

  /**
   * Check keyboard accessibility
   */
  private checkKeyboardAccess(
    component: GeneratedComponent,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    const code = component.code;

    // Check for tabindex
    if (component.type === "button" && !code.includes("tabindex")) {
      suggestions.push(
        "Ensure component is keyboard accessible with proper tabindex"
      );
    }

    // Check for disabled state handling
    if (code.includes("disabled") && !code.includes("aria-disabled")) {
      warnings.push({
        category: "keyboard",
        message: "Disabled state should also use aria-disabled",
        location: component.metadata.id,
      });
    }
  }

  /**
   * Calculate overall accessibility score
   */
  private calculateScore(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): number {
    const errorWeights = { critical: 50, high: 25, medium: 10, low: 5 };
    const warningWeight = 2;

    let deductions = 0;
    for (const error of errors) {
      deductions += errorWeights[error.severity];
    }
    deductions += warnings.length * warningWeight;

    return Math.max(0, 1 - deductions / 100);
  }

  /**
   * Determine WCAG compliance level
   */
  private determineWCAGLevel(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): "A" | "AA" | "AAA" | "none" {
    const criticalErrors = errors.filter(e => e.severity === "critical").length;
    const highErrors = errors.filter(e => e.severity === "high").length;

    if (criticalErrors > 0 || highErrors > 0) return "none";
    if (warnings.length > 2) return "A";
    if (warnings.length > 0) return "AA";
    return "AAA";
  }

  /**
   * Calculate contrast ratios
   */
  private calculateContrastRatios(
    component: GeneratedComponent
  ): Record<string, number> {
    const ratios: Record<string, number> = {};
    const styles = component.styles;

    if (styles.color && styles.backgroundColor) {
      ratios["primary"] = this.colorUtils.contrastRatio(
        styles.color as string,
        styles.backgroundColor as string
      );
    }

    return ratios;
  }
}
