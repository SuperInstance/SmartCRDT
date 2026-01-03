/**
 * @fileoverview DOM Structure Extractor - Extract and analyze DOM structure
 * @description Parses DOM, detects components, extracts styles and accessibility info
 */

// @ts-ignore - Puppeteer is optional
import type { Page } from "puppeteer";
import type {
  DOMStructure,
  DOMNode,
  DetectedComponent,
  ComponentType,
  CSSProperties,
  A11yInfo,
  BoundingBox,
  StructureMetadata,
  ExtractedStyles,
  DatasetError,
} from "../types.js";

/**
 * DOM Extractor configuration
 */
export interface DOMExtractorConfig {
  extractStyles: boolean;
  extractAccessibility: boolean;
  detectComponents: boolean;
  maxDepth: number;
  includeTextContent: boolean;
  includeComputedStyles: boolean;
}

/**
 * Component detection patterns
 */
const COMPONENT_PATTERNS: Record<ComponentType, RegExp[]> = {
  button: [/^button$/i, /btn/i, /button/i, /\[role=["']button["']\]/i],
  input: [/^input$/i, /^textarea$/i, /^select$/i, /form-control/i, /input/i],
  card: [/card/i, /panel/i, /tile/i],
  navbar: [/nav/i, /navbar/i, /navigation/i, /header/i],
  sidebar: [/sidebar/i, /aside/i, /drawer/i, /menu/i],
  modal: [/modal/i, /dialog/i, /popup/i, /overlay/i],
  dropdown: [/dropdown/i, /select/i, /menu-item/i],
  form: [/^form$/i, /form-group/i],
  table: [/^table$/i, /data-table/i],
  list: [/^ul$/i, /^ol$/i, /^li$/i, /list/i],
  carousel: [/carousel/i, /slider/i, /swiper/i],
  alert: [/alert/i, /notification/i, /toast/i, /message/i],
  tooltip: [/tooltip/i, /popover/i],
  tab: [/tab/i, /\[role=["']tab["']\]/i],
  accordion: [/accordion/i, /collapse/i],
  breadcrumb: [/breadcrumb/i, /breadcrumb-item/i],
  pagination: [/pagination/i, /pager/i],
  progress: [/progress/i, /spinner/i, /loading/i],
  skeleton: [/skeleton/i, /placeholder/i],
  chart: [/chart/i, /graph/i, /plot/i],
  unknown: [],
};

/**
 * DOM Extractor class
 */
export class DOMExtractor {
  private config: DOMExtractorConfig;

  constructor(config?: Partial<DOMExtractorConfig>) {
    this.config = {
      extractStyles: config?.extractStyles ?? true,
      extractAccessibility: config?.extractAccessibility ?? true,
      detectComponents: config?.detectComponents ?? true,
      maxDepth: config?.maxDepth ?? 50,
      includeTextContent: config?.includeTextContent ?? true,
      includeComputedStyles: config?.includeComputedStyles ?? true,
    };
  }

  /**
   * Extract complete DOM structure from page
   */
  async extract(page: Page): Promise<DOMStructure> {
    const startTime = Date.now();

    try {
      // Extract DOM tree
      const tree = await this.extractDOMTree(page);

      // Detect components
      const components = this.config.detectComponents
        ? await this.detectComponents(page)
        : [];

      // Extract styles
      const styles = this.config.extractStyles
        ? await this.extractStyles(page)
        : this.getEmptyStyles();

      // Extract accessibility info
      const accessibility = this.config.extractAccessibility
        ? await this.extractAccessibilityInfo(page)
        : this.getEmptyA11y();

      // Create metadata
      const metadata = await this.createMetadata(
        page,
        tree,
        components,
        startTime
      );

      return {
        tree,
        components,
        styles,
        accessibility,
        metadata,
      };
    } catch (error) {
      throw this.createError(
        "parsing-failed",
        "Failed to extract DOM structure",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Extract DOM tree
   */
  private async extractDOMTree(page: Page): Promise<DOMNode> {
    return await page.evaluate(
      (maxDepth, includeText) => {
        function extractNode(node: Node, depth: number): any {
          if (depth > maxDepth) return null;

          if (node.nodeType !== Node.ELEMENT_NODE) {
            return null;
          }

          const element = node as Element;
          const rect = (element as HTMLElement).getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            styles.visibility !== "hidden" &&
            styles.display !== "none" &&
            styles.opacity !== "0";

          // Build XPath
          let xpath = "";
          let temp = element;
          while (temp && temp !== document.body) {
            let index = 1;
            let sibling = temp.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === temp.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            xpath = `/${temp.tagName.toLowerCase()}[${index}]${xpath}`;
            temp = temp.parentElement as Element;
          }

          // Extract accessibility info
          const a11y: A11yInfo = {
            role: element.getAttribute("role") || undefined,
            label:
              element.getAttribute("aria-label") ||
              element.getAttribute("aria-labelledby") ||
              undefined,
            description: element.getAttribute("aria-describedby") || undefined,
            ariaAttributes: {},
            focusable:
              element.getAttribute("tabindex") !== null ||
              ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(
                element.tagName
              ),
            keyboardAccessible: false,
            semanticHtml: [
              "HEADER",
              "NAV",
              "MAIN",
              "ARTICLE",
              "SECTION",
              "ASIDE",
              "FOOTER",
            ].includes(element.tagName),
          };

          // Collect ARIA attributes
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr.name.startsWith("aria-")) {
              a11y.ariaAttributes![attr.name] = attr.value;
            }
          }

          // Extract CSS properties
          const cssProps: CSSProperties = {
            display: styles.display,
            position: styles.position,
            width: styles.width,
            height: styles.height,
            margin: styles.margin,
            padding: styles.padding,
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily,
            fontWeight: styles.fontWeight,
            textAlign: styles.textAlign,
            border: styles.border,
            borderRadius: styles.borderRadius,
            boxShadow: styles.boxShadow,
            opacity: parseFloat(styles.opacity),
            zIndex: parseInt(styles.zIndex) || undefined,
            cursor: styles.cursor,
          };

          // Extract attributes
          const attributes: Record<string, string> = {};
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            attributes[attr.name] = attr.value;
          }

          const domNode: DOMNode = {
            id: element.id || `node_${Math.random().toString(36).substr(2, 9)}`,
            tagName: element.tagName.toLowerCase(),
            textContent:
              includeText && element.textContent
                ? element.textContent.slice(0, 100)
                : undefined,
            attributes,
            children: [],
            styles: cssProps,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom,
            },
            xpath,
            depth,
            isInteractive:
              ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(
                element.tagName
              ) ||
              element.onclick !== null ||
              element.getAttribute("role") !== null,
            isVisible,
            a11y,
          };

          // Process children
          const childNodes = Array.from(element.childNodes);
          for (const child of childNodes) {
            const childNode = extractNode(child, depth + 1);
            if (childNode) {
              domNode.children.push(childNode);
            }
          }

          return domNode;
        }

        return extractNode(document.body, 0);
      },
      this.config.maxDepth,
      this.config.includeTextContent
    );
  }

  /**
   * Detect UI components
   */
  private async detectComponents(page: Page): Promise<DetectedComponent[]> {
    return await page.evaluate(patterns => {
      const components: DetectedComponent[] = [];
      const seen = new Set<string>();

      function checkPattern(text: string, type: ComponentType): boolean {
        const patternList = patterns[type];
        if (!patternList) return false;
        return patternList.some(pattern => pattern.test(text));
      }

      function detectComponent(element: Element): DetectedComponent | null {
        const id =
          element.id ||
          element.className?.split(" ")[0] ||
          element.tagName.toLowerCase();

        if (seen.has(id)) return null;

        const rect = (element as HTMLElement).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        const styles = window.getComputedStyle(element);
        const selector = generateSelector(element);

        // Check all component types
        for (const [type, patternList] of Object.entries(patterns)) {
          if (type === "unknown") continue;

          const className = element.className || "";
          const id = element.id || "";
          const role = element.getAttribute("role") || "";
          const tag = element.tagName.toLowerCase();
          const aria = Array.from(element.attributes)
            .filter(a => a.name.startsWith("aria-"))
            .map(a => `${a.name}="${a.value}"`)
            .join(" ");

          const checkString =
            `${tag}#${id}.${className}[role="${role}"] ${aria}`.toLowerCase();

          if (checkPattern(checkString, type as ComponentType)) {
            seen.add(id);

            const cssProps: CSSProperties = {
              display: styles.display,
              position: styles.position,
              width: styles.width,
              height: styles.height,
              margin: styles.margin,
              padding: styles.padding,
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontSize: styles.fontSize,
              fontFamily: styles.fontFamily,
              fontWeight: styles.fontWeight,
              border: styles.border,
              borderRadius: styles.borderRadius,
              boxShadow: styles.boxShadow,
              opacity: parseFloat(styles.opacity),
              cursor: styles.cursor,
            };

            const component: DetectedComponent = {
              type: type as ComponentType,
              selector,
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
              styles: cssProps,
              text: element.textContent?.slice(0, 50) || "",
              attributes: Array.from(element.attributes).reduce(
                (acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                },
                {} as Record<string, string>
              ),
              children: [],
              confidence: 0.8,
              xpath: getXPath(element),
            };

            return component;
          }
        }

        return null;
      }

      function generateSelector(element: Element): string {
        if (element.id) {
          return `#${element.id}`;
        }

        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();

          if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break;
          }

          if (current.className) {
            const classes = current.className
              .split(" ")
              .filter((c: string) => c);
            if (classes.length > 0) {
              selector += `.${classes[0]}`;
            }
          }

          path.unshift(selector);
          current = current.parentElement;
        }

        return path.join(" > ");
      }

      function getXPath(element: Element): string {
        let xpath = "";
        let temp: Element | null = element;

        while (temp && temp !== document.body) {
          let index = 1;
          let sibling = temp.previousElementSibling;

          while (sibling) {
            if (sibling.tagName === temp.tagName) index++;
            sibling = sibling.previousElementSibling;
          }

          xpath = `/${temp.tagName.toLowerCase()}[${index}]${xpath}`;
          temp = temp.parentElement;
        }

        return xpath;
      }

      // Walk DOM and detect components
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: node => {
            const element = node as Element;
            const rect = (element as HTMLElement).getBoundingClientRect();
            return rect.width > 0 && rect.height > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
        }
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const component = detectComponent(node as Element);
        if (component) {
          components.push(component);
        }
      }

      return components;
    }, COMPONENT_PATTERNS);
  }

  /**
   * Extract styles from page
   */
  private async extractStyles(page: Page): Promise<ExtractedStyles> {
    return await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("*"));
      const colors = new Set<string>();
      const fonts = new Set<string>();
      const spacing = new Set<number>();
      const borderRadius = new Set<number>();
      const layout = new Set<string>();
      const animations = new Set<string>();

      elements.forEach(el => {
        const styles = window.getComputedStyle(el);

        // Extract colors
        if (
          styles.backgroundColor &&
          styles.backgroundColor !== "rgba(0, 0, 0, 0)"
        ) {
          colors.add(styles.backgroundColor);
        }
        if (styles.color) {
          colors.add(styles.color);
        }

        // Extract fonts
        if (styles.fontFamily) {
          fonts.add(styles.fontFamily.split(",")[0].replace(/['"]/g, ""));
        }

        // Extract spacing
        const margin = parseFloat(styles.marginTop);
        const padding = parseFloat(styles.paddingTop);
        if (margin > 0) spacing.add(margin);
        if (padding > 0) spacing.add(padding);

        // Extract border radius
        const radius = parseFloat(styles.borderRadius);
        if (radius > 0) borderRadius.add(radius);

        // Extract layout
        if (styles.display) layout.add(styles.display);
        if (styles.position) layout.add(styles.position);

        // Extract animations
        if (styles.animationName && styles.animationName !== "none") {
          animations.add(styles.animationName);
        }
      });

      return {
        colors: Array.from(colors),
        fonts: Array.from(fonts),
        spacing: Array.from(spacing).sort((a, b) => a - b),
        borderRadius: Array.from(borderRadius).sort((a, b) => a - b),
        layout: Array.from(layout),
        animations: Array.from(animations),
      };
    });
  }

  /**
   * Extract accessibility information
   */
  private async extractAccessibilityInfo(page: Page): Promise<A11yInfo> {
    return await page.evaluate(() => {
      const root = document.body;

      return {
        role: root.getAttribute("role") || undefined,
        label: root.getAttribute("aria-label") || undefined,
        description: root.getAttribute("aria-describedby") || undefined,
        ariaAttributes: {},
        focusable: false,
        keyboardAccessible: false,
        semanticHtml: true,
      };
    });
  }

  /**
   * Create metadata
   */
  private async createMetadata(
    page: Page,
    tree: DOMNode,
    components: DetectedComponent[],
    startTime: number
  ): Promise<StructureMetadata> {
    const metadata = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      framework: detectFramework(),
      library: detectLibraries(),
    }));

    function countElements(node: DOMNode): number {
      let count = 1;
      for (const child of node.children) {
        count += countElements(child);
      }
      return count;
    }

    function countInteractive(node: DOMNode): number {
      let count = node.isInteractive ? 1 : 0;
      for (const child of node.children) {
        count += countInteractive(child);
      }
      return count;
    }

    function detectFramework(): string | undefined {
      // React
      if ((window as any).__REACT__) return "react";
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) return "react";

      // Vue
      if ((window as any).__VUE__) return "vue";

      // Angular
      if (document.querySelector("[ng-version]")) return "angular";

      // Svelte
      if ((window as any).__SVELTE__) return "svelte";

      return undefined;
    }

    function detectLibraries(): string[] {
      const libraries: string[] = [];

      // jQuery
      if ((window as any).jQuery) libraries.push("jquery");

      // Bootstrap
      if ((window as any).$.fn.button) libraries.push("bootstrap");

      // Material UI
      if (document.querySelector('[class*="Mui"]'))
        libraries.push("material-ui");

      // Tailwind
      if (document.querySelector('[class*="bg-"], [class*="text-"]')) {
        libraries.push("tailwind");
      }

      // Chakra UI
      if (document.querySelector('[class*="chakra"]'))
        libraries.push("chakra-ui");

      return libraries;
    }

    return {
      ...metadata,
      timestamp: Date.now(),
      totalElements: countElements(tree),
      interactiveElements: countInteractive(tree),
      depth: this.calculateDepth(tree),
      hasForms: components.some(c => c.type === "form"),
      hasMedia: components.some(
        c =>
          c.type === "carousel" ||
          c.type === "chart" ||
          c.attributes.type === "video"
      ),
    };
  }

  /**
   * Calculate tree depth
   */
  private calculateDepth(node: DOMNode): number {
    if (node.children.length === 0) {
      return node.depth;
    }
    return Math.max(...node.children.map(child => this.calculateDepth(child)));
  }

  /**
   * Get empty styles object
   */
  private getEmptyStyles(): ExtractedStyles {
    return {
      colors: [],
      fonts: [],
      spacing: [],
      borderRadius: [],
      layout: [],
      animations: [],
    };
  }

  /**
   * Get empty accessibility object
   */
  private getEmptyA11y(): A11yInfo {
    return {
      focusable: false,
      keyboardAccessible: false,
      semanticHtml: false,
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
    error.recoverable = type !== "parsing-failed";
    error.details = details;
    return error;
  }

  /**
   * Find components by type
   */
  findComponentsByType(
    structure: DOMStructure,
    type: ComponentType
  ): DetectedComponent[] {
    return structure.components.filter(c => c.type === type);
  }

  /**
   * Find interactive components
   */
  findInteractiveComponents(structure: DOMStructure): DetectedComponent[] {
    return structure.components.filter(c =>
      ["button", "input", "dropdown", "tab", "link"].includes(c.type)
    );
  }

  /**
   * Get component hierarchy
   */
  getComponentHierarchy(structure: DOMStructure): DetectedComponent[][] {
    const levels: DetectedComponent[][] = [];
    const visited = new Set<string>();

    function addComponent(component: DetectedComponent, depth: number) {
      if (visited.has(component.selector)) return;
      visited.add(component.selector);

      while (levels.length <= depth) {
        levels.push([]);
      }
      levels[depth].push(component);
    }

    for (const component of structure.components) {
      const depth = component.xpath.split("/").length;
      addComponent(component, depth);
    }

    return levels;
  }
}
