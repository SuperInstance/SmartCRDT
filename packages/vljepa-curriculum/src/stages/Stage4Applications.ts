/**
 * Stage 4: Applications
 *
 * Learning Objectives:
 * - Complete pages: Login, dashboard, settings, etc.
 * - Complex interactions: Multi-step flows, user journeys
 * - Real applications: Ecommerce, SaaS, content platforms
 * - Context understanding: Purpose, intent, user goals
 *
 * Target: 10,000+ application examples
 * Difficulty Range: 0.75-1.0
 */

import type {
  AppType,
  PageType,
  Stage4Config,
  Stage4Example,
  TrainingExample,
  DataGenerator,
  StageEvaluator,
  GeneratorProgress,
  EvaluationResult,
  BatchEvaluationResult,
  StageProgress,
  InteractionPattern,
  AppContext,
} from "../types.js";

export class Stage4Applications {
  private config: Stage4Config;
  private generator: ApplicationsGenerator;
  private evaluator: ApplicationsEvaluator;

  constructor(config: Partial<Stage4Config> = {}) {
    this.config = {
      examples: 10000,
      epochs: 30,
      batchSize: 16,
      masteryThreshold: 0.75,
      patience: 8,
      prerequisites: ["stage1", "stage2", "stage3"],
      applications: this.getDefaultApplications(),
      pages: this.getDefaultPages(),
      difficulty: "hard" as const,
      includeInteractions: true,
      realWorldExamples: true,
      ...config,
    };

    this.generator = new ApplicationsGenerator(this.config);
    this.evaluator = new ApplicationsEvaluator();
  }

  /**
   * Get default application types for Stage 4
   */
  private getDefaultApplications(): AppType[] {
    return [
      "ecommerce",
      "saas",
      "dashboard",
      "social",
      "content",
      "admin",
      "education",
      "finance",
    ];
  }

  /**
   * Get default page types for Stage 4
   */
  private getDefaultPages(): PageType[] {
    return [
      "login",
      "signup",
      "dashboard",
      "settings",
      "profile",
      "listing",
      "detail",
      "checkout",
      "onboarding",
      "analytics",
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
  async generateExamples(count: number): Promise<Stage4Example[]> {
    return await this.generator.generate(count);
  }

  /**
   * Evaluate predictions
   */
  evaluate(example: Stage4Example, prediction: Float32Array): EvaluationResult {
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
  getConfig(): Stage4Config {
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
 * Application page templates and generators
 */
interface PageTemplate {
  type: PageType;
  sections: PageSection[];
  interactions: InteractionPattern[];
  context: Partial<AppContext>;
}

interface PageSection {
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
  interactive: boolean;
}

class ApplicationsGenerator implements DataGenerator {
  private config: Stage4Config;
  private progress: GeneratorProgress = {
    generated: 0,
    target: 0,
    complete: false,
  };
  private pageTemplates: Map<PageType, PageTemplate>;
  private appContexts: Map<AppType, AppContext>;
  private random: () => number;

  constructor(config: Stage4Config) {
    this.config = config;
    this.pageTemplates = this.initializePageTemplates();
    this.appContexts = this.initializeAppContexts();
    let seed = 12345;
    this.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  async initialize(config: Stage4Config): Promise<void> {
    this.config = config;
    this.progress = {
      generated: 0,
      target: config.examples,
      complete: false,
    };
  }

  async generate(count: number): Promise<Stage4Example[]> {
    const examples: Stage4Example[] = [];

    for (let i = 0; i < count; i++) {
      const application = this.selectApplication();
      const pageType = this.selectPageType(application);
      const example = this.generateExample(application, pageType);
      examples.push(example);
      this.progress.generated++;
    }

    if (this.progress.generated >= this.progress.target) {
      this.progress.complete = true;
    }

    return examples;
  }

  private initializePageTemplates(): Map<PageType, PageTemplate> {
    const templates = new Map<PageType, PageTemplate>();

    // Login Page
    templates.set("login", {
      type: "login",
      sections: [
        {
          type: "header",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 60 },
          content: "Logo + Brand",
          interactive: false,
        },
        {
          type: "form",
          position: { x: 250, y: 120 },
          size: { width: 300, height: 200 },
          content: "Email, Password inputs",
          interactive: true,
        },
        {
          type: "button",
          position: { x: 250, y: 330 },
          size: { width: 300, height: 40 },
          content: "Sign In",
          interactive: true,
        },
        {
          type: "link",
          position: { x: 250, y: 380 },
          size: { width: 300, height: 20 },
          content: "Forgot password?",
          interactive: true,
        },
        {
          type: "footer",
          position: { x: 0, y: 550 },
          size: { width: 800, height: 50 },
          content: "Copyright, Links",
          interactive: false,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "validate",
          target: "form",
          expected: "show_errors_or_proceed",
        },
        {
          trigger: "submit",
          action: "authenticate",
          target: "button",
          expected: "navigate_to_dashboard",
        },
        {
          trigger: "click",
          action: "navigate",
          target: "link",
          expected: "open_reset_flow",
        },
      ],
      context: { purpose: "User authentication", userGoal: "Access account" },
    });

    // Dashboard Page
    templates.set("dashboard", {
      type: "dashboard",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Navigation, User menu",
          interactive: true,
        },
        {
          type: "sidebar",
          position: { x: 0, y: 50 },
          size: { width: 180, height: 500 },
          content: "Menu items",
          interactive: true,
        },
        {
          type: "stats",
          position: { x: 200, y: 70 },
          size: { width: 580, height: 120 },
          content: "Key metrics cards",
          interactive: false,
        },
        {
          type: "chart",
          position: { x: 200, y: 210 },
          size: { width: 380, height: 200 },
          content: "Data visualization",
          interactive: true,
        },
        {
          type: "feed",
          position: { x: 600, y: 210 },
          size: { width: 180, height: 200 },
          content: "Activity feed",
          interactive: false,
        },
        {
          type: "table",
          position: { x: 200, y: 430 },
          size: { width: 580, height: 120 },
          content: "Recent items",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "filter",
          target: "stats",
          expected: "update_dashboard",
        },
        {
          trigger: "hover",
          action: "tooltip",
          target: "chart",
          expected: "show_details",
        },
        {
          trigger: "click",
          action: "navigate",
          target: "table",
          expected: "open_detail",
        },
        {
          trigger: "click",
          action: "switch",
          target: "sidebar",
          expected: "change_view",
        },
      ],
      context: {
        purpose: "Overview and quick actions",
        userGoal: "Monitor status",
      },
    });

    // Settings Page
    templates.set("settings", {
      type: "settings",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Navigation, Breadcrumbs",
          interactive: true,
        },
        {
          type: "tabs",
          position: { x: 20, y: 70 },
          size: { width: 760, height: 40 },
          content: "Profile, Account, Security",
          interactive: true,
        },
        {
          type: "form",
          position: { x: 20, y: 130 },
          size: { width: 400, height: 300 },
          content: "Settings fields",
          interactive: true,
        },
        {
          type: "preview",
          position: { x: 440, y: 130 },
          size: { width: 340, height: 300 },
          content: "Profile preview",
          interactive: false,
        },
        {
          type: "actions",
          position: { x: 20, y: 450 },
          size: { width: 760, height: 50 },
          content: "Save, Cancel buttons",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "switch_tab",
          target: "tabs",
          expected: "change_form",
        },
        {
          trigger: "input",
          action: "update_preview",
          target: "form",
          expected: "refresh_preview",
        },
        {
          trigger: "click",
          action: "save",
          target: "actions",
          expected: "persist_and_notify",
        },
      ],
      context: {
        purpose: "User preferences management",
        userGoal: "Customize experience",
      },
    });

    // Checkout Page (Ecommerce)
    templates.set("checkout", {
      type: "checkout",
      sections: [
        {
          type: "header",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 60 },
          content: "Logo, Cart icon",
          interactive: true,
        },
        {
          type: "steps",
          position: { x: 20, y: 80 },
          size: { width: 760, height: 40 },
          content: "Progress indicator",
          interactive: false,
        },
        {
          type: "form",
          position: { x: 20, y: 140 },
          size: { width: 400, height: 250 },
          content: "Shipping, Payment",
          interactive: true,
        },
        {
          type: "summary",
          position: { x: 440, y: 140 },
          size: { width: 340, height: 250 },
          content: "Order summary",
          interactive: false,
        },
        {
          type: "actions",
          position: { x: 20, y: 410 },
          size: { width: 760, height: 50 },
          content: "Place Order button",
          interactive: true,
        },
        {
          type: "trust",
          position: { x: 20, y: 480 },
          size: { width: 760, height: 40 },
          content: "Security badges",
          interactive: false,
        },
      ],
      interactions: [
        {
          trigger: "input",
          action: "validate",
          target: "form",
          expected: "show_validation",
        },
        {
          trigger: "change",
          action: "update_total",
          target: "form",
          expected: "refresh_summary",
        },
        {
          trigger: "click",
          action: "submit_order",
          target: "actions",
          expected: "process_payment",
        },
      ],
      context: { purpose: "Complete purchase", userGoal: "Buy items" },
    });

    // Listing Page
    templates.set("listing", {
      type: "listing",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Navigation, Search",
          interactive: true,
        },
        {
          type: "filters",
          position: { x: 20, y: 70 },
          size: { width: 180, height: 400 },
          content: "Filter options",
          interactive: true,
        },
        {
          type: "sort",
          position: { x: 220, y: 70 },
          size: { width: 560, height: 30 },
          content: "Sort controls",
          interactive: true,
        },
        {
          type: "grid",
          position: { x: 220, y: 110 },
          size: { width: 560, height: 360 },
          content: "Item cards grid",
          interactive: true,
        },
        {
          type: "pagination",
          position: { x: 220, y: 480 },
          size: { width: 560, height: 30 },
          content: "Page controls",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "change",
          action: "filter",
          target: "filters",
          expected: "update_grid",
        },
        {
          trigger: "click",
          action: "sort",
          target: "sort",
          expected: "reorder_grid",
        },
        {
          trigger: "click",
          action: "navigate",
          target: "grid",
          expected: "open_detail",
        },
        {
          trigger: "click",
          action: "paginate",
          target: "pagination",
          expected: "load_more",
        },
      ],
      context: { purpose: "Browse items", userGoal: "Find and compare" },
    });

    // Detail Page
    templates.set("detail", {
      type: "detail",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Back button, Share",
          interactive: true,
        },
        {
          type: "media",
          position: { x: 20, y: 70 },
          size: { width: 350, height: 300 },
          content: "Image gallery",
          interactive: true,
        },
        {
          type: "info",
          position: { x: 390, y: 70 },
          size: { width: 390, height: 180 },
          content: "Title, Price, Rating",
          interactive: false,
        },
        {
          type: "actions",
          position: { x: 390, y: 260 },
          size: { width: 390, height: 50 },
          content: "Add to Cart, Buy",
          interactive: true,
        },
        {
          type: "details",
          position: { x: 20, y: 390 },
          size: { width: 760, height: 100 },
          content: "Description, Specs",
          interactive: false,
        },
        {
          type: "reviews",
          position: { x: 20, y: 500 },
          size: { width: 760, height: 50 },
          content: "Reviews preview",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "zoom",
          target: "media",
          expected: "open_lightbox",
        },
        {
          trigger: "click",
          action: "add_to_cart",
          target: "actions",
          expected: "update_cart_count",
        },
        {
          trigger: "click",
          action: "expand",
          target: "details",
          expected: "show_full_description",
        },
        {
          trigger: "click",
          action: "navigate",
          target: "reviews",
          expected: "scroll_to_reviews",
        },
      ],
      context: { purpose: "Item details", userGoal: "Evaluate and decide" },
    });

    // Analytics Page
    templates.set("analytics", {
      type: "analytics",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Navigation, Export",
          interactive: true,
        },
        {
          type: "date_range",
          position: { x: 20, y: 70 },
          size: { width: 760, height: 30 },
          content: "Date picker",
          interactive: true,
        },
        {
          type: "kpi",
          position: { x: 20, y: 120 },
          size: { width: 760, height: 80 },
          content: "KPI cards row",
          interactive: false,
        },
        {
          type: "chart_main",
          position: { x: 20, y: 220 },
          size: { width: 500, height: 200 },
          content: "Main chart",
          interactive: true,
        },
        {
          type: "chart_secondary",
          position: { x: 540, y: 220 },
          size: { width: 240, height: 200 },
          content: "Secondary chart",
          interactive: true,
        },
        {
          type: "table",
          position: { x: 20, y: 440 },
          size: { width: 760, height: 110 },
          content: "Data table",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "change",
          action: "update_period",
          target: "date_range",
          expected: "refresh_all_data",
        },
        {
          trigger: "hover",
          action: "show_tooltip",
          target: "chart_main",
          expected: "display_details",
        },
        {
          trigger: "click",
          action: "drill_down",
          target: "kpi",
          expected: "show_breakdown",
        },
        {
          trigger: "click",
          action: "export",
          target: "navbar",
          expected: "download_report",
        },
      ],
      context: { purpose: "Data analysis", userGoal: "Gain insights" },
    });

    // Profile Page
    templates.set("profile", {
      type: "profile",
      sections: [
        {
          type: "navbar",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 50 },
          content: "Navigation, Edit",
          interactive: true,
        },
        {
          type: "header",
          position: { x: 20, y: 70 },
          size: { width: 760, height: 100 },
          content: "Avatar, Name, Bio",
          interactive: false,
        },
        {
          type: "stats",
          position: { x: 20, y: 190 },
          size: { width: 760, height: 60 },
          content: "Follower stats",
          interactive: false,
        },
        {
          type: "tabs",
          position: { x: 20, y: 270 },
          size: { width: 760, height: 40 },
          content: "Posts, Media, Likes",
          interactive: true,
        },
        {
          type: "content",
          position: { x: 20, y: 320 },
          size: { width: 760, height: 230 },
          content: "User content grid",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "switch_tab",
          target: "tabs",
          expected: "change_content",
        },
        {
          trigger: "click",
          action: "follow",
          target: "header",
          expected: "toggle_follow",
        },
        {
          trigger: "click",
          action: "navigate",
          target: "content",
          expected: "open_item",
        },
      ],
      context: { purpose: "User profile view", userGoal: "View or connect" },
    });

    // Signup Page
    templates.set("signup", {
      type: "signup",
      sections: [
        {
          type: "header",
          position: { x: 0, y: 0 },
          size: { width: 800, height: 60 },
          content: "Logo + Brand",
          interactive: false,
        },
        {
          type: "form",
          position: { x: 250, y: 100 },
          size: { width: 300, height: 280 },
          content: "Name, Email, Password",
          interactive: true,
        },
        {
          type: "terms",
          position: { x: 250, y: 390 },
          size: { width: 300, height: 30 },
          content: "Terms checkbox",
          interactive: true,
        },
        {
          type: "button",
          position: { x: 250, y: 430 },
          size: { width: 300, height: 40 },
          content: "Create Account",
          interactive: true,
        },
        {
          type: "footer",
          position: { x: 250, y: 490 },
          size: { width: 300, height: 30 },
          content: "Sign in link",
          interactive: true,
        },
      ],
      interactions: [
        {
          trigger: "input",
          action: "validate",
          target: "form",
          expected: "check_requirements",
        },
        {
          trigger: "click",
          action: "toggle",
          target: "terms",
          expected: "enable_button",
        },
        {
          trigger: "submit",
          action: "register",
          target: "button",
          expected: "create_account_or_show_errors",
        },
      ],
      context: { purpose: "New user registration", userGoal: "Create account" },
    });

    // Onboarding Page
    templates.set("onboarding", {
      type: "onboarding",
      sections: [
        {
          type: "progress",
          position: { x: 20, y: 20 },
          size: { width: 760, height: 30 },
          content: "Step indicator",
          interactive: false,
        },
        {
          type: "content",
          position: { x: 100, y: 80 },
          size: { width: 600, height: 300 },
          content: "Welcome / Tips",
          interactive: false,
        },
        {
          type: "actions",
          position: { x: 100, y: 400 },
          size: { width: 600, height: 50 },
          content: "Skip, Next buttons",
          interactive: true,
        },
        {
          type: "dots",
          position: { x: 100, y: 470 },
          size: { width: 600, height: 20 },
          content: "Page dots",
          interactive: false,
        },
      ],
      interactions: [
        {
          trigger: "click",
          action: "next",
          target: "actions",
          expected: "show_next_step",
        },
        {
          trigger: "click",
          action: "skip",
          target: "actions",
          expected: "complete_onboarding",
        },
        {
          trigger: "load",
          action: "animate",
          target: "content",
          expected: "fade_in_content",
        },
      ],
      context: {
        purpose: "First-time user guidance",
        userGoal: "Learn basics",
      },
    });

    return templates;
  }

  private initializeAppContexts(): Map<AppType, AppContext> {
    const contexts = new Map<AppType, AppContext>();

    contexts.set("ecommerce", {
      purpose: "Online shopping and product discovery",
      userGoal: "Find, compare, and purchase products",
      domain: "retail",
      constraints: ["Cart management", "Checkout flow", "Product search"],
    });

    contexts.set("saas", {
      purpose: "Software application access and management",
      userGoal: "Use software tools and manage subscription",
      domain: "software",
      constraints: ["Authentication", "Feature limits", "Billing"],
    });

    contexts.set("dashboard", {
      purpose: "Data overview and quick actions",
      userGoal: "Monitor status and access key features",
      domain: "analytics",
      constraints: ["Real-time data", "Permissions", "Responsive"],
    });

    contexts.set("social", {
      purpose: "Social networking and content sharing",
      userGoal: "Connect with others and share content",
      domain: "social media",
      constraints: ["Privacy", "Content moderation", "Engagement"],
    });

    contexts.set("content", {
      purpose: "Content consumption and discovery",
      userGoal: "Read, watch, or listen to content",
      domain: "media",
      constraints: ["Content delivery", "Recommendations", "Bookmarking"],
    });

    contexts.set("admin", {
      purpose: "System administration and management",
      userGoal: "Configure and monitor the system",
      domain: "administration",
      constraints: ["Security", "Audit logs", "Permissions"],
    });

    contexts.set("education", {
      purpose: "Learning and skill development",
      userGoal: "Access courses and track progress",
      domain: "education",
      constraints: ["Progress tracking", "Certificates", "Assessments"],
    });

    contexts.set("finance", {
      purpose: "Financial management and transactions",
      userGoal: "Monitor accounts and execute transactions",
      domain: "finance",
      constraints: ["Security", "Compliance", "Verification"],
    });

    return contexts;
  }

  private selectApplication(): AppType {
    const index = Math.floor(this.random() * this.config.applications.length);
    return this.config.applications[index];
  }

  private selectPageType(application: AppType): PageType {
    // Select page type based on application relevance
    const relevantPages: Record<AppType, PageType[]> = {
      ecommerce: ["listing", "detail", "checkout", "dashboard"],
      saas: ["dashboard", "settings", "analytics", "profile"],
      dashboard: ["dashboard", "analytics", "settings"],
      social: ["login", "signup", "profile", "dashboard"],
      content: ["listing", "detail", "profile", "settings"],
      admin: ["dashboard", "settings", "analytics"],
      education: ["dashboard", "detail", "profile"],
      finance: ["dashboard", "analytics", "settings"],
    };

    const pages = relevantPages[application] || this.config.pages;
    const index = Math.floor(this.random() * pages.length);
    return pages[index];
  }

  private generateExample(
    application: AppType,
    pageType: PageType
  ): Stage4Example {
    const template = this.pageTemplates.get(pageType);
    if (!template) {
      throw new Error(`No template found for page type: ${pageType}`);
    }

    const appContext = this.appContexts.get(application);
    if (!appContext) {
      throw new Error(`No context found for application: ${application}`);
    }

    const context = {
      ...appContext,
      ...template.context,
    };

    const imageData = this.renderPage(template);
    const embedding = this.generateEmbedding(
      application,
      pageType,
      template,
      context
    );
    const difficulty = this.calculateDifficulty(
      application,
      pageType,
      template
    );
    const interactions = this.config.includeInteractions
      ? template.interactions
      : [];

    return {
      id: `stage4_${application}_${pageType}_${this.progress.generated}`,
      stageId: "stage4_applications",
      imageData,
      embedding,
      metadata: {
        labels: [application, pageType, context.purpose],
        attributes: {
          application,
          pageType,
          sectionCount: template.sections.length,
          interactionCount: interactions.length,
        },
      },
      difficulty,
      timestamp: Date.now(),
      application,
      pageType,
      context,
      interactions,
    };
  }

  private renderPage(template: PageTemplate): {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array;
  } {
    const width = 800;
    const height = 600;
    const channels = 3;
    const data = new Uint8Array(width * height * channels);

    // Fill background
    for (let i = 0; i < data.length; i += channels) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }

    // Render each section
    for (const section of template.sections) {
      this.renderSection(data, width, height, channels, section);
    }

    return { width, height, channels, data };
  }

  private renderSection(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    section: PageSection
  ): void {
    const { position, size, type, interactive } = section;
    const colors = this.getSectionColors(type, interactive);

    // Draw section background
    this.drawRoundedRect(
      data,
      width,
      height,
      channels,
      position.x,
      position.y,
      size.width,
      size.height,
      4,
      colors.bg
    );

    // Draw border if interactive
    if (interactive) {
      this.drawRectBorder(
        data,
        width,
        height,
        channels,
        position.x,
        position.y,
        size.width,
        size.height,
        colors.border
      );
    }

    // Draw content indicator
    this.drawSectionContent(data, width, height, channels, section, colors);
  }

  private getSectionColors(
    type: string,
    interactive: boolean
  ): { bg: number[]; border: number[]; text: number[] } {
    const baseColors: Record<
      string,
      { bg: number[]; border: number[]; text: number[] }
    > = {
      navbar: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      sidebar: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      header: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      footer: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      form: {
        bg: [255, 255, 255],
        border: [209, 213, 219],
        text: [17, 24, 39],
      },
      button: {
        bg: [59, 130, 246],
        border: [37, 99, 235],
        text: [255, 255, 255],
      },
      link: {
        bg: [255, 255, 255],
        border: [255, 255, 255],
        text: [59, 130, 246],
      },
      card: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      stats: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      chart: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      table: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      feed: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      tabs: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [55, 65, 81],
      },
      grid: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      filters: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      pagination: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [55, 65, 81],
      },
      media: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      info: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      details: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [55, 65, 81],
      },
      reviews: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      actions: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      steps: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      trust: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      summary: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      sort: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      date_range: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      kpi: { bg: [255, 255, 255], border: [229, 231, 235], text: [17, 24, 39] },
      chart_main: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      chart_secondary: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      progress: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      content: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
      dots: {
        bg: [249, 250, 251],
        border: [229, 231, 235],
        text: [107, 114, 128],
      },
      terms: {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [55, 65, 81],
      },
      preview: {
        bg: [243, 244, 246],
        border: [229, 231, 235],
        text: [17, 24, 39],
      },
    };

    return (
      baseColors[type] || {
        bg: [255, 255, 255],
        border: [229, 231, 235],
        text: [17, 24, 39],
      }
    );
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

  private drawRectBorder(
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
    const borderWidth = 1;

    for (let d = 0; d < borderWidth; d++) {
      // Top
      for (let px = x; px < x + w; px++) {
        const py = y + d;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
      // Bottom
      for (let px = x; px < x + w; px++) {
        const py = y + h - 1 - d;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
      // Left
      for (let py = y; py < y + h; py++) {
        const px = x + d;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
      // Right
      for (let py = y; py < y + h; py++) {
        const px = x + w - 1 - d;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels;
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
        }
      }
    }
  }

  private drawSectionContent(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    section: PageSection,
    colors: { bg: number[]; border: number[]; text: number[] }
  ): void {
    const { position, size, content } = section;

    // Draw content as horizontal lines to represent text/content
    const lineCount = Math.floor(size.height / 20);
    const lineHeight = 6;
    const lineGap = 8;

    for (let i = 0; i < Math.min(lineCount, 3); i++) {
      const lineY = position.y + 15 + i * (lineHeight + lineGap);
      const lineWidth = size.width - 20;

      this.drawLine(
        data,
        width,
        height,
        channels,
        position.x + 10,
        lineY,
        lineWidth,
        lineHeight,
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

  private generateEmbedding(
    application: AppType,
    pageType: PageType,
    template: PageTemplate,
    context: AppContext
  ): Float32Array {
    const embedding = new Float32Array(768);
    const seed = this.hashString(
      `${application}_${pageType}_${template.sections.length}_${template.interactions.length}_${context.purpose}`
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
    application: AppType,
    pageType: PageType,
    template: PageTemplate
  ): number {
    let difficulty = 0.75;

    // Application complexity
    const appComplexity: Record<AppType, number> = {
      content: 0.0,
      social: 0.02,
      education: 0.03,
      ecommerce: 0.04,
      saas: 0.05,
      dashboard: 0.06,
      admin: 0.08,
      finance: 0.1,
    };
    difficulty += appComplexity[application];

    // Page complexity
    const pageComplexity: Record<PageType, number> = {
      login: 0.0,
      signup: 0.02,
      profile: 0.03,
      listing: 0.04,
      detail: 0.05,
      onboarding: 0.06,
      checkout: 0.07,
      settings: 0.08,
      dashboard: 0.09,
      analytics: 0.12,
    };
    difficulty += pageComplexity[pageType];

    // Section count complexity
    difficulty += (template.sections.length - 3) * 0.01;

    // Interaction count complexity
    difficulty += (template.interactions.length - 2) * 0.005;

    return Math.min(1.0, difficulty);
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
 * Evaluator for application predictions
 */
class ApplicationsEvaluator implements StageEvaluator {
  evaluate(example: Stage4Example, prediction: Float32Array): EvaluationResult {
    const target = example.embedding;
    const similarity = this.cosineSimilarity(target, prediction);
    const mse = this.mse(target, prediction);

    // Application recognition accuracy
    const appAccuracy = similarity > 0.65 ? 1.0 : similarity * 1.2;

    // Page type recognition accuracy
    const pageAccuracy = similarity > 0.6 ? 1.0 : similarity * 1.1;

    // Context understanding accuracy
    const contextAccuracy = similarity > 0.7 ? 1.0 : similarity;

    return {
      loss: mse,
      accuracy: (similarity + appAccuracy + pageAccuracy + contextAccuracy) / 4,
      confidence: similarity > 0.7 ? similarity : similarity * 0.9,
      metrics: {
        cosine_similarity: similarity,
        mse: mse,
        application_recognition: appAccuracy,
        page_recognition: pageAccuracy,
        context_understanding: contextAccuracy,
        interaction_prediction:
          example.interactions.length > 0 ? similarity * 0.9 : 0,
      },
    };
  }

  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult {
    const results = examples.map((ex, i) =>
      this.evaluate(ex as Stage4Example, predictions[i])
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
    return progress.mastery >= 0.75 && progress.loss < 0.25;
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
