/**
 * DwellTimeCollector - Tracks how long users hover/interact with elements
 */

import type { UIElement, UIContext } from "../types.js";

export interface DwellEvent {
  element: UIElement;
  startTime: number;
  endTime?: number;
  duration?: number;
  context: UIContext;
  completed: boolean;
}

export interface DwellStatistics {
  avgDwellTime: number;
  minDwellTime: number;
  maxDwellTime: number;
  medianDwellTime: number;
  totalDwellTime: number;
  elementCount: number;
}

export class DwellTimeCollector {
  private activeDwells: Map<string, DwellEvent> = new Map();
  private completedDwells: DwellEvent[] = [];
  private elementStats: Map<string, number[]> = new Map();

  /**
   * Start tracking dwell time for an element
   */
  startDwell(element: UIElement, context: UIContext): string {
    const dwellId = `${element.id}-${Date.now()}`;
    const event: DwellEvent = {
      element,
      startTime: Date.now(),
      context,
      completed: false,
    };

    this.activeDwells.set(dwellId, event);
    return dwellId;
  }

  /**
   * Stop tracking dwell time
   */
  endDwell(dwellId: string): number | null {
    const event = this.activeDwells.get(dwellId);
    if (!event) {
      return null;
    }

    event.endTime = Date.now();
    event.duration = event.endTime - event.startTime;
    event.completed = true;

    this.activeDwells.delete(dwellId);
    this.completedDwells.push(event);

    // Track by element
    const elementId = event.element.id;
    if (!this.elementStats.has(elementId)) {
      this.elementStats.set(elementId, []);
    }
    this.elementStats.get(elementId)!.push(event.duration);

    return event.duration;
  }

  /**
   * Get all completed dwell events
   */
  getCompletedDwells(): DwellEvent[] {
    return [...this.completedDwells];
  }

  /**
   * Get dwell events for a specific element
   */
  getDwellsForElement(elementId: string): DwellEvent[] {
    return this.completedDwells.filter(d => d.element.id === elementId);
  }

  /**
   * Get dwell statistics for an element
   */
  getElementStats(elementId: string): DwellStatistics | null {
    const durations = this.elementStats.get(elementId);
    if (!durations || durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      avgDwellTime: sum / durations.length,
      minDwellTime: sorted[0]!,
      maxDwellTime: sorted[sorted.length - 1]!,
      medianDwellTime: sorted[Math.floor(sorted.length / 2)]!,
      totalDwellTime: sum,
      elementCount: durations.length,
    };
  }

  /**
   * Get overall dwell statistics
   */
  getOverallStats(): DwellStatistics {
    const allDurations = Array.from(this.elementStats.values()).flat();
    if (allDurations.length === 0) {
      return {
        avgDwellTime: 0,
        minDwellTime: 0,
        maxDwellTime: 0,
        medianDwellTime: 0,
        totalDwellTime: 0,
        elementCount: 0,
      };
    }

    const sorted = [...allDurations].sort((a, b) => a - b);
    const sum = allDurations.reduce((a, b) => a + b, 0);

    return {
      avgDwellTime: sum / allDurations.length,
      minDwellTime: sorted[0]!,
      maxDwellTime: sorted[sorted.length - 1]!,
      medianDwellTime: sorted[Math.floor(sorted.length / 2)]!,
      totalDwellTime: sum,
      elementCount: allDurations.length,
    };
  }

  /**
   * Get elements by dwell time (highest first)
   */
  getTopElements(
    limit: number = 10
  ): Array<{ elementId: string; stats: DwellStatistics }> {
    const results: Array<{ elementId: string; stats: DwellStatistics }> = [];

    for (const [elementId, durations] of this.elementStats.entries()) {
      const stats = this.getElementStats(elementId);
      if (stats) {
        results.push({ elementId, stats });
      }
    }

    return results
      .sort((a, b) => b.stats.avgDwellTime - a.stats.avgDwellTime)
      .slice(0, limit);
  }

  /**
   * Clean up old dwell events
   */
  cleanup(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    this.completedDwells = this.completedDwells.filter(
      d => d.endTime! > cutoff
    );

    // Clean up element stats for old events
    for (const [elementId, durations] of this.elementStats.entries()) {
      // Keep only recent events (this is approximate)
      if (durations.length > 1000) {
        this.elementStats.set(elementId, durations.slice(-500));
      }
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.activeDwells.clear();
    this.completedDwells = [];
    this.elementStats.clear();
  }

  /**
   * Get active dwell count
   */
  getActiveCount(): number {
    return this.activeDwells.size;
  }

  /**
   * Get completed dwell count
   */
  getCompletedCount(): number {
    return this.completedDwells.length;
  }
}
