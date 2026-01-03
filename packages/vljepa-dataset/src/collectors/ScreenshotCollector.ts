/**
 * @fileoverview Screenshot Collector - Browser-based screenshot capture
 * @description Captures UI screenshots from various sources using Puppeteer/Playwright
 */

// @ts-ignore - Puppeteer is optional
import type { Browser, Page, Viewport } from "puppeteer";
import type {
  ScreenshotConfig,
  CollectedScreenshot,
  DatasetSource,
  ScreenshotMetadata,
  ViewportSize,
  CollectionProgress,
  DatasetError,
} from "../types.js";

/**
 * Popular websites for UI dataset collection
 */
const POPULAR_SOURCES: DatasetSource[] = [
  {
    type: "url",
    location: "https://github.com",
    weight: 10,
    categories: ["developer-tools", "code-repository"],
  },
  {
    type: "url",
    location: "https://dribbble.com",
    weight: 8,
    categories: ["design", "inspiration"],
  },
  {
    type: "url",
    location: "https://behance.net",
    weight: 8,
    categories: ["design", "portfolio"],
  },
  {
    type: "url",
    location: "https://material.io/design",
    weight: 7,
    categories: ["component-library", "material-design"],
  },
  {
    type: "url",
    location: "https://ant.design",
    weight: 7,
    categories: ["component-library", "ant-design"],
  },
  {
    type: "url",
    location: "https://tailwindui.com",
    weight: 7,
    categories: ["component-library", "tailwind"],
  },
  {
    type: "url",
    location: "https://ui.shadcn.com",
    weight: 7,
    categories: ["component-library", "shadcn"],
  },
  {
    type: "url",
    location: "https://stripe.com",
    weight: 6,
    categories: ["payment", "saas"],
  },
  {
    type: "url",
    location: "https://vercel.com",
    weight: 6,
    categories: ["infrastructure", "saas"],
  },
  {
    type: "url",
    location: "https://linear.app",
    weight: 6,
    categories: ["productivity", "saas"],
  },
];

/**
 * Component library URLs for specialized UI patterns
 */
const COMPONENT_LIBRARY_SOURCES: DatasetSource[] = [
  {
    type: "url",
    location: "https://mui.com",
    weight: 9,
    categories: ["component-library", "material-ui"],
  },
  {
    type: "url",
    location: "https://chakra-ui.com",
    weight: 8,
    categories: ["component-library", "chakra"],
  },
  {
    type: "url",
    location: "https://headlessui.com",
    weight: 8,
    categories: ["component-library", "headless"],
  },
  {
    type: "url",
    location: "https://radix-ui.com",
    weight: 8,
    categories: ["component-library", "radix"],
  },
];

/**
 * Screenshot Collector class
 */
export class ScreenshotCollector {
  private config: ScreenshotConfig;
  private browser: Browser | null = null;
  private collected: Map<string, CollectedScreenshot> = new Map();
  private progress: CollectionProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
    currentBatch: 0,
    estimatedTimeRemaining: 0,
  };

  constructor(config?: Partial<ScreenshotConfig>) {
    this.config = {
      sources: config?.sources ?? POPULAR_SOURCES,
      resolutions: config?.resolutions ?? [
        { width: 1920, height: 1080, name: "Desktop 1080p", isDesktop: true },
        { width: 1366, height: 768, name: "Laptop", isDesktop: true },
        { width: 768, height: 1024, name: "Tablet", isTablet: true },
        { width: 375, height: 667, name: "Mobile", isMobile: true },
      ],
      formats: config?.formats ?? ["png", "webp"],
      quality: config?.quality ?? 95,
      delay: config?.delay ?? 2000,
      waitUntil: config?.waitUntil ?? "networkidle2",
      fullPage: config?.fullPage ?? true,
      captureBeyondViewport: config?.captureBeyondViewport ?? false,
    };
  }

  /**
   * Initialize browser for screenshot capture
   */
  async initialize(): Promise<void> {
    try {
      // Dynamic import for optional puppeteer dependency
      let puppeteer: typeof import("puppeteer");
      try {
        puppeteer = await import("puppeteer");
      } catch {
        // Fallback to playwright if puppeteer not available
        const { default: playwright } = await import("playwright");
        const browser = await playwright.chromium.launch();
        // Use playwright browser...
        return;
      }

      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-extensions",
        ],
        defaultViewport: null,
      });
    } catch (error) {
      throw this.createError("capture-failed", "Failed to initialize browser", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect screenshots from all configured sources
   */
  async collect(): Promise<CollectedScreenshot[]> {
    if (!this.browser) {
      await this.initialize();
    }

    const results: CollectedScreenshot[] = [];
    const startTime = Date.now();

    this.progress.total =
      this.config.sources.length * this.config.resolutions.length;

    for (const source of this.config.sources) {
      try {
        const sourceScreenshots = await this.collectFromSource(source);
        results.push(...sourceScreenshots);
        this.progress.completed++;
        this.updateProgress(startTime);
      } catch (error) {
        this.progress.failed++;
        console.error(`Failed to collect from ${source.location}:`, error);
      }
    }

    return results;
  }

  /**
   * Collect screenshots from a single source
   */
  async collectFromSource(
    source: DatasetSource
  ): Promise<CollectedScreenshot[]> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const screenshots: CollectedScreenshot[] = [];

    for (const resolution of this.config.resolutions) {
      try {
        const page = await this.browser.newPage();
        await this.setupPage(page, resolution);

        const screenshot = await this.captureScreenshot(
          page,
          source,
          resolution
        );
        screenshots.push(screenshot);

        await page.close();
      } catch (error) {
        console.error(
          `Failed to capture ${source.location} at ${resolution.name}:`,
          error
        );
      }
    }

    return screenshots;
  }

  /**
   * Setup page with viewport and configuration
   */
  private async setupPage(page: Page, resolution: ViewportSize): Promise<void> {
    const viewport: Viewport = {
      width: resolution.width,
      height: resolution.height,
      deviceScaleFactor: resolution.deviceScaleFactor ?? 1,
      isMobile: resolution.isMobile ?? false,
      hasTouch: resolution.isMobile ?? false,
    };

    await page.setViewport(viewport);

    // Set realistic user agent
    const userAgent = resolution.isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    await page.setUserAgent(userAgent);

    // Accept cookies and handle common popups
    await page.evaluateOnNewDocument(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = parameters =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });
  }

  /**
   * Capture screenshot from a page
   */
  private async captureScreenshot(
    page: Page,
    source: DatasetSource,
    resolution: ViewportSize
  ): Promise<CollectedScreenshot> {
    const startTime = Date.now();

    try {
      // Navigate to URL
      await page.goto(source.location, {
        waitUntil: this.config.waitUntil,
        timeout: 30000,
      });

      // Wait for page to stabilize
      await this.waitForPageLoad(page);

      // Get page metadata
      const metadata = await this.getPageMetadata(page, source, resolution);

      // Capture screenshot
      const screenshot = await page.screenshot({
        type: this.config.formats[0],
        quality:
          this.config.formats[0] === "jpg" || this.config.formats[0] === "webp"
            ? this.config.quality
            : undefined,
        fullPage: this.config.fullPage,
        encoding: "binary",
      });

      if (!Buffer.isBuffer(screenshot)) {
        throw new Error("Screenshot did not return a buffer");
      }

      const collectedScreenshot: CollectedScreenshot = {
        id: this.generateId(source.location, resolution.name),
        url: source.location,
        image: screenshot,
        metadata: {
          ...metadata,
          format: this.config.formats[0],
          fileSize: screenshot.length,
        },
        timestamp: Date.now(),
      };

      return collectedScreenshot;
    } catch (error) {
      throw this.createError(
        "capture-failed",
        `Failed to capture screenshot from ${source.location}`,
        {
          resolution: resolution.name,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Wait for page to fully load and stabilize
   */
  private async waitForPageLoad(page: Page): Promise<void> {
    // Wait for initial delay
    await new Promise(resolve => setTimeout(resolve, this.config.delay));

    // Wait for images to load
    await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      return Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>(resolve => {
            img.addEventListener("load", () => resolve());
            img.addEventListener("error", () => resolve());
            setTimeout(() => resolve(), 2000);
          });
        })
      );
    });

    // Wait for fonts to load
    await page.evaluate(() => {
      return document.fonts.ready;
    });

    // Wait for animations to settle
    await page.waitForTimeout(500);
  }

  /**
   * Extract metadata from page
   */
  private async getPageMetadata(
    page: Page,
    source: DatasetSource,
    resolution: ViewportSize
  ): Promise<ScreenshotMetadata> {
    const metadata = await page.evaluate(() => {
      return {
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        devicePixelRatio: window.devicePixelRatio,
      };
    });

    return {
      url: source.location,
      title: metadata.title,
      viewport: resolution,
      timestamp: Date.now(),
      format: this.config.formats[0],
      width: metadata.viewport.width,
      height: metadata.viewport.height,
      fileSize: 0, // Will be set by caller
      category: source.categories?.[0],
      tags: source.categories,
      devicePixelRatio: metadata.devicePixelRatio,
    };
  }

  /**
   * Collect from component library with multiple pages
   */
  async collectFromComponentLibraries(): Promise<CollectedScreenshot[]> {
    const screenshots: CollectedScreenshot[] = [];

    for (const source of COMPONENT_LIBRARY_SOURCES) {
      try {
        const libraryScreenshots = await this.crawlLibraryPages(source);
        screenshots.push(...libraryScreenshots);
      } catch (error) {
        console.error(
          `Failed to collect from library ${source.location}:`,
          error
        );
      }
    }

    return screenshots;
  }

  /**
   * Crawl multiple pages from a component library
   */
  private async crawlLibraryPages(
    source: DatasetSource,
    maxPages: number = 50
  ): Promise<CollectedScreenshot[]> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const screenshots: CollectedScreenshot[] = [];
    const page = await this.browser.newPage();

    try {
      await page.goto(source.location, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Extract links to component pages
      const componentLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a[href]"));
        return links
          .map(a => a.getAttribute("href"))
          .filter((href): href is string => {
            if (!href) return false;
            // Filter for component/documentation pages
            return (
              href.includes("/components/") ||
              href.includes("/docs/") ||
              href.includes("/api/") ||
              href.match(/\/[a-z-]+\/[a-z-]+$/)
            );
          })
          .slice(0, maxPages);
      });

      // Capture homepage
      for (const resolution of this.config.resolutions) {
        await this.setupPage(page, resolution);
        const screenshot = await this.captureScreenshot(
          page,
          source,
          resolution
        );
        screenshots.push(screenshot);
      }

      // Capture component pages
      for (const link of componentLinks.slice(0, 20)) {
        try {
          const fullUrl = new URL(link, source.location).toString();
          await page.goto(fullUrl, {
            waitUntil: "networkidle2",
            timeout: 15000,
          });

          for (const resolution of this.config.resolutions.slice(0, 2)) {
            await this.setupPage(page, resolution);
            const screenshot = await this.captureScreenshot(
              page,
              {
                ...source,
                location: fullUrl,
              },
              resolution
            );
            screenshots.push(screenshot);
          }
        } catch {
          // Skip failed pages
        }
      }
    } finally {
      await page.close();
    }

    return screenshots;
  }

  /**
   * Generate unique ID for screenshot
   */
  private generateId(url: string, resolution: string): string {
    const hash = Buffer.from(url + resolution + Date.now())
      .toString("base64")
      .slice(0, 16);
    return `screenshot_${hash}`;
  }

  /**
   * Update progress metrics
   */
  private updateProgress(startTime: number): void {
    const elapsed = Date.now() - startTime;
    const rate = this.progress.completed / (elapsed / 1000); // screenshots per second
    const remaining = this.progress.total - this.progress.completed;
    this.progress.estimatedTimeRemaining = remaining / rate;
    this.progress.percentage =
      (this.progress.completed / this.progress.total) * 100;
  }

  /**
   * Get current collection progress
   */
  getProgress(): CollectionProgress {
    return { ...this.progress };
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
    error.recoverable = type !== "capture-failed";
    error.details = details;
    return error;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Add custom source
   */
  addSource(source: DatasetSource): void {
    this.config.sources.push(source);
  }

  /**
   * Add custom viewport
   */
  addViewport(viewport: ViewportSize): void {
    this.config.resolutions.push(viewport);
  }

  /**
   * Get collected screenshots
   */
  getCollected(): CollectedScreenshot[] {
    return Array.from(this.collected.values());
  }

  /**
   * Clear collected screenshots
   */
  clear(): void {
    this.collected.clear();
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
      currentBatch: 0,
      estimatedTimeRemaining: 0,
    };
  }
}
