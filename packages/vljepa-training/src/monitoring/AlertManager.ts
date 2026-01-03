/**
 * @fileoverview Alert manager for training monitoring
 * @package @lsi/vljepa-training
 */

import type {
  AlertConfig,
  AlertCondition,
  AlertAction,
  TrainingMetrics,
} from "../types.js";

/**
 * Alert state
 */
interface AlertState {
  config: AlertConfig;
  consecutiveCount: number;
  lastTriggered: number;
}

/**
 * Alert result
 */
interface AlertResult {
  triggered: boolean;
  config: AlertConfig;
  value: number;
  message: string;
  actionsTaken: string[];
}

/**
 * Alert manager for training anomalies
 *
 * Monitors training metrics and triggers alerts when conditions are met:
 * - Metric anomalies (loss spikes, accuracy drops)
 * - Training issues (vanishing/exploding gradients)
 * - Performance issues (high latency, memory overflow)
 * - Resource issues (GPU memory, CPU usage)
 */
export class AlertManager {
  private alerts: AlertConfig[];
  private alertStates: Map<string, AlertState> = new Map();
  private isEnabled: boolean;

  constructor(alerts: AlertConfig[]) {
    this.alerts = alerts;
    this.isEnabled = alerts.length > 0;

    // Initialize alert states
    for (const alert of alerts) {
      this.alertStates.set(alert.type, {
        config: alert,
        consecutiveCount: 0,
        lastTriggered: 0,
      });
    }
  }

  /**
   * Check metrics against all alert conditions
   */
  check(metrics: TrainingMetrics): AlertResult[] {
    if (!this.isEnabled) {
      return [];
    }

    const results: AlertResult[] = [];

    for (const alert of this.alerts) {
      const result = this.checkAlert(alert, metrics);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Check a single alert condition
   */
  private checkAlert(
    alert: AlertConfig,
    metrics: TrainingMetrics
  ): AlertResult | null {
    const value = this.extractValue(alert, metrics);
    if (value === null) {
      return null;
    }

    const condition = alert.condition;
    const triggered = this.evaluateCondition(value, condition);

    if (triggered) {
      const state = this.alertStates.get(alert.type)!;
      state.consecutiveCount++;

      // Check if we've hit the consecutive threshold
      if (
        !condition.consecutive ||
        state.consecutiveCount >= condition.consecutive
      ) {
        state.lastTriggered = Date.now();
        const actionsTaken = this.executeActions(alert.action);

        return {
          triggered: true,
          config: alert,
          value,
          message: this.formatMessage(alert, value),
          actionsTaken,
        };
      }
    } else {
      // Reset consecutive count
      const state = this.alertStates.get(alert.type)!;
      state.consecutiveCount = 0;
    }

    return null;
  }

  /**
   * Extract value from metrics based on alert type
   */
  private extractValue(
    alert: AlertConfig,
    metrics: TrainingMetrics
  ): number | null {
    switch (alert.type) {
      case "metric":
        // Generic metric - would need more specific config
        return null;

      case "loss":
        return metrics.loss.training;

      case "accuracy":
        return metrics.accuracy.top1 || 0;

      case "latency":
        return metrics.latency.total;

      case "memory":
        return metrics.memory.gpu;

      case "gradient":
        return metrics.learning.gradientNorm;

      default:
        return null;
    }
  }

  /**
   * Evaluate condition
   */
  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case ">":
        return value > condition.threshold;
      case "<":
        return value < condition.threshold;
      case ">=":
        return value >= condition.threshold;
      case "<=":
        return value <= condition.threshold;
      case "==":
        return value === condition.threshold;
      case "!=":
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Execute alert actions
   */
  private executeActions(action: AlertAction): string[] {
    const actionsTaken: string[] = [];

    if (action.stopTraining) {
      actionsTaken.push("stop_training");
      // In real implementation, would signal pipeline to stop
    }

    if (action.saveCheckpoint) {
      actionsTaken.push("save_checkpoint");
      // In real implementation, would trigger checkpoint save
    }

    if (action.script) {
      actionsTaken.push(`run_script: ${action.script}`);
      // In real implementation, would execute script
    }

    return actionsTaken;
  }

  /**
   * Format alert message
   */
  private formatMessage(alert: AlertConfig, value: number): string {
    const severity = alert.severity.toUpperCase();
    const operator = alert.condition.operator;
    const threshold = alert.condition.threshold;

    return `[${severity}] ${alert.type} ${operator} ${threshold}: ${value.toFixed(4)}`;
  }

  /**
   * Get alert state
   */
  getAlertState(type: string): AlertState | undefined {
    return this.alertStates.get(type);
  }

  /**
   * Reset alert state
   */
  resetAlert(type: string): void {
    const state = this.alertStates.get(type);
    if (state) {
      state.consecutiveCount = 0;
    }
  }

  /**
   * Reset all alert states
   */
  resetAll(): void {
    for (const state of this.alertStates.values()) {
      state.consecutiveCount = 0;
    }
  }

  /**
   * Add a new alert
   */
  addAlert(alert: AlertConfig): void {
    this.alerts.push(alert);
    this.alertStates.set(alert.type, {
      config: alert,
      consecutiveCount: 0,
      lastTriggered: 0,
    });
  }

  /**
   * Remove an alert
   */
  removeAlert(type: string): void {
    this.alerts = this.alerts.filter(a => a.type !== type);
    this.alertStates.delete(type);
  }

  /**
   * Get all alerts
   */
  getAlerts(): AlertConfig[] {
    return [...this.alerts];
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
