/**
 * Stage 2: Components
 *
 * Learning Objectives:
 * - Individual components: Buttons, inputs, cards, modals, etc.
 * - Component states: Default, hover, active, disabled, focus
 * - Variations: Styles, sizes, colors, icons
 * - Recognition: Identify component type and attributes
 *
 * Target: 15,000+ component examples
 * Difficulty Range: 0.25-0.5
 */

import type {
  ComponentType,
  UIState,
  ComponentAttributes,
  Stage2Config,
  Stage2Example,
  TrainingExample,
  DataGenerator,
  StageEvaluator,
  GeneratorProgress,
  EvaluationResult,
  BatchEvaluationResult,
  StageProgress,
} from "../types.js";

export class Stage2Components {
  private config: Stage2Config;
  private generator: ComponentsGenerator;
  private evaluator: ComponentsEvaluator;

  constructor(config: Partial<Stage2Config> = {}) {
    this.config = {
      examples: 15000,
      epochs: 15,
      batchSize: 32,
      masteryThreshold: 0.85,
      patience: 5,
      prerequisites: ["stage1"],
      components: this.getDefaultComponents(),
      states: ["default", "hover", "active", "disabled", "focus"],
      difficulty: "easy" as const,
      styleVariations: 5,
      ...config,
    };

    this.generator = new ComponentsGenerator(this.config);
    this.evaluator = new ComponentsEvaluator();
  }

  /**
   * Get default component types for Stage 2
   */
  private getDefaultComponents(): ComponentType[] {
    return [
      "button",
      "input",
      "select",
      "checkbox",
      "radio",
      "card",
      "modal",
      "dropdown",
      "slider",
      "toggle",
    ];
  }

  /**
   * Initialize the stage
   */
  async initialize(): Promise<void> {
    await this.generator.initialize(this.config);
  }

  /**
   * Generate training examples
   */
  async generateExamples(count: number): Promise<Stage2Example[]> {
    return await this.generator.generate(count);
  }

  /**
   * Evaluate predictions
   */
  evaluate(example: Stage2Example, prediction: Float32Array): EvaluationResult {
    return this.evaluator.evaluate(example, prediction);
  }

  /**
   * Check if stage is mastered
   */
  isMastered(progress: StageProgress): boolean {
    return progress.mastery >= this.config.masteryThreshold;
  }

  /**
   * Get configuration
   */
  getConfig(): Stage2Config {
    return { ...this.config };
  }

  /**
   * Get generator progress
   */
  getGeneratorProgress(): GeneratorProgress {
    return this.generator.getProgress();
  }
}

/**
 * Component specifications and rendering utilities
 */
interface ComponentSpec {
  type: ComponentType;
  baseSize: { width: number; height: number };
  padding: number;
  borderRadius: number;
  colors: Record<UIState, { bg: number[]; border: number[]; text: number[] }>;
  shadows: Record<UIState, number[]>;
}

class ComponentsGenerator implements DataGenerator {
  private config: Stage2Config;
  private progress: GeneratorProgress = {
    generated: 0,
    target: 0,
    complete: false,
  };
  private componentSpecs: Map<ComponentType, ComponentSpec>;
  private random: () => number;

  constructor(config: Stage2Config) {
    this.config = config;
    this.componentSpecs = this.initializeComponentSpecs();
    let seed = 12345;
    this.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  async initialize(config: Stage2Config): Promise<void> {
    this.config = config;
    this.progress = {
      generated: 0,
      target: config.examples,
      complete: false,
    };
  }

  async generate(count: number): Promise<Stage2Example[]> {
    const examples: Stage2Example[] = [];

    for (let i = 0; i < count; i++) {
      const component = this.selectComponent();
      const state = this.selectState();
      const attributes = this.generateAttributes(component);
      const example = this.generateExample(component, state, attributes);
      examples.push(example);
      this.progress.generated++;
    }

    if (this.progress.generated >= this.progress.target) {
      this.progress.complete = true;
    }

    return examples;
  }

  private initializeComponentSpecs(): Map<ComponentType, ComponentSpec> {
    const specs = new Map<ComponentType, ComponentSpec>();

    // Button
    specs.set("button", {
      type: "button",
      baseSize: { width: 120, height: 40 },
      padding: 8,
      borderRadius: 6,
      colors: {
        default: {
          bg: [59, 130, 246],
          border: [37, 99, 235],
          text: [255, 255, 255],
        },
        hover: {
          bg: [37, 99, 235],
          border: [29, 78, 216],
          text: [255, 255, 255],
        },
        active: {
          bg: [29, 78, 216],
          border: [30, 64, 175],
          text: [255, 255, 255],
        },
        disabled: {
          bg: [209, 213, 219],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [59, 130, 246],
          border: [99, 102, 241],
          text: [255, 255, 255],
        },
        error: {
          bg: [239, 68, 68],
          border: [220, 38, 38],
          text: [255, 255, 255],
        },
      },
      shadows: {
        default: [0, 1, 3, 0.1],
        hover: [0, 4, 6, 0.1],
        active: [0, 2, 4, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.15],
        error: [0, 2, 8, 0.15],
      },
    });

    // Input
    specs.set("input", {
      type: "input",
      baseSize: { width: 200, height: 40 },
      padding: 10,
      borderRadius: 6,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        active: {
          bg: [255, 255, 255],
          border: [59, 130, 246],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [249, 250, 251],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [255, 255, 255],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 0, 0, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Card
    specs.set("card", {
      type: "card",
      baseSize: { width: 280, height: 180 },
      padding: 16,
      borderRadius: 12,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [229, 231, 235],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        active: {
          bg: [249, 250, 251],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [243, 244, 246],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [254, 242, 242],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 3, 0.1],
        hover: [0, 10, 15, 0.1],
        active: [0, 2, 5, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 4, 12, 0.15],
      },
    });

    // Checkbox
    specs.set("checkbox", {
      type: "checkbox",
      baseSize: { width: 24, height: 24 },
      padding: 4,
      borderRadius: 4,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        active: {
          bg: [59, 130, 246],
          border: [59, 130, 246],
          text: [255, 255, 255],
        },
        disabled: {
          bg: [249, 250, 251],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [255, 255, 255],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 2, 4, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Modal
    specs.set("modal", {
      type: "modal",
      baseSize: { width: 400, height: 300 },
      padding: 24,
      borderRadius: 12,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [229, 231, 235],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [229, 231, 235],
          text: [17, 24, 39],
        },
        active: {
          bg: [255, 255, 255],
          border: [229, 231, 235],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [243, 244, 246],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [254, 242, 242],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 20, 25, 0.15],
        hover: [0, 20, 25, 0.15],
        active: [0, 20, 25, 0.15],
        disabled: [0, 10, 15, 0.1],
        focus: [0, 25, 50, 0.25],
        error: [0, 20, 25, 0.2],
      },
    });

    // Select dropdown
    specs.set("select", {
      type: "select",
      baseSize: { width: 180, height: 40 },
      padding: 8,
      borderRadius: 6,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        active: {
          bg: [255, 255, 255],
          border: [59, 130, 246],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [249, 250, 251],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [255, 255, 255],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 4, 6, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Radio button
    specs.set("radio", {
      type: "radio",
      baseSize: { width: 24, height: 24 },
      padding: 4,
      borderRadius: 12,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        hover: {
          bg: [255, 255, 255],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        active: {
          bg: [59, 130, 246],
          border: [59, 130, 246],
          text: [255, 255, 255],
        },
        disabled: {
          bg: [249, 250, 251],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [255, 255, 255],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 2, 4, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Slider
    specs.set("slider", {
      type: "slider",
      baseSize: { width: 200, height: 24 },
      padding: 0,
      borderRadius: 12,
      colors: {
        default: {
          bg: [229, 231, 235],
          border: [229, 231, 235],
          text: [17, 24, 39],
        },
        hover: {
          bg: [209, 213, 219],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        active: {
          bg: [156, 163, 175],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [243, 244, 246],
          border: [243, 244, 246],
          text: [156, 163, 175],
        },
        focus: {
          bg: [59, 130, 246],
          border: [59, 130, 246],
          text: [255, 255, 255],
        },
        error: {
          bg: [254, 226, 226],
          border: [254, 226, 226],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 2, 5, 0.15],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Toggle switch
    specs.set("toggle", {
      type: "toggle",
      baseSize: { width: 48, height: 28 },
      padding: 2,
      borderRadius: 14,
      colors: {
        default: {
          bg: [229, 231, 235],
          border: [229, 231, 235],
          text: [255, 255, 255],
        },
        hover: {
          bg: [209, 213, 219],
          border: [209, 213, 219],
          text: [255, 255, 255],
        },
        active: {
          bg: [59, 130, 246],
          border: [59, 130, 246],
          text: [255, 255, 255],
        },
        disabled: {
          bg: [243, 244, 246],
          border: [243, 244, 246],
          text: [156, 163, 175],
        },
        focus: {
          bg: [59, 130, 246],
          border: [99, 102, 241],
          text: [255, 255, 255],
        },
        error: {
          bg: [239, 68, 68],
          border: [239, 68, 68],
          text: [255, 255, 255],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 2, 4, 0.15],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    // Dropdown menu
    specs.set("dropdown", {
      type: "dropdown",
      baseSize: { width: 200, height: 40 },
      padding: 8,
      borderRadius: 6,
      colors: {
        default: {
          bg: [255, 255, 255],
          border: [209, 213, 219],
          text: [17, 24, 39],
        },
        hover: {
          bg: [249, 250, 251],
          border: [156, 163, 175],
          text: [17, 24, 39],
        },
        active: {
          bg: [243, 244, 246],
          border: [107, 114, 128],
          text: [17, 24, 39],
        },
        disabled: {
          bg: [249, 250, 251],
          border: [229, 231, 235],
          text: [156, 163, 175],
        },
        focus: {
          bg: [255, 255, 255],
          border: [99, 102, 241],
          text: [17, 24, 39],
        },
        error: {
          bg: [254, 242, 242],
          border: [239, 68, 68],
          text: [17, 24, 39],
        },
      },
      shadows: {
        default: [0, 1, 2, 0.05],
        hover: [0, 1, 3, 0.1],
        active: [0, 4, 6, 0.1],
        disabled: [0, 0, 0, 0],
        focus: [0, 0, 0, 0.2],
        error: [0, 0, 0, 0.1],
      },
    });

    return specs;
  }

  private selectComponent(): ComponentType {
    const index = Math.floor(this.random() * this.config.components.length);
    return this.config.components[index];
  }

  private selectState(): UIState {
    const index = Math.floor(this.random() * this.config.states.length);
    return this.config.states[index];
  }

  private generateAttributes(component: ComponentType): ComponentAttributes {
    const sizes = ["xs", "sm", "md", "lg", "xl"] as const;
    const variants = [
      "primary",
      "secondary",
      "outline",
      "ghost",
      "danger",
    ] as const;

    return {
      size: sizes[Math.floor(this.random() * sizes.length)],
      variant: variants[Math.floor(this.random() * variants.length)],
      icon: this.random() > 0.7,
      label: this.random() > 0.3 ? "Sample" : undefined,
      placeholder: this.random() > 0.5 ? "Enter text..." : undefined,
      disabled: Math.random() > 0.8,
      loading: Math.random() > 0.9,
    };
  }

  private generateExample(
    component: ComponentType,
    state: UIState,
    attributes: ComponentAttributes
  ): Stage2Example {
    const spec = this.componentSpecs.get(component);
    if (!spec) {
      throw new Error(`No spec found for component: ${component}`);
    }

    // Generate image with component
    const { width, height } = this.calculateSize(
      attributes.size,
      spec.baseSize
    );
    const padding = 20;
    const imageData = this.renderComponent(
      component,
      state,
      attributes,
      spec,
      width,
      height,
      padding
    );

    // Generate embedding
    const embedding = this.generateEmbedding(component, state, attributes);

    // Calculate difficulty
    const difficulty = this.calculateDifficulty(component, state, attributes);

    return {
      id: `stage2_${component}_${state}_${this.progress.generated}`,
      stageId: "stage2_components",
      imageData,
      embedding,
      metadata: {
        labels: [component, state, attributes.variant || "default"],
        attributes: {
          component,
          state,
          size: attributes.size,
          variant: attributes.variant,
        },
      },
      difficulty,
      timestamp: Date.now(),
      component,
      state,
      attributes,
    };
  }

  private calculateSize(
    size: string | undefined,
    baseSize: { width: number; height: number }
  ): { width: number; height: number } {
    const multiplier =
      size === "xs"
        ? 0.75
        : size === "sm"
          ? 0.875
          : size === "lg"
            ? 1.125
            : size === "xl"
              ? 1.25
              : 1.0;
    return {
      width: Math.floor(baseSize.width * multiplier),
      height: Math.floor(baseSize.height * multiplier),
    };
  }

  private renderComponent(
    component: ComponentType,
    state: UIState,
    attributes: ComponentAttributes,
    spec: ComponentSpec,
    width: number,
    height: number,
    padding: number
  ): { width: number; height: number; channels: number; data: Uint8Array } {
    const totalWidth = width + padding * 2;
    const totalHeight = height + padding * 2;
    const channels = 3;
    const data = new Uint8Array(totalWidth * totalHeight * channels);

    // Clear background
    for (let i = 0; i < data.length; i += channels) {
      data[i] = 248;
      data[i + 1] = 249;
      data[i + 2] = 250;
    }

    // Get colors for state
    const colors = spec.colors[state] || spec.colors.default;
    const shadow = spec.shadows[state] || spec.shadows.default;

    // Draw shadow
    this.drawShadow(
      data,
      totalWidth,
      totalHeight,
      channels,
      padding,
      padding,
      width,
      height,
      shadow
    );

    // Draw component background
    this.drawRoundedRect(
      data,
      totalWidth,
      totalHeight,
      channels,
      padding,
      padding,
      width,
      height,
      spec.borderRadius,
      colors.bg
    );

    // Draw border
    this.drawBorder(
      data,
      totalWidth,
      totalHeight,
      channels,
      padding,
      padding,
      width,
      height,
      spec.borderRadius,
      colors.border
    );

    // Component-specific rendering
    this.renderComponentContent(
      data,
      totalWidth,
      totalHeight,
      channels,
      component,
      state,
      attributes,
      spec,
      padding,
      width,
      height,
      colors
    );

    return { width: totalWidth, height: totalHeight, channels, data };
  }

  private drawShadow(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    w: number,
    h: number,
    shadow: number[]
  ): void {
    const [offsetX, offsetY, blur, alpha] = shadow;
    const alphaByte = Math.floor(alpha * 255);

    for (
      let sy = Math.max(0, y + offsetY);
      sy < Math.min(height, y + h + offsetY + blur);
      sy++
    ) {
      for (
        let sx = Math.max(0, x + offsetX);
        sx < Math.min(width, x + w + offsetX + blur);
        sx++
      ) {
        const dist = Math.sqrt(
          (sx - (x + offsetX)) ** 2 + (sy - (y + offsetY + h / 2)) ** 2
        );
        if (dist < blur) {
          const shadowAlpha = alphaByte * (1 - dist / blur);
          const idx = (sy * width + sx) * channels;
          data[idx] = Math.max(0, data[idx] - shadowAlpha);
          data[idx + 1] = Math.max(0, data[idx + 1] - shadowAlpha);
          data[idx + 2] = Math.max(0, data[idx + 2] - shadowAlpha);
        }
      }
    }
  }

  private drawRoundedRect(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: number[]
  ): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        let inRect = true;

        // Corner rounding
        if (px < x + radius && py < y + radius) {
          if (
            (px - (x + radius)) ** 2 + (py - (y + radius)) ** 2 >
            radius ** 2
          ) {
            inRect = false;
          }
        } else if (px > x + w - radius && py < y + radius) {
          if (
            (px - (x + w - radius)) ** 2 + (py - (y + radius)) ** 2 >
            radius ** 2
          ) {
            inRect = false;
          }
        } else if (px < x + radius && py > y + h - radius) {
          if (
            (px - (x + radius)) ** 2 + (py - (y + h - radius)) ** 2 >
            radius ** 2
          ) {
            inRect = false;
          }
        } else if (px > x + w - radius && py > y + h - radius) {
          if (
            (px - (x + w - radius)) ** 2 + (py - (y + h - radius)) ** 2 >
            radius ** 2
          ) {
            inRect = false;
          }
        }

        if (inRect && px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private drawBorder(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: number[]
  ): void {
    const borderWidth = 2;

    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        let onEdge = false;
        const distToEdge = Math.min(px - x, x + w - px, py - y, y + h - py);

        if (distToEdge < borderWidth) {
          onEdge = true;
        }

        // Skip corners
        if (
          (px < x + radius && py < y + radius) ||
          (px > x + w - radius && py < y + radius) ||
          (px < x + radius && py > y + h - radius) ||
          (px > x + w - radius && py > y + h - radius)
        ) {
          const cornerX = px < x + w / 2 ? px - x : x + w - px;
          const cornerY = py < y + h / 2 ? py - y : y + h - py;
          if (
            cornerX ** 2 + cornerY ** 2 > (radius - borderWidth) ** 2 &&
            cornerX ** 2 + cornerY ** 2 < radius ** 2
          ) {
            onEdge = true;
          } else {
            onEdge = false;
          }
        }

        if (onEdge && px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private renderComponentContent(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    component: ComponentType,
    state: UIState,
    attributes: ComponentAttributes,
    spec: ComponentSpec,
    padding: number,
    w: number,
    h: number,
    colors: Record<string, number[]>
  ): void {
    const centerX = padding + w / 2;
    const centerY = padding + h / 2;

    switch (component) {
      case "button":
        // Draw text placeholder
        this.drawText(
          data,
          width,
          height,
          channels,
          "Button",
          centerX,
          centerY,
          colors.text,
          14
        );
        break;

      case "input":
        this.drawText(
          data,
          width,
          height,
          channels,
          attributes.placeholder || "Input...",
          centerX,
          centerY,
          [156, 163, 175],
          12
        );
        break;

      case "checkbox":
        if (state === "active" || attributes.disabled === false) {
          // Draw checkmark
          const cx = centerX;
          const cy = centerY;
          for (let i = 0; i < 8; i++) {
            const px = cx - 4 + i;
            const py = cy + (i < 4 ? i - 2 : 6 - i);
            if (
              px >= padding &&
              px < width - padding &&
              py >= padding &&
              py < height - padding
            ) {
              const idx = (Math.floor(py) * width + Math.floor(px)) * channels;
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            }
          }
        }
        break;

      case "radio":
        if (state === "active") {
          // Draw inner circle
          const innerRadius = 6;
          for (
            let py = centerY - innerRadius;
            py < centerY + innerRadius;
            py++
          ) {
            for (
              let px = centerX - innerRadius;
              px < centerX + innerRadius;
              px++
            ) {
              if (
                (px - centerX) ** 2 + (py - centerY) ** 2 <=
                innerRadius ** 2
              ) {
                const idx =
                  (Math.floor(py) * width + Math.floor(px)) * channels;
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
              }
            }
          }
        }
        break;

      case "slider":
        // Draw track
        const trackY = centerY;
        for (let px = padding + 8; px < padding + w - 8; px++) {
          for (let py = trackY - 2; py < trackY + 2; py++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * channels;
              data[idx] = colors.bg[0];
              data[idx + 1] = colors.bg[1];
              data[idx + 2] = colors.bg[2];
            }
          }
        }
        // Draw thumb
        const thumbX = padding + w / 2;
        for (let py = centerY - 8; py < centerY + 8; py++) {
          for (let px = thumbX - 6; px < thumbX + 6; px++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * channels;
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            }
          }
        }
        break;

      case "toggle":
        // Draw thumb
        const thumbX2 = state === "active" ? padding + w - 18 : padding + 10;
        for (let py = centerY - 10; py < centerY + 10; py++) {
          for (let px = thumbX2 - 8; px < thumbX2 + 8; px++) {
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (Math.floor(py) * width + Math.floor(px)) * channels;
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            }
          }
        }
        break;

      case "card":
        // Card content header
        this.drawText(
          data,
          width,
          height,
          channels,
          "Card Title",
          padding + 16,
          padding + 24,
          colors.text,
          14
        );
        // Card content body
        for (let i = 0; i < 3; i++) {
          const lineY = padding + 48 + i * 16;
          this.drawHorizontalLine(
            data,
            width,
            height,
            channels,
            padding + 16,
            lineY,
            w - 32,
            4,
            [229, 231, 235]
          );
        }
        break;

      case "select":
        this.drawText(
          data,
          width,
          height,
          channels,
          "Select ▼",
          centerX - 10,
          centerY,
          colors.text,
          12
        );
        break;

      case "dropdown":
        this.drawText(
          data,
          width,
          height,
          channels,
          "Menu ▼",
          centerX - 10,
          centerY,
          colors.text,
          12
        );
        break;

      case "modal":
        // Modal header
        this.drawText(
          data,
          width,
          height,
          channels,
          "Modal",
          padding + 20,
          padding + 30,
          colors.text,
          16
        );
        // Modal content
        for (let i = 0; i < 4; i++) {
          const lineY = padding + 60 + i * 20;
          this.drawHorizontalLine(
            data,
            width,
            height,
            channels,
            padding + 20,
            lineY,
            w - 40,
            6,
            [229, 231, 235]
          );
        }
        // Modal buttons
        this.drawButtonPlaceholder(
          data,
          width,
          height,
          channels,
          padding + 100,
          padding + h - 50,
          80,
          32,
          [209, 213, 219]
        );
        this.drawButtonPlaceholder(
          data,
          width,
          height,
          channels,
          padding + 190,
          padding + h - 50,
          80,
          32,
          [59, 130, 246]
        );
        break;
    }
  }

  private drawText(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    text: string,
    x: number,
    y: number,
    color: number[],
    size: number
  ): void {
    // Simplified text rendering (draws horizontal lines to represent text)
    const textWidth = text.length * size * 0.6;
    const startX = x - textWidth / 2;

    for (let i = 0; i < text.length; i++) {
      const charX = startX + i * size * 0.6;
      for (let py = y - size / 2; py < y + size / 2; py++) {
        for (let px = charX; px < charX + size * 0.5; px++) {
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (Math.floor(py) * width + Math.floor(px)) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    }
  }

  private drawHorizontalLine(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number[]
  ): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (Math.floor(py) * width + Math.floor(px)) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private drawButtonPlaceholder(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number[]
  ): void {
    this.drawRoundedRect(data, width, height, channels, x, y, w, h, 6, color);
  }

  private generateEmbedding(
    component: ComponentType,
    state: UIState,
    attributes: ComponentAttributes
  ): Float32Array {
    const embedding = new Float32Array(768);
    const seed = this.hashString(
      `${component}_${state}_${JSON.stringify(attributes)}`
    );

    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = this.seededRandom(seed + i);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private calculateDifficulty(
    component: ComponentType,
    state: UIState,
    attributes: ComponentAttributes
  ): number {
    let difficulty = 0.25;

    // Component complexity
    const componentComplexity: Record<ComponentType, number> = {
      button: 0.0,
      checkbox: 0.02,
      radio: 0.02,
      toggle: 0.03,
      slider: 0.05,
      input: 0.05,
      select: 0.06,
      dropdown: 0.07,
      card: 0.08,
      modal: 0.1,
    };
    difficulty += componentComplexity[component] || 0.05;

    // State complexity
    if (state === "disabled") difficulty += 0.02;
    if (state === "error") difficulty += 0.03;
    if (state === "focus") difficulty += 0.04;

    // Attribute complexity
    if (attributes.icon) difficulty += 0.02;
    if (attributes.loading) difficulty += 0.03;
    if (attributes.size === "xs" || attributes.size === "xl")
      difficulty += 0.01;

    return Math.min(0.5, difficulty);
  }

  getProgress(): GeneratorProgress {
    return { ...this.progress };
  }

  reset(): void {
    this.progress = {
      generated: 0,
      target: this.config.examples,
      complete: false,
    };
  }
}

/**
 * Evaluator for component predictions
 */
class ComponentsEvaluator implements StageEvaluator {
  evaluate(example: Stage2Example, prediction: Float32Array): EvaluationResult {
    const target = example.embedding;
    const similarity = this.cosineSimilarity(target, prediction);
    const mse = this.mse(target, prediction);

    // Component-specific accuracy (check if component type is recognized)
    const componentAccuracy = similarity > 0.7 ? 1.0 : similarity;

    return {
      loss: mse,
      accuracy: (similarity + componentAccuracy) / 2,
      confidence: similarity > 0.75 ? similarity : similarity * 0.9,
      metrics: {
        cosine_similarity: similarity,
        mse: mse,
        component_recognition: componentAccuracy,
        state_recognition: similarity > 0.6 ? 1.0 : 0.5,
      },
    };
  }

  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult {
    const results = examples.map((ex, i) =>
      this.evaluate(ex as Stage2Example, predictions[i])
    );

    const totalLoss = results.reduce((sum, r) => sum + r.loss, 0);
    const totalAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0);
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);

    return {
      totalLoss,
      averageLoss: totalLoss / results.length,
      averageAccuracy: totalAccuracy / results.length,
      averageConfidence: totalConfidence / results.length,
      metrics: {
        total_loss: totalLoss,
        total_accuracy: totalAccuracy,
      },
      perExample: results,
    };
  }

  isMastered(progress: StageProgress): boolean {
    return progress.mastery >= 0.85 && progress.loss < 0.15;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private mse(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum / a.length;
  }
}
