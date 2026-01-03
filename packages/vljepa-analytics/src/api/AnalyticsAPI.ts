/**
 * AnalyticsAPI - REST API for analytics data
 */

import express, { Request, Response, Router } from "express";
import type {
  AnalyticsAPIConfig,
  APIResponse,
  QueryOptions,
  DateRange,
} from "../types.js";
import { AnalyticsDashboard } from "../dashboards/AnalyticsDashboard.js";
import { PersonalizationDashboard } from "../dashboards/PersonalizationDashboard.js";
import { ExperimentDashboard } from "../dashboards/ExperimentDashboard.js";
import { RealTimeDashboard } from "../dashboards/RealTimeDashboard.js";

export class AnalyticsAPI {
  private config: AnalyticsAPIConfig;
  private app: express.Application;
  private router: Router;
  private analyticsDashboard: AnalyticsDashboard;
  private personalizationDashboard: PersonalizationDashboard;
  private experimentDashboard: ExperimentDashboard;
  private realTimeDashboard: RealTimeDashboard;

  constructor(
    config: AnalyticsAPIConfig,
    analyticsDashboard: AnalyticsDashboard,
    personalizationDashboard: PersonalizationDashboard,
    experimentDashboard: ExperimentDashboard,
    realTimeDashboard: RealTimeDashboard
  ) {
    this.config = config;
    this.app = express();
    this.router = Router();

    this.analyticsDashboard = analyticsDashboard;
    this.personalizationDashboard = personalizationDashboard;
    this.experimentDashboard = experimentDashboard;
    this.realTimeDashboard = realTimeDashboard;

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS
    if (this.config.cors) {
      this.app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", this.config.cors!.origin);
        res.header("Access-Control-Allow-Credentials", "true");
        res.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        );
        next();
      });
    }

    // Rate limiting
    if (this.config.rateLimit) {
      const rateLimitMap = new Map<string, number[]>();

      this.app.use((req, res, next) => {
        const key = req.ip || "unknown";
        const now = Date.now();
        const windowStart = now - this.config.rateLimit!.windowMs;

        const requests = rateLimitMap.get(key) || [];
        const validRequests = requests.filter(t => t > windowStart);

        if (validRequests.length >= this.config.rateLimit!.max) {
          return res.status(429).json({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests",
            },
          });
        }

        validRequests.push(now);
        rateLimitMap.set(key, validRequests);
        next();
      });
    }

    // Authentication
    if (this.config.authentication?.enabled) {
      this.app.use((req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authorization header required",
            },
          });
        }

        // Validate auth token (placeholder)
        next();
      });
    }

    this.app.use("/api/analytics", this.router);
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Overview
    this.router.get("/overview", async (req: Request, res: Response) => {
      try {
        const data = await this.analyticsDashboard.getOverviewMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Users
    this.router.get("/users", async (req: Request, res: Response) => {
      try {
        const data = await this.analyticsDashboard.getUserMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Sessions
    this.router.get("/sessions", async (req: Request, res: Response) => {
      try {
        const data = await this.analyticsDashboard.getSessionMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Events
    this.router.get("/events", async (req: Request, res: Response) => {
      try {
        const data = await this.analyticsDashboard.getEventMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Funnels
    this.router.get("/funnels", async (req: Request, res: Response) => {
      try {
        const data = await this.analyticsDashboard.getFunnelMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Personalization
    this.router.get("/personalization", async (req: Request, res: Response) => {
      try {
        const data = await this.personalizationDashboard.getMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Personalization insights
    this.router.get(
      "/personalization/insights",
      async (req: Request, res: Response) => {
        try {
          const data = await this.personalizationDashboard.getInsights();
          this.sendSuccess(res, data);
        } catch (error) {
          this.sendError(res, error);
        }
      }
    );

    // Real-time metrics
    this.router.get("/realtime", (req: Request, res: Response) => {
      try {
        const data = this.realTimeDashboard.getMetrics();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Experiments
    this.router.get("/experiments", (req: Request, res: Response) => {
      try {
        const data = this.experimentDashboard.getAllExperiments();
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Get experiment
    this.router.get("/experiments/:id", (req: Request, res: Response) => {
      try {
        const data = this.experimentDashboard.getExperiment(req.params.id);
        if (!data) {
          return this.sendError(
            res,
            { code: "NOT_FOUND", message: "Experiment not found" },
            404
          );
        }
        this.sendSuccess(res, data);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Create experiment
    this.router.post("/experiments", (req: Request, res: Response) => {
      try {
        const data = this.experimentDashboard.createExperiment(req.body);
        this.sendSuccess(res, data, 201);
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Get experiment results
    this.router.get(
      "/experiments/:id/results",
      (req: Request, res: Response) => {
        try {
          const data = this.experimentDashboard.getResults(req.params.id);
          if (!data) {
            return this.sendError(
              res,
              { code: "NOT_FOUND", message: "Experiment results not found" },
              404
            );
          }
          this.sendSuccess(res, data);
        } catch (error) {
          this.sendError(res, error);
        }
      }
    );

    // Export data
    this.router.post("/export", (req: Request, res: Response) => {
      try {
        // Placeholder for export functionality
        this.sendSuccess(res, {
          message: "Export initiated",
          id: "export-123",
        });
      } catch (error) {
        this.sendError(res, error);
      }
    });

    // Health check
    this.router.get("/health", (req: Request, res: Response) => {
      this.sendSuccess(res, { status: "healthy", timestamp: Date.now() });
    });
  }

  /**
   * Send success response
   */
  private sendSuccess<T>(res: Response, data: T, status: number = 200): void {
    const response: APIResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: Date.now(),
        requestId: this.generateRequestId(),
        version: "1.0.0",
      },
    };

    res.status(status).json(response);
  }

  /**
   * Send error response
   */
  private sendError(res: Response, error: unknown, status: number = 500): void {
    const message = error instanceof Error ? error.message : String(error);

    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
      meta: {
        timestamp: Date.now(),
        requestId: this.generateRequestId(),
        version: "1.0.0",
      },
    };

    res.status(status).json(response);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the server
   */
  start(): void {
    this.app.listen(this.config.port, this.config.host, () => {
      console.log(
        `Analytics API listening on http://${this.config.host}:${this.config.port}`
      );
    });
  }

  /**
   * Stop the server
   */
  stop(): void {
    // In a real implementation, this would close the server
  }

  /**
   * Get the Express app
   */
  getApp(): express.Application {
    return this.app;
  }
}
