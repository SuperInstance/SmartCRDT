/**
 * ClickCollector - Tracks click patterns and heatmaps
 */

import type { UIElement, UIContext, Interaction } from "../types.js";

export interface ClickEvent {
  element: UIElement;
  timestamp: number;
  position: { x: number; y: number };
  context: UIContext;
  rapidFire?: boolean;
}

export interface ClickHeatmap {
  elementId: string;
  clicks: Array<{ x: number; y: number; count: number }>;
  totalClicks: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ClickStatistics {
  totalClicks: number;
  uniqueElements: number;
  mostClicked: Array<{ elementId: string; count: number }>;
  avgClicksPerSession: number;
  rapidFireCount: number;
}

export class ClickCollector {
  private clicks: ClickEvent[] = [];
  private elementClicks: Map<string, number> = new Map();
  private heatmapData: Map<string, ClickHeatmap> = new Map();
  private sessionClicks: Map<string, number> = new Map();
  private rapidFireThreshold: number = 500; // ms

  /**
   * Record a click
   */
  recordClick(
    element: UIElement,
    position: { x: number; y: number },
    context: UIContext,
    sessionId?: string
  ): ClickEvent {
    const click: ClickEvent = {
      element,
      timestamp: Date.now(),
      position,
      context,
    };

    // Check for rapid fire clicking
    const recentClicks = this.clicks.filter(
      c => c.timestamp >= click.timestamp - this.rapidFireThreshold
    );
    if (recentClicks.length > 3) {
      click.rapidFire = true;
    }

    this.clicks.push(click);

    // Update element click count
    const count = this.elementClicks.get(element.id) ?? 0;
    this.elementClicks.set(element.id, count + 1);

    // Update heatmap
    this.updateHeatmap(element, position);

    // Update session stats
    if (sessionId) {
      const sessionCount = this.sessionClicks.get(sessionId) ?? 0;
      this.sessionClicks.set(sessionId, sessionCount + 1);
    }

    return click;
  }

  /**
   * Update heatmap data for an element
   */
  private updateHeatmap(
    element: UIElement,
    position: { x: number; y: number }
  ): void {
    let heatmap = this.heatmapData.get(element.id);

    if (!heatmap) {
      heatmap = {
        elementId: element.id,
        clicks: [],
        totalClicks: 0,
        bounds: element.position,
      };
      this.heatmapData.set(element.id, heatmap);
    }

    // Check if position is close to existing point
    const threshold = 10; // pixels
    let found = false;

    for (const point of heatmap.clicks) {
      const dist = Math.sqrt(
        Math.pow(point.x - position.x, 2) + Math.pow(point.y - position.y, 2)
      );
      if (dist <= threshold) {
        point.count++;
        found = true;
        break;
      }
    }

    if (!found) {
      heatmap.clicks.push({ x: position.x, y: position.y, count: 1 });
    }

    heatmap.totalClicks++;
  }

  /**
   * Get click heatmap for an element
   */
  getHeatmap(elementId: string): ClickHeatmap | null {
    return this.heatmapData.get(elementId) ?? null;
  }

  /**
   * Get all heatmaps
   */
  getAllHeatmaps(): ClickHeatmap[] {
    return Array.from(this.heatmapData.values());
  }

  /**
   * Get click count for an element
   */
  getClickCount(elementId: string): number {
    return this.elementClicks.get(elementId) ?? 0;
  }

  /**
   * Get most clicked elements
   */
  getMostClicked(
    limit: number = 10
  ): Array<{ elementId: string; count: number }> {
    const results = Array.from(this.elementClicks.entries()).map(
      ([elementId, count]) => ({
        elementId,
        count,
      })
    );

    return results.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /**
   * Get click statistics
   */
  getStatistics(): ClickStatistics {
    const mostClicked = this.getMostClicked(10);
    const avgClicksPerSession =
      this.sessionClicks.size > 0
        ? Array.from(this.sessionClicks.values()).reduce((a, b) => a + b, 0) /
          this.sessionClicks.size
        : 0;

    const rapidFireCount = this.clicks.filter(c => c.rapidFire).length;

    return {
      totalClicks: this.clicks.length,
      uniqueElements: this.elementClicks.size,
      mostClicked,
      avgClicksPerSession,
      rapidFireCount,
    };
  }

  /**
   * Get clicks by time range
   */
  getClicksByTimeRange(startTime: number, endTime: number): ClickEvent[] {
    return this.clicks.filter(
      c => c.timestamp >= startTime && c.timestamp <= endTime
    );
  }

  /**
   * Get clicks by element type
   */
  getClicksByElementType(type: string): ClickEvent[] {
    return this.clicks.filter(c => c.element.type === type);
  }

  /**
   * Detect rage clicks (multiple clicks on same element)
   */
  detectRageClicks(
    threshold: number = 3,
    windowMs: number = 1000
  ): ClickEvent[] {
    const rageClicks: ClickEvent[] = [];

    for (const click of this.clicks) {
      const nearbyClicks = this.clicks.filter(
        c =>
          c.element.id === click.element.id &&
          c.timestamp >= click.timestamp - windowMs &&
          c.timestamp <= click.timestamp + windowMs
      );

      if (nearbyClicks.length >= threshold) {
        rageClicks.push(click);
      }
    }

    return rageClicks;
  }

  /**
   * Get click path (sequence of clicked elements)
   */
  getClickPath(sessionId?: string, limit: number = 50): string[] {
    const clicks = sessionId
      ? this.clicks.filter(c => c.context.referrer?.includes(sessionId))
      : this.clicks;

    return clicks.slice(-limit).map(c => c.element.id);
  }

  /**
   * Calculate click distribution
   */
  getClickDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();
    const total = this.clicks.length;

    for (const [elementId, count] of this.elementClicks.entries()) {
      distribution.set(elementId, count / total);
    }

    return distribution;
  }

  /**
   * Clean up old clicks
   */
  cleanup(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    this.clicks = this.clicks.filter(c => c.timestamp > cutoff);

    // Rebuild element counts
    this.elementClicks.clear();
    for (const click of this.clicks) {
      const count = this.elementClicks.get(click.element.id) ?? 0;
      this.elementClicks.set(click.element.id, count + 1);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.clicks = [];
    this.elementClicks.clear();
    this.heatmapData.clear();
    this.sessionClicks.clear();
  }

  /**
   * Get total click count
   */
  getTotalCount(): number {
    return this.clicks.length;
  }

  /**
   * Set rapid fire threshold
   */
  setRapidFireThreshold(threshold: number): void {
    this.rapidFireThreshold = threshold;
  }
}
