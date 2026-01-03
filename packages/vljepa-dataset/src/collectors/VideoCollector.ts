/**
 * @fileoverview Video Collector - Screen recording for UI interactions
 * @description Records UI interactions and extracts frames for VL-JEPA training
 */

// @ts-ignore - Puppeteer is optional
import type { Browser, Page, ElementHandle } from "puppeteer";
import type {
  VideoSegment,
  RecordedAction,
  ImageFrame,
  ActionType,
  VideoMetadata,
  DOMElement,
  ViewportSize,
  CollectionProgress,
  DatasetError,
} from "../types.js";

/**
 * Video collector configuration
 */
export interface VideoCollectorConfig {
  maxDuration: number;
  fps: number;
  resolution: ViewportSize;
  actionTypes: ActionType[];
  autoActions: boolean;
  maxActionsPerVideo: number;
}

/**
 * DOM element description
 */
interface DOMElement {
  selector: string;
  tagName: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
}

/**
 * Video Collector class
 */
export class VideoCollector {
  private config: VideoCollectorConfig;
  private browser: Browser | null = null;
  private collected: Map<string, VideoSegment> = new Map();
  private progress: CollectionProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
    currentBatch: 0,
    estimatedTimeRemaining: 0,
  };

  constructor(config?: Partial<VideoCollectorConfig>) {
    this.config = {
      maxDuration: config?.maxDuration ?? 30, // 30 seconds max
      fps: config?.fps ?? 1, // 1 frame per second
      resolution: config?.resolution ?? {
        width: 1920,
        height: 1080,
        name: "Desktop 1080p",
        isDesktop: true,
      },
      actionTypes: config?.actionTypes ?? ["click", "type", "scroll", "hover"],
      autoActions: config?.autoActions ?? true,
      maxActionsPerVideo: config?.maxActionsPerVideo ?? 20,
    };
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    try {
      let puppeteer: typeof import("puppeteer");
      try {
        puppeteer = await import("puppeteer");
      } catch {
        // Fallback to playwright
        await import("playwright");
        return;
      }

      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--start-maximized",
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
   * Record interaction video from URL
   */
  async recordFromURL(url: string): Promise<VideoSegment> {
    if (!this.browser) {
      await this.initialize();
    }

    const page = await this.createPage();
    const frames: ImageFrame[] = [];
    const actions: RecordedAction[] = [];
    const startTime = Date.now();

    try {
      // Navigate to URL
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await this.waitForStabilization(page);

      // Capture initial frame
      const initialFrame = await this.captureFrame(page, 0);
      frames.push(initialFrame);

      // Perform and record actions
      if (this.config.autoActions) {
        const recordedActions = await this.performAutoActions(page, url);
        actions.push(...recordedActions);
      }

      // Capture frames at regular intervals
      const intervalMs = 1000 / this.config.fps;
      let currentTime = 0;

      while (currentTime < this.config.maxDuration * 1000) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        currentTime += intervalMs;

        const frame = await this.captureFrame(page, currentTime);
        frames.push(frame);

        // Stop if max actions reached
        if (actions.length >= this.config.maxActionsPerVideo) {
          break;
        }
      }

      const metadata: VideoMetadata = {
        title: await page.title(),
        viewport: this.config.resolution,
        startTime,
        endTime: Date.now(),
        totalFrames: frames.length,
        category: this.categorizeURL(url),
      };

      const segment: VideoSegment = {
        id: this.generateId(url),
        url,
        frames,
        actions,
        duration: (metadata.endTime - metadata.startTime) / 1000,
        fps: this.config.fps,
        metadata,
      };

      this.collected.set(segment.id, segment);
      this.progress.completed++;

      return segment;
    } catch (error) {
      this.progress.failed++;
      throw this.createError(
        "capture-failed",
        `Failed to record video from ${url}`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } finally {
      await page.close();
    }
  }

  /**
   * Create and configure page
   */
  private async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const page = await this.browser.newPage();
    await page.setViewport({
      width: this.config.resolution.width,
      height: this.config.resolution.height,
      deviceScaleFactor: 1,
    });

    // Enable CDPSession for screen recording
    const client = await page.target().createCDPSession();
    await client.send("Page.startScreencast", {
      format: "png",
      quality: 95,
      maxWidth: this.config.resolution.width,
      maxHeight: this.config.resolution.height,
    });

    return page;
  }

  /**
   * Perform automated actions on page
   */
  private async performAutoActions(
    page: Page,
    url: string
  ): Promise<RecordedAction[]> {
    const actions: RecordedAction[] = [];
    const startTime = Date.now();

    // Find interactive elements
    const elements = await this.findInteractiveElements(page);

    for (const element of elements.slice(0, this.config.maxActionsPerVideo)) {
      try {
        const beforeFrame = await this.captureFrame(
          page,
          Date.now() - startTime
        );

        // Perform action
        const action = await this.performAction(
          page,
          element,
          url,
          beforeFrame,
          startTime
        );
        if (action) {
          actions.push(action);
        }

        // Wait for state change
        await this.waitForStateChange(page);

        const afterFrame = await this.captureFrame(
          page,
          Date.now() - startTime
        );

        // Update the last action's after frame
        if (actions.length > 0) {
          actions[actions.length - 1].after = afterFrame;
        }

        // Small delay between actions
        await page.waitForTimeout(500);
      } catch (error) {
        console.error("Action failed:", error);
      }
    }

    return actions;
  }

  /**
   * Find interactive elements on page
   */
  private async findInteractiveElements(page: Page): Promise<DOMElement[]> {
    const elements = await page.evaluate(() => {
      const selectors = [
        "button:not([disabled])",
        "a[href]",
        'input:not([disabled]):not([type="hidden"])',
        "textarea:not([disabled])",
        "select:not([disabled])",
        '[role="button"]',
        '[role="link"]',
        "[onclick]",
        '[tabindex]:not([tabindex="-1"])',
      ].join(", ");

      const nodes = Array.from(document.querySelectorAll(selectors));
      return nodes
        .map(node => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (!isVisible) return null;

          return {
            selector: this.getSelector(element),
            tagName: element.tagName.toLowerCase(),
            text: element.textContent?.slice(0, 50) || "",
            attributes: Array.from(element.attributes).reduce(
              (acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              },
              {} as Record<string, string>
            ),
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        })
        .filter((e): e is DOMElement => e !== null);
    });

    // Prioritize important elements
    return this.prioritizeElements(elements);
  }

  /**
   * Get CSS selector for element
   */
  private getSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = current.className.split(" ").filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }

      path.unshift(selector);
      current = current.parentElement as Element;
    }

    return path.join(" > ");
  }

  /**
   * Prioritize elements for action selection
   */
  private prioritizeElements(elements: DOMElement[]): DOMElement[] {
    const priorityScores = elements.map(el => {
      let score = 0;

      // Prioritize buttons
      if (el.tagName === "button" || el.attributes.role === "button") {
        score += 10;
      }

      // Prioritize links with descriptive text
      if (el.tagName === "a" && el.text && el.text.length > 5) {
        score += 8;
      }

      // Prioritize input fields
      if (el.tagName === "input" || el.tagName === "textarea") {
        score += 6;
      }

      // Prioritize elements with clear text
      if (el.text && el.text.length > 3 && el.text.length < 50) {
        score += 5;
      }

      // Prioritize elements with action-related attributes
      if (el.attributes.onclick || el.attributes.role) {
        score += 4;
      }

      // Prioritize visible center elements
      const centerX = el.boundingBox.x + el.boundingBox.width / 2;
      const centerY = el.boundingBox.y + el.boundingBox.height / 2;
      if (
        centerX > 200 &&
        centerX < this.config.resolution.width - 200 &&
        centerY > 200 &&
        centerY < this.config.resolution.height - 200
      ) {
        score += 3;
      }

      return { element: el, score };
    });

    return priorityScores.sort((a, b) => b.score - a.score).map(p => p.element);
  }

  /**
   * Perform action on element
   */
  private async performAction(
    page: Page,
    element: DOMElement,
    url: string,
    beforeFrame: ImageFrame,
    startTime: number
  ): Promise<RecordedAction | null> {
    const actionType = this.determineActionType(element);
    const actionStartTime = Date.now() - startTime;

    try {
      switch (actionType) {
        case "click":
          await page.click(element.selector, { delay: 100 });
          break;

        case "type":
          if (element.tagName === "input" || element.tagName === "textarea") {
            await page.type(element.selector, "test input", { delay: 50 });
          } else {
            await page.click(element.selector, { delay: 100 });
          }
          break;

        case "hover":
          await page.hover(element.selector);
          break;

        default:
          await page.click(element.selector, { delay: 100 });
      }

      return {
        type: actionType,
        timestamp: actionStartTime,
        element,
        before: beforeFrame,
        after: beforeFrame, // Will be updated by caller
        duration: Date.now() - startTime - actionStartTime,
      };
    } catch (error) {
      console.error(
        `Failed to perform ${actionType} on ${element.selector}:`,
        error
      );
      return null;
    }
  }

  /**
   * Determine action type for element
   */
  private determineActionType(element: DOMElement): ActionType {
    if (element.tagName === "input" || element.tagName === "textarea") {
      return "type";
    }

    if (element.attributes.role === "button" || element.tagName === "button") {
      return "click";
    }

    if (element.tagName === "a" || element.attributes.role === "link") {
      return "click";
    }

    if (element.attributes.role === "menuitem") {
      return "hover";
    }

    return "click";
  }

  /**
   * Capture frame from page
   */
  private async captureFrame(
    page: Page,
    timestamp: number
  ): Promise<ImageFrame> {
    const screenshot = await page.screenshot({
      type: "png",
      encoding: "binary",
    });

    if (!Buffer.isBuffer(screenshot)) {
      throw new Error("Screenshot did not return a buffer");
    }

    const metadata = await page.evaluate(() => ({
      url: window.location.href,
      elements: document.querySelectorAll("*").length,
      hasForms: document.querySelectorAll("form").length > 0,
      hasMedia: document.querySelectorAll("img, video, canvas").length > 0,
    }));

    return {
      id: `frame_${Date.now()}_${timestamp}`,
      image: screenshot,
      timestamp,
      index: Math.floor(timestamp / (1000 / this.config.fps)),
      metadata: {
        viewport: this.config.resolution,
        url: metadata.url,
        elements: metadata.elements,
        hasForms: metadata.hasForms,
        hasMedia: metadata.hasMedia,
      },
    };
  }

  /**
   * Wait for page to stabilize after load
   */
  private async waitForStabilization(page: Page): Promise<void> {
    await page.waitForTimeout(2000);

    // Wait for images
    await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      return Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>(resolve => {
            img.addEventListener("load", () => resolve());
            img.addEventListener("error", () => resolve());
            setTimeout(() => resolve(), 1000);
          });
        })
      );
    });

    await page.waitForTimeout(500);
  }

  /**
   * Wait for state change after action
   */
  private async waitForStateChange(page: Page): Promise<void> {
    try {
      await page.waitForTimeout(500);

      // Wait for navigation or network idle
      await Promise.race([
        page.waitForNavigation({ timeout: 1000 }).catch(() => {}),
        page.waitForTimeout(1000),
      ]);
    } catch {
      // Ignore timeout
    }
  }

  /**
   * Categorize URL
   */
  private categorizeURL(url: string): string {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    if (domain.includes("github")) return "developer-tools";
    if (domain.includes("dribbble") || domain.includes("behance"))
      return "design";
    if (
      domain.includes("mui") ||
      domain.includes("ant") ||
      domain.includes("chakra")
    ) {
      return "component-library";
    }
    if (domain.includes("stripe") || domain.includes("paypal"))
      return "payment";
    if (domain.includes("amazon") || domain.includes("shopify"))
      return "ecommerce";

    return "general";
  }

  /**
   * Generate unique ID
   */
  private generateId(url: string): string {
    const hash = Buffer.from(url + Date.now())
      .toString("base64")
      .slice(0, 16);
    return `video_${hash}`;
  }

  /**
   * Extract key frames from video segment
   */
  extractKeyFrames(
    segment: VideoSegment,
    maxFrames: number = 10
  ): ImageFrame[] {
    const totalFrames = segment.frames.length;
    const step = Math.max(1, Math.floor(totalFrames / maxFrames));

    return segment.frames.filter((_, index) => index % step === 0);
  }

  /**
   * Create before/after pairs from actions
   */
  createActionPairs(segment: VideoSegment): Array<{
    action: RecordedAction;
    before: ImageFrame;
    after: ImageFrame;
  }> {
    return segment.actions.map(action => {
      const beforeIndex = Math.floor(
        action.timestamp / (1000 / this.config.fps)
      );
      const afterIndex = Math.min(beforeIndex + 1, segment.frames.length - 1);

      return {
        action,
        before: segment.frames[beforeIndex],
        after: segment.frames[afterIndex],
      };
    });
  }

  /**
   * Get progress
   */
  getProgress(): CollectionProgress {
    return { ...this.progress };
  }

  /**
   * Get all collected segments
   */
  getCollected(): VideoSegment[] {
    return Array.from(this.collected.values());
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
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Clear collected segments
   */
  clear(): void {
    this.collected.clear();
  }
}
