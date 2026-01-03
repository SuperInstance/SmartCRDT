/**
 * BudgetTracker - Track and manage AI API spending
 *
 * Monitors spending, enforces budget limits, and provides alerts
 * when approaching or exceeding budget thresholds.
 */

/**
 * Budget alert level
 */
export type BudgetAlertLevel = "info" | "warning" | "critical" | "exceeded";

/**
 * Budget alert
 */
export interface BudgetAlert {
  /** Alert level */
  level: BudgetAlertLevel;
  /** Alert message */
  message: string;
  /** Current spending */
  currentSpending: number;
  /** Budget limit */
  budgetLimit: number;
  /** Percentage used */
  percentageUsed: number;
  /** Timestamp of alert */
  timestamp: number;
}

/**
 * Budget state
 */
export interface BudgetState {
  /** Total budget limit */
  budgetLimit: number;
  /** Current spending */
  currentSpending: number;
  /** Spending by model */
  spendingByModel: Record<string, number>;
  /** Request count */
  requestCount: number;
  /** Warning threshold (0-1) */
  warningThreshold: number;
  /** Critical threshold (0-1) */
  criticalThreshold: number;
  /** Session start time */
  sessionStart: number;
  /** Last reset time */
  lastReset: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Total budget limit (USD) */
  budgetLimit: number;
  /** Warning threshold (percentage, 0-1) */
  warningThreshold?: number;
  /** Critical threshold (percentage, 0-1) */
  criticalThreshold?: number;
  /** Whether to block requests when budget exceeded */
  blockOnExceed?: boolean;
  /** Alert callback */
  onAlert?: (alert: BudgetAlert) => void;
  /** Reset period (milliseconds, 0 = no auto-reset) */
  resetPeriod?: number;
}

/**
 * BudgetTracker class
 */
export class BudgetTracker {
  private state: BudgetState;
  private config: Required<BudgetConfig>;
  private alerts: BudgetAlert[] = [];
  private resetTimer?: NodeJS.Timeout;

  constructor(config: BudgetConfig) {
    this.config = {
      budgetLimit: config.budgetLimit,
      warningThreshold: config.warningThreshold ?? 0.7,
      criticalThreshold: config.criticalThreshold ?? 0.9,
      blockOnExceed: config.blockOnExceed ?? true,
      onAlert: config.onAlert ?? (() => {}),
      resetPeriod: config.resetPeriod ?? 0,
    };

    this.state = {
      budgetLimit: this.config.budgetLimit,
      currentSpending: 0,
      spendingByModel: {},
      requestCount: 0,
      warningThreshold: this.config.warningThreshold,
      criticalThreshold: this.config.criticalThreshold,
      sessionStart: Date.now(),
      lastReset: Date.now(),
    };

    // Setup auto-reset if configured
    if (this.config.resetPeriod > 0) {
      this.setupAutoReset();
    }
  }

  /**
   * Check if a request is within budget
   */
  canAfford(cost: number): boolean {
    if (!this.config.blockOnExceed) {
      return true;
    }

    const newTotal = this.state.currentSpending + cost;
    return newTotal <= this.state.budgetLimit;
  }

  /**
   * Record a cost and update budget state
   */
  recordCost(
    model: string,
    cost: number
  ): { allowed: boolean; alert?: BudgetAlert } {
    // Check if we can afford this
    const canAfford = this.canAfford(cost);

    if (!canAfford && this.config.blockOnExceed) {
      const alert = this.createAlert("exceeded");
      this.config.onAlert(alert);
      this.alerts.push(alert);
      return { allowed: false, alert };
    }

    // Update spending
    this.state.currentSpending += cost;
    this.state.spendingByModel[model] =
      (this.state.spendingByModel[model] || 0) + cost;
    this.state.requestCount += 1;

    // Check for alerts
    const alert = this.checkAlerts();
    if (alert) {
      this.config.onAlert(alert);
      this.alerts.push(alert);
      return { allowed: true, alert };
    }

    return { allowed: true };
  }

  /**
   * Get current budget state
   */
  getState(): BudgetState {
    return { ...this.state };
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, this.state.budgetLimit - this.state.currentSpending);
  }

  /**
   * Get percentage of budget used
   */
  getPercentageUsed(): number {
    return this.state.currentSpending / this.state.budgetLimit;
  }

  /**
   * Get spending by model
   */
  getSpendingByModel(): Record<string, number> {
    return { ...this.state.spendingByModel };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 10): BudgetAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Reset budget (start fresh)
   */
  resetBudget(newLimit?: number): void {
    this.state.currentSpending = 0;
    this.state.spendingByModel = {};
    this.state.requestCount = 0;
    this.state.lastReset = Date.now();

    if (newLimit !== undefined) {
      this.state.budgetLimit = newLimit;
      this.config.budgetLimit = newLimit;
    }

    this.clearAlerts();
  }

  /**
   * Update budget limit
   */
  setBudgetLimit(newLimit: number): void {
    this.state.budgetLimit = newLimit;
    this.config.budgetLimit = newLimit;
  }

  /**
   * Get average cost per request
   */
  getAverageCostPerRequest(): number {
    return this.state.requestCount > 0
      ? this.state.currentSpending / this.state.requestCount
      : 0;
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(): number {
    return Date.now() - this.state.sessionStart;
  }

  /**
   * Get spending rate (USD per hour)
   */
  getSpendingRate(): number {
    const durationHours = this.getSessionDuration() / (1000 * 60 * 60);
    return durationHours > 0 ? this.state.currentSpending / durationHours : 0;
  }

  /**
   * Check if we should alert based on current spending
   */
  private checkAlerts(): BudgetAlert | null {
    const percentage = this.getPercentageUsed();

    if (percentage >= 1) {
      return this.createAlert("exceeded");
    } else if (percentage >= this.state.criticalThreshold) {
      return this.createAlert("critical");
    } else if (percentage >= this.state.warningThreshold) {
      return this.createAlert("warning");
    }

    return null;
  }

  /**
   * Create an alert
   */
  private createAlert(level: BudgetAlertLevel): BudgetAlert {
    const percentage = this.getPercentageUsed();

    return {
      level,
      message: this.getAlertMessage(level),
      currentSpending: this.state.currentSpending,
      budgetLimit: this.state.budgetLimit,
      percentageUsed: percentage,
      timestamp: Date.now(),
    };
  }

  /**
   * Get alert message based on level
   */
  private getAlertMessage(level: BudgetAlertLevel): string {
    const percentage = (this.getPercentageUsed() * 100).toFixed(1);
    const remaining = this.getRemainingBudget().toFixed(4);

    switch (level) {
      case "exceeded":
        return `Budget exceeded! Spent $${this.state.currentSpending.toFixed(4)} of $${this.state.budgetLimit.toFixed(2)} (${percentage}%).`;
      case "critical":
        return `Critical: Budget ${percentage}% used. $${remaining} remaining.`;
      case "warning":
        return `Warning: Budget ${percentage}% used. Consider upgrading or reducing usage.`;
      case "info":
        return `Budget status: ${percentage}% used, $${remaining} remaining.`;
      default:
        return `Budget at ${percentage}%`;
    }
  }

  /**
   * Setup automatic budget reset
   */
  private setupAutoReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.resetBudget();
      this.setupAutoReset(); // Schedule next reset
    }, this.config.resetPeriod);
  }

  /**
   * Cleanup (stop auto-reset timer)
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Get budget summary
   */
  getSummary(): {
    budgetLimit: number;
    currentSpending: number;
    remaining: number;
    percentageUsed: number;
    requestCount: number;
    averageCost: number;
    spendingRate: number;
    sessionDuration: number;
  } {
    return {
      budgetLimit: this.state.budgetLimit,
      currentSpending: this.state.currentSpending,
      remaining: this.getRemainingBudget(),
      percentageUsed: this.getPercentageUsed(),
      requestCount: this.state.requestCount,
      averageCost: this.getAverageCostPerRequest(),
      spendingRate: this.getSpendingRate(),
      sessionDuration: this.getSessionDuration(),
    };
  }
}

/**
 * Create a BudgetTracker with default configuration
 */
export function createBudgetTracker(
  budgetLimit: number,
  options?: Partial<BudgetConfig>
): BudgetTracker {
  return new BudgetTracker({
    budgetLimit,
    ...options,
  });
}
