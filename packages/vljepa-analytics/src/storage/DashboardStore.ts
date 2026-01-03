/**
 * DashboardStore - Stores and retrieves dashboard configurations and data
 */

import type { DashboardConfig, DashboardData } from "../types.js";

export class DashboardStore {
  private configs: Map<string, DashboardConfig> = new Map();
  private data: Map<string, DashboardData[]> = new Map();

  /**
   * Store dashboard config
   */
  storeConfig(id: string, config: DashboardConfig): void {
    this.configs.set(id, config);
  }

  /**
   * Get dashboard config
   */
  getConfig(id: string): DashboardConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get all configs
   */
  getAllConfigs(): Map<string, DashboardConfig> {
    return this.configs;
  }

  /**
   * Store dashboard data
   */
  storeData(dashboardId: string, data: DashboardData): void {
    if (!this.data.has(dashboardId)) {
      this.data.set(dashboardId, []);
    }

    this.data.get(dashboardId)!.push({ ...data, timestamp: Date.now() });
  }

  /**
   * Get latest dashboard data
   */
  getLatestData(dashboardId: string): DashboardData | undefined {
    const dataList = this.data.get(dashboardId);
    if (!dataList || dataList.length === 0) return undefined;

    return dataList[dataList.length - 1];
  }

  /**
   * Get historical data for dashboard
   */
  getHistoricalData(dashboardId: string, limit: number = 100): DashboardData[] {
    const dataList = this.data.get(dashboardId);
    if (!dataList) return [];

    return dataList.slice(-limit);
  }

  /**
   * Delete dashboard config
   */
  deleteConfig(id: string): boolean {
    this.data.delete(id);
    return this.configs.delete(id);
  }

  /**
   * Clear all
   */
  clear(): void {
    this.configs.clear();
    this.data.clear();
  }
}
