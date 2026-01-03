/**
 * GraphQLAPI - GraphQL API for analytics queries
 */

import { createYoga, createSchema } from "graphql-yoga";
import type { AnalyticsAPIConfig } from "../types.js";
import { AnalyticsDashboard } from "../dashboards/AnalyticsDashboard.js";
import { PersonalizationDashboard } from "../dashboards/PersonalizationDashboard.js";
import { ExperimentDashboard } from "../dashboards/ExperimentDashboard.js";
import { RealTimeDashboard } from "../dashboards/RealTimeDashboard.js";

export class GraphQLAPI {
  private config: AnalyticsAPIConfig;
  private analyticsDashboard: AnalyticsDashboard;
  private personalizationDashboard: PersonalizationDashboard;
  private experimentDashboard: ExperimentDashboard;
  private realTimeDashboard: RealTimeDashboard;
  private yoga: ReturnType<typeof createYoga> | null = null;

  constructor(
    config: AnalyticsAPIConfig,
    analyticsDashboard: AnalyticsDashboard,
    personalizationDashboard: PersonalizationDashboard,
    experimentDashboard: ExperimentDashboard,
    realTimeDashboard: RealTimeDashboard
  ) {
    this.config = config;
    this.analyticsDashboard = analyticsDashboard;
    this.personalizationDashboard = personalizationDashboard;
    this.experimentDashboard = experimentDashboard;
    this.realTimeDashboard = realTimeDashboard;

    this.setupSchema();
  }

  /**
   * Setup GraphQL schema
   */
  private setupSchema(): void {
    const schema = createSchema({
      typeDefs: `
        type OverviewMetrics {
          totalUsers: Int!
          activeUsers: Int!
          totalSessions: Int!
          totalEvents: Int!
          bounceRate: Float!
          avgSessionDuration: Float!
          conversionRate: Float!
          pageViewsPerSession: Float!
        }

        type UserMetrics {
          total: Int!
          new: Int!
          returning: Int!
          active: Int!
          churned: Int!
        }

        type SessionMetrics {
          total: Int!
          average: Float!
          median: Float!
          p75: Float!
          p90: Float!
          p95: Float!
          p99: Float!
          bounceRate: Float!
          averagePageViews: Float!
        }

        type EventMetrics {
          total: Int!
          unique: Int!
          perSession: Float!
        }

        type FunnelMetrics {
          name: String!
          totalUsers: Int!
          completionRate: Float!
        }

        type PersonalizationMetrics {
          accuracy: Float!
          precision: Float!
          recall: Float!
          f1Score: Float!
          satisfaction: Float!
          engagementLift: Float!
          clickThroughRate: Float!
          conversionRate: Float!
        }

        type RealtimeMetrics {
          activeUsers: Int!
          currentPageViews: Int!
          currentSessionCount: Int!
          eventsPerMinute: Int!
          averageLatency: Float!
          errorRate: Float!
        }

        type Experiment {
          id: String!
          name: String!
          description: String!
          status: String!
        }

        type Query {
          overview: OverviewMetrics
          users: UserMetrics
          sessions: SessionMetrics
          events: EventMetrics
          funnels: [FunnelMetrics!]
          personalization: PersonalizationMetrics
          realtime: RealtimeMetrics
          experiments: [Experiment!]
        }

        type Mutation {
          trackEvent(type: String!, properties: String): String
        }

        type Subscription {
          metricsUpdated: RealtimeMetrics
        }
      `,
      resolvers: {
        Query: {
          overview: () => this.analyticsDashboard.getOverviewMetrics(),
          users: () => this.analyticsDashboard.getUserMetrics(),
          sessions: () => this.analyticsDashboard.getSessionMetrics(),
          events: () => this.analyticsDashboard.getEventMetrics(),
          funnels: () => this.analyticsDashboard.getFunnelMetrics(),
          personalization: () => this.personalizationDashboard.getMetrics(),
          realtime: () => this.realTimeDashboard.getMetrics(),
          experiments: () => this.experimentDashboard.getAllExperiments(),
        },
        Mutation: {
          trackEvent: (
            _: unknown,
            args: { type: string; properties: string }
          ) => {
            // Placeholder for event tracking
            return `event-${Date.now()}`;
          },
        },
      },
    });

    this.yoga = createYoga({
      schema,
      graphqlEndpoint: "/api/graphql",
      port: this.config.port + 1, // Different port from REST API
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.yoga) {
      await this.yoga.start();
      console.log(
        `GraphQL API listening on http://${this.config.host}:${this.config.port + 1}/api/graphql`
      );
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.yoga) {
      await this.yoga.stop();
    }
  }
}
