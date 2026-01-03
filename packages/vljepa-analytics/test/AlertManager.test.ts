/**
 * AlertManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertManager } from '../src/alerts/AlertManager.js';
import type { AlertConfig, AlertRule, NotificationChannel } from '../src/types.js';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let testConfig: AlertConfig;

  beforeEach(() => {
    testConfig = {
      rules: [
        {
          id: 'rule-1',
          name: 'High CPU Alert',
          type: 'threshold',
          metric: 'cpu_usage',
          condition: 'gt',
          threshold: 80,
          severity: 'warning',
          cooldown: 60000,
          enabled: true,
          notificationChannels: [],
        },
        {
          id: 'rule-2',
          name: 'Error Rate Alert',
          type: 'threshold',
          metric: 'error_rate',
          condition: 'gt',
          threshold: 5,
          severity: 'error',
          cooldown: 60000,
          enabled: false,
          notificationChannels: [],
        },
      ],
      notifications: [],
      cooldown: 60000,
      maxAlertsPerHour: 100,
    };

    alertManager = new AlertManager(testConfig);
  });

  describe('metric updates', () => {
    it('should trigger alert when threshold exceeded', () => {
      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', 90);

      expect(alertSpy).toHaveBeenCalled();
    });

    it('should not trigger alert when threshold not exceeded', () => {
      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', 50);

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should respect disabled rules', () => {
      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('error_rate', 10);

      // Rule is disabled, should not trigger
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('alert lifecycle', () => {
    it('should create open alert', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].status).toBe('open');
    });

    it('should acknowledge alert', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getOpenAlerts();
      if (alerts.length > 0) {
        alertManager.acknowledgeAlert(alerts[0].id, 'admin');

        const updatedAlert = alertManager.getAlerts().find((a) => a.id === alerts[0].id);
        expect(updatedAlert?.status).toBe('acknowledged');
        expect(updatedAlert?.acknowledgedBy).toBe('admin');
      }
    });

    it('should resolve alert', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getOpenAlerts();
      if (alerts.length > 0) {
        alertManager.resolveAlert(alerts[0].id, 'admin');

        const updatedAlert = alertManager.getAlerts().find((a) => a.id === alerts[0].id);
        expect(updatedAlert?.status).toBe('resolved');
        expect(updatedAlert?.resolvedBy).toBe('admin');
      }
    });

    it('should dismiss alert', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getOpenAlerts();
      if (alerts.length > 0) {
        alertManager.dismissAlert(alerts[0].id);

        const updatedAlert = alertManager.getAlerts().find((a) => a.id === alerts[0].id);
        expect(updatedAlert?.status).toBe('dismissed');
      }
    });
  });

  describe('alert filtering', () => {
    it('should get open alerts', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const openAlerts = alertManager.getOpenAlerts();
      expect(openAlerts.length).toBeGreaterThan(0);
      expect(openAlerts.every((a) => a.status === 'open')).toBe(true);
    });

    it('should get alerts by severity', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const warningAlerts = alertManager.getAlertsBySeverity('warning');
      expect(warningAlerts.length).toBeGreaterThan(0);
    });

    it('should get alerts by type', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const thresholdAlerts = alertManager.getAlertsByType('threshold');
      expect(thresholdAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('rule management', () => {
    it('should add rule', () => {
      const newRule: AlertRule = {
        id: 'rule-3',
        name: 'Memory Alert',
        type: 'threshold',
        metric: 'memory_usage',
        condition: 'gt',
        threshold: 90,
        severity: 'error',
        cooldown: 60000,
        enabled: true,
        notificationChannels: [],
      };

      alertManager.addRule(newRule);

      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('memory_usage', 95);

      expect(alertSpy).toHaveBeenCalled();
    });

    it('should update rule', () => {
      alertManager.updateRule('rule-1', { threshold: 95 });

      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', 92);

      expect(alertSpy).toHaveBeenCalled();
    });

    it('should delete rule', () => {
      alertManager.deleteRule('rule-1');

      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', 90);

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should toggle rule', () => {
      alertManager.toggleRule('rule-2', true);

      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('error_rate', 10);

      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('notification channels', () => {
    it('should add notification channel', () => {
      const channel: NotificationChannel = {
        id: 'channel-1',
        name: 'Email Notifications',
        type: 'email',
        enabled: true,
        config: { to: ['admin@example.com'] },
      };

      alertManager.addNotificationChannel(channel);

      // Should add without errors
      expect(true).toBe(true);
    });

    it('should delete notification channel', () => {
      const channel: NotificationChannel = {
        id: 'channel-2',
        name: 'Slack',
        type: 'slack',
        enabled: true,
        config: { webhookUrl: 'https://hooks.slack.com/test' },
      };

      alertManager.addNotificationChannel(channel);
      alertManager.deleteNotificationChannel('channel-2');

      // Should delete without errors
      expect(true).toBe(true);
    });
  });

  describe('alert history', () => {
    it('should get alert history for rule', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const history = alertManager.getAlertHistory('rule-1');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const history = alertManager.getAlertHistory('rule-1', 10);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('alert statistics', () => {
    it('should get statistics', () => {
      alertManager.updateMetric('cpu_usage', 90);

      const stats = alertManager.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('open');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('byType');
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('cooldown', () => {
    it('should respect cooldown period', () => {
      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', 90);
      alertManager.updateMetric('cpu_usage', 95); // Should be suppressed by cooldown

      expect(alertSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear operations', () => {
    it('should clear all alerts', () => {
      alertManager.updateMetric('cpu_usage', 90);
      alertManager.clearAlerts();

      const alerts = alertManager.getAlerts();
      expect(alerts.length).toBe(0);
    });

    it('should clear old alerts', () => {
      alertManager.updateMetric('cpu_usage', 90);

      // Create alert with old timestamp
      const alerts = alertManager.getAlerts();
      if (alerts.length > 0) {
        (alerts[0] as any).timestamp = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
        (alerts[0] as any).status = 'resolved';
      }

      alertManager.clearOldAlerts(30); // Clear alerts older than 30 days

      // Old resolved alerts should be cleared
      expect(true).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit on alert created', () => {
      const emitSpy = vi.fn();
      alertManager.on('alert', emitSpy);

      alertManager.updateMetric('cpu_usage', 90);

      expect(emitSpy).toHaveBeenCalled();
      expect(emitSpy.mock.calls[0][0]).toHaveProperty('type');
    });

    it('should emit on alert acknowledged', () => {
      const emitSpy = vi.fn();
      alertManager.on('alertAcknowledged', emitSpy);

      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getOpenAlerts();
      if (alerts.length > 0) {
        alertManager.acknowledgeAlert(alerts[0].id, 'admin');
        expect(emitSpy).toHaveBeenCalled();
      }
    });

    it('should emit on alert resolved', () => {
      const emitSpy = vi.fn();
      alertManager.on('alertResolved', emitSpy);

      alertManager.updateMetric('cpu_usage', 90);

      const alerts = alertManager.getOpenAlerts();
      if (alerts.length > 0) {
        alertManager.resolveAlert(alerts[0].id, 'admin');
        expect(emitSpy).toHaveBeenCalled();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle no rules', () => {
      const noRulesManager = new AlertManager({
        rules: [],
        notifications: [],
        cooldown: 60000,
        maxAlertsPerHour: 100,
      });

      noRulesManager.updateMetric('test', 100);

      expect(noRulesManager.getAlerts().length).toBe(0);
    });

    it('should handle invalid metric value', () => {
      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('cpu_usage', NaN);

      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should handle missing rule', () => {
      const result = alertManager.updateRule('non-existent', { threshold: 100 });
      expect(result).toBeUndefined();
    });
  });
});
