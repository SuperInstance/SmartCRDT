/**
 * @lsi/vljepa-synthetic - Layout Generator
 *
 * Generates 1,000+ unique layouts with various patterns, breakpoints, and responsive designs.
 * Supports grid, flex, absolute positioning, and common UI layout patterns.
 *
 * @module generators
 */

import type {
  GeneratedLayout,
  ComponentPlacement,
  LayoutPattern,
  LayoutGeneratorConfig,
  ViewportSize,
  CSSProperties,
  StyleSystem,
} from "../types.js";
import { createSeededRandom, generateId, camelToKebab } from "../utils.js";

const THEME = {
  tailwind: { prefix: "", spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } },
  material: {
    prefix: "md-",
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
  ant: { prefix: "ant-", spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } },
  bootstrap: {
    prefix: "bs-",
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
  chakra: {
    prefix: "chakra-",
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
  mantine: {
    prefix: "mantine-",
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
};

/**
 * Layout Generator class
 *
 * Generates UI layouts with various patterns and responsive breakpoints.
 * Target: 1,000+ unique layouts.
 */
export class LayoutGenerator {
  private config: LayoutGeneratorConfig;
  private rng: ReturnType<typeof createSeededRandom>;

  constructor(config: LayoutGeneratorConfig) {
    this.config = config;
    this.rng = createSeededRandom(config.seed ?? Date.now());
  }

  /**
   * Generate a layout of the specified pattern
   */
  generate(
    pattern: LayoutPattern,
    options?: {
      columns?: number;
      componentCount?: number;
      styleSystem?: StyleSystem;
    }
  ): GeneratedLayout {
    const styleSystem = options?.styleSystem ?? "tailwind";
    const componentCount = options?.componentCount ?? this.rng.int(3, 12);

    const components = this.generateComponentPlacements(
      componentCount,
      pattern,
      styleSystem
    );
    const code = this.generateLayoutCode(pattern, components, styleSystem);
    const responsive = this.generateResponsiveStyles(
      pattern,
      components,
      styleSystem
    );

    const metadata = {
      id: generateId("layout"),
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      componentCount,
      breakpoints: this.config.breakpoints,
    };

    return { pattern, code, responsive, components, metadata };
  }

  /**
   * Generate multiple layouts
   */
  generateBatch(count: number): GeneratedLayout[] {
    const layouts: GeneratedLayout[] = [];

    for (let i = 0; i < count; i++) {
      const pattern = this.rng.pick(this.config.patterns);
      const columns = this.rng.int(
        this.config.minColumns,
        this.config.maxColumns
      );
      const componentCount = this.rng.int(3, 12);
      layouts.push(this.generate(pattern, { columns, componentCount }));
    }

    return layouts;
  }

  /**
   * Generate all layout pattern variations
   */
  generateAllVariations(): GeneratedLayout[] {
    const allLayouts: GeneratedLayout[] = [];

    for (const pattern of this.config.patterns) {
      for (const breakpoint of this.config.breakpoints) {
        const columns = this.rng.int(
          this.config.minColumns,
          this.config.maxColumns
        );
        const componentCount = this.rng.int(3, 12);
        allLayouts.push(this.generate(pattern, { columns, componentCount }));
      }
    }

    return allLayouts;
  }

  // ========================================================================
  // COMPONENT PLACEMENT GENERATION
  // ========================================================================

  private generateComponentPlacements(
    count: number,
    pattern: LayoutPattern,
    styleSystem: StyleSystem
  ): ComponentPlacement[] {
    const placements: ComponentPlacement[] = [];
    const theme = THEME[styleSystem];

    for (let i = 0; i < count; i++) {
      const position = this.generatePosition(pattern, i, count);
      const size = this.generateSize(pattern);
      const spacing = this.generateSpacing(theme);
      const alignment = this.generateAlignment();

      placements.push({
        componentId: generateId("component"),
        position,
        size,
        spacing,
        alignment,
      });
    }

    return placements;
  }

  private generatePosition(
    pattern: LayoutPattern,
    index: number,
    total: number
  ): ComponentPlacement["position"] {
    switch (pattern) {
      case "grid":
      case "card-grid":
      case "bento":
        const columns = this.rng.int(
          this.config.minColumns,
          this.config.maxColumns
        );
        const row = Math.floor(index / columns);
        const col = index % columns;
        return {
          row,
          column: col,
          rowSpan: this.rng.pick([1, 1, 1, 2]),
          columnSpan: this.rng.pick([1, 1, 2]),
        };

      case "flex-row":
      case "flex-column":
        return {
          order: index,
        };

      case "sidebar-main":
        if (index === 0) {
          return { row: 1, column: 1, rowSpan: 2 };
        }
        return { row: index, column: 2 };

      case "header-content":
        if (index === 0) {
          return { row: 1, column: 1 };
        }
        return { row: 2, column: 1 };

      case "header-sidebar-content":
        if (index === 0) {
          return { row: 1, column: 1, columnSpan: 2 };
        }
        if (index === 1) {
          return { row: 2, column: 1, rowSpan: 2 };
        }
        return { row: 2, column: 2 };

      default:
        return { row: index };
    }
  }

  private generateSize(pattern: LayoutPattern): ComponentPlacement["size"] {
    const sizeVariants = [
      "100%",
      "50%",
      "33.333%",
      "25%",
      "auto",
      "200px",
      "300px",
      "400px",
    ];

    return {
      width: this.rng.pick(sizeVariants),
      height: this.rng.pick([...sizeVariants, "auto", "min-content"]),
      minWidth: this.rng.pick(["0", "100px", "200px", undefined]),
      maxWidth: this.rng.pick(["none", "100%", "400px", undefined]),
      minHeight: this.rng.pick(["0", "100px", undefined]),
      maxHeight: this.rng.pick(["none", "300px", undefined]),
    };
  }

  private generateSpacing(
    theme: (typeof THEME)[StyleSystem]
  ): ComponentPlacement["spacing"] {
    return {
      margin: this.rng.pick(["0", "8px", "16px", "24px", undefined]),
      padding: this.rng.pick(["8px", "16px", "24px", undefined]),
      gap: this.rng.pick(["0", "8px", "16px", "24px"]),
    };
  }

  private generateAlignment(): ComponentPlacement["alignment"] {
    return {
      justify: this.rng.pick([
        "start",
        "end",
        "center",
        "space-between",
        "space-around",
      ]),
      align: this.rng.pick(["start", "end", "center", "stretch", "baseline"]),
    };
  }

  // ========================================================================
  // LAYOUT CODE GENERATION
  // ========================================================================

  private generateLayoutCode(
    pattern: LayoutPattern,
    components: ComponentPlacement[],
    styleSystem: StyleSystem
  ): string {
    const theme = THEME[styleSystem];
    const prefix = theme.prefix;

    const containerStyles = this.getContainerStyles(pattern, theme);
    const componentElements = components
      .map((comp, i) => this.generateComponentElement(comp, i, prefix))
      .join("\n  ");

    return `
<div class="${prefix}layout ${prefix}layout--${camelToKebab(pattern)}" style="${this.cssToString(containerStyles)}">
  ${componentElements}
</div>`.trim();
  }

  private getContainerStyles(
    pattern: LayoutPattern,
    theme: (typeof THEME)[StyleSystem]
  ): CSSProperties {
    const baseStyles: CSSProperties = {
      display: this.getDisplayValue(pattern),
      gap: `${this.rng.int(8, 32)}px`,
    };

    switch (pattern) {
      case "grid":
      case "card-grid":
      case "bento":
        return {
          ...baseStyles,
          display: "grid",
          gridTemplateColumns: `repeat(${this.rng.int(2, 4)}, 1fr)`,
          gridAutoRows: "minmax(100px, auto)",
        };

      case "flex-row":
        return { ...baseStyles, flexDirection: "row", flexWrap: "wrap" };

      case "flex-column":
        return { ...baseStyles, flexDirection: "column" };

      case "absolute":
        return { ...baseStyles, position: "relative", minHeight: "400px" };

      case "sidebar-main":
        return {
          ...baseStyles,
          display: "grid",
          gridTemplateColumns: "250px 1fr",
        };

      case "header-content":
        return { ...baseStyles, display: "grid", gridTemplateRows: "auto 1fr" };

      case "header-sidebar-content":
        return {
          ...baseStyles,
          display: "grid",
          gridTemplateColumns: "250px 1fr",
          gridTemplateRows: "auto 1fr",
        };

      case "holy-grail":
        return {
          ...baseStyles,
          display: "grid",
          gridTemplateColumns: "200px 1fr 200px",
          gridTemplateRows: "auto 1fr auto",
        };

      case "fluid":
        return { ...baseStyles, display: "flex", flexDirection: "row" };

      case "responsive-grid":
        return {
          ...baseStyles,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        };

      default:
        return baseStyles;
    }
  }

  private getDisplayValue(pattern: LayoutPattern): string {
    const displayValues: Record<LayoutPattern, string> = {
      grid: "grid",
      "flex-row": "flex",
      "flex-column": "flex",
      absolute: "relative",
      "sidebar-main": "grid",
      "header-content": "grid",
      "header-sidebar-content": "grid",
      "card-grid": "grid",
      bento: "grid",
      "holy-grail": "grid",
      fluid: "flex",
      "responsive-grid": "grid",
      masonry: "column",
    };
    return displayValues[pattern];
  }

  private generateComponentElement(
    component: ComponentPlacement,
    index: number,
    prefix: string
  ): string {
    const styles: CSSProperties = {
      padding: `${component.spacing.padding ?? "16px"}`,
      background: `hsl(${this.rng.int(0, 360)}, 70%, 95%)`,
      borderRadius: "8px",
      border: "1px solid #e5e7eb",
    };

    if (component.position.row !== undefined) {
      styles.gridRow = `${component.position.row + 1} / span ${component.position.rowSpan ?? 1}`;
    }
    if (component.position.column !== undefined) {
      styles.gridColumn = `${component.position.column + 1} / span ${component.position.columnSpan ?? 1}`;
    }
    if (component.position.order !== undefined) {
      styles.order = component.position.order.toString();
    }

    if (component.size.width) {
      styles.width = component.size.width as string;
    }
    if (component.size.height) {
      styles.height = component.size.height as string;
    }

    return `<div id="${component.componentId}" class="${prefix}layout__item" style="${this.cssToString(styles)}">Component ${index + 1}</div>`;
  }

  // ========================================================================
  // RESPONSIVE STYLES GENERATION
  // ========================================================================

  private generateResponsiveStyles(
    pattern: LayoutPattern,
    components: ComponentPlacement[],
    styleSystem: StyleSystem
  ): Record<ViewportSize, string> {
    const responsive: Record<ViewportSize, string> = {} as any;

    for (const breakpoint of this.config.breakpoints) {
      responsive[breakpoint] = this.getBreakpointStyles(
        pattern,
        breakpoint,
        styleSystem
      );
    }

    return responsive;
  }

  private getBreakpointStyles(
    pattern: LayoutPattern,
    breakpoint: ViewportSize,
    styleSystem: StyleSystem
  ): string {
    const breakpointSizes: Record<
      ViewportSize,
      { width: string; columns: number }
    > = {
      xs: { width: "320px", columns: 1 },
      sm: { width: "640px", columns: 2 },
      md: { width: "768px", columns: 2 },
      lg: { width: "1024px", columns: 3 },
      xl: { width: "1280px", columns: 4 },
      "2xl": { width: "1536px", columns: 4 },
    };

    const size = breakpointSizes[breakpoint];

    switch (pattern) {
      case "grid":
      case "card-grid":
      case "responsive-grid":
        return `@media (min-width: ${size.width}) { grid-template-columns: repeat(${size.columns}, 1fr); }`;

      case "sidebar-main":
        return breakpoint === "xs"
          ? "@media (max-width: 640px) { grid-template-columns: 1fr; }"
          : `@media (min-width: ${size.width}) { grid-template-columns: 250px 1fr; }`;

      default:
        return `@media (min-width: ${size.width}) { gap: ${breakpoint === "xs" ? "8px" : "16px"}; }`;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private cssToString(styles: CSSProperties): string {
    return Object.entries(styles)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${camelToKebab(key)}: ${JSON.stringify(value)};`;
        }
        return `${camelToKebab(key)}: ${value};`;
      })
      .join(" ");
  }
}
