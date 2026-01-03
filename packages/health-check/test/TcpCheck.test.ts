/**
 * TcpCheck Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TcpCheck } from '../src/checks/TcpCheck.js';

describe('TcpCheck', () => {
  let tcpCheck: TcpCheck;

  beforeEach(() => {
    tcpCheck = new TcpCheck({
      host: 'localhost',
      port: 3000,
      timeout: 5000
    });
  });

  describe('constructor', () => {
    it('should create TCP check with config', () => {
      const config = tcpCheck.getConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(3000);
      expect(config.timeout).toBe(5000);
    });

    it('should use default values', () => {
      const check = new TcpCheck({
        host: 'localhost',
        port: 8080
      });

      const config = check.getConfig();
      expect(config.connectionTimeout).toBe(5000);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const result = TcpCheck.validateConfig({
        host: 'localhost',
        port: 3000,
        timeout: 5000
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing host', () => {
      const result = TcpCheck.validateConfig({
        port: 3000
      } as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Host is required');
    });

    it('should reject invalid port', () => {
      const result = TcpCheck.validateConfig({
        host: 'localhost',
        port: -1
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('port'))).toBe(true);
    });

    it('should reject port out of range', () => {
      const result = TcpCheck.validateConfig({
        host: 'localhost',
        port: 70000
      });

      expect(result.valid).toBe(false);
    });

    it('should reject invalid timeout', () => {
      const result = TcpCheck.validateConfig({
        host: 'localhost',
        port: 3000,
        timeout: -100
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be positive');
    });
  });

  describe('getServiceName', () => {
    it('should return service name for common ports', () => {
      expect(TcpCheck.getServiceName(80)).toBe('HTTP');
      expect(TcpCheck.getServiceName(443)).toBe('HTTPS');
      expect(TcpCheck.getServiceName(22)).toBe('SSH');
      expect(TcpCheck.getServiceName(3306)).toBe('MySQL');
    });

    it('should return Unknown for uncommon ports', () => {
      expect(TcpCheck.getServiceName(9999)).toBe('Unknown');
    });
  });

  describe('toFunction', () => {
    it('should create health check function', async () => {
      const fn = tcpCheck.toFunction();

      expect(typeof fn).toBe('function');
      // Will fail since nothing is listening on localhost:3000
      const result = await fn();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      tcpCheck.updateConfig({
        host: 'example.com',
        port: 8080,
        timeout: 10000
      });

      const config = tcpCheck.getConfig();
      expect(config.host).toBe('example.com');
      expect(config.port).toBe(8080);
      expect(config.timeout).toBe(10000);
    });
  });

  describe('executeAsMetric', () => {
    it('should return health metric', async () => {
      const metric = await tcpCheck.executeAsMetric();

      expect(metric.name).toBe('tcp-connection');
      expect(metric.unit).toBe('boolean');
      expect(metric.timestamp).toBeInstanceOf(Date);
      expect(metric.status).toBeDefined();
    });
  });

  describe('executeMultiple', () => {
    it('should execute multiple checks', async () => {
      const configs = [
        { host: 'localhost', port: 3000, timeout: 1000 },
        { host: 'localhost', port: 3001, timeout: 1000 },
        { host: 'localhost', port: 3002, timeout: 1000 }
      ];

      const results = await TcpCheck.executeMultiple(configs);

      expect(results.length).toBe(3);
      expect(results.every(r => r.name === 'tcp-check')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle IPv6 addresses', () => {
      const check = new TcpCheck({
        host: '::1',
        port: 3000
      });

      expect(check.getConfig().host).toBe('::1');
    });

    it('should handle connection timeout', async () => {
      const check = new TcpCheck({
        host: '192.0.2.1', // TEST-NET-1, should timeout
        port: 9999,
        timeout: 100
      });

      const result = await check.execute();

      expect(result.passed).toBe(false);
      expect(result.responseTime).toBeGreaterThanOrEqual(100);
    }, 10000);
  });
});
