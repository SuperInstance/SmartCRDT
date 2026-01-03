/**
 * Analysis - Analyze evolution patterns and generate insights
 */

import type {
  UIState,
  UIVersion,
  EvolutionEvent,
  EvolutionPattern,
  EvolutionTrend,
  EvolutionInsight,
} from "../types.js";

export class EvolutionAnalyzer {
  /**
   * Analyze evolution patterns in version history
   */
  analyzePatterns(versions: UIVersion[]): EvolutionPattern[] {
    const patterns: EvolutionPattern[] = [];

    if (versions.length < 2) {
      return patterns;
    }

    // Detect refactor pattern
    const refactorPattern = this.detectRefactorPattern(versions);
    if (refactorPattern) {
      patterns.push(refactorPattern);
    }

    // Detect expansion pattern
    const expansionPattern = this.detectExpansionPattern(versions);
    if (expansionPattern) {
      patterns.push(expansionPattern);
    }

    // Detect consolidation pattern
    const consolidationPattern = this.detectConsolidationPattern(versions);
    if (consolidationPattern) {
      patterns.push(consolidationPattern);
    }

    // Detect iterative pattern
    const iterativePattern = this.detectIterativePattern(versions);
    if (iterativePattern) {
      patterns.push(iterativePattern);
    }

    return patterns;
  }

  /**
   * Detect refactor pattern
   */
  private detectRefactorPattern(
    versions: UIVersion[]
  ): EvolutionPattern | null {
    const recentVersions = versions.slice(-10);

    let refactoringCount = 0;
    const evidence: EvolutionPattern["evidence"] = [];

    for (const version of recentVersions) {
      const message = version.message.toLowerCase();
      if (message.includes("refactor") || message.includes("restructure")) {
        refactoringCount++;
        evidence.push({
          timestamp: version.timestamp,
          version: version.version,
          description: version.message,
        });
      }
    }

    if (refactoringCount >= 2) {
      return {
        type: "refactor",
        confidence: Math.min(refactoringCount / 5, 1),
        description: `${refactoringCount} refactoring operations detected`,
        evidence,
      };
    }

    return null;
  }

  /**
   * Detect expansion pattern
   */
  private detectExpansionPattern(
    versions: UIVersion[]
  ): EvolutionPattern | null {
    if (versions.length < 3) return null;

    let expansionCount = 0;
    const evidence: EvolutionPattern["evidence"] = [];

    for (let i = 1; i < versions.length; i++) {
      const prevSize = JSON.stringify(versions[i - 1].state).length;
      const currSize = JSON.stringify(versions[i].state).length;

      if (currSize > prevSize * 1.2) {
        expansionCount++;
        evidence.push({
          timestamp: versions[i].timestamp,
          version: versions[i].version,
          description: `State size increased by ${(((currSize - prevSize) / prevSize) * 100).toFixed(1)}%`,
        });
      }
    }

    if (expansionCount >= versions.length * 0.3) {
      return {
        type: "expansion",
        confidence: expansionCount / versions.length,
        description: `UI expanded in ${expansionCount} of ${versions.length} versions`,
        evidence,
      };
    }

    return null;
  }

  /**
   * Detect consolidation pattern
   */
  private detectConsolidationPattern(
    versions: UIVersion[]
  ): EvolutionPattern | null {
    if (versions.length < 3) return null;

    let consolidationCount = 0;
    const evidence: EvolutionPattern["evidence"] = [];

    for (let i = 1; i < versions.length; i++) {
      const prevComponents = versions[i - 1].state.components.length;
      const currComponents = versions[i].state.components.length;

      if (currComponents < prevComponents) {
        consolidationCount++;
        evidence.push({
          timestamp: versions[i].timestamp,
          version: versions[i].version,
          description: `Component count reduced from ${prevComponents} to ${currComponents}`,
        });
      }
    }

    if (consolidationCount >= 2) {
      return {
        type: "consolidation",
        confidence: Math.min(consolidationCount / 5, 1),
        description: `${consolidationCount} consolidation operations detected`,
        evidence,
      };
    }

    return null;
  }

  /**
   * Detect iterative pattern
   */
  private detectIterativePattern(
    versions: UIVersion[]
  ): EvolutionPattern | null {
    if (versions.length < 5) return null;

    const authorCounts = new Map<string, number>();

    for (const version of versions) {
      authorCounts.set(
        version.author,
        (authorCounts.get(version.author) || 0) + 1
      );
    }

    for (const [author, count] of authorCounts) {
      if (count >= 5) {
        const evidence = versions
          .filter(v => v.author === author)
          .slice(-10)
          .map(v => ({
            timestamp: v.timestamp,
            version: v.version,
            description: v.message,
          }));

        return {
          type: "iterative",
          confidence: Math.min(count / versions.length, 1),
          description: `${count} commits by ${author} showing iterative development`,
          evidence,
        };
      }
    }

    return null;
  }
}

export class PatternDetector {
  /**
   * Detect all patterns in event history
   */
  detectPatterns(events: EvolutionEvent[]): EvolutionPattern[] {
    const patterns: EvolutionPattern[] = [];

    // Detect rapid iteration
    const rapidIteration = this.detectRapidIteration(events);
    if (rapidIteration) patterns.push(rapidIteration);

    // Detect batch updates
    const batchUpdates = this.detectBatchUpdates(events);
    if (batchUpdates) patterns.push(batchUpdates);

    return patterns;
  }

  private detectRapidIteration(
    events: EvolutionEvent[]
  ): EvolutionPattern | null {
    if (events.length < 5) return null;

    const recentEvents = events.slice(-20);
    const timeWindow = 60 * 60 * 1000; // 1 hour

    let rapidIterations = 0;
    const evidence: EvolutionPattern["evidence"] = [];

    for (let i = 1; i < recentEvents.length; i++) {
      const timeDiff =
        recentEvents[i].timestamp - recentEvents[i - 1].timestamp;

      if (timeDiff < timeWindow) {
        rapidIterations++;
        evidence.push({
          timestamp: recentEvents[i].timestamp,
          version: recentEvents[i].metadata.commit,
          description: `Change made ${Math.round(timeDiff / 60000)} minutes after previous`,
        });
      }
    }

    if (rapidIterations >= 3) {
      return {
        type: "iterative",
        confidence: Math.min(rapidIterations / 10, 1),
        description: `${rapidIterations} rapid iterations detected`,
        evidence,
      };
    }

    return null;
  }

  private detectBatchUpdates(
    events: EvolutionEvent[]
  ): EvolutionPattern | null {
    if (events.length < 3) return null;

    const authorEvents = new Map<string, EvolutionEvent[]>();

    for (const event of events) {
      const author = event.author;
      if (!authorEvents.has(author)) {
        authorEvents.set(author, []);
      }
      authorEvents.get(author)!.push(event);
    }

    for (const [author, authorEventList] of authorEvents) {
      if (authorEventList.length < 3) continue;

      // Check for clusters of events by same author
      const clusters = this.findEventClusters(authorEventList);

      if (clusters.length > 0) {
        const evidence = clusters.flatMap(c =>
          c.events.map(e => ({
            timestamp: e.timestamp,
            version: e.metadata.commit,
            description: `Part of batch update: ${c.events.length} changes`,
          }))
        );

        return {
          type: "experimental",
          confidence: 0.7,
          description: `${clusters.length} batch update(s) detected by ${author}`,
          evidence,
        };
      }
    }

    return null;
  }

  private findEventClusters(events: EvolutionEvent[]): EventCluster[] {
    const clusters: EventCluster[] = [];
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    let currentCluster: EvolutionEvent[] = [events[0]];

    for (let i = 1; i < events.length; i++) {
      const timeDiff = events[i].timestamp - events[i - 1].timestamp;

      if (timeDiff < timeWindow) {
        currentCluster.push(events[i]);
      } else {
        if (currentCluster.length >= 3) {
          clusters.push({ events: [...currentCluster] });
        }
        currentCluster = [events[i]];
      }
    }

    if (currentCluster.length >= 3) {
      clusters.push({ events: currentCluster });
    }

    return clusters;
  }
}

interface EventCluster {
  events: EvolutionEvent[];
}

export class TrendAnalyzer {
  /**
   * Analyze trends in version history
   */
  analyzeTrends(versions: UIVersion[]): EvolutionTrend[] {
    const trends: EvolutionTrend[] = [];

    // Component count trend
    const componentTrend = this.analyzeComponentCountTrend(versions);
    if (componentTrend) trends.push(componentTrend);

    // Change frequency trend
    const frequencyTrend = this.analyzeChangeFrequencyTrend(versions);
    if (frequencyTrend) trends.push(frequencyTrend);

    return trends;
  }

  private analyzeComponentCountTrend(
    versions: UIVersion[]
  ): EvolutionTrend | null {
    if (versions.length < 3) return null;

    const counts = versions.map(v => v.state.components.length);

    // Calculate trend direction
    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < counts.length; i++) {
      if (counts[i] > counts[i - 1]) increasing++;
      else if (counts[i] < counts[i - 1]) decreasing++;
    }

    const direction =
      increasing > decreasing
        ? "increasing"
        : decreasing > increasing
          ? "decreasing"
          : "stable";

    const magnitude = Math.abs(increasing - decreasing) / (counts.length - 1);

    return {
      metric: "component_count",
      direction,
      magnitude,
      confidence: magnitude,
    };
  }

  private analyzeChangeFrequencyTrend(
    versions: UIVersion[]
  ): EvolutionTrend | null {
    if (versions.length < 3) return null;

    const intervals: number[] = [];

    for (let i = 1; i < versions.length; i++) {
      intervals.push(versions[i].timestamp - versions[i - 1].timestamp);
    }

    // Calculate average interval trend
    let increasing = 0;
    let decreasing = 0;

    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i] > intervals[i - 1]) increasing++;
      else if (intervals[i] < intervals[i - 1]) decreasing++;
    }

    const direction =
      increasing > decreasing
        ? "increasing"
        : decreasing > increasing
          ? "decreasing"
          : "stable";

    const magnitude =
      Math.abs(increasing - decreasing) / (intervals.length - 1);

    return {
      metric: "change_frequency",
      direction,
      magnitude,
      confidence: magnitude,
    };
  }
}

export class InsightGenerator {
  /**
   * Generate insights from evolution data
   */
  generateInsights(
    versions: UIVersion[],
    patterns: EvolutionPattern[],
    trends: EvolutionTrend[]
  ): EvolutionInsight[] {
    const insights: EvolutionInsight[] = [];

    // Pattern-based insights
    for (const pattern of patterns) {
      insights.push({
        type: "pattern",
        severity: "info",
        message: `Detected ${pattern.type} pattern with ${pattern.confidence.toFixed(2)} confidence`,
        data: { pattern },
      });
    }

    // Trend-based insights
    for (const trend of trends) {
      if (trend.magnitude > 0.5) {
        const severity =
          trend.metric === "component_count" && trend.direction === "decreasing"
            ? "warning"
            : "info";

        insights.push({
          type: "trend",
          severity,
          message: `${trend.metric} is ${trend.direction} with magnitude ${trend.magnitude.toFixed(2)}`,
          data: { trend },
        });
      }
    }

    // Stability insight
    const stabilityInsight = this.generateStabilityInsight(versions);
    if (stabilityInsight) {
      insights.push(stabilityInsight);
    }

    return insights;
  }

  private generateStabilityInsight(
    versions: UIVersion[]
  ): EvolutionInsight | null {
    if (versions.length < 5) return null;

    const recentVersions = versions.slice(-10);
    const breakingChanges = recentVersions.filter(v =>
      v.changes.some(c => c.severity === "breaking")
    ).length;

    const ratio = breakingChanges / recentVersions.length;

    if (ratio > 0.3) {
      return {
        type: "anomaly",
        severity: "warning",
        message: `High rate of breaking changes: ${Math.round(ratio * 100)}% of recent versions`,
        data: { breakingChanges, totalVersions: recentVersions.length, ratio },
      };
    } else if (ratio === 0) {
      return {
        type: "recommendation",
        severity: "info",
        message:
          "Recent versions show good stability - no breaking changes detected",
        data: { breakingChanges: 0, totalVersions: recentVersions.length },
      };
    }

    return null;
  }
}
