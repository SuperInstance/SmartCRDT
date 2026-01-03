/**
 * Stage 3: Layouts
 *
 * Learning Objectives:
 * - Layout patterns: Flex row/column, grid, absolute positioning
 * - Spatial relationships: Above, below, beside, contains, overlaps
 * - Responsive design: Mobile, tablet, desktop variants
 * - Composition: Multiple components working together
 *
 * Target: 20,000+ layout examples
 * Difficulty Range: 0.5-0.75
 */

import type {
  LayoutPattern,
  SpatialRelation,
  ComponentType,
  ComponentPlacement,
  SpatialRelations,
  HierarchyNode,
  ResponsiveVariants,
  Stage3Config,
  Stage3Example,
  TrainingExample,
  DataGenerator,
  StageEvaluator,
  GeneratorProgress,
  EvaluationResult,
  BatchEvaluationResult,
  StageProgress,
} from "../types.js";

export class Stage3Layouts {
  private config: Stage3Config;
  private generator: LayoutsGenerator;
  private evaluator: LayoutsEvaluator;

  constructor(config: Partial<Stage3Config> = {}) {
    this.config = {
      examples: 20000,
      epochs: 20,
      batchSize: 32,
      masteryThreshold: 0.8,
      patience: 5,
      prerequisites: ["stage1", "stage2"],
      layouts: this.getDefaultLayouts(),
      complexity: ["simple", "moderate", "complex"],
      responsive: true,
      difficulty: "medium" as const,
      ...config,
    };

    this.generator = new LayoutsGenerator(this.config);
    this.evaluator = new LayoutsEvaluator();
  }

  /**
   * Get default layout patterns for Stage 3
   */
  private getDefaultLayouts(): LayoutPattern[] {
    return [
      "flex_row",
      "flex_column",
      "grid",
      "absolute",
      "stack",
      "sidebar",
      "navbar",
      "hero",
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
  async generateExamples(count: number): Promise<Stage3Example[]> {
    return await this.generator.generate(count);
  }

  /**
   * Evaluate predictions
   */
  evaluate(example: Stage3Example, prediction: Float32Array): EvaluationResult {
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
  getConfig(): Stage3Config {
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
 * Layout generator with spatial relationship understanding
 */
class LayoutsGenerator implements DataGenerator {
  private config: Stage3Config;
  private progress: GeneratorProgress = {
    generated: 0,
    target: 0,
    complete: false,
  };
  private componentTypes: ComponentType[] = [
    "button",
    "input",
    "card",
    "select",
    "checkbox",
  ];
  private random: () => number;

  constructor(config: Stage3Config) {
    this.config = config;
    let seed = 12345;
    this.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  async initialize(config: Stage3Config): Promise<void> {
    this.config = config;
    this.progress = {
      generated: 0,
      target: config.examples,
      complete: false,
    };
  }

  async generate(count: number): Promise<Stage3Example[]> {
    const examples: Stage3Example[] = [];

    for (let i = 0; i < count; i++) {
      const layout = this.selectLayout();
      const complexity = this.selectComplexity();
      const example = this.generateExample(layout, complexity);
      examples.push(example);
      this.progress.generated++;
    }

    if (this.progress.generated >= this.progress.target) {
      this.progress.complete = true;
    }

    return examples;
  }

  private selectLayout(): LayoutPattern {
    const index = Math.floor(this.random() * this.config.layouts.length);
    return this.config.layouts[index];
  }

  private selectComplexity(): "simple" | "moderate" | "complex" {
    const index = Math.floor(this.random() * this.config.complexity.length);
    return this.config.complexity[index];
  }

  private generateExample(
    layout: LayoutPattern,
    complexity: string
  ): Stage3Example {
    const componentCount = this.getComponentCount(complexity);
    const components = this.generateComponents(layout, componentCount);
    const spatial = this.analyzeSpatialRelations(components);
    const imageData = this.renderLayout(layout, components);
    const embedding = this.generateEmbedding(layout, components, spatial);
    const difficulty = this.calculateDifficulty(layout, complexity, components);

    const example: Stage3Example = {
      id: `stage3_${layout}_${complexity}_${this.progress.generated}`,
      stageId: "stage3_layouts",
      imageData,
      embedding,
      metadata: {
        labels: [layout, complexity],
        attributes: {
          layout,
          complexity,
          componentCount,
        },
        relationships: spatial.relations.map(r => ({
          type: r.relation,
          target: r.to,
          confidence: 1 - r.distance / 1000,
        })),
      },
      difficulty,
      timestamp: Date.now(),
      layout,
      components,
      spatial,
    };

    // Add responsive variants if enabled
    if (this.config.responsive && this.random() > 0.5) {
      example.responsive = this.generateResponsiveVariants(layout, components);
    }

    return example;
  }

  private getComponentCount(complexity: string): number {
    switch (complexity) {
      case "simple":
        return 2 + Math.floor(this.random() * 2); // 2-3
      case "moderate":
        return 4 + Math.floor(this.random() * 3); // 4-6
      case "complex":
        return 7 + Math.floor(this.random() * 4); // 7-10
      default:
        return 3;
    }
  }

  private generateComponents(
    layout: LayoutPattern,
    count: number
  ): ComponentPlacement[] {
    const components: ComponentPlacement[] = [];
    const canvasSize = this.getCanvasSize();

    for (let i = 0; i < count; i++) {
      const component =
        this.componentTypes[
          Math.floor(this.random() * this.componentTypes.length)
        ];
      const size = this.getComponentSize(component);
      const position = this.getComponentPosition(
        layout,
        i,
        count,
        canvasSize,
        size
      );

      components.push({
        component,
        position,
        size,
        zOrder: i,
      });
    }

    return components;
  }

  private getCanvasSize(): { width: number; height: number } {
    return { width: 400, height: 300 };
  }

  private getComponentSize(component: ComponentType): {
    width: number;
    height: number;
  } {
    const sizes: Record<ComponentType, { width: number; height: number }> = {
      button: { width: 80, height: 36 },
      input: { width: 120, height: 36 },
      card: { width: 160, height: 120 },
      select: { width: 100, height: 36 },
      checkbox: { width: 24, height: 24 },
    };
    return sizes[component];
  }

  private getComponentPosition(
    layout: LayoutPattern,
    index: number,
    total: number,
    canvas: { width: number; height: number },
    size: { width: number; height: number }
  ): { x: number; y: number } {
    const padding = 20;

    switch (layout) {
      case "flex_row":
        const totalWidth = canvas.width - padding * 2;
        const gap = (totalWidth - size.width * total) / (total + 1);
        return {
          x: padding + gap * (index + 1) + size.width * index,
          y: canvas.height / 2 - size.height / 2,
        };

      case "flex_column":
        const totalHeight = canvas.height - padding * 2;
        const gapY = (totalHeight - size.height * total) / (total + 1);
        return {
          x: canvas.width / 2 - size.width / 2,
          y: padding + gapY * (index + 1) + size.height * index,
        };

      case "grid":
        const cols = Math.ceil(Math.sqrt(total));
        const cellWidth = canvas.width / cols;
        const cellHeight = canvas.height / Math.ceil(total / cols);
        return {
          x: (index % cols) * cellWidth + (cellWidth - size.width) / 2,
          y:
            Math.floor(index / cols) * cellHeight +
            (cellHeight - size.height) / 2,
        };

      case "stack":
        return {
          x: canvas.width / 2 - size.width / 2 + (index % 3) * 10,
          y: canvas.height / 2 - size.height / 2 + Math.floor(index / 3) * 10,
        };

      case "sidebar":
        const sidebarWidth = 120;
        if (index === 0) {
          return { x: padding, y: padding };
        } else {
          return {
            x:
              sidebarWidth +
              padding +
              (((index - 1) % 2) *
                (canvas.width - sidebarWidth - padding * 3)) /
                2,
            y: padding + Math.floor((index - 1) / 2) * (canvas.height / 2),
          };
        }

      case "navbar":
        const navbarHeight = 50;
        if (index === 0) {
          return { x: canvas.width / 2 - 40, y: 10 };
        } else {
          return {
            x: padding + (((index - 1) % 3) * (canvas.width - padding * 2)) / 3,
            y:
              navbarHeight +
              padding +
              (Math.floor((index - 1) / 3) *
                (canvas.height - navbarHeight - padding * 2)) /
                2,
          };
        }

      case "hero":
        const heroHeight = 150;
        if (index === 0) {
          return { x: canvas.width / 2 - 50, y: heroHeight / 2 - 20 };
        } else if (index === 1) {
          return { x: canvas.width / 2 + 60, y: heroHeight / 2 - 20 };
        } else {
          return {
            x: padding + (((index - 2) % 3) * (canvas.width - padding * 2)) / 3,
            y: heroHeight + padding + Math.floor((index - 2) / 3) * 80,
          };
        }

      case "absolute":
        return {
          x:
            padding + this.random() * (canvas.width - size.width - padding * 2),
          y:
            padding +
            this.random() * (canvas.height - size.height - padding * 2),
        };

      default:
        return { x: padding, y: padding };
    }
  }

  private analyzeSpatialRelations(
    components: ComponentPlacement[]
  ): SpatialRelations {
    const relations: SpatialRelations["relations"] = [];
    const hierarchy: HierarchyNode[] = [];

    for (let i = 0; i < components.length; i++) {
      const a = components[i];
      hierarchy.push({
        id: `component_${i}`,
        type: "component",
        children: [],
      });

      for (let j = i + 1; j < components.length; j++) {
        const b = components[j];
        const relation = this.determineRelation(a, b);
        const distance = this.calculateDistance(a, b);

        relations.push({
          from: `component_${i}`,
          to: `component_${j}`,
          relation,
          distance,
        });

        // Add reverse relation
        const reverseRelation = this.reverseRelation(relation);
        relations.push({
          from: `component_${j}`,
          to: `component_${i}`,
          relation: reverseRelation,
          distance,
        });
      }
    }

    return { relations, hierarchy };
  }

  private determineRelation(
    a: ComponentPlacement,
    b: ComponentPlacement
  ): SpatialRelation {
    const aCenterX = a.position.x + a.size.width / 2;
    const aCenterY = a.position.y + a.size.height / 2;
    const bCenterX = b.position.x + b.size.width / 2;
    const bCenterY = b.position.y + b.size.height / 2;

    const dx = bCenterX - aCenterX;
    const dy = bCenterY - aCenterY;

    // Check for containment
    if (this.contains(a, b)) {
      return "contains";
    }

    // Check for overlap
    if (this.overlaps(a, b)) {
      return "overlaps";
    }

    // Check alignment
    const yAligned = Math.abs(dy) < 20;
    const xAligned = Math.abs(dx) < 20;

    if (yAligned && xAligned) {
      return "aligned";
    } else if (yAligned) {
      return dx > 0 ? "right_of" : "left_of";
    } else if (xAligned) {
      return dy > 0 ? "below" : "above";
    } else {
      // Determine dominant direction
      return Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right_of"
          : "left_of"
        : dy > 0
          ? "below"
          : "above";
    }
  }

  private reverseRelation(relation: SpatialRelation): SpatialRelation {
    const reverses: Record<SpatialRelation, SpatialRelation> = {
      above: "below",
      below: "above",
      left_of: "right_of",
      right_of: "left_of",
      contains: "overlaps",
      overlaps: "overlaps",
      aligned: "aligned",
    };
    return reverses[relation] || "aligned";
  }

  private contains(a: ComponentPlacement, b: ComponentPlacement): boolean {
    return (
      b.position.x >= a.position.x &&
      b.position.x + b.size.width <= a.position.x + a.size.width &&
      b.position.y >= a.position.y &&
      b.position.y + b.size.height <= a.position.y + a.size.height
    );
  }

  private overlaps(a: ComponentPlacement, b: ComponentPlacement): boolean {
    return !(
      a.position.x + a.size.width < b.position.x ||
      b.position.x + b.size.width < a.position.x ||
      a.position.y + a.size.height < b.position.y ||
      b.position.y + b.size.height < a.position.y
    );
  }

  private calculateDistance(
    a: ComponentPlacement,
    b: ComponentPlacement
  ): number {
    const aCenterX = a.position.x + a.size.width / 2;
    const aCenterY = a.position.y + a.size.height / 2;
    const bCenterX = b.position.x + b.size.width / 2;
    const bCenterY = b.position.y + b.size.height / 2;

    return Math.sqrt((bCenterX - aCenterX) ** 2 + (bCenterY - aCenterY) ** 2);
  }

  private renderLayout(
    layout: LayoutPattern,
    components: ComponentPlacement[]
  ): {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array;
  } {
    const canvas = this.getCanvasSize();
    const channels = 3;
    const data = new Uint8Array(canvas.width * canvas.height * channels);

    // Fill background
    for (let i = 0; i < data.length; i += channels) {
      data[i] = 250;
      data[i + 1] = 250;
      data[i + 2] = 251;
    }

    // Draw layout-specific background elements
    this.drawLayoutBackground(
      data,
      canvas.width,
      canvas.height,
      channels,
      layout
    );

    // Draw components
    for (const component of components) {
      this.drawComponent(
        data,
        canvas.width,
        canvas.height,
        channels,
        component
      );
    }

    return {
      width: canvas.width,
      height: canvas.height,
      channels,
      data,
    };
  }

  private drawLayoutBackground(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    layout: LayoutPattern
  ): void {
    switch (layout) {
      case "sidebar":
        // Draw sidebar
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < 120; x++) {
            const idx = (y * width + x) * channels;
            data[idx] = 243;
            data[idx + 1] = 244;
            data[idx + 2] = 246;
          }
        }
        break;

      case "navbar":
        // Draw navbar
        for (let y = 0; y < 50; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * channels;
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
          }
        }
        break;

      case "hero":
        // Draw hero section
        for (let y = 0; y < 150; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * channels;
            data[idx] = 239;
            data[idx + 1] = 246;
            data[idx + 2] = 255;
          }
        }
        break;

      case "grid":
        // Draw grid lines
        const cols = 4;
        const rows = 3;
        for (let i = 1; i < cols; i++) {
          const x = (width / cols) * i;
          for (let y = 0; y < height; y++) {
            const idx = (y * width + Math.floor(x)) * channels;
            data[idx] = 229;
            data[idx + 1] = 231;
            data[idx + 2] = 235;
          }
        }
        for (let i = 1; i < rows; i++) {
          const y = (height / rows) * i;
          for (let x = 0; x < width; x++) {
            const idx = (Math.floor(y) * width + x) * channels;
            data[idx] = 229;
            data[idx + 1] = 231;
            data[idx + 2] = 235;
          }
        }
        break;
    }
  }

  private drawComponent(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    component: ComponentPlacement
  ): void {
    const { position, size, zOrder } = component;
    const colors = this.getComponentColors(component.component);

    // Draw shadow
    this.drawComponentShadow(data, width, height, channels, position, size);

    // Draw background
    this.drawRoundedRect(
      data,
      width,
      height,
      channels,
      position.x,
      position.y,
      size.width,
      size.height,
      6,
      colors.bg
    );

    // Draw border
    this.drawComponentBorder(
      data,
      width,
      height,
      channels,
      position,
      size,
      colors.border
    );

    // Draw content indicator
    this.drawComponentContent(data, width, height, channels, component, colors);
  }

  private getComponentColors(component: ComponentType): {
    bg: number[];
    border: number[];
    text: number[];
  } {
    const colorMap: Record<
      ComponentType,
      { bg: number[]; border: number[]; text: number[] }
    > = {
      button: {
        bg: [59, 130, 246],
        border: [37, 99, 235],
        text: [255, 255, 255],
      },
      input: {
        bg: [255, 255, 255],
        border: [209, 213, 219],
        text: [17, 24, 39],
      },
      card: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      select: {
        bg: [255, 255, 255],
        border: [209, 213, 219],
        text: [17, 24, 39],
      },
      checkbox: {
        bg: [255, 255, 255],
        border: [209, 213, 219],
        text: [17, 24, 39],
      },
    };
    return colorMap[component];
  }

  private drawComponentShadow(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): void {
    for (let y = position.y + 2; y < position.y + size.height + 2; y++) {
      for (let x = position.x + 2; x < position.x + size.width + 2; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          data[idx] = Math.max(0, data[idx] - 20);
          data[idx + 1] = Math.max(0, data[idx + 1] - 20);
          data[idx + 2] = Math.max(0, data[idx + 2] - 20);
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
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px++) {
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

        if (inRect) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private drawComponentBorder(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    position: { x: number; y: number },
    size: { width: number; height: number },
    color: number[]
  ): void {
    const borderWidth = 2;

    // Top edge
    for (let x = position.x; x < position.x + size.width; x++) {
      for (let d = 0; d < borderWidth; d++) {
        const y = position.y + d;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }

    // Bottom edge
    for (let x = position.x; x < position.x + size.width; x++) {
      for (let d = 0; d < borderWidth; d++) {
        const y = position.y + size.height - 1 - d;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }

    // Left edge
    for (let y = position.y; y < position.y + size.height; y++) {
      for (let d = 0; d < borderWidth; d++) {
        const x = position.x + d;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }

    // Right edge
    for (let y = position.y; y < position.y + size.height; y++) {
      for (let d = 0; d < borderWidth; d++) {
        const x = position.x + size.width - 1 - d;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private drawComponentContent(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    component: ComponentPlacement,
    colors: { bg: number[]; border: number[]; text: number[] }
  ): void {
    const { position, size } = component;
    const centerX = position.x + size.width / 2;
    const centerY = position.y + size.height / 2;

    switch (component.component) {
      case "checkbox":
        // Draw check indicator
        const checkSize = 6;
        for (
          let y = centerY - checkSize / 2;
          y < centerY + checkSize / 2;
          y++
        ) {
          for (
            let x = centerX - checkSize / 2;
            x < centerX + checkSize / 2;
            x++
          ) {
            if (x >= 0 && x < width && y >= 0 && y < height) {
              const idx = (Math.floor(y) * width + Math.floor(x)) * channels;
              data[idx] = colors.text[0];
              data[idx + 1] = colors.text[1];
              data[idx + 2] = colors.text[2];
            }
          }
        }
        break;

      case "card":
        // Draw card content lines
        for (let i = 0; i < 3; i++) {
          const lineY = position.y + 20 + i * 12;
          const lineWidth = size.width - 24;
          this.drawLine(
            data,
            width,
            height,
            channels,
            position.x + 12,
            lineY,
            lineWidth,
            4,
            [229, 231, 235]
          );
        }
        break;

      default:
        // Draw text placeholder
        this.drawLine(
          data,
          width,
          height,
          channels,
          centerX - 20,
          centerY,
          40,
          6,
          colors.text
        );
    }
  }

  private drawLine(
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
    for (
      let py = Math.max(0, Math.floor(y));
      py < Math.min(height, Math.floor(y + h));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x));
        px < Math.min(width, Math.floor(x + w));
        px++
      ) {
        const idx = (py * width + px) * channels;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
      }
    }
  }

  private generateResponsiveVariants(
    layout: LayoutPattern,
    components: ComponentPlacement[]
  ): ResponsiveVariants {
    const mobileScale = 0.6;
    const tabletScale = 0.8;

    return {
      mobile: this.scaleComponents(components, mobileScale, 375),
      tablet: this.scaleComponents(components, tabletScale, 768),
      desktop: components,
    };
  }

  private scaleComponents(
    components: ComponentPlacement[],
    scale: number,
    maxWidth: number
  ): ComponentPlacement[] {
    return components.map(c => ({
      ...c,
      position: {
        x: c.position.x * scale,
        y: c.position.y * scale,
      },
      size: {
        width: c.size.width * scale,
        height: c.size.height * scale,
      },
    }));
  }

  private generateEmbedding(
    layout: LayoutPattern,
    components: ComponentPlacement[],
    spatial: SpatialRelations
  ): Float32Array {
    const embedding = new Float32Array(768);
    const seed = this.hashString(
      `${layout}_${components.length}_${spatial.relations.length}`
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
    layout: LayoutPattern,
    complexity: string,
    components: ComponentPlacement[]
  ): number {
    let difficulty = 0.5;

    // Layout complexity
    const layoutDifficulty: Record<LayoutPattern, number> = {
      flex_row: 0.0,
      flex_column: 0.02,
      stack: 0.04,
      grid: 0.06,
      navbar: 0.08,
      sidebar: 0.1,
      absolute: 0.12,
      hero: 0.14,
    };
    difficulty += layoutDifficulty[layout];

    // Component count complexity
    difficulty += (components.length - 2) * 0.02;

    // Complexity level
    if (complexity === "moderate") difficulty += 0.05;
    if (complexity === "complex") difficulty += 0.1;

    return Math.min(0.75, difficulty);
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
 * Evaluator for layout predictions
 */
class LayoutsEvaluator implements StageEvaluator {
  evaluate(example: Stage3Example, prediction: Float32Array): EvaluationResult {
    const target = example.embedding;
    const similarity = this.cosineSimilarity(target, prediction);
    const mse = this.mse(target, prediction);

    // Spatial relationship accuracy
    const spatialAccuracy = this.evaluateSpatialAccuracy(example, prediction);

    return {
      loss: mse,
      accuracy: (similarity + spatialAccuracy) / 2,
      confidence: similarity > 0.7 ? similarity : similarity * 0.85,
      metrics: {
        cosine_similarity: similarity,
        mse: mse,
        spatial_accuracy: spatialAccuracy,
        layout_recognition: similarity > 0.65 ? 1.0 : 0.7,
      },
    };
  }

  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult {
    const results = examples.map((ex, i) =>
      this.evaluate(ex as Stage3Example, predictions[i])
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
    return progress.mastery >= 0.8 && progress.loss < 0.2;
  }

  private evaluateSpatialAccuracy(
    example: Stage3Example,
    prediction: Float32Array
  ): number {
    // Simplified spatial accuracy based on embedding similarity
    const target = example.embedding;
    let matchCount = 0;

    // Compare chunks of embedding that represent spatial relationships
    const chunkSize = 64;
    for (
      let i = 0;
      i < Math.min(target.length, prediction.length);
      i += chunkSize
    ) {
      const targetChunk = target.slice(i, i + chunkSize);
      const predChunk = prediction.slice(i, i + chunkSize);
      const chunkSimilarity = this.cosineSimilarity(targetChunk, predChunk);
      if (chunkSimilarity > 0.7) {
        matchCount++;
      }
    }

    return matchCount / Math.ceil(target.length / chunkSize);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private mse(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum / a.length;
  }
}
