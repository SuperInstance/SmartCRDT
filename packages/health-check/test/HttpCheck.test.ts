/**
 * HttpCheck Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpCheck } from '../src/checks/HttpCheck.js';

// Mock fetch
global.fetch = vi.fn();

describe('HttpCheck', () => {
  let httpCheck: HttpCheck;

  beforeEach(() => {
    vi.clearAllMocks();
    httpCheck = new HttpCheck({
      url: 'http://localhost:3000/health',
      timeout: 5000,
      expectedStatuses: [200],
      method: 'GET'
    });
  });

  describe('constructor', () => {
    it('should create HTTP check with config', () => {
      const config = httpCheck.getConfig();

      expect(config.url).toBe('http://localhost:3000/health');
      expect(config.timeout).toBe(5000);
      expect(config.expectedStatuses).toEqual([200]);
      expect(config.method).toBe('GET');
    });

    it('should use default values when not provided', () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health'
      });

      const config = check.getConfig();
      expect(config.expectedStatuses).toEqual([200]);
      expect(config.method).toBe('GET');
      expect(config.followRedirects).toBe(true);
    });
  });

  describe('execute', () => {
    it('should pass when status code matches expected', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await httpCheck.execute();

      expect(result.passed).toBe(true);
      expect(result.name).toBe('http-check');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should fail when status code does not match expected', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await httpCheck.execute();

      expect(result.passed).toBe(false);
    });

    it('should accept multiple expected status codes', async () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health',
        expectedStatuses: [200, 201, 204]
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content'
      });

      const result = await check.execute();

      expect(result.passed).toBe(true);
    });

    it('should be degraded when response time exceeds threshold', async () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health',
        maxResponseTime: 10
      });

      (global.fetch as any).mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          statusText: 'OK'
        };
      });

      const result = await check.execute();

      expect(result.passed).toBe(false);
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await httpCheck.execute();

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should include metadata in result', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await httpCheck.execute();

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.statusCode).toBe(200);
      expect(result.metadata?.url).toBe('http://localhost:3000/health');
    });
  });

  describe('executeAsMetric', () => {
    it('should return health metric', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const metric = await httpCheck.executeAsMetric();

      expect(metric.name).toBe('http-endpoint');
      expect(metric.unit).toBe('ms');
      expect(metric.status).toBeDefined();
      expect(metric.timestamp).toBeInstanceOf(Date);
    });

    it('should mark as unhealthy when check fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const metric = await httpCheck.executeAsMetric();

      expect(metric.status).toBe('unhealthy');
    });

    it('should mark as degraded when response time is high', async () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health',
        maxResponseTime: 10
      });

      (global.fetch as any).mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          statusText: 'OK'
        };
      });

      const metric = await check.executeAsMetric();

      expect(metric.status).toBe('degraded');
    });
  });

  describe('executeMultiple', () => {
    it('should execute multiple HTTP checks', async () => {
      const configs = [
        { url: 'http://localhost:3000/health1' },
        { url: 'http://localhost:3000/health2' },
        { url: 'http://localhost:3000/health3' }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const results = await HttpCheck.executeMultiple(configs);

      expect(results.length).toBe(3);
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should handle partial failures', async () => {
      const configs = [
        { url: 'http://localhost:3000/health1' },
        { url: 'http://localhost:3000/health2' }
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await HttpCheck.executeMultiple(configs);

      expect(results.length).toBe(2);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
    });
  });

  describe('toFunction', () => {
    it('should create health check function', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const fn = httpCheck.toFunction();
      const result = await fn();

      expect(result).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      httpCheck.updateConfig({
        url: 'http://localhost:4000/health',
        timeout: 10000
      });

      const config = httpCheck.getConfig();
      expect(config.url).toBe('http://localhost:4000/health');
      expect(config.timeout).toBe(10000);
    });
  });

  describe('parseUrl', () => {
    it('should parse valid URL', () => {
      const parsed = HttpCheck.parseUrl('http://localhost:3000/api/health');

      expect(parsed).toEqual({
        protocol: 'http:',
        host: 'localhost',
        port: '3000',
        path: '/api/health'
      });
    });

    it('should parse URL without port', () => {
      const parsed = HttpCheck.parseUrl('https://example.com/health');

      expect(parsed).toEqual({
        protocol: 'https:',
        host: 'example.com',
        port: '',
        path: '/health'
      });
    });

    it('should return null for invalid URL', () => {
      const parsed = HttpCheck.parseUrl('not-a-url');
      expect(parsed).toBeNull();
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const result = HttpCheck.validateConfig({
        url: 'http://localhost:3000/health',
        timeout: 5000
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with missing URL', () => {
      const result = HttpCheck.validateConfig({
        timeout: 5000
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL is required');
    });

    it('should reject config with invalid URL', () => {
      const result = HttpCheck.validateConfig({
        url: 'not-a-url',
        timeout: 5000
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid URL'))).toBe(true);
    });

    it('should reject config with invalid timeout', () => {
      const result = HttpCheck.validateConfig({
        url: 'http://localhost:3000/health',
        timeout: -100
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be positive');
    });
  });

  describe('edge cases', () => {
    it('should handle empty response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content'
      });

      const result = await httpCheck.execute();

      expect(result.passed).toBe(true);
    });

    it('should handle timeout via AbortController', async () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health',
        timeout: 10
      });

      (global.fetch as any).mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          ok: true,
          status: 200,
          statusText: 'OK'
        };
      });

      const result = await check.execute();

      expect(result.passed).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle different HTTP methods', async () => {
      const check = new HttpCheck({
        url: 'http://localhost:3000/health',
        method: 'POST',
        body: '{"test": true}',
        headers: { 'Content-Type': 'application/json' }
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await check.execute();

      expect(result.passed).toBe(true);
    });
  });
});
