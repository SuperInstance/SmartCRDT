/**
 * @lsi/vljepa-synthetic - Component Generator
 *
 * Generates 100+ variations per component type with different styles, sizes, states, and colors.
 * Supports multiple style systems (Tailwind, Material, Ant, Bootstrap, Chakra, Mantine).
 *
 * @module generators
 */

import type {
  ComponentType,
  GeneratedComponent,
  ComponentMetadata,
  ComponentGeneratorConfig,
  CSSProperties,
  StyleSystem,
  ButtonVariant,
  ButtonSize,
  InputType,
  ComponentState,
} from "../types.js";
import {
  createSeededRandom,
  createColorUtils,
  generateId,
  camelToKebab,
} from "../utils.js";

// ============================================================================
// STYLE SYSTEM TEMPLATES
// ============================================================================

const STYLE_SYSTEMS: Record<
  StyleSystem,
  {
    prefix: string;
    colors: Record<string, string>;
    spacing: Record<string, number>;
    borderRadius: Record<string, number>;
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
  }
> = {
  tailwind: {
    prefix: "",
    colors: {
      primary: "#3b82f6",
      secondary: "#64748b",
      accent: "#8b5cf6",
      background: "#ffffff",
      text: "#1e293b",
      error: "#ef4444",
      warning: "#f59e0b",
      success: "#22c55e",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  material: {
    prefix: "md-",
    colors: {
      primary: "#1976d2",
      secondary: "#757575",
      accent: "#9c27b0",
      background: "#ffffff",
      text: "#212121",
      error: "#d32f2f",
      warning: "#ed6c02",
      success: "#2e7d32",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 4, lg: 4, xl: 4 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  ant: {
    prefix: "ant-",
    colors: {
      primary: "#1890ff",
      secondary: "#8c8c8c",
      accent: "#722ed1",
      background: "#ffffff",
      text: "#262626",
      error: "#ff4d4f",
      warning: "#faad14",
      success: "#52c41a",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 2, md: 2, lg: 2, xl: 2 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  bootstrap: {
    prefix: "bs-",
    colors: {
      primary: "#0d6efd",
      secondary: "#6c757d",
      accent: "#6f42c1",
      background: "#ffffff",
      text: "#212529",
      error: "#dc3545",
      warning: "#ffc107",
      success: "#198754",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 2, md: 4, lg: 6, xl: 8 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  chakra: {
    prefix: "chakra-",
    colors: {
      primary: "#3182ce",
      secondary: "#718096",
      accent: "#805ad5",
      background: "#ffffff",
      text: "#1a202c",
      error: "#e53e3e",
      warning: "#dd6b20",
      success: "#38a169",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 6, lg: 8, xl: 12 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  mantine: {
    prefix: "mantine-",
    colors: {
      primary: "#228be6",
      secondary: "#868e96",
      accent: "#7950f2",
      background: "#ffffff",
      text: "#212529",
      error: "#fa5252",
      warning: "#fab005",
      success: "#40c057",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    borderRadius: { sm: 4, md: 8, lg: 16, xl: 32 },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
    },
    fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
};

// ============================================================================
// COMPONENT GENERATOR
// ============================================================================

/**
 * Component Generator class
 *
 * Generates UI components with various styles, sizes, states, and colors.
 * Target: 100+ variations per component type.
 */
export class ComponentGenerator {
  private config: ComponentGeneratorConfig;
  private rng: ReturnType<typeof createSeededRandom>;
  private colorUtils: ReturnType<typeof createColorUtils>;

  constructor(config: ComponentGeneratorConfig) {
    this.config = config;
    const seed = config.seed ?? Date.now();
    this.rng = createSeededRandom(seed);
    this.colorUtils = createColorUtils(seed + 1);
  }

  /**
   * Generate a component of the specified type
   */
  generate(
    type: ComponentType,
    options?: {
      variant?: string;
      size?: string;
      state?: ComponentState;
      styleSystem?: StyleSystem;
    }
  ): GeneratedComponent {
    switch (type) {
      case "button":
        return this.generateButton(options);
      case "input":
        return this.generateInput(options);
      case "textarea":
        return this.generateTextarea(options);
      case "card":
        return this.generateCard(options);
      case "modal":
        return this.generateModal(options);
      case "alert":
        return this.generateAlert(options);
      case "spinner":
        return this.generateSpinner(options);
      case "tabs":
        return this.generateTabs(options);
      case "navbar":
        return this.generateNavbar(options);
      case "sidebar":
        return this.generateSidebar(options);
      case "table":
        return this.generateTable(options);
      case "form":
        return this.generateForm(options);
      default:
        return this.generateGenericComponent(type, options);
    }
  }

  /**
   * Generate multiple components
   */
  generateBatch(type: ComponentType, count: number): GeneratedComponent[] {
    const components: GeneratedComponent[] = [];

    for (let i = 0; i < count; i++) {
      const styleSystem = this.rng.pick(this.config.styleSystems);
      const state = this.rng.pick([
        "default",
        "hover",
        "active",
        "focus",
        "disabled",
        "loading",
        "error",
      ] as ComponentState[]);

      components.push(this.generate(type, { state, styleSystem }));
    }

    return components;
  }

  /**
   * Generate all variations for a component type
   */
  generateAllVariations(type: ComponentType): GeneratedComponent[] {
    const allVariations: GeneratedComponent[] = [];

    for (const styleSystem of this.config.styleSystems) {
      const colorVariations = this.config.variations.colors;
      const sizeVariations = this.config.variations.sizes;
      const stateVariations = this.config.variations.states;

      for (let c = 0; c < colorVariations; c++) {
        for (let s = 0; s < sizeVariations; s++) {
          for (let st = 0; st < stateVariations; st++) {
            allVariations.push(this.generate(type, { styleSystem }));
          }
        }
      }
    }

    return allVariations;
  }

  // ========================================================================
  // BUTTON GENERATOR
  // ========================================================================

  private generateButton(options?: {
    variant?: string;
    size?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const variant =
      (options?.variant as ButtonVariant) ??
      this.rng.pick([
        "primary",
        "secondary",
        "ghost",
        "outline",
        "danger",
        "success",
        "warning",
        "info",
      ]);
    const size =
      (options?.size as ButtonSize) ??
      this.rng.pick(["xs", "sm", "md", "lg", "xl"]);
    const state = options?.state ?? "default";

    const id = generateId("btn");
    const disabled = state === "disabled";
    const loading = state === "loading";

    const styles: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: this.getButtonPadding(size),
      fontSize: theme.fontSize[size],
      fontWeight: theme.fontWeight.medium,
      borderRadius: `${theme.borderRadius[size]}px`,
      border: this.getButtonBorder(variant),
      backgroundColor: this.getButtonBg(variant, styleSystem, state),
      color: this.getButtonColor(variant, styleSystem, state),
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transition: "all 0.2s ease",
      gap: `${theme.spacing.sm}px`,
    };

    if (state === "hover") {
      styles.transform = "translateY(-1px)";
      styles.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.15)`;
    }

    if (state === "active") {
      styles.transform = "translateY(0)";
      styles.boxShadow = `0 2px 4px rgba(0, 0, 0, 0.1)`;
    }

    if (state === "focus") {
      styles.outline = `2px solid ${theme.colors.primary}`;
      styles.outlineOffset = "2px";
    }

    const props: Record<string, unknown> = {
      id,
      type: "button",
      disabled,
      variant,
      size,
      styleSystem,
    };

    const code = this.generateButtonCode(
      id,
      variant,
      size,
      styleSystem,
      disabled,
      loading
    );

    const metadata: ComponentMetadata = {
      type: "button",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      variant,
      size,
      state,
      tags: ["button", variant, size, styleSystem, state],
    };

    return { type: "button", code, styles, props, metadata };
  }

  private getButtonPadding(size: ButtonSize): string {
    const paddings: Record<ButtonSize, string> = {
      xs: "4px 8px",
      sm: "6px 12px",
      md: "8px 16px",
      lg: "12px 24px",
      xl: "16px 32px",
    };
    return paddings[size];
  }

  private getButtonBorder(variant: ButtonVariant): string {
    if (variant === "outline" || variant === "ghost") {
      return "1px solid currentColor";
    }
    return "1px solid transparent";
  }

  private getButtonBg(
    variant: ButtonVariant,
    styleSystem: StyleSystem,
    state: ComponentState
  ): string {
    const theme = STYLE_SYSTEMS[styleSystem];

    const bgColors: Record<ButtonVariant, string> = {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      ghost: "transparent",
      outline: "transparent",
      danger: theme.colors.error,
      success: theme.colors.success,
      warning: theme.colors.warning,
      info: theme.colors.primary,
    };

    const baseBg = bgColors[variant];

    if (state === "hover") {
      return variant === "ghost" || variant === "outline"
        ? this.colorUtils.luminance(baseBg) > 0.5
          ? "rgba(0, 0, 0, 0.05)"
          : "rgba(255, 255, 255, 0.1)"
        : baseBg;
    }

    return baseBg;
  }

  private getButtonColor(
    variant: ButtonVariant,
    styleSystem: StyleSystem,
    state: ComponentState
  ): string {
    const theme = STYLE_SYSTEMS[styleSystem];

    if (variant === "ghost" || variant === "outline") {
      return theme.colors.text;
    }

    return "#ffffff";
  }

  private generateButtonCode(
    id: string,
    variant: ButtonVariant,
    size: ButtonSize,
    styleSystem: StyleSystem,
    disabled: boolean,
    loading: boolean
  ): string {
    const prefix = STYLE_SYSTEMS[styleSystem].prefix;
    const className =
      `${prefix}btn ${prefix}btn--${variant} ${prefix}btn--${size}`.trim();

    if (loading) {
      return `<button id="${id}" class="${className}" disabled>
        <span class="${prefix}spinner"></span>
        <span>Loading...</span>
      </button>`;
    }

    return `<button id="${id}" class="${className}"${disabled ? " disabled" : ""}>
      Click Me
    </button>`;
  }

  // ========================================================================
  // INPUT GENERATOR
  // ========================================================================

  private generateInput(options?: {
    variant?: string;
    size?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const inputType = this.rng.pick<InputType>([
      "text",
      "email",
      "password",
      "number",
      "tel",
      "url",
      "search",
      "date",
      "time",
    ]);
    const state = options?.state ?? "default";
    const size = options?.size ?? this.rng.pick(["sm", "md", "lg"]);

    const id = generateId("input");
    const hasError = state === "error";

    const styles: CSSProperties = {
      display: "block",
      width: "100%",
      padding: this.getInputPadding(size),
      fontSize: theme.fontSize[size],
      fontFamily: "inherit",
      lineHeight: 1.5,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      border: `1px solid ${hasError ? theme.colors.error : "#d1d5db"}`,
      borderRadius: `${theme.borderRadius.md}px`,
      transition:
        "border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out",
    };

    if (state === "focus") {
      styles.borderColor = theme.colors.primary;
      styles.outline = `3px solid ${theme.colors.primary}33`;
      styles.outlineOffset = "0";
    }

    if (state === "disabled") {
      styles.backgroundColor = "#f3f4f6";
      styles.color = "#9ca3af";
      styles.cursor = "not-allowed";
    }

    const props: Record<string, unknown> = {
      id,
      type: inputType,
      placeholder: this.getInputPlaceholder(inputType),
      disabled: state === "disabled",
      styleSystem,
    };

    const code = `<input id="${id}" type="${inputType}" placeholder="${props.placeholder}" class="${theme.prefix}input ${theme.prefix}input--${size}"${state === "disabled" ? " disabled" : ""} />`;

    const metadata: ComponentMetadata = {
      type: "input",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      size,
      state,
      tags: ["input", inputType, size, styleSystem, state],
    };

    return { type: "input", code, styles, props, metadata };
  }

  private getInputPadding(size: string): string {
    const paddings: Record<string, string> = {
      sm: "6px 12px",
      md: "8px 16px",
      lg: "12px 16px",
    };
    return paddings[size] ?? paddings.md;
  }

  private getInputPlaceholder(type: InputType): string {
    const placeholders: Record<string, string> = {
      text: "Enter text...",
      email: "you@example.com",
      password: "Enter password...",
      number: "123",
      tel: "+1 (555) 000-0000",
      url: "https://example.com",
      search: "Search...",
      date: "YYYY-MM-DD",
      time: "HH:MM",
      "datetime-local": "YYYY-MM-DDTHH:MM",
    };
    return placeholders[type] || "Enter value...";
  }

  // ========================================================================
  // TEXTAREA GENERATOR
  // ========================================================================

  private generateTextarea(options?: {
    size?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const state = options?.state ?? "default";
    const size = options?.size ?? "md";

    const id = generateId("textarea");
    const rows = this.rng.int(3, 8);

    const styles: CSSProperties = {
      display: "block",
      width: "100%",
      padding: this.getInputPadding(size),
      fontSize: theme.fontSize[size],
      fontFamily: "inherit",
      lineHeight: 1.5,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      border: `1px solid ${state === "error" ? theme.colors.error : "#d1d5db"}`,
      borderRadius: `${theme.borderRadius.md}px`,
      resize: "vertical",
      minHeight: "80px",
    };

    const props: Record<string, unknown> = {
      id,
      rows,
      placeholder: "Enter your message...",
      disabled: state === "disabled",
    };

    const code = `<textarea id="${id}" rows="${rows}" placeholder="${props.placeholder}" class="${theme.prefix}textarea"${state === "disabled" ? " disabled" : ""}></textarea>`;

    const metadata: ComponentMetadata = {
      type: "textarea",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state,
      tags: ["textarea", size, styleSystem, state],
    };

    return { type: "textarea", code, styles, props, metadata };
  }

  // ========================================================================
  // CARD GENERATOR
  // ========================================================================

  private generateCard(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const variant = options?.variant ?? "basic";
    const hasImage = this.rng.boolean();
    const hasStats = this.rng.boolean();

    const id = generateId("card");

    const styles: CSSProperties = {
      backgroundColor: theme.colors.background,
      border: `1px solid #e5e7eb`,
      borderRadius: `${theme.borderRadius.lg}px`,
      boxShadow: `0 1px 3px rgba(0, 0, 0, 0.1)`,
      overflow: "hidden",
      transition: "box-shadow 0.3s ease",
    };

    if (options?.state === "hover") {
      styles.boxShadow = `0 10px 25px rgba(0, 0, 0, 0.15)`;
    }

    const contentParts: string[] = [];

    if (hasImage) {
      const imgHeight = this.rng.int(120, 240);
      contentParts.push(
        `<div class="${theme.prefix}card__image" style="height: ${imgHeight}px; background: linear-gradient(135deg, ${this.colorUtils.randomHue(180, 240)}, ${this.colorUtils.randomHue(200, 260)});"></div>`
      );
    }

    contentParts.push(
      `<div class="${theme.prefix}card__content" style="padding: ${theme.spacing.lg}px;">`
    );
    contentParts.push(
      `<h3 class="${theme.prefix}card__title" style="font-size: ${theme.fontSize.lg}; font-weight: ${theme.fontWeight.semibold}; margin-bottom: ${theme.spacing.sm}px;">Card Title</h3>`
    );
    contentParts.push(
      `<p class="${theme.prefix}card__text" style="color: ${theme.colors.secondary}; font-size: ${theme.fontSize.sm};">Card content goes here.</p>`
    );

    if (hasStats) {
      contentParts.push(
        `<div class="${theme.prefix}card__stats" style="display: flex; gap: ${theme.spacing.md}px; margin-top: ${theme.spacing.md}px;">`
      );
      contentParts.push(
        `<span style="color: ${theme.colors.primary};">1,234</span>`
      );
      contentParts.push(
        `<span style="color: ${theme.colors.success};">+56%</span>`
      );
      contentParts.push(`</div>`);
    }

    contentParts.push(`</div>`);

    const code = `<div id="${id}" class="${theme.prefix}card">\n${contentParts.join("\n  ")}\n</div>`;

    const metadata: ComponentMetadata = {
      type: "card",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      variant,
      state: options?.state ?? "default",
      tags: ["card", variant, styleSystem],
    };

    return {
      type: "card",
      code,
      styles,
      props: { hasImage, hasStats },
      metadata,
    };
  }

  // ========================================================================
  // MODAL GENERATOR
  // ========================================================================

  private generateModal(options?: {
    size?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const size = options?.size ?? "md";
    const isOpen = options?.state !== "disabled";

    const id = generateId("modal");
    const widths: Record<string, string> = {
      sm: "400px",
      md: "560px",
      lg: "720px",
      xl: "900px",
    };

    const styles: CSSProperties = {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      display: isOpen ? "flex" : "none",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      zIndex: "1000",
    };

    const modalStyles: CSSProperties = {
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.lg}px`,
      boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1)`,
      maxWidth: widths[size] ?? widths.md,
      width: "90%",
      maxHeight: "90vh",
      overflow: "auto",
    };

    const code = `
<div id="${id}" class="${theme.prefix}modal" style="${this.cssToString(styles)}">
  <div class="${theme.prefix}modal__content" style="${this.cssToString(modalStyles)}">
    <div class="${theme.prefix}modal__header" style="padding: ${theme.spacing.lg}px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
      <h2 style="font-size: ${theme.fontSize.xl}; font-weight: ${theme.fontWeight.semibold};">Modal Title</h2>
      <button class="${theme.prefix}modal__close">&times;</button>
    </div>
    <div class="${theme.prefix}modal__body" style="padding: ${theme.spacing.lg}px;">
      <p>Modal content goes here.</p>
    </div>
    <div class="${theme.prefix}modal__footer" style="padding: ${theme.spacing.lg}px; border-top: 1px solid #e5e7eb; display: flex; gap: ${theme.spacing.md}px; justify-content: flex-end;">
      <button class="${theme.prefix}btn ${theme.prefix}btn--ghost">Cancel</button>
      <button class="${theme.prefix}btn ${theme.prefix}btn--primary">Confirm</button>
    </div>
  </div>
</div>`.trim();

    const metadata: ComponentMetadata = {
      type: "modal",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: isOpen ? "default" : "disabled",
      tags: ["modal", size, styleSystem],
    };

    return { type: "modal", code, styles, props: { size, isOpen }, metadata };
  }

  // ========================================================================
  // ALERT GENERATOR
  // ========================================================================

  private generateAlert(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const variant =
      options?.variant ??
      this.rng.pick(["info", "success", "warning", "error"]);

    const id = generateId("alert");

    const variantColors: Record<
      string,
      { bg: string; border: string; text: string; icon: string }
    > = {
      info: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", icon: "" },
      success: { bg: "#dcfce7", border: "#22c55e", text: "#166534", icon: "" },
      warning: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", icon: "" },
      error: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", icon: "" },
    };

    const colors = variantColors[variant];

    const styles: CSSProperties = {
      padding: `${theme.spacing.md}px`,
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: `${theme.borderRadius.md}px`,
      color: colors.text,
      display: "flex",
      alignItems: "flex-start",
      gap: `${theme.spacing.md}px`,
    };

    const code = `
<div id="${id}" class="${theme.prefix}alert ${theme.prefix}alert--${variant}" style="${this.cssToString(styles)}">
  <span class="${theme.prefix}alert__icon"></span>
  <div class="${theme.prefix}alert__content">
    <div class="${theme.prefix}alert__title" style="font-weight: ${theme.fontWeight.semibold}; margin-bottom: ${theme.spacing.xs}px;">${variant.charAt(0).toUpperCase() + variant.slice(1)} Message</div>
    <div class="${theme.prefix}alert__text">This is a ${variant} alert message.</div>
  </div>
</div>`.trim();

    const metadata: ComponentMetadata = {
      type: "alert",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      variant,
      state: options?.state ?? "default",
      tags: ["alert", variant, styleSystem],
    };

    return { type: "alert", code, styles, props: { variant }, metadata };
  }

  // ========================================================================
  // SPINNER GENERATOR
  // ========================================================================

  private generateSpinner(options?: {
    size?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const size = options?.size ?? "md";

    const id = generateId("spinner");

    const sizes: Record<
      string,
      { width: string; height: string; border: string }
    > = {
      xs: { width: "16px", height: "16px", border: "2px" },
      sm: { width: "24px", height: "24px", border: "3px" },
      md: { width: "32px", height: "32px", border: "3px" },
      lg: { width: "48px", height: "48px", border: "4px" },
      xl: { width: "64px", height: "64px", border: "5px" },
    };

    const sizeConfig = sizes[size] ?? sizes.md;

    const styles: CSSProperties = {
      display: "inline-block",
      width: sizeConfig.width,
      height: sizeConfig.height,
      border: `${sizeConfig.border} solid #e5e7eb`,
      borderTopColor: theme.colors.primary,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    };

    const code = `
<div id="${id}" class="${theme.prefix}spinner ${theme.prefix}spinner--${size}" style="${this.cssToString(styles)}"></div>
<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>`.trim();

    const metadata: ComponentMetadata = {
      type: "spinner",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: ["spinner", size, styleSystem],
    };

    return { type: "spinner", code, styles, props: { size }, metadata };
  }

  // ========================================================================
  // TABS GENERATOR
  // ========================================================================

  private generateTabs(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const tabCount = this.rng.int(3, 6);
    const activeTab = this.rng.int(0, tabCount - 1);

    const id = generateId("tabs");

    const tabs = Array.from({ length: tabCount }, (_, i) => `Tab ${i + 1}`);

    const styles: CSSProperties = {
      display: "flex",
      flexDirection: "column",
    };

    const tabListStyles: CSSProperties = {
      display: "flex",
      gap: `${theme.spacing.xs}px`,
      borderBottom: `1px solid #e5e7eb`,
      padding: `0 ${theme.spacing.sm}px`,
    };

    const tabStyles: CSSProperties = {
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      fontSize: theme.fontSize.md,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.secondary,
      border: "none",
      background: "none",
      cursor: "pointer",
      borderBottom: "2px solid transparent",
    };

    const tabPanels = tabs
      .map(
        (tab, i) => `
      <div class="${theme.prefix}tabs__panel" style="padding: ${theme.spacing.lg}px; display: ${i === activeTab ? "block" : "none"};">
        <p>Content for ${tab}</p>
      </div>
    `
      )
      .join("\n      ");

    const tabButtons = tabs
      .map((tab, i) => {
        const isActive = i === activeTab;
        const activeStyle = isActive
          ? `color: ${theme.colors.primary}; borderBottomColor: ${theme.colors.primary};`
          : "";
        return `<button class="${theme.prefix}tabs__tab" style="${this.cssToString(tabStyles)}${activeStyle}">${tab}</button>`;
      })
      .join("\n        ");

    const code = `
<div id="${id}" class="${theme.prefix}tabs" style="${this.cssToString(styles)}">
  <div class="${theme.prefix}tabs__list" role="tablist" style="${this.cssToString(tabListStyles)}">
    ${tabButtons}
  </div>
  <div class="${theme.prefix}tabs__panels">
    ${tabPanels}
  </div>
</div>`.trim();

    const metadata: ComponentMetadata = {
      type: "tabs",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: ["tabs", styleSystem],
    };

    return {
      type: "tabs",
      code,
      styles,
      props: { tabCount, activeTab },
      metadata,
    };
  }

  // ========================================================================
  // NAVBAR GENERATOR
  // ========================================================================

  private generateNavbar(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];

    const id = generateId("navbar");
    const linkCount = this.rng.int(3, 6);
    const hasCTA = this.rng.boolean();

    const styles: CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
      backgroundColor: theme.colors.background,
      borderBottom: `1px solid #e5e7eb`,
      boxShadow: `0 1px 2px rgba(0, 0, 0, 0.05)`,
    };

    const links = Array.from({ length: linkCount }, (_, i) => ({
      text: `Link ${i + 1}`,
      active: i === 0,
    }));

    const linkElements = links
      .map(
        link => `
      <a href="#" class="${theme.prefix}navbar__link" style="color: ${link.active ? theme.colors.primary : theme.colors.secondary}; text-decoration: ${link.active ? "underline" : "none"}; font-weight: ${link.active ? theme.fontWeight.semibold : theme.fontWeight.normal}; padding: ${theme.spacing.sm}px;">${link.text}</a>
    `
      )
      .join("\n      ");

    const ctaButton = hasCTA
      ? `
      <button class="${theme.prefix}btn ${theme.prefix}btn--primary" style="padding: ${theme.spacing.sm}px ${theme.spacing.md}px;">Action</button>
    `
      : "";

    const code = `
<nav id="${id}" class="${theme.prefix}navbar" style="${this.cssToString(styles)}">
  <div class="${theme.prefix}navbar__brand" style="font-size: ${theme.fontSize.xl}; font-weight: ${theme.fontWeight.bold}; color: ${theme.colors.primary};">Brand</div>
  <div class="${theme.prefix}navbar__links" style="display: flex; gap: ${theme.spacing.md}px; align-items: center;">
    ${linkElements}
    ${ctaButton}
  </div>
</nav>`.trim();

    const metadata: ComponentMetadata = {
      type: "navbar",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: ["navbar", styleSystem],
    };

    return {
      type: "navbar",
      code,
      styles,
      props: { linkCount, hasCTA },
      metadata,
    };
  }

  // ========================================================================
  // SIDEBAR GENERATOR
  // ========================================================================

  private generateSidebar(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];

    const id = generateId("sidebar");
    const itemCount = this.rng.int(4, 8);
    const isCollapsed = options?.state === "disabled";

    const width = isCollapsed ? "64px" : "256px";

    const styles: CSSProperties = {
      width,
      height: "100vh",
      backgroundColor: theme.colors.background,
      borderRight: `1px solid #e5e7eb`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.3s ease",
      overflow: "hidden",
    };

    const items = Array.from({ length: itemCount }, (_, i) => ({
      label: `Item ${i + 1}`,
      icon: i === 0 ? "home" : i === 1 ? "user" : "file",
      active: i === 0,
    }));

    const itemElements = items
      .map(
        item => `
      <a href="#" class="${theme.prefix}sidebar__item" style="display: flex; align-items: center; gap: ${theme.spacing.md}px; padding: ${theme.spacing.md}px; color: ${item.active ? theme.colors.primary : theme.colors.secondary}; text-decoration: none; ${item.active ? `background: ${theme.colors.primary}11;` : ""}">
        <span style="width: 20px; height: 20px; background: ${item.active ? theme.colors.primary : "#e5e7eb"}; border-radius: 4px;"></span>
        ${!isCollapsed ? `<span>${item.label}</span>` : ""}
      </a>
    `
      )
      .join("\n    ");

    const code = `
<aside id="${id}" class="${theme.prefix}sidebar" style="${this.cssToString(styles)}">
  <div class="${theme.prefix}sidebar__header" style="padding: ${theme.spacing.lg}px; border-bottom: 1px solid #e5e7eb; font-weight: ${theme.fontWeight.bold};">Logo</div>
  <nav class="${theme.prefix}sidebar__nav" style="flex: 1; padding: ${theme.spacing.md}px;">
    ${itemElements}
  </nav>
</aside>`.trim();

    const metadata: ComponentMetadata = {
      type: "sidebar",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: isCollapsed ? "disabled" : "default",
      tags: ["sidebar", styleSystem],
    };

    return {
      type: "sidebar",
      code,
      styles,
      props: { itemCount, isCollapsed },
      metadata,
    };
  }

  // ========================================================================
  // TABLE GENERATOR
  // ========================================================================

  private generateTable(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];

    const id = generateId("table");
    const rowCount = this.rng.int(3, 8);
    const colCount = this.rng.int(3, 5);

    const styles: CSSProperties = {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: theme.fontSize.md,
    };

    const headers = Array.from(
      { length: colCount },
      (_, i) => `Column ${i + 1}`
    );
    const rows = Array.from({ length: rowCount }, () =>
      Array.from({ length: colCount }, () => `Data ${Math.random().toFixed(2)}`)
    );

    const headerCells = headers
      .map(
        h =>
          `<th style="padding: ${theme.spacing.md}px; textAlign: left; border-bottom: 2px solid #e5e7eb; font-weight: ${theme.fontWeight.semibold};">${h}</th>`
      )
      .join("\n        ");
    const dataRows = rows
      .map(row => {
        const cells = row
          .map(
            cell =>
              `<td style="padding: ${theme.spacing.md}px; border-bottom: 1px solid #e5e7eb;">${cell}</td>`
          )
          .join("\n        ");
        return `        <tr>${cells}</tr>`;
      })
      .join("\n");

    const code = `
<table id="${id}" class="${theme.prefix}table" style="${this.cssToString(styles)}">
  <thead>
    <tr>${headerCells}</tr>
  </thead>
  <tbody>
${dataRows}
  </tbody>
</table>`.trim();

    const metadata: ComponentMetadata = {
      type: "table",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: ["table", styleSystem],
    };

    return {
      type: "table",
      code,
      styles,
      props: { rowCount, colCount },
      metadata,
    };
  }

  // ========================================================================
  // FORM GENERATOR
  // ========================================================================

  private generateForm(options?: {
    variant?: string;
    state?: ComponentState;
    styleSystem?: StyleSystem;
  }): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];

    const id = generateId("form");
    const fieldCount = this.rng.int(3, 6);

    const styles: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      gap: `${theme.spacing.md}px`,
      maxWidth: "400px",
    };

    const fieldTypes = this.rng.pickN<
      "text" | "email" | "password" | "textarea"
    >(["text", "email", "password", "textarea"], fieldCount);

    const fields = fieldTypes
      .map((type, i) => {
        const isTextarea = type === "textarea";
        const inputElement = isTextarea
          ? `<textarea id="field-${i}" placeholder="Enter text..." rows="3" style="width: 100%; padding: ${theme.spacing.sm}px; border: 1px solid #d1d5db; border-radius: 4px;"></textarea>`
          : `<input id="field-${i}" type="${type}" placeholder="Enter ${type}..." style="width: 100%; padding: ${theme.spacing.sm}px; border: 1px solid #d1d5db; border-radius: 4px;" />`;

        return `
      <div style="display: flex; flex-direction: column; gap: ${theme.spacing.xs}px;">
        <label for="field-${i}" style="font-weight: ${theme.fontWeight.medium}; font-size: ${theme.fontSize.sm};">Field ${i + 1}</label>
        ${inputElement}
      </div>`;
      })
      .join("\n");

    const code = `
<form id="${id}" class="${theme.prefix}form" style="${this.cssToString(styles)}">
${fields}
  <div style="display: flex; gap: ${theme.spacing.md}px; margin-top: ${theme.spacing.md}px;">
    <button type="submit" class="${theme.prefix}btn ${theme.prefix}btn--primary" style="flex: 1;">Submit</button>
    <button type="reset" class="${theme.prefix}btn ${theme.prefix}btn--ghost" style="flex: 1;">Reset</button>
  </div>
</form>`.trim();

    const metadata: ComponentMetadata = {
      type: "form",
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: ["form", styleSystem],
    };

    return { type: "form", code, styles, props: { fieldCount }, metadata };
  }

  // ========================================================================
  // GENERIC COMPONENT GENERATOR
  // ========================================================================

  private generateGenericComponent(
    type: ComponentType,
    options?: {
      variant?: string;
      size?: string;
      state?: ComponentState;
      styleSystem?: StyleSystem;
    }
  ): GeneratedComponent {
    const styleSystem =
      options?.styleSystem ?? this.rng.pick(this.config.styleSystems);
    const theme = STYLE_SYSTEMS[styleSystem];
    const id = generateId(type);

    const styles: CSSProperties = {
      padding: `${theme.spacing.md}px`,
      backgroundColor: theme.colors.background,
      border: `1px solid #e5e7eb`,
      borderRadius: `${theme.borderRadius.md}px`,
    };

    const code = `<div id="${id}" class="${theme.prefix}${camelToKebab(type)}" style="${this.cssToString(styles)}">${type} component</div>`;

    const metadata: ComponentMetadata = {
      type,
      id,
      styleSystem,
      timestamp: Date.now(),
      seed: this.rng.getSeed(),
      state: options?.state ?? "default",
      tags: [type, styleSystem],
    };

    return { type, code, styles, props: {}, metadata };
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private cssToString(styles: CSSProperties): string {
    return Object.entries(styles)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${camelToKebab(key)}: ${JSON.stringify(value)};`;
        }
        return `${camelToKebab(key)}: ${value};`;
      })
      .join(" ");
  }
}

// Extend SeededRandom interface to include boolean method
declare module "../types.js" {
  interface SeededRandom {
    boolean(): boolean;
  }
}

// Add boolean method to seeded random
const originalCreateSeededRandom = createSeededRandom;
const _createSeededRandom = (
  seed: number
): ReturnType<typeof createSeededRandom> => {
  const rng = originalCreateSeededRandom(seed);
  (rng as any).boolean = (): boolean => (rng as any).float(0, 1) < 0.5;
  return rng as ReturnType<typeof createSeededRandom> & { boolean(): boolean };
};
