/**
 * @fileoverview Metadata Collector - Extract UI metadata
 * @description Collects comprehensive metadata for dataset samples
 */

// @ts-ignore - Puppeteer is optional
import type { Page } from "puppeteer";
import type {
  ScreenshotMetadata,
  StructureMetadata,
  DatasetError,
} from "../types.js";

/**
 * Extended metadata including performance and interaction metrics
 */
export interface ExtendedMetadata extends ScreenshotMetadata {
  performance: PerformanceMetrics;
  interaction: InteractionMetrics;
  accessibility: AccessibilityMetrics;
  seo: SEOMetrics;
  framework: FrameworkInfo;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  resourceCount: number;
  scriptCount: number;
  stylesheetCount: number;
  imageCount: number;
  totalSize: number;
}

/**
 * Interaction metrics
 */
export interface InteractionMetrics {
  clickableElements: number;
  formFields: number;
  links: number;
  buttons: number;
  inputs: number;
  scrollableElements: number;
  hoverElements: number;
  hasVideo: boolean;
  hasAudio: boolean;
  hasAnimation: boolean;
}

/**
 * Accessibility metrics
 */
export interface AccessibilityMetrics {
  ariaElements: number;
  landmarks: number;
  headings: number;
  labels: number;
  focusableElements: number;
  keyboardAccessible: number;
  colorContrastIssues: number;
  altTextMissing: number;
  accessibilityScore: number;
}

/**
 * SEO metrics
 */
export interface SEOMetrics {
  titleLength: number;
  descriptionLength: number;
  headingStructure: boolean;
  hasH1: boolean;
  headingCount: number;
  metaTags: number;
  openGraphTags: number;
  twitterCardTags: number;
  structuredData: boolean;
}

/**
 * Framework information
 */
export interface FrameworkInfo {
  name: string;
  version?: string;
  uiLibrary?: string;
  stateManagement?: string;
  buildTool?: string;
  cssFramework?: string;
}

/**
 * Metadata Collector configuration
 */
export interface MetadataCollectorConfig {
  collectPerformance: boolean;
  collectInteraction: boolean;
  collectAccessibility: boolean;
  collectSEO: boolean;
  collectFramework: boolean;
}

/**
 * Metadata Collector class
 */
export class MetadataCollector {
  private config: MetadataCollectorConfig;

  constructor(config?: Partial<MetadataCollectorConfig>) {
    this.config = {
      collectPerformance: config?.collectPerformance ?? true,
      collectInteraction: config?.collectInteraction ?? true,
      collectAccessibility: config?.collectAccessibility ?? true,
      collectSEO: config?.collectSEO ?? true,
      collectFramework: config?.collectFramework ?? true,
    };
  }

  /**
   * Collect all metadata from page
   */
  async collect(
    page: Page,
    baseMetadata: ScreenshotMetadata
  ): Promise<ExtendedMetadata> {
    try {
      const performance = this.config.collectPerformance
        ? await this.collectPerformanceMetrics(page)
        : this.getEmptyPerformance();

      const interaction = this.config.collectInteraction
        ? await this.collectInteractionMetrics(page)
        : this.getEmptyInteraction();

      const accessibility = this.config.collectAccessibility
        ? await this.collectAccessibilityMetrics(page)
        : this.getEmptyAccessibility();

      const seo = this.config.collectSEO
        ? await this.collectSEOMetrics(page)
        : this.getEmptySEO();

      const framework = this.config.collectFramework
        ? await this.detectFramework(page)
        : this.getEmptyFramework();

      return {
        ...baseMetadata,
        performance,
        interaction,
        accessibility,
        seo,
        framework,
      };
    } catch (error) {
      throw this.createError("parsing-failed", "Failed to collect metadata", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(
    page: Page
  ): Promise<PerformanceMetrics> {
    return await page.evaluate(() => {
      const perfData = performance.getEntriesByType(
        "navigation"
      )[0] as PerformanceNavigationTiming;

      return {
        loadTime: perfData?.loadEventEnd - perfData?.loadEventStart || 0,
        domContentLoaded:
          perfData?.domContentLoadedEventEnd -
            perfData?.domContentLoadedEventStart || 0,
        firstPaint:
          performance
            .getEntriesByType("paint")
            .find(p => p.name === "first-paint")?.startTime || 0,
        firstContentfulPaint:
          performance
            .getEntriesByType("paint")
            .find(p => p.name === "first-contentful-paint")?.startTime || 0,
        resourceCount: performance.getEntriesByType("resource").length,
        scriptCount: document.querySelectorAll("script").length,
        stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]')
          .length,
        imageCount: document.querySelectorAll("img").length,
        totalSize: performance
          .getEntriesByType("resource")
          .reduce((sum, r) => sum + (r as any).transferSize, 0),
      };
    });
  }

  /**
   * Collect interaction metrics
   */
  private async collectInteractionMetrics(
    page: Page
  ): Promise<InteractionMetrics> {
    return await page.evaluate(() => {
      return {
        clickableElements: document.querySelectorAll(
          'button, a, [role="button"], [onclick]'
        ).length,
        formFields: document.querySelectorAll("input, textarea, select").length,
        links: document.querySelectorAll("a[href]").length,
        buttons: document.querySelectorAll("button").length,
        inputs: document.querySelectorAll("input").length,
        scrollableElements: document.querySelectorAll(
          '[style*="overflow"], [style*="scroll"]'
        ).length,
        hoverElements: document.querySelectorAll(
          '[onmouseover], [class*="hover"]'
        ).length,
        hasVideo: document.querySelectorAll("video").length > 0,
        hasAudio: document.querySelectorAll("audio").length > 0,
        hasAnimation:
          document.querySelectorAll('[style*="animation"], .animate, .animated')
            .length > 0,
      };
    });
  }

  /**
   * Collect accessibility metrics
   */
  private async collectAccessibilityMetrics(
    page: Page
  ): Promise<AccessibilityMetrics> {
    return await page.evaluate(() => {
      const ariaElements = document.querySelectorAll(
        "[aria-label], [aria-labelledby], [role]"
      ).length;

      const landmarks = document.querySelectorAll(
        '[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], ' +
          "header, nav, main, aside, footer"
      ).length;

      const headings = document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6"
      ).length;
      const hasH1 = document.querySelectorAll("h1").length > 0;

      const labels = document.querySelectorAll(
        "label, [aria-label], [aria-labelledby]"
      ).length;

      const focusableElements = document.querySelectorAll(
        'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ).length;

      const keyboardAccessible = document.querySelectorAll(
        "button, a, input, textarea, select"
      ).length;

      // Check for missing alt text
      const images = document.querySelectorAll("img");
      let altTextMissing = 0;
      images.forEach(img => {
        if (!img.alt || img.alt.trim() === "") {
          altTextMissing++;
        }
      });

      // Calculate accessibility score (simplified)
      const score =
        (landmarks > 0 ? 20 : 0) +
        (hasH1 ? 15 : 0) +
        (labels / focusableElements) * 20 +
        (altTextMissing / images.length) * -15 +
        (ariaElements > 0 ? 15 : 0) +
        30;

      return {
        ariaElements,
        landmarks,
        headings,
        labels,
        focusableElements,
        keyboardAccessible,
        colorContrastIssues: 0, // Would need contrast calculation
        altTextMissing,
        accessibilityScore: Math.max(0, Math.min(100, score)),
      };
    });
  }

  /**
   * Collect SEO metrics
   */
  private async collectSEOMetrics(page: Page): Promise<SEOMetrics> {
    return await page.evaluate(() => {
      const title = document.title;
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";
      const h1 = document.querySelectorAll("h1");
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const headingLevels = new Set(Array.from(headings).map(h => h.tagName));

      return {
        titleLength: title.length,
        descriptionLength: description.length,
        headingStructure: headingLevels.size === 6,
        hasH1: h1.length === 1,
        headingCount: headings.length,
        metaTags: document.querySelectorAll("meta").length,
        openGraphTags: document.querySelectorAll('meta[property^="og:"]')
          .length,
        twitterCardTags: document.querySelectorAll('meta[name^="twitter:"]')
          .length,
        structuredData:
          document.querySelectorAll('script[type="application/ld+json"]')
            .length > 0,
      };
    });
  }

  /**
   * Detect framework and libraries
   */
  private async detectFramework(page: Page): Promise<FrameworkInfo> {
    return await page.evaluate(() => {
      const framework = detectJSFramework();
      const uiLibrary = detectUILibrary();
      const stateManagement = detectStateManagement();
      const buildTool = detectBuildTool();
      const cssFramework = detectCSSFramework();

      return {
        name: framework,
        version: undefined,
        uiLibrary,
        stateManagement,
        buildTool,
        cssFramework,
      };
    });
  }

  /**
   * Get empty performance metrics
   */
  private getEmptyPerformance(): PerformanceMetrics {
    return {
      loadTime: 0,
      domContentLoaded: 0,
      firstPaint: 0,
      firstContentfulPaint: 0,
      resourceCount: 0,
      scriptCount: 0,
      stylesheetCount: 0,
      imageCount: 0,
      totalSize: 0,
    };
  }

  /**
   * Get empty interaction metrics
   */
  private getEmptyInteraction(): InteractionMetrics {
    return {
      clickableElements: 0,
      formFields: 0,
      links: 0,
      buttons: 0,
      inputs: 0,
      scrollableElements: 0,
      hoverElements: 0,
      hasVideo: false,
      hasAudio: false,
      hasAnimation: false,
    };
  }

  /**
   * Get empty accessibility metrics
   */
  private getEmptyAccessibility(): AccessibilityMetrics {
    return {
      ariaElements: 0,
      landmarks: 0,
      headings: 0,
      labels: 0,
      focusableElements: 0,
      keyboardAccessible: 0,
      colorContrastIssues: 0,
      altTextMissing: 0,
      accessibilityScore: 0,
    };
  }

  /**
   * Get empty SEO metrics
   */
  private getEmptySEO(): SEOMetrics {
    return {
      titleLength: 0,
      descriptionLength: 0,
      headingStructure: false,
      hasH1: false,
      headingCount: 0,
      metaTags: 0,
      openGraphTags: 0,
      twitterCardTags: 0,
      structuredData: false,
    };
  }

  /**
   * Get empty framework info
   */
  private getEmptyFramework(): FrameworkInfo {
    return {
      name: "unknown",
    };
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}

/**
 * Framework detection helper
 */
function detectJSFramework(): string {
  const win = window as any;

  // React
  if (win.__REACT__ || win.__REACT_DEVTOOLS_GLOBAL_HOOK__) return "react";

  // Vue
  if (win.__VUE__) return "vue";

  // Angular
  if (document.querySelector("[ng-version]")) return "angular";

  // Svelte
  if (win.__SVELTE__) return "svelte";

  // Solid
  if (win.Solid) return "solid";

  return "vanilla";
}

/**
 * UI library detection
 */
function detectUILibrary(): string | undefined {
  const doc = document;

  // Material UI
  if (doc.querySelector('[class*="Mui"]')) return "@mui/material";

  // Chakra UI
  if (doc.querySelector('[class*="chakra"]')) return "@chakra-ui/react";

  // Ant Design
  if (doc.querySelector('[class*="ant-"]')) return "antd";

  // Tailwind UI / shadcn/ui
  if (
    doc.querySelector(
      '[class*="bg-"], [class*="text-"], [class*="p-"], [class*="m-"]'
    )
  ) {
    return "tailwind";
  }

  // Bootstrap
  if (doc.querySelector('[class*="col-"], .container, .btn'))
    return "bootstrap";

  return undefined;
}

/**
 * State management detection
 */
function detectStateManagement(): string | undefined {
  const win = window as any;

  if (win.__REDUX_DEVTOOLS_EXTENSION__) return "redux";
  if (win.Recoil) return "recoil";
  if (win.Zustand) return "zustand";
  if (win.Pinia) return "pinia";
  if (win.Jotai) return "jotai";

  return undefined;
}

/**
 * Build tool detection
 */
function detectBuildTool(): string | undefined {
  const doc = document;

  // Vite
  if (doc.querySelector('script[type="module"][src*="/@vite/"]')) return "vite";

  // Webpack
  if (doc.querySelector("script[data-webpack]")) return "webpack";

  // Next.js
  if (doc.querySelector('script[id*="__NEXT_DATA__"]')) return "next.js";

  return undefined;
}

/**
 * CSS framework detection
 */
function detectCSSFramework(): string | undefined {
  const doc = document;

  if (doc.querySelector('[class*="bg-"], [class*="text-"]')) return "tailwind";
  if (doc.querySelector('[class*="col-"], .container')) return "bootstrap";
  if (doc.querySelector('[class*="Mui"]')) return "material-ui";

  return undefined;
}
