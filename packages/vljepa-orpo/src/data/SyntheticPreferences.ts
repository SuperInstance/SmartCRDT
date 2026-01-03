/**
 * @lsi/vljepa-orpo - Synthetic Preferences Generator
 *
 * Generates synthetic UI preference pairs using multiple strategies:
 * - Design principles (Gestalt, color theory, typography)
 * - A/B test simulation
 * - Rule-based heuristics
 * - Learned patterns
 *
 * Target: Generate 5,000+ synthetic preferences
 *
 * @module data
 */

import type {
  UIPreferencePair,
  UIState,
  PreferenceContext,
  PreferenceMetadata,
  SyntheticPreferenceConfig,
  GeneratedPreference,
  PreferenceStrategy,
  DOMStructure,
  CSSProperties,
} from "../types.js";

/**
 * Design principle types
 */
type DesignPrinciple =
  | "gestalt"
  | "f_pattern"
  | "z_pattern"
  | "contrast"
  | "hierarchy"
  | "balance";

/**
 * Rule types for rule-based generation
 */
type RuleType =
  | "cta_size"
  | "color_contrast"
  | "spacing"
  | "alignment"
  | "typography";

/**
 * Synthetic Preferences Generator
 *
 * Generates synthetic UI preference pairs using multiple strategies.
 *
 * @example
 * ```typescript
 * const generator = new SyntheticPreferences(config);
 * const prefs = await generator.generate(5000);
 * const dataset = generator.toDataset(prefs);
 * ```
 */
export class SyntheticPreferences {
  private config: SyntheticPreferenceConfig;
  private rng: () => number;
  private designPrinciples: Map<DesignPrinciple, () => GeneratedPreference>;
  private rules: Map<RuleType, () => GeneratedPreference>;

  constructor(config: Partial<SyntheticPreferenceConfig> = {}) {
    this.config = {
      strategies: [
        { type: "design_principle", weight: 0.4, parameters: {} },
        { type: "ab_simulation", weight: 0.3, parameters: {} },
        { type: "rule_based", weight: 0.3, parameters: {} },
      ],
      qualityWeight: 0.6,
      diversity: 0.8,
      seed: 42,
      numPairs: 5000,
      ...config,
    };

    this.rng = this.seededRandom(this.config.seed);
    this.designPrinciples = this.initDesignPrinciples();
    this.rules = this.initRules();
  }

  /**
   * Generate synthetic preferences
   */
  async generate(count?: number): Promise<UIPreferencePair[]> {
    const targetCount = count ?? this.config.numPairs;
    const preferences: UIPreferencePair[] = [];

    // Weight strategies by config
    const totalWeight = this.config.strategies.reduce(
      (sum, s) => sum + s.weight,
      0
    );
    const normalizedStrategies = this.config.strategies.map(s => ({
      ...s,
      weight: s.weight / totalWeight,
    }));

    for (let i = 0; i < targetCount; i++) {
      // Select strategy based on weights
      const rand = this.rng();
      let cumulative = 0;
      let selectedStrategy = normalizedStrategies[0];

      for (const strategy of normalizedStrategies) {
        cumulative += strategy.weight;
        if (rand <= cumulative) {
          selectedStrategy = strategy;
          break;
        }
      }

      // Generate preference using selected strategy
      const pref = await this.generateWithStrategy(selectedStrategy);
      preferences.push(this.toUIPreferencePair(pref, i));
    }

    return preferences;
  }

  /**
   * Generate using specific strategy
   */
  private async generateWithStrategy(
    strategy: PreferenceStrategy
  ): Promise<GeneratedPreference> {
    switch (strategy.type) {
      case "design_principle":
        return this.generateDesignPrinciple();

      case "ab_simulation":
        return this.generateABSimulation();

      case "rule_based":
        return this.generateRuleBased();

      case "learned":
        return this.generateLearned();

      default:
        return this.generateDesignPrinciple();
    }
  }

  /**
   * Generate using design principles
   */
  private generateDesignPrinciple(): GeneratedPreference {
    // Randomly select a design principle
    const principles = Array.from(this.designPrinciples.keys());
    const principle = principles[Math.floor(this.rng() * principles.length)];
    const generator = this.designPrinciples.get(principle)!;

    return generator();
  }

  /**
   * Generate A/B test simulation
   */
  private generateABSimulation(): GeneratedPreference {
    // Simulate A/B test with one variant winning
    const conversionA = 0.02 + this.rng() * 0.15;
    const conversionB = 0.02 + this.rng() * 0.15;

    const chosen = conversionA > conversionB;
    const confidence = Math.min(1.0, Math.abs(conversionA - conversionB) * 10);

    const baseUI = this.createRandomUIState();
    const variantUI = this.createUIVariant(baseUI, "minor");

    return {
      chosen: chosen ? baseUI : variantUI,
      rejected: chosen ? variantUI : baseUI,
      reason: `A/B test: ${chosen ? "A" : "B"} converted ${(Math.max(conversionA, conversionB) * 100).toFixed(1)}% vs ${(Math.min(conversionA, conversionB) * 100).toFixed(1)}%`,
      confidence:
        this.config.qualityWeight * confidence +
        (1 - this.config.qualityWeight) * this.rng() * 0.3,
      strategy: "ab_simulation",
    };
  }

  /**
   * Generate using rule-based heuristics
   */
  private generateRuleBased(): GeneratedPreference {
    // Randomly select a rule
    const ruleKeys = Array.from(this.rules.keys());
    const rule = ruleKeys[Math.floor(this.rng() * ruleKeys.length)];
    const generator = this.rules.get(rule)!;

    return generator();
  }

  /**
   * Generate using learned patterns (placeholder)
   */
  private generateLearned(): GeneratedPreference {
    // TODO: Load actual learned patterns from training
    // For now, fall back to design principles
    return this.generateDesignPrinciple();
  }

  /**
   * Initialize design principle generators
   */
  private initDesignPrinciples(): Map<
    DesignPrinciple,
    () => GeneratedPreference
  > {
    return new Map([
      ["gestalt", () => this.generateGestaltPrinciple()],
      ["f_pattern", () => this.generateFPattern()],
      ["z_pattern", () => this.generateZPattern()],
      ["contrast", () => this.generateContrast()],
      ["hierarchy", () => this.generateHierarchy()],
      ["balance", () => this.generateBalance()],
    ]);
  }

  /**
   * Initialize rule generators
   */
  private initRules(): Map<RuleType, () => GeneratedPreference> {
    return new Map([
      ["cta_size", () => this.generateCTASizeRule()],
      ["color_contrast", () => this.generateColorContrastRule()],
      ["spacing", () => this.generateSpacingRule()],
      ["alignment", () => this.generateAlignmentRule()],
      ["typography", () => this.generateTypographyRule()],
    ]);
  }

  /**
   * Generate using Gestalt principle
   */
  private generateGestaltPrinciple(): GeneratedPreference {
    // Proximity: related elements should be close together
    const chosen = this.createRandomUIState();
    const rejected = { ...chosen };

    // Chosen: grouped related elements
    chosen.styles.margin = "8px";
    chosen.styles.gap = "16px";

    // Rejected: scattered elements
    rejected.styles.margin = "32px";
    rejected.styles.gap = "48px";

    return {
      chosen,
      rejected,
      reason: "Gestalt proximity principle: related elements grouped together",
      confidence: 0.8 + this.rng() * 0.2,
      strategy: "design_principle",
    };
  }

  /**
   * Generate using F-pattern layout
   */
  private generateFPattern(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: F-pattern friendly (top horizontal, then left vertical)
    chosen.dom.children[0].attributes = { layout: "f-pattern" };
    chosen.styles.display = "flex";
    chosen.styles.flexDirection = "column";
    chosen.styles.alignItems = "flex-start";

    // Rejected: Scattered layout
    rejected.dom.children[0].attributes = { layout: "random" };
    rejected.styles.position = "absolute";

    return {
      chosen,
      rejected,
      reason: "F-pattern reading: content follows natural eye movement",
      confidence: 0.75 + this.rng() * 0.2,
      strategy: "design_principle",
    };
  }

  /**
   * Generate using Z-pattern layout
   */
  private generateZPattern(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Z-pattern (top-left → top-right → bottom-left → bottom-right)
    chosen.dom.children[0].attributes = { layout: "z-pattern" };
    chosen.styles.display = "grid";
    chosen.styles.gridTemplateColumns = "1fr 1fr";

    // Rejected: Center-focused
    rejected.dom.children[0].attributes = { layout: "center" };
    rejected.styles.textAlign = "center";

    return {
      chosen,
      rejected,
      reason: "Z-pattern: key elements follow Z-shaped scanning path",
      confidence: 0.7 + this.rng() * 0.25,
      strategy: "design_principle",
    };
  }

  /**
   * Generate using contrast principle
   */
  private generateContrast(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = { ...chosen };

    // Chosen: High contrast
    chosen.styles.color = "#000000";
    chosen.styles.backgroundColor = "#ffffff";

    // Rejected: Low contrast
    rejected.styles.color = "#808080";
    rejected.styles.backgroundColor = "#a0a0a0";

    return {
      chosen,
      rejected,
      reason: "Color contrast: WCAG AA compliant vs poor contrast",
      confidence: 0.85 + this.rng() * 0.15,
      strategy: "design_principle",
    };
  }

  /**
   * Generate using hierarchy principle
   */
  private generateHierarchy(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = { ...chosen };

    // Chosen: Clear visual hierarchy
    chosen.dom.children.push({
      tagName: "h1",
      classes: ["title"],
      children: [],
      attributes: { size: "32px" },
      text: "Main Title",
    });
    chosen.dom.children.push({
      tagName: "p",
      classes: ["subtitle"],
      children: [],
      attributes: { size: "16px" },
      text: "Subtitle",
    });

    // Rejected: No hierarchy
    rejected.dom.children.push({
      tagName: "span",
      classes: ["text"],
      children: [],
      attributes: { size: "18px" },
      text: "Same size text",
    });
    rejected.dom.children.push({
      tagName: "span",
      classes: ["text"],
      children: [],
      attributes: { size: "18px" },
      text: "Same size text",
    });

    return {
      chosen,
      rejected,
      reason: "Visual hierarchy: clear size differentiation",
      confidence: 0.8 + this.rng() * 0.15,
      strategy: "design_principle",
    };
  }

  /**
   * Generate using balance principle
   */
  private generateBalance(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Balanced layout
    chosen.styles.display = "flex";
    chosen.styles.justifyContent = "space-between";

    // Rejected: Unbalanced
    rejected.styles.display = "block";
    rejected.styles.float = "left";

    return {
      chosen,
      rejected,
      reason: "Visual balance: symmetrical weight distribution",
      confidence: 0.7 + this.rng() * 0.25,
      strategy: "design_principle",
    };
  }

  /**
   * Generate CTA size rule
   */
  private generateCTASizeRule(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Large, prominent CTA
    chosen.styles.padding = "16px 32px";
    chosen.styles.fontSize = "18px";
    chosen.styles.fontWeight = "bold";

    // Rejected: Small, subtle CTA
    rejected.styles.padding = "8px 12px";
    rejected.styles.fontSize = "14px";
    rejected.styles.fontWeight = "normal";

    return {
      chosen,
      rejected,
      reason: "CTA best practice: larger button increases conversions",
      confidence: 0.75 + this.rng() * 0.2,
      strategy: "rule_based",
    };
  }

  /**
   * Generate color contrast rule
   */
  private generateColorContrastRule(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: High contrast button
    chosen.styles.backgroundColor = "#2563eb";
    chosen.styles.color = "#ffffff";

    // Rejected: Low contrast button
    rejected.styles.backgroundColor = "#dbeafe";
    rejected.styles.color = "#93c5fd";

    return {
      chosen,
      rejected,
      reason: "WCAG accessibility: sufficient color contrast",
      confidence: 0.85 + this.rng() * 0.15,
      strategy: "rule_based",
    };
  }

  /**
   * Generate spacing rule
   */
  private generateSpacingRule(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Consistent spacing (8px grid)
    chosen.styles.gap = "16px";
    chosen.styles.padding = "16px";

    // Rejected: Inconsistent spacing
    rejected.styles.gap = "13px";
    rejected.styles.padding = "19px";

    return {
      chosen,
      rejected,
      reason: "Design system: consistent spacing using 8px grid",
      confidence: 0.7 + this.rng() * 0.25,
      strategy: "rule_based",
    };
  }

  /**
   * Generate alignment rule
   */
  private generateAlignmentRule(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Left aligned with consistent edge
    chosen.styles.textAlign = "left";
    chosen.styles.marginLeft = "0";

    // Rejected: Center aligned
    rejected.styles.textAlign = "center";

    return {
      chosen,
      rejected,
      reason: "Alignment: left-aligned text is easier to scan",
      confidence: 0.65 + this.rng() * 0.3,
      strategy: "rule_based",
    };
  }

  /**
   * Generate typography rule
   */
  private generateTypographyRule(): GeneratedPreference {
    const chosen = this.createRandomUIState();
    const rejected = this.createRandomUIState();

    // Chosen: Readable typography
    chosen.styles.fontSize = "16px";
    chosen.styles.lineHeight = "1.5";
    chosen.styles.maxWidth = "65ch";

    // Rejected: Less readable
    rejected.styles.fontSize = "12px";
    rejected.styles.lineHeight = "1.2";
    rejected.styles.maxWidth = "100ch";

    return {
      chosen,
      rejected,
      reason: "Typography: optimal line length and height for readability",
      confidence: 0.75 + this.rng() * 0.2,
      strategy: "rule_based",
    };
  }

  /**
   * Create a random UI state
   */
  private createRandomUIState(): UIState {
    const width = Math.floor(this.rng() * 1000 + 500);
    const height = Math.floor(this.rng() * 800 + 400);

    return {
      image: this.createImageData(width, height),
      embedding: new Float32Array(768).map(() => this.rng() * 2 - 1),
      dom: this.createRandomDOM(),
      styles: this.createRandomStyles(),
    };
  }

  /**
   * Create image data
   */
  private createImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < data.length; i += 4) {
      // Generate random color
      data[i] = Math.floor(this.rng() * 256); // R
      data[i + 1] = Math.floor(this.rng() * 256); // G
      data[i + 2] = Math.floor(this.rng() * 256); // B
      data[i + 3] = 255; // A
    }

    return { data, width, height, colorSpace: "srgb" };
  }

  /**
   * Create random DOM structure
   */
  private createRandomDOM(): DOMStructure {
    const tagNames = [
      "div",
      "button",
      "section",
      "article",
      "header",
      "footer",
    ];
    const tagName = tagNames[Math.floor(this.rng() * tagNames.length)];

    return {
      tagName,
      id: `el_${Math.floor(this.rng() * 10000)}`,
      classes: [`class_${Math.floor(this.rng() * 100)}`],
      children: [],
      attributes: {},
      text: this.rng() > 0.5 ? "Sample text" : undefined,
      bbox: {
        x: Math.floor(this.rng() * 1000),
        y: Math.floor(this.rng() * 800),
        width: Math.floor(this.rng() * 200 + 50),
        height: Math.floor(this.rng() * 100 + 30),
      },
    };
  }

  /**
   * Create random CSS properties
   */
  private createRandomStyles(): CSSProperties {
    const display = ["flex", "grid", "block", "inline-block"][
      Math.floor(this.rng() * 4)
    ];
    const colors = [
      "#ffffff",
      "#f3f4f6",
      "#000000",
      "#1f2937",
      "#2563eb",
      "#dc2626",
    ];

    return {
      display,
      position: this.rng() > 0.7 ? "relative" : undefined,
      margin: this.rng() > 0.5 ? `${Math.floor(this.rng() * 32)}px` : undefined,
      padding:
        this.rng() > 0.5 ? `${Math.floor(this.rng() * 32)}px` : undefined,
      backgroundColor: colors[Math.floor(this.rng() * colors.length)],
      color: colors[Math.floor(this.rng() * colors.length)],
      fontSize: `${Math.floor(this.rng() * 24 + 12)}px`,
      borderRadius:
        this.rng() > 0.5 ? `${Math.floor(this.rng() * 12)}px` : undefined,
    };
  }

  /**
   * Create UI variant
   */
  private createUIVariant(base: UIState, severity: "minor" | "major"): UIState {
    const variant = JSON.parse(JSON.stringify(base)) as UIState;

    if (severity === "minor") {
      // Minor changes: adjust colors slightly
      if (variant.styles.backgroundColor) {
        variant.styles.backgroundColor = this.adjustColor(
          variant.styles.backgroundColor,
          10
        );
      }
      if (variant.styles.padding) {
        const current = parseInt(variant.styles.padding as string);
        variant.styles.padding = `${current + Math.floor(this.rng() * 8 - 4)}px`;
      }
    } else {
      // Major changes: different layout
      variant.styles.display =
        variant.styles.display === "flex" ? "grid" : "flex";
    }

    return variant;
  }

  /**
   * Adjust color brightness
   */
  private adjustColor(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  /**
   * Convert generated preference to UI preference pair
   */
  private toUIPreferencePair(
    pref: GeneratedPreference,
    index: number
  ): UIPreferencePair {
    return {
      id: `synthetic_${Date.now()}_${index}`,
      chosen: pref.chosen,
      rejected: pref.rejected,
      context: {
        task: "UI improvement",
        userIntent: "Better user experience",
        uiContext: "landing_page",
        constraints: {},
      },
      metadata: {
        source: "synthetic",
        confidence: pref.confidence,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Get configuration
   */
  getConfig(): SyntheticPreferenceConfig {
    return { ...this.config };
  }

  /**
   * Set random seed
   */
  setSeed(seed: number): void {
    this.config.seed = seed;
    this.rng = this.seededRandom(seed);
  }

  /**
   * Add custom strategy
   */
  addStrategy(strategy: PreferenceStrategy): void {
    this.config.strategies.push(strategy);
  }
}

/**
 * Create synthetic preferences generator
 */
export function createSyntheticPreferences(
  config?: Partial<SyntheticPreferenceConfig>
): SyntheticPreferences {
  return new SyntheticPreferences(config);
}

/**
 * Generate synthetic preferences (convenience function)
 */
export async function generateSyntheticPreferences(
  count: number = 5000,
  config?: Partial<SyntheticPreferenceConfig>
): Promise<UIPreferencePair[]> {
  const generator = new SyntheticPreferences(config);
  return await generator.generate(count);
}
