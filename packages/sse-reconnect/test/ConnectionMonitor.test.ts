/**
 * ConnectionMonitor Tests
 * Tests for connection health monitoring and disconnect detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor, createConnectionMonitor } from '../src/ConnectionMonitor.js';
import type { ConnectionMonitorConfig, ConnectionMonitorEvent, DisconnectReason } from '../src/types.js';

describe('ConnectionMonitor', () => {
  let monitor: ConnectionMonitor;

  beforeEach(() => {
    monitor = new ConnectionMonitor({
      healthCheckInterval: 100,
      connectionTimeout: 500,
      maxConsecutiveFailures: 3,
      enableAutoHealthCheck: false
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      const m = new ConnectionMonitor();

      expect(m).toBeDefined();
      expect(m.isConnected()).toBe(false);
    });

    it('should create with factory function', () => {
      const m = createConnectionMonitor();

      expect(m).toBeDefined();
    });

    it('should create with custom config', () => {
      const m = new ConnectionMonitor({
        healthCheckInterval: 5000,
        connectionTimeout: 10000
      });

      const config = m.getConfig();

      expect(config.healthCheckInterval).toBe(5000);
      expect(config.connectionTimeout).toBe(10000);
    });
  });

  describe('Monitoring', () => {
    it('should start monitoring', () => {
      monitor.monitor();

      expect(monitor.isConnected()).toBe(true);
      expect(monitor.getHealth().healthy).toBe(true);
    });

    it('should emit connect event on start', () => {
      const handler = vi.fn();

      monitor.onEvent(handler);
      monitor.monitor();

      expect(handler).toHaveBeenCalledTimes(1);

      const event = handler.mock.calls[0][0] as ConnectionMonitorEvent;

      expect(event.type).toBe('connect');
      expect(event.state).toBe('connected');
    });

    it('should stop monitoring', () => {
      monitor.monitor();
      monitor.stopMonitoring();

      expect(monitor.isConnected()).toBe(false);
      expect(monitor.getHealth().healthy).toBe(false);
    });

    it('should emit disconnect event on stop', () => {
      const handler = vi.fn();

      monitor.monitor();
      monitor.onEvent(handler);
      monitor.stopMonitoring();

      expect(handler).toHaveBeenCalled();

      const events = handler.mock.calls.map(call => call[0] as ConnectionMonitorEvent);
      const disconnectEvent = events.find(e => e.type === 'disconnect');

      expect(disconnectEvent).toBeDefined();
    });
  });

  describe('Event Recording', () => {
    it('should record event timestamps', () => {
      monitor.monitor();

      const beforeTime = Date.now();
      monitor.recordEvent();
      const afterTime = Date.now();

      const health = monitor.getHealth();

      expect(health.lastPingTime).not.toBeNull();

      if (health.lastPingTime) {
        expect(health.lastPingTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
        expect(health.lastPingTime.getTime()).toBeLessThanOrEqual(afterTime);
      }
    });

    it('should reset consecutive failures on event', () => {
      monitor.monitor();

      // Simulate some failures
      for (let i = 0; i < 3; i++) {
        monitor.checkHealth();
      }

      let health = monitor.getHealth();
      expect(health.consecutiveFailures).toBeGreaterThan(0);

      // Record event (success)
      monitor.recordEvent();

      health = monitor.getHealth();
      expect(health.consecutiveFailures).toBe(0);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when events are recent', () => {
      monitor.monitor();
      monitor.recordEvent();

      const healthy = monitor.checkHealth();

      expect(healthy).toBe(true);
    });

    it('should report unhealthy when no recent events', async () => {
      monitor.monitor();

      // Wait longer than timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      const healthy = monitor.checkHealth();

      expect(healthy).toBe(false);
    });

    it('should track consecutive failures', async () => {
      monitor.monitor();

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      monitor.checkHealth();
      monitor.checkHealth();

      const health = monitor.getHealth();

      expect(health.consecutiveFailures).toBeGreaterThan(1);
    });

    it('should emit health check events', () => {
      const handler = vi.fn();

      monitor.monitor();
      monitor.onEvent(handler);

      monitor.checkHealth();

      expect(handler).toHaveBeenCalled();

      const events = handler.mock.calls.map(call => call[0] as ConnectionMonitorEvent);
      const healthCheckEvent = events.find(e => e.type === 'health-check');

      expect(healthCheckEvent).toBeDefined();
    });

    it('should detect disconnect after max failures', async () => {
      const handler = vi.fn();

      monitor.monitor();
      monitor.onEvent(handler);

      // Wait for timeout and accumulate failures
      await new Promise(resolve => setTimeout(resolve, 600));

      for (let i = 0; i < 5; i++) {
        monitor.checkHealth();
      }

      const events = handler.mock.calls.map(call => call[0] as ConnectionMonitorEvent);
      const disconnectEvents = events.filter(e => e.type === 'disconnect');

      expect(disconnectEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Disconnect Detection', () => {
    it('should detect disconnect with reason', () => {
      const handler = vi.fn();

      monitor.monitor();
      monitor.onEvent(handler);

      monitor.detectDisconnect('error');

      expect(monitor.isConnected()).toBe(false);

      const events = handler.mock.calls.map(call => call[0] as ConnectionMonitorEvent);
      const disconnectEvent = events.find(e => e.type === 'disconnect');

      expect(disconnectEvent?.data?.reason).toBe('error');
    });

    it('should handle all disconnect reasons', () => {
      const reasons: DisconnectReason[] = ['error', 'timeout', 'server-close', 'network-loss', 'manual'];

      for (const reason of reasons) {
        const m = new ConnectionMonitor({ enableAutoHealthCheck: false });

        m.monitor();
        m.detectDisconnect(reason);

        expect(m.isConnected()).toBe(false);
        m.stopMonitoring();
      }
    });
  });

  describe('Uptime Tracking', () => {
    it('should track uptime while connected', async () => {
      monitor.monitor();

      await new Promise(resolve => setTimeout(resolve, 100));

      const uptime = monitor.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThan(1); // Less than 1 second
    });

    it('should reset uptime on reconnect', async () => {
      monitor.monitor();

      await new Promise(resolve => setTimeout(resolve, 100));

      const uptime1 = monitor.getUptime();

      monitor.stopMonitoring();
      monitor.monitor();

      await new Promise(resolve => setTimeout(resolve, 50));

      const uptime2 = monitor.getUptime();

      expect(uptime2).toBeLessThan(uptime1);
    });

    it('should return zero uptime when never connected', () => {
      const uptime = monitor.getUptime();

      expect(uptime).toBe(0);
    });
  });

  describe('Time Since Last Event', () => {
    it('should track time since last event', async () => {
      monitor.monitor();
      monitor.recordEvent();

      await new Promise(resolve => setTimeout(resolve, 50));

      const timeSinceEvent = monitor.getTimeSinceLastEvent();

      expect(timeSinceEvent).toBeGreaterThan(40);
      expect(timeSinceEvent).toBeLessThan(200);
    });

    it('should return infinity when no events recorded', () => {
      monitor.monitor();

      const timeSinceEvent = monitor.getTimeSinceLastEvent();

      expect(timeSinceEvent).toBe(Infinity);
    });
  });

  describe('Health Status', () => {
    it('should return current health status', () => {
      monitor.monitor();

      const health = monitor.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.lastPingTime).not.toBeNull();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should update health status', async () => {
      monitor.monitor();

      await new Promise(resolve => setTimeout(resolve, 600));

      monitor.checkHealth();

      const health = monitor.getHealth();

      expect(health.healthy).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return monitor statistics', () => {
      monitor.monitor();

      const stats = monitor.getStatistics();

      expect(stats.isConnected).toBe(true);
      expect(stats.isHealthy).toBe(true);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.consecutiveFailures).toBe(0);
    });

    it('should track last event time', () => {
      monitor.monitor();
      monitor.recordEvent();

      const stats = monitor.getStatistics();

      expect(stats.lastEventTime).not.toBeNull();
    });

    it('should track last check time', () => {
      monitor.monitor();

      monitor.checkHealth();

      const stats = monitor.getStatistics();

      expect(stats.lastCheckTime).not.toBeNull();
    });
  });

  describe('Event Handlers', () => {
    it('should support multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      monitor.onEvent(handler1);
      monitor.onEvent(handler2);

      monitor.monitor();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe handler', () => {
      const handler = vi.fn();

      const unsubscribe = monitor.onEvent(handler);

      unsubscribe();

      monitor.monitor();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      monitor.onEvent(errorHandler);

      expect(() => {
        monitor.monitor();
      }).not.toThrow();
    });
  });

  describe('Auto Health Check', () => {
    it('should start automatic health checking', async () => {
      const m = new ConnectionMonitor({
        healthCheckInterval: 50,
        enableAutoHealthCheck: true
      });

      const handler = vi.fn();

      m.monitor();
      m.onEvent(handler);

      await new Promise(resolve => setTimeout(resolve, 200));

      const events = handler.mock.calls.map(call => call[0] as ConnectionMonitorEvent);
      const healthCheckEvents = events.filter(e => e.type === 'health-check');

      expect(healthCheckEvents.length).toBeGreaterThan(0);

      m.stopMonitoring();
    });

    it('should stop automatic health checking on disconnect', () => {
      const m = new ConnectionMonitor({
        healthCheckInterval: 50,
        enableAutoHealthCheck: true
      });

      m.monitor();
      m.stopMonitoring();

      // Should not have any timers after stopping
      expect(m.isConnected()).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    it('should update health check interval', () => {
      monitor.updateConfig({ healthCheckInterval: 5000 });

      const config = monitor.getConfig();

      expect(config.healthCheckInterval).toBe(5000);
    });

    it('should update connection timeout', () => {
      monitor.updateConfig({ connectionTimeout: 20000 });

      const config = monitor.getConfig();

      expect(config.connectionTimeout).toBe(20000);
    });

    it('should restart health check when interval changes', async () => {
      const m = new ConnectionMonitor({
        healthCheckInterval: 50,
        enableAutoHealthCheck: true
      });

      m.monitor();

      await new Promise(resolve => setTimeout(resolve, 100));

      m.updateConfig({ healthCheckInterval: 200 });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be running with new interval
      expect(m.isConnected()).toBe(true);

      m.stopMonitoring();
    });
  });

  describe('Reset', () => {
    it('should reset monitor state', () => {
      monitor.monitor();
      monitor.recordEvent();
      monitor.checkHealth();

      monitor.reset();

      const stats = monitor.getStatistics();

      expect(stats.isConnected).toBe(false);
      expect(stats.lastEventTime).toBeNull();
      expect(stats.consecutiveFailures).toBe(0);
    });

    it('should clear health status on reset', () => {
      monitor.monitor();

      monitor.reset();

      const health = monitor.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.lastPingTime).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid event recording', () => {
      monitor.monitor();

      for (let i = 0; i < 100; i++) {
        monitor.recordEvent();
      }

      const health = monitor.getHealth();

      expect(health.consecutiveFailures).toBe(0);
    });

    it('should handle monitor start when already monitoring', () => {
      monitor.monitor();

      expect(() => {
        monitor.monitor();
      }).not.toThrow();

      expect(monitor.isConnected()).toBe(true);
    });

    it('should handle stop when not monitoring', () => {
      expect(() => {
        monitor.stopMonitoring();
      }).not.toThrow();

      expect(monitor.isConnected()).toBe(false);
    });

    it('should handle health check without monitoring', () => {
      const healthy = monitor.checkHealth();

      expect(typeof healthy).toBe('boolean');
    });
  });
});
