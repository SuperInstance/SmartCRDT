/**
 * @file analytics.test.ts - Tests for error analytics
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorAnalytics } from '../src/analytics.js';
import type { AgentError, RecoveryResult, ErrorSeverity } from '../src/types.js';

describe('ErrorAnalytics', () => {
  let analytics: ErrorAnalytics;

  beforeEach(() => {
    analytics = new ErrorAnalytics();
  });

  describe('trackError', () => {
    it('should track error', () => {
      const error: AgentError = {
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test error',
        context: {},
        timestamp: Date.now(),
        retryable: true,
        retry_count: 0,
      };

      analytics.trackError(error);

      const stats = analytics.getStatistics();
      expect(stats.total_errors).toBe(1);
    });

    it('should limit history size', () => {
      const smallAnalytics = new ErrorAnalytics(5);

      for (let i = 0; i < 10; i++) {
        smallAnalytics.trackError({
          error_id: `err_${i}`,
          agent_id: 'agent-1',
          severity: 'error',
          category: 'execution',
          message: `Error ${i}`,
          context: {},
          timestamp: Date.now(),
         
          retry_count: 0,
        });
      }

      const stats = smallAnalytics.getStatistics();
      expect(stats.total_errors).toBe(5);
    });
  });

  describe('trackRecovery', () => {
    it('should track recovery result', () => {
      const error: AgentError = {
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test error',
        context: {},
        timestamp: Date.now(),
        retryable: true,
        retry_count: 0,
      };

      analytics.trackError(error);

      const recovery: RecoveryResult = {
        success: true,
        strategy: 'retry',
        result: 'recovered',
        recovery_time: 100,
        attempts: 2,
      };

      analytics.trackRecovery(error, recovery);

      const stats = analytics.getStatistics();
      expect(stats.recovery_success_rate).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    it('should return empty statistics initially', () => {
      const stats = analytics.getStatistics();

      expect(stats.total_errors).toBe(0);
      expect(stats.recovery_success_rate).toBe(0);
      expect(stats.avg_recovery_time).toBe(0);
    });

    it('should count errors by severity', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Error 1',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_2',
        agent_id: 'agent-1',
        severity: 'warning',
        category: 'validation',
        message: 'Warning 1',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const stats = analytics.getStatistics();

      expect(stats.errors_by_severity.error).toBe(1);
      expect(stats.errors_by_severity.warning).toBe(1);
    });

    it('should count errors by category', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'timeout',
        message: 'Timeout',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_2',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'network',
        message: 'Network error',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const stats = analytics.getStatistics();

      expect(stats.errors_by_category.timeout).toBe(1);
      expect(stats.errors_by_category.network).toBe(1);
    });

    it('should count errors by agent', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Error 1',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_2',
        agent_id: 'agent-2',
        severity: 'error',
        category: 'execution',
        message: 'Error 2',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const stats = analytics.getStatistics();

      expect(stats.errors_by_agent['agent-1']).toBe(1);
      expect(stats.errors_by_agent['agent-2']).toBe(1);
    });

    it('should calculate average recovery time', () => {
      const error: AgentError = {
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      };

      analytics.trackError(error);
      analytics.trackRecovery(error, {
        success: true,
        strategy: 'retry',
        recovery_time: 100,
        attempts: 1,
      });

      analytics.trackError({
        ...error,
        error_id: 'err_2',
      });
      analytics.trackRecovery({
        ...error,
        error_id: 'err_2',
      }, {
        success: true,
        strategy: 'retry',
        recovery_time: 200,
        attempts: 1,
      });

      const stats = analytics.getStatistics();

      expect(stats.avg_recovery_time).toBe(150);
    });

    it('should identify common errors', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Connection timeout',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_2',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Connection timeout',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_3',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Different error',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const stats = analytics.getStatistics();

      expect(stats.common_errors[0].message).toBe('Connection timeout');
      expect(stats.common_errors[0].count).toBe(2);
    });
  });

  describe('calculateErrorRate', () => {
    it('should calculate error rate per minute', () => {
      const now = Date.now();

      for (let i = 0; i < 6; i++) {
        analytics.trackError({
          error_id: `err_${i}`,
          agent_id: 'agent-1',
          severity: 'error',
          category: 'execution',
          message: `Error ${i}`,
          context: {},
          timestamp: now - i * 10000,
         
          retry_count: 0,
        });
      }

      const rate = analytics.calculateErrorRate(60000);

      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('getPatterns', () => {
    it('should detect error patterns', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Failed to connect to host 192.168.1.1',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.trackError({
        error_id: 'err_2',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Failed to connect to host 192.168.1.2',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const patterns = analytics.getPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].count).toBe(2);
    });
  });

  describe('getPatternsByAgent', () => {
    it('should filter patterns by agent', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Timeout',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const patterns = analytics.getPatternsByAgent('agent-1');

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('getErrorTrend', () => {
    it('should calculate error trend', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        analytics.trackError({
          error_id: `err_${i}`,
          agent_id: 'agent-1',
          severity: 'error',
          category: 'execution',
          message: `Error ${i}`,
          context: {},
          timestamp: now - i * 1000000,
         
          retry_count: 0,
        });
      }

      const trend = analytics.getErrorTrend(3600000, 5);

      expect(trend).toHaveLength(5);
      expect(trend[0]).toHaveProperty('time');
      expect(trend[0]).toHaveProperty('count');
    });
  });

  describe('getAgentPerformance', () => {
    it('should get agent performance metrics', () => {
      const error: AgentError = {
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      };

      analytics.trackError(error);
      analytics.trackRecovery(error, {
        success: true,
        strategy: 'retry',
        recovery_time: 100,
        attempts: 1,
      });

      const perf = analytics.getAgentPerformance('agent-1');

      expect(perf.totalErrors).toBe(1);
      expect(perf.recoverySuccessRate).toBe(1);
      expect(perf.avgRecoveryTime).toBe(100);
    });
  });

  describe('checkAlerts', () => {
    it('should generate alerts for exceeded thresholds', () => {
      for (let i = 0; i < 15; i++) {
        analytics.trackError({
          error_id: `err_${i}`,
          agent_id: 'agent-1',
          severity: 'warning',
          category: 'execution',
          message: `Warning ${i}`,
          context: {},
          timestamp: Date.now(),
         
          retry_count: 0,
        });
      }

      const alerts = analytics.checkAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toHaveProperty('severity');
      expect(alerts[0]).toHaveProperty('count');
      expect(alerts[0]).toHaveProperty('threshold');
    });
  });

  describe('setAlertThreshold', () => {
    it('should set custom alert threshold', () => {
      analytics.setAlertThreshold('error', 5);

      for (let i = 0; i < 10; i++) {
        analytics.trackError({
          error_id: `err_${i}`,
          agent_id: 'agent-1',
          severity: 'error',
          category: 'execution',
          message: `Error ${i}`,
          context: {},
          timestamp: Date.now(),
         
          retry_count: 0,
        });
      }

      const alerts = analytics.checkAlerts();

      expect(alerts.some((a) => a.severity === 'error')).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate text report', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'timeout',
        message: 'Test error',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const report = analytics.generateReport();

      expect(report).toContain('Error Analytics Report');
      expect(report).toContain('Total Errors: 1');
      expect(report).toContain('timeout');
    });
  });

  describe('createDashboardData', () => {
    it('should create dashboard data', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const dashboard = analytics.createDashboardData();

      expect(dashboard.statistics).toBeDefined();
      expect(dashboard.patterns).toBeDefined();
      expect(dashboard.trend).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset analytics', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      analytics.reset();

      const stats = analytics.getStatistics();
      expect(stats.total_errors).toBe(0);
    });
  });

  describe('export/import', () => {
    it('should export and import analytics', () => {
      analytics.trackError({
        error_id: 'err_1',
        agent_id: 'agent-1',
        severity: 'error',
        category: 'execution',
        message: 'Test',
        context: {},
        timestamp: Date.now(),
       
        retry_count: 0,
      });

      const exported = analytics.export();
      const newAnalytics = new ErrorAnalytics();
      newAnalytics.import(exported);

      const stats = newAnalytics.getStatistics();
      expect(stats.total_errors).toBe(1);
    });
  });
});
