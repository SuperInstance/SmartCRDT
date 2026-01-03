/**
 * StyleRecommender - Recommend UI styles based on user preferences
 */

import type { ThemeType, UserPreferences, UIContext } from "../types.js";

export interface StyleRecommendationRequest {
  userId: string;
  context: UIContext;
  contentType?: "text" | "image" | "video" | "data" | "mixed";
  brandGuidelines?: BrandGuidelines;
}

export interface StyleRecommendation {
  theme: ThemeType;
  colors: ColorScheme;
  typography: TypographyScheme;
  spacing: SpacingScheme;
  effects: EffectScheme;
  confidence: number;
  reason: string;
}

export interface BrandGuidelines {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export interface TypographyScheme {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface SpacingScheme {
  unit: number; // Base spacing unit
  scale: number[]; // Spacing scale
}

export interface EffectScheme {
  shadows: boolean;
  borderRadius: number;
  borderWidth: number;
  animations: boolean;
  transitions: {
    duration: number; // ms
    easing: string;
  };
}

export class StyleRecommender {
  private userPreferences: Map<string, UserPreferences> = new Map();
  private stylePerformance: Map<string, Map<string, number>> = new Map(); // userId -> styleKey -> performance
  private colorPalettes: Map<string, ColorScheme> = new Map();

  constructor() {
    this.initializeColorPalettes();
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: UserPreferences): void {
    this.userPreferences.set(preferences.userId, preferences);
  }

  /**
   * Record style performance
   */
  recordPerformance(
    userId: string,
    styleKey: string,
    performance: number
  ): void {
    if (!this.stylePerformance.has(userId)) {
      this.stylePerformance.set(userId, new Map());
    }

    this.stylePerformance.get(userId)!.set(styleKey, performance);
  }

  /**
   * Recommend style
   */
  recommend(request: StyleRecommendationRequest): StyleRecommendation {
    const { userId, context, contentType = "mixed", brandGuidelines } = request;

    const preferences = this.userPreferences.get(userId);

    // Generate recommendations
    const theme = this.recommendTheme(userId, context, preferences);
    const colors = this.recommendColors(userId, preferences, brandGuidelines);
    const typography = this.recommendTypography(
      userId,
      contentType,
      preferences
    );
    const spacing = this.recommendSpacing(preferences);
    const effects = this.recommendEffects(preferences);

    // Calculate confidence
    const confidence = this.calculateConfidence(preferences);

    return {
      theme,
      colors,
      typography,
      spacing,
      effects,
      confidence,
      reason: this.generateReason(
        theme,
        colors,
        typography,
        preferences,
        context
      ),
    };
  }

  /**
   * Recommend theme
   */
  private recommendTheme(
    userId: string,
    context: UIContext,
    preferences: UserPreferences | undefined
  ): ThemeType {
    // Time-based preference
    const hour = new Date(context.timestamp).getHours();

    // Dark mode at night, light during day
    const timeBased = hour >= 18 || hour <= 6 ? "dark" : "light";

    // User preference override
    if (preferences && preferences.visual.theme !== "auto") {
      return preferences.visual.theme;
    }

    return timeBased;
  }

  /**
   * Recommend colors
   */
  private recommendColors(
    userId: string,
    preferences: UserPreferences | undefined,
    brandGuidelines?: BrandGuidelines
  ): ColorScheme {
    const theme = this.recommendTheme(
      userId,
      {
        viewport: { width: 1000, height: 800 },
        timestamp: Date.now(),
        page: "",
      },
      preferences
    );

    // Get base palette
    const basePalette =
      this.colorPalettes.get(theme) ?? this.colorPalettes.get("light")!;

    // Customize based on preferences
    const colors: ColorScheme = { ...basePalette };

    if (preferences) {
      // Use user's preferred colors
      colors.primary = preferences.visual.primaryColor;
      colors.accent = preferences.visual.accentColor;
    }

    // Apply brand guidelines if provided
    if (brandGuidelines) {
      colors.primary = brandGuidelines.primaryColor;

      if (brandGuidelines.secondaryColor) {
        colors.secondary = brandGuidelines.secondaryColor;
      }

      if (brandGuidelines.accentColor) {
        colors.accent = brandGuidelines.accentColor;
      }
    }

    return colors;
  }

  /**
   * Recommend typography
   */
  private recommendTypography(
    userId: string,
    contentType: string,
    preferences: UserPreferences | undefined
  ): TypographyScheme {
    const baseTypography: TypographyScheme = {
      fontFamily: preferences?.typography.fontFamily ?? "system-ui",
      fontSize: {
        xs: "0.75rem",
        sm: "0.875rem",
        md: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
      },
      fontWeight: {
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      lineHeight: {
        tight: 1.25,
        normal: 1.5,
        relaxed: 1.75,
      },
    };

    // Adjust based on content type
    if (contentType === "text") {
      // Text content: larger base size, relaxed line height
      baseTypography.fontSize.md = "1.125rem";
      baseTypography.lineHeight.normal = 1.75;
    } else if (contentType === "data") {
      // Data content: more compact
      baseTypography.fontSize.md = "0.875rem";
      baseTypography.lineHeight.normal = 1.25;
    }

    // Apply user preferences
    if (preferences) {
      const fontSizeMult = this.getFontSizeMultiplier(
        preferences.typography.fontSize
      );

      for (const key of Object.keys(baseTypography.fontSize)) {
        const size = parseFloat(
          baseTypography.fontSize[key as keyof typeof baseTypography.fontSize]!
        );
        baseTypography.fontSize[key as keyof typeof baseTypography.fontSize] =
          `${size * fontSizeMult}rem`;
      }

      baseTypography.lineHeight.normal = preferences.typography.lineHeight;
      baseTypography.fontWeight.normal = preferences.typography.fontWeight;
    }

    return baseTypography;
  }

  /**
   * Get font size multiplier
   */
  private getFontSizeMultiplier(size: string): number {
    switch (size) {
      case "small":
        return 0.875;
      case "medium":
        return 1;
      case "large":
        return 1.125;
      case "extra_large":
        return 1.25;
      default:
        return 1;
    }
  }

  /**
   * Recommend spacing
   */
  private recommendSpacing(
    preferences: UserPreferences | undefined
  ): SpacingScheme {
    let baseUnit = 4; // 4px base

    let density = "normal";
    if (preferences) {
      density = preferences.layout.density;
    }

    // Adjust based on density
    switch (density) {
      case "compact":
        baseUnit = 3;
        break;
      case "normal":
        baseUnit = 4;
        break;
      case "spacious":
        baseUnit = 6;
        break;
    }

    return {
      unit: baseUnit,
      scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(
        n => n * baseUnit
      ),
    };
  }

  /**
   * Recommend effects
   */
  private recommendEffects(
    preferences: UserPreferences | undefined
  ): EffectScheme {
    return {
      shadows: preferences?.visual.shadows ?? true,
      borderRadius: preferences?.visual.borderRadius ?? 4,
      borderWidth: 1,
      animations: preferences?.visual.animations ?? true,
      transitions: {
        duration: 200,
        easing: "ease-in-out",
      },
    };
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    preferences: UserPreferences | undefined
  ): number {
    if (!preferences) return 0.5;

    const confidences = [
      preferences.visual.confidence,
      preferences.typography.confidence,
    ];

    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  /**
   * Generate recommendation reason
   */
  private generateReason(
    theme: ThemeType,
    colors: ColorScheme,
    typography: TypographyScheme,
    preferences: UserPreferences | undefined,
    context: UIContext
  ): string {
    const reasons: string[] = [];

    reasons.push(`${theme} theme`);

    if (preferences) {
      reasons.push("based on your visual preferences");
    }

    const hour = new Date(context.timestamp).getHours();
    if (hour >= 18 || hour <= 6) {
      reasons.push("dark mode for nighttime viewing");
    }

    return reasons.join(", ");
  }

  /**
   * Initialize color palettes
   */
  private initializeColorPalettes(): void {
    // Light theme
    this.colorPalettes.set("light", {
      primary: "#007bff",
      secondary: "#6c757d",
      accent: "#28a745",
      background: "#ffffff",
      surface: "#f8f9fa",
      text: "#212529",
      textSecondary: "#6c757d",
      error: "#dc3545",
      warning: "#ffc107",
      success: "#28a745",
      info: "#17a2b8",
    });

    // Dark theme
    this.colorPalettes.set("dark", {
      primary: "#0d6efd",
      secondary: "#6c757d",
      accent: "#198754",
      background: "#212529",
      surface: "#343a40",
      text: "#f8f9fa",
      textSecondary: "#adb5bd",
      error: "#dc3545",
      warning: "#ffc107",
      success: "#198754",
      info: "#0dcaf0",
    });
  }

  /**
   * Add custom color palette
   */
  addColorPalette(name: string, palette: ColorScheme): void {
    this.colorPalettes.set(name, palette);
  }

  /**
   * Get color palette
   */
  getColorPalette(name: string): ColorScheme | undefined {
    return this.colorPalettes.get(name);
  }

  /**
   * Get all color palettes
   */
  getAllColorPalettes(): Map<string, ColorScheme> {
    return this.colorPalettes;
  }

  /**
   * Get style performance for user
   */
  getStylePerformance(userId: string): Map<string, number> | undefined {
    return this.stylePerformance.get(userId);
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): UserPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.userPreferences.clear();
    this.stylePerformance.clear();
    this.colorPalettes.clear();
    this.initializeColorPalettes();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalUsers: number;
    totalPerformanceRecords: number;
    avgConfidence: number;
  } {
    let totalPerformanceRecords = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const performance of this.stylePerformance.values()) {
      totalPerformanceRecords += performance.size;
    }

    for (const preferences of this.userPreferences.values()) {
      totalConfidence += preferences.visual.confidence;
      totalConfidence += preferences.typography.confidence;
      confidenceCount += 2;
    }

    return {
      totalUsers: this.userPreferences.size,
      totalPerformanceRecords,
      avgConfidence:
        confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }
}
