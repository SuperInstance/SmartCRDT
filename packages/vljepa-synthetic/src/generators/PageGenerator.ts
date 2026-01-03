/**
 * @lsi/vljepa-synthetic - Page Generator
 *
 * Generates complete page layouts with multiple components and layouts.
 *
 * @module generators
 */

import type {
  GeneratedComponent,
  GeneratedLayout,
  StyleSystem,
} from "../types.js";
import { ComponentGenerator } from "./ComponentGenerator.js";
import { LayoutGenerator } from "./LayoutGenerator.js";
import { createSeededRandom, generateId } from "../utils.js";

export interface PageGeneratorConfig {
  componentTypes: string[];
  styleSystem: StyleSystem;
  minComponents: number;
  maxComponents: number;
  seed?: number;
}

export interface GeneratedPage {
  id: string;
  components: GeneratedComponent[];
  layout: GeneratedLayout;
  code: string;
  metadata: {
    timestamp: number;
    seed: number;
    componentCount: number;
    styleSystem: StyleSystem;
  };
}

export class PageGenerator {
  private config: PageGeneratorConfig;
  private componentGenerator: ComponentGenerator;
  private layoutGenerator: LayoutGenerator;
  private rng: ReturnType<typeof createSeededRandom>;

  constructor(config: PageGeneratorConfig) {
    this.config = config;
    const seed = config.seed ?? Date.now();
    this.rng = createSeededRandom(seed);

    this.componentGenerator = new ComponentGenerator({
      componentTypes: config.componentTypes as any,
      styleSystems: [config.styleSystem],
      variations: { colors: 5, sizes: 3, states: 3 },
      seed,
    });

    this.layoutGenerator = new LayoutGenerator({
      patterns: ["grid", "flex-row", "header-content"],
      minColumns: 2,
      maxColumns: 4,
      breakpoints: ["sm", "md", "lg", "xl"],
      spacing: { min: 4, max: 32, step: 4 },
      seed: seed + 1,
    });
  }

  generate(): GeneratedPage {
    const id = generateId("page");
    const componentCount = this.rng.int(
      this.config.minComponents,
      this.config.maxComponents
    );

    const components: GeneratedComponent[] = [];
    for (let i = 0; i < componentCount; i++) {
      const type = this.rng.pick(this.config.componentTypes) as any;
      components.push(this.componentGenerator.generate(type));
    }

    const layout = this.layoutGenerator.generate("grid", { componentCount });
    const code = this.generatePageCode(components, layout);

    return {
      id,
      components,
      layout,
      code,
      metadata: {
        timestamp: Date.now(),
        seed: this.config.seed ?? Date.now(),
        componentCount,
        styleSystem: this.config.styleSystem,
      },
    };
  }

  generateBatch(count: number): GeneratedPage[] {
    return Array.from({ length: count }, () => this.generate());
  }

  private generatePageCode(
    components: GeneratedComponent[],
    layout: GeneratedLayout
  ): string {
    const componentCodes = components.map(c => `  ${c.code}`).join("\n");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Page</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
${layout.code}
  <div class="components">
${componentCodes}
  </div>
</body>
</html>`;
  }
}
