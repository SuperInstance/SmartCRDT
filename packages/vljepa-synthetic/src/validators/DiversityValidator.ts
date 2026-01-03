/**
 * @lsi/vljepa-synthetic - Diversity Validator
 *
 * Validates diversity in generated synthetic data.
 *
 * @module validators
 */

import type {
  DiversityReport,
  DiversityGap,
  GeneratedComponent,
  GeneratedLayout,
  StyleSystem,
  ComponentType,
  LayoutPattern,
} from "../types.js";

export class DiversityValidator {
  /**
   * Analyze diversity in generated components
   */
  analyzeComponents(components: GeneratedComponent[]): DiversityReport {
    const colorCoverage = this.analyzeColorCoverage(components);
    const layoutVariety = 0.8; // N/A for components
    const componentMix = this.analyzeComponentMix(components);
    const styleDiversity = this.analyzeStyleDiversity(components);
    const gaps = this.identifyGaps(components);
    const recommendations = this.generateRecommendations(gaps);

    const overallScore =
      (colorCoverage + layoutVariety + componentMix + styleDiversity) / 4;

    return {
      overallScore,
      colorCoverage,
      layoutVariety,
      componentMix,
      styleDiversity,
      gaps,
      recommendations,
    };
  }

  /**
   * Analyze diversity in generated layouts
   */
  analyzeLayouts(layouts: GeneratedLayout[]): DiversityReport {
    const colorCoverage = 0.7; // Less relevant for layouts
    const layoutVariety = this.analyzeLayoutVariety(layouts);
    const componentMix = 0.8;
    const styleDiversity = this.analyzeLayoutStyleDiversity(layouts);
    const gaps = this.identifyLayoutGaps(layouts);
    const recommendations = this.generateRecommendations(gaps);

    const overallScore =
      (colorCoverage + layoutVariety + componentMix + styleDiversity) / 4;

    return {
      overallScore,
      colorCoverage,
      layoutVariety,
      componentMix,
      styleDiversity,
      gaps,
      recommendations,
    };
  }

  /**
   * Analyze color coverage
   */
  private analyzeColorCoverage(components: GeneratedComponent[]): number {
    const colors = new Set<string>();

    for (const component of components) {
      const styles = component.styles;
      if (styles.color) colors.add(styles.color as string);
      if (styles.backgroundColor) colors.add(styles.backgroundColor as string);
      if (styles.borderColor) colors.add(styles.borderColor as string);
    }

    // More unique colors = better coverage
    const expectedColors = 100;
    const coverage = Math.min(1, colors.size / expectedColors);

    return coverage;
  }

  /**
   * Analyze component mix
   */
  private analyzeComponentMix(components: GeneratedComponent[]): number {
    const typeCounts = new Map<ComponentType, number>();

    for (const component of components) {
      const count = typeCounts.get(component.type) ?? 0;
      typeCounts.set(component.type, count + 1);
    }

    // Calculate evenness of distribution
    const counts = Array.from(typeCounts.values());
    const maxCount = Math.max(...counts);
    const total = components.length;

    if (total === 0) return 0;

    // Use Gini coefficient for diversity
    const sorted = counts.sort((a, b) => b - a);
    let gini = 0;
    for (let i = 0; i < sorted.length; i++) {
      gini += (2 * (i + 1) - sorted.length - 1) * sorted[i];
    }
    gini /= sorted.length * total;

    // Convert Gini to diversity score (lower Gini = higher diversity)
    return 1 - gini;
  }

  /**
   * Analyze style diversity
   */
  private analyzeStyleDiversity(components: GeneratedComponent[]): number {
    const styleSystems = new Set<StyleSystem>();

    for (const component of components) {
      styleSystems.add(component.metadata.styleSystem);
    }

    const expectedSystems = 6; // tailwind, material, ant, bootstrap, chakra, mantine
    return styleSystems.size / expectedSystems;
  }

  /**
   * Analyze layout variety
   */
  private analyzeLayoutVariety(layouts: GeneratedLayout[]): number {
    const patterns = new Set();

    for (const layout of layouts) {
      patterns.add(layout.pattern);
    }

    const expectedPatterns = 12;
    return Math.min(1, patterns.size / expectedPatterns);
  }

  /**
   * Analyze layout style diversity
   */
  private analyzeLayoutStyleDiversity(layouts: GeneratedLayout[]): number {
    const styleSystems = new Set<StyleSystem>();

    for (const layout of layouts) {
      styleSystems.add(layout.metadata.styleSystem);
    }

    const expectedSystems = 6;
    return styleSystems.size / expectedSystems;
  }

  /**
   * Identify diversity gaps
   */
  private identifyGaps(components: GeneratedComponent[]): DiversityGap[] {
    const gaps: DiversityGap[] = [];

    // Check for missing component types
    const allTypes: ComponentType[] = [
      "button",
      "input",
      "textarea",
      "card",
      "modal",
      "alert",
      "spinner",
      "tabs",
      "navbar",
      "sidebar",
      "table",
      "form",
    ];
    const presentTypes = new Set(components.map(c => c.type));
    const missingTypes = allTypes.filter(t => !presentTypes.has(t));

    if (missingTypes.length > 0) {
      gaps.push({
        category: "component-types",
        missing: missingTypes,
        underrepresented: [],
        priority: "high",
      });
    }

    // Check for underrepresented style systems
    const styleSystemCounts = new Map<StyleSystem, number>();
    for (const component of components) {
      const count = styleSystemCounts.get(component.metadata.styleSystem) ?? 0;
      styleSystemCounts.set(component.metadata.styleSystem, count + 1);
    }

    const underrepresentedStyles: Array<{
      item: string;
      currentCount: number;
      targetCount: number;
    }> = [];

    const targetCount = components.length / 6; // Even distribution
    for (const [style, count] of styleSystemCounts) {
      if (count < targetCount * 0.5) {
        underrepresentedStyles.push({
          item: style,
          currentCount: count,
          targetCount: Math.ceil(targetCount),
        });
      }
    }

    if (underrepresentedStyles.length > 0) {
      gaps.push({
        category: "style-systems",
        missing: [],
        underrepresented: underrepresentedStyles,
        priority: "medium",
      });
    }

    return gaps;
  }

  /**
   * Identify layout gaps
   */
  private identifyLayoutGaps(layouts: GeneratedLayout[]): DiversityGap[] {
    const gaps: DiversityGap[] = [];

    // Check for missing layout patterns
    const allPatterns: LayoutPattern[] = [
      "grid",
      "flex-row",
      "flex-column",
      "absolute",
      "sidebar-main",
      "header-content",
      "header-sidebar-content",
      "card-grid",
      "bento",
      "holy-grail",
      "fluid",
      "responsive-grid",
    ];
    const presentPatterns = new Set(layouts.map(l => l.pattern));
    const missingPatterns = allPatterns.filter(p => !presentPatterns.has(p));

    if (missingPatterns.length > 0) {
      gaps.push({
        category: "layout-patterns",
        missing: missingPatterns,
        underrepresented: [],
        priority: "high",
      });
    }

    return gaps;
  }

  /**
   * Generate recommendations based on gaps
   */
  private generateRecommendations(gaps: DiversityGap[]): string[] {
    const recommendations: string[] = [];

    for (const gap of gaps) {
      switch (gap.category) {
        case "component-types":
          recommendations.push(
            `Generate missing component types: ${gap.missing.join(", ")}`
          );
          break;

        case "style-systems":
          for (const item of gap.underrepresented ?? []) {
            recommendations.push(
              `Increase ${item.item} component count from ${item.currentCount} to ${item.targetCount}`
            );
          }
          break;

        case "layout-patterns":
          recommendations.push(
            `Generate missing layout patterns: ${gap.missing.join(", ")}`
          );
          break;
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Diversity looks good! Consider generating more variations to increase coverage."
      );
    }

    return recommendations;
  }
}
