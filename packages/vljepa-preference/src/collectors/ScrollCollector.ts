/**
 * ScrollCollector - Tracks scrolling behavior and patterns
 */

import type { UIElement, UIContext } from "../types.js";

export interface ScrollEvent {
  timestamp: number;
  position: { x: number; y: number };
  direction: "up" | "down" | "left" | "right";
  distance: number;
  velocity: number;
  context: UIContext;
  targetElement?: UIElement;
}

export interface ScrollStatistics {
  totalScrollDistance: number;
  avgScrollVelocity: number;
  maxScrollVelocity: number;
  scrollCount: number;
  avgScrollDepth: number;
  maxScrollDepth: number;
  bottomReached: number;
  topReached: number;
}

export interface ScrollDepth {
  depth: number;
  percentage: number;
  timestamp: number;
}

export class ScrollCollector {
  private scrollEvents: ScrollEvent[] = [];
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 };
  private lastTimestamp: number = 0;
  private scrollDepths: ScrollDepth[] = [];
  private maxScrollDepth: number = 0;
  private pageHeight: number = 0;
  private bottomReached: number = 0;
  private topReached: number = 0;

  /**
   * Record a scroll event
   */
  recordScroll(
    position: { x: number; y: number },
    context: UIContext,
    pageHeight: number,
    targetElement?: UIElement
  ): ScrollEvent {
    this.pageHeight = pageHeight;
    const now = Date.now();

    // Calculate distance and direction
    const dx = position.x - this.lastPosition.x;
    const dy = position.y - this.lastPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let direction: "up" | "down" | "left" | "right" = "down";
    if (Math.abs(dy) > Math.abs(dx)) {
      direction = dy > 0 ? "down" : "up";
    } else {
      direction = dx > 0 ? "right" : "left";
    }

    // Calculate velocity
    const timeDiff = now - this.lastTimestamp;
    const velocity = timeDiff > 0 ? distance / timeDiff : 0;

    const event: ScrollEvent = {
      timestamp: now,
      position: { ...position },
      direction,
      distance,
      velocity,
      context,
      targetElement,
    };

    this.scrollEvents.push(event);
    this.lastPosition = { ...position };
    this.lastTimestamp = now;

    // Track scroll depth
    this.trackScrollDepth(position.y, pageHeight);

    return event;
  }

  /**
   * Track scroll depth
   */
  private trackScrollDepth(scrollY: number, pageHeight: number): void {
    const depth = Math.round(scrollY);
    const percentage =
      pageHeight > 0 ? Math.round((scrollY / pageHeight) * 100) : 0;

    this.scrollDepths.push({
      depth,
      percentage,
      timestamp: Date.now(),
    });

    // Update max scroll depth
    if (depth > this.maxScrollDepth) {
      this.maxScrollDepth = depth;
    }

    // Track bottom/top reached
    if (percentage >= 95) {
      this.bottomReached++;
    }

    if (depth <= 10) {
      this.topReached++;
    }
  }

  /**
   * Get scroll statistics
   */
  getStatistics(): ScrollStatistics {
    if (this.scrollEvents.length === 0) {
      return this.getEmptyStats();
    }

    const totalDistance = this.scrollEvents.reduce(
      (sum, e) => sum + e.distance,
      0
    );
    const velocities = this.scrollEvents.map(e => e.velocity);
    const avgVelocity =
      velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);

    const depths = this.scrollDepths.map(d => d.depth);
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

    return {
      totalScrollDistance: totalDistance,
      avgScrollVelocity: avgVelocity,
      maxScrollVelocity: maxVelocity,
      scrollCount: this.scrollEvents.length,
      avgScrollDepth: avgDepth,
      maxScrollDepth: maxDepth,
      bottomReached: this.bottomReached,
      topReached: this.topReached,
    };
  }

  /**
   * Get empty statistics
   */
  private getEmptyStats(): ScrollStatistics {
    return {
      totalScrollDistance: 0,
      avgScrollVelocity: 0,
      maxScrollVelocity: 0,
      scrollCount: 0,
      avgScrollDepth: 0,
      maxScrollDepth: 0,
      bottomReached: 0,
      topReached: 0,
    };
  }

  /**
   * Get maximum scroll depth reached
   */
  getMaxScrollDepth(): number {
    return this.maxScrollDepth;
  }

  /**
   * Get scroll depth percentage
   */
  getScrollDepthPercentage(): number {
    return this.pageHeight > 0
      ? Math.round((this.maxScrollDepth / this.pageHeight) * 100)
      : 0;
  }

  /**
   * Get scroll depth timeline
   */
  getScrollDepthTimeline(): ScrollDepth[] {
    return [...this.scrollDepths];
  }

  /**
   * Get scroll events by direction
   */
  getScrollsByDirection(
    direction: "up" | "down" | "left" | "right"
  ): ScrollEvent[] {
    return this.scrollEvents.filter(e => e.direction === direction);
  }

  /**
   * Detect rapid scrolling
   */
  detectRapidScrolling(threshold: number = 1000): ScrollEvent[] {
    return this.scrollEvents.filter(e => e.velocity > threshold);
  }

  /**
   * Detect scroll bouncing (scrolling back and forth)
   */
  detectScrollBouncing(windowSize: number = 5): boolean {
    if (this.scrollEvents.length < windowSize) {
      return false;
    }

    const recent = this.scrollEvents.slice(-windowSize);
    const directionChanges = recent.filter((e, i) => {
      if (i === 0) return false;
      return e.direction !== recent[i - 1]!.direction;
    }).length;

    return directionChanges >= windowSize - 1;
  }

  /**
   * Calculate scroll engagement score
   */
  calculateEngagementScore(): number {
    const stats = this.getStatistics();

    // Factors: depth, distance, bottom reached
    const depthScore = Math.min(stats.maxScrollDepth / this.pageHeight, 1) * 40;
    const distanceScore = Math.min(stats.totalScrollDistance / 10000, 1) * 30;
    const bottomScore = Math.min(stats.bottomReached * 10, 30);

    return depthScore + distanceScore + bottomScore;
  }

  /**
   * Get scroll heatmap (where user scrolls most)
   */
  getScrollHeatmap(bucketSize: number = 100): Map<number, number> {
    const heatmap = new Map<number, number>();

    for (const event of this.scrollEvents) {
      const bucket = Math.floor(event.position.y / bucketSize) * bucketSize;
      const count = heatmap.get(bucket) ?? 0;
      heatmap.set(bucket, count + 1);
    }

    return heatmap;
  }

  /**
   * Clean up old scroll events
   */
  cleanup(maxAge: number): void {
    const cutoff = Date.now() - maxAge;
    this.scrollEvents = this.scrollEvents.filter(e => e.timestamp > cutoff);
    this.scrollDepths = this.scrollDepths.filter(d => d.timestamp > cutoff);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.scrollEvents = [];
    this.lastPosition = { x: 0, y: 0 };
    this.lastTimestamp = 0;
    this.scrollDepths = [];
    this.maxScrollDepth = 0;
    this.pageHeight = 0;
    this.bottomReached = 0;
    this.topReached = 0;
  }

  /**
   * Get total scroll event count
   */
  getTotalCount(): number {
    return this.scrollEvents.length;
  }

  /**
   * Set page height
   */
  setPageHeight(height: number): void {
    this.pageHeight = height;
  }
}
