/**
 * AnalyticsAPI Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsAPI } from '../src/api/AnalyticsAPI.js';
import { AnalyticsDashboard } from '../src/dashboards/AnalyticsDashboard.js';
import { PersonalizationDashboard } from '../src/dashboards/PersonalizationDashboard.js';
import { ExperimentDashboard } from '../src/dashboards/ExperimentDashboard.js';
import { RealTimeDashboard } from '../src/dashboards/RealTimeDashboard.js';
import { EventStore } from '../src/storage/EventStore.js';
import { UserProfileStore } from '../src/storage/UserProfileStore.js';
import { SessionCollector } from '../src/collectors/SessionCollector.js';
import request from 'supertest';
import express from 'express';

describe('AnalyticsAPI', () => {
  let api: AnalyticsAPI;
  let app: express.Application;
  let analyticsDashboard: AnalyticsDashboard;
  let personalizationDashboard: PersonalizationDashboard;
  let experimentDashboard: ExperimentDashboard;
  let realTimeDashboard: RealTimeDashboard;

  beforeEach(() => {
    const eventStore = new EventStore();
    const userStore = new UserProfileStore();
    const sessionCollector = new SessionCollector();

    analyticsDashboard = new AnalyticsDashboard(
      {
        refreshInterval: 0,
        widgets: [],
        dateRange: { start: new Date(), end: new Date() },
        filters: [],
        exportFormats: [],
      },
      eventStore,
      userStore,
      sessionCollector
    );

    personalizationDashboard = new PersonalizationDashboard({
      refreshInterval: 0,
      widgets: [],
      dateRange: { start: new Date(), end: new Date() },
      filters: [],
      exportFormats: [],
    });

    experimentDashboard = new ExperimentDashboard({
      refreshInterval: 0,
      widgets: [],
      dateRange: { start: new Date(), end: new Date() },
      filters: [],
      exportFormats: [],
    });

    realTimeDashboard = new RealTimeDashboard({
      refreshInterval: 0,
      widgets: [],
      dateRange: { start: new Date(), end: new Date() },
      filters: [],
      exportFormats: [],
    });

    api = new AnalyticsAPI(
      {
        port: 3001,
        host: 'localhost',
        cors: {
          origin: '*',
          credentials: true,
        },
      },
      analyticsDashboard,
      personalizationDashboard,
      experimentDashboard,
      realTimeDashboard
    );

    app = api.getApp();
  });

  describe('GET /api/analytics/overview', () => {
    it('should return overview metrics', async () => {
      const response = await request(app).get('/api/analytics/overview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /api/analytics/users', () => {
    it('should return user metrics', async () => {
      const response = await request(app).get('/api/analytics/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/sessions', () => {
    it('should return session metrics', async () => {
      const response = await request(app).get('/api/analytics/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/events', () => {
    it('should return event metrics', async () => {
      const response = await request(app).get('/api/analytics/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/funnels', () => {
    it('should return funnel metrics', async () => {
      const response = await request(app).get('/api/analytics/funnels');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/personalization', () => {
    it('should return personalization metrics', async () => {
      const response = await request(app).get('/api/analytics/personalization');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/personalization/insights', () => {
    it('should return personalization insights', async () => {
      const response = await request(app).get('/api/analytics/personalization/insights');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/realtime', () => {
    it('should return real-time metrics', async () => {
      const response = await request(app).get('/api/analytics/realtime');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/experiments', () => {
    it('should return all experiments', async () => {
      const response = await request(app).get('/api/analytics/experiments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/analytics/experiments/:id', () => {
    it('should return 404 for non-existent experiment', async () => {
      const response = await request(app).get('/api/analytics/experiments/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/analytics/experiments', () => {
    it('should create new experiment', async () => {
      const newExperiment = {
        name: 'Test Experiment',
        description: 'Testing experiment creation',
        status: 'draft',
        variants: [
          { id: 'control', name: 'Control', traffic: 50, config: {} },
          { id: 'variant', name: 'Variant', traffic: 50, config: {} },
        ],
        metrics: ['conversion'],
        sampleSize: 1000,
        confidence: 0.95,
      };

      const response = await request(app)
        .post('/api/analytics/experiments')
        .send(newExperiment);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });
  });

  describe('GET /api/analytics/experiments/:id/results', () => {
    it('should return 404 for non-existent experiment results', async () => {
      const response = await request(app).get('/api/analytics/experiments/non-existent/results');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/analytics/export', () => {
    it('should initiate export', async () => {
      const response = await request(app)
        .post('/api/analytics/export')
        .send({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/analytics/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/analytics/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/api/analytics/health');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/analytics/unknown');

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/analytics/experiments')
        .send('{invalid json}');

      expect(response.status).toBe(400);
    });
  });

  describe('response format', () => {
    it('should include meta information', async () => {
      const response = await request(app).get('/api/analytics/health');

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      expect(response.body.meta.requestId).toBeDefined();
      expect(response.body.meta.version).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty query parameters', async () => {
      const response = await request(app).get('/api/analytics/users?page=&limit=');

      expect(response.status).toBe(200);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/analytics/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
