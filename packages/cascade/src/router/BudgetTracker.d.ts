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
export declare class BudgetTracker {
    private state;
    private config;
    private alerts;
    private resetTimer?;
    constructor(config: BudgetConfig);
    /**
     * Check if a request is within budget
     */
    canAfford(cost: number): boolean;
    /**
     * Record a cost and update budget state
     */
    recordCost(model: string, cost: number): {
        allowed: boolean;
        alert?: BudgetAlert;
    };
    /**
     * Get current budget state
     */
    getState(): BudgetState;
    /**
     * Get remaining budget
     */
    getRemainingBudget(): number;
    /**
     * Get percentage of budget used
     */
    getPercentageUsed(): number;
    /**
     * Get spending by model
     */
    getSpendingByModel(): Record<string, number>;
    /**
     * Get recent alerts
     */
    getRecentAlerts(count?: number): BudgetAlert[];
    /**
     * Clear alerts
     */
    clearAlerts(): void;
    /**
     * Reset budget (start fresh)
     */
    resetBudget(newLimit?: number): void;
    /**
     * Update budget limit
     */
    setBudgetLimit(newLimit: number): void;
    /**
     * Get average cost per request
     */
    getAverageCostPerRequest(): number;
    /**
     * Get session duration in milliseconds
     */
    getSessionDuration(): number;
    /**
     * Get spending rate (USD per hour)
     */
    getSpendingRate(): number;
    /**
     * Check if we should alert based on current spending
     */
    private checkAlerts;
    /**
     * Create an alert
     */
    private createAlert;
    /**
     * Get alert message based on level
     */
    private getAlertMessage;
    /**
     * Setup automatic budget reset
     */
    private setupAutoReset;
    /**
     * Cleanup (stop auto-reset timer)
     */
    destroy(): void;
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
    };
}
/**
 * Create a BudgetTracker with default configuration
 */
export declare function createBudgetTracker(budgetLimit: number, options?: Partial<BudgetConfig>): BudgetTracker;
//# sourceMappingURL=BudgetTracker.d.ts.map