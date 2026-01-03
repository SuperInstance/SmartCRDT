/**
 * PatternAnalyzer - Analyzes user interaction patterns
 */

import type {
  Interaction,
  Pattern,
  PatternType,
  PatternCluster,
  Outlier,
  PatternAnalysis,
  UIElement,
  AnalyzerConfig,
} from "../types.js";

export class PatternAnalyzer {
  private config: AnalyzerConfig;
  private patterns: Map<string, Pattern> = new Map();
  private clusters: Map<string, PatternCluster> = new Map();

  constructor(config: Partial<AnalyzerConfig> = {}) {
    this.config = {
      minPatternLength: config.minPatternLength ?? 2,
      maxPatternLength: config.maxPatternLength ?? 10,
      minFrequency: config.minFrequency ?? 2,
      minConfidence: config.minConfidence ?? 0.5,
      clusteringThreshold: config.clusteringThreshold ?? 0.7,
    };
  }

  /**
   * Analyze interactions to find patterns
   */
  analyze(interactions: Interaction[]): PatternAnalysis {
    const startTime = Date.now();

    // Find patterns
    const sequentialPatterns = this.findSequentialPatterns(interactions);
    const temporalPatterns = this.findTemporalPatterns(interactions);
    const spatialPatterns = this.findSpatialPatterns(interactions);
    const contextualPatterns = this.findContextualPatterns(interactions);

    const allPatterns = [
      ...sequentialPatterns,
      ...temporalPatterns,
      ...spatialPatterns,
      ...contextualPatterns,
    ];

    // Cluster patterns
    const clusters = this.clusterPatterns(allPatterns);

    // Find outliers
    const outliers = this.findOutliers(interactions, allPatterns);

    const metadata = {
      totalInteractions: interactions.length,
      totalPatterns: allPatterns.length,
      analysisDuration: Date.now() - startTime,
      timestamp: Date.now(),
    };

    // Update stored patterns
    for (const pattern of allPatterns) {
      this.patterns.set(pattern.id, pattern);
    }

    return {
      patterns: allPatterns,
      clusters,
      outliers,
      metadata,
    };
  }

  /**
   * Find sequential patterns (actions in sequence)
   */
  private findSequentialPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];
    const sequences = new Map<string, number>();

    // Extract sequences of actions
    for (
      let i = 0;
      i < interactions.length - this.config.minPatternLength;
      i++
    ) {
      for (
        let len = this.config.minPatternLength;
        len <= this.config.maxPatternLength;
        len++
      ) {
        if (i + len > interactions.length) break;

        const sequence = interactions.slice(i, i + len);
        const key = this.sequenceToKey(sequence);

        sequences.set(key, (sequences.get(key) ?? 0) + 1);
      }
    }

    // Convert frequent sequences to patterns
    for (const [key, frequency] of sequences.entries()) {
      if (frequency >= this.config.minFrequency) {
        const sequence = this.keyToSequence(key);
        const confidence = Math.min(frequency / interactions.length, 1);

        if (confidence >= this.config.minConfidence) {
          patterns.push({
            id: `sequential-${this.hash(key)}`,
            type: "sequential",
            elements: sequence.map(i => i.element),
            sequence: sequence.map(i => i.type),
            frequency,
            confidence,
            timestamp: Date.now(),
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Find temporal patterns (time-based patterns)
   */
  private findTemporalPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Group by hour of day
    const hourlyPatterns = new Map<number, Interaction[]>();
    for (const interaction of interactions) {
      const hour = new Date(interaction.timestamp).getHours();
      if (!hourlyPatterns.has(hour)) {
        hourlyPatterns.set(hour, []);
      }
      hourlyPatterns.get(hour)!.push(interaction);
    }

    // Find patterns in each time bucket
    for (const [hour, hourInteractions] of hourlyPatterns.entries()) {
      if (hourInteractions.length < this.config.minFrequency) continue;

      const commonElements = this.findCommonElements(hourInteractions);
      const confidence = Math.min(
        hourInteractions.length / interactions.length,
        1
      );

      if (
        confidence >= this.config.minConfidence &&
        commonElements.length > 0
      ) {
        patterns.push({
          id: `temporal-hour-${hour}`,
          type: "temporal",
          elements: commonElements,
          frequency: hourInteractions.length,
          confidence,
          timestamp: Date.now(),
          timespan: 3600000, // 1 hour
        });
      }
    }

    return patterns;
  }

  /**
   * Find spatial patterns (location-based patterns)
   */
  private findSpatialPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Group by screen regions
    const regions = new Map<string, Interaction[]>();
    const gridSize = 100; // pixels

    for (const interaction of interactions) {
      const regionX = Math.floor(interaction.position.x / gridSize);
      const regionY = Math.floor(interaction.position.y / gridSize);
      const regionKey = `${regionX},${regionY}`;

      if (!regions.has(regionKey)) {
        regions.set(regionKey, []);
      }
      regions.get(regionKey)!.push(interaction);
    }

    // Find patterns in each region
    for (const [region, regionInteractions] of regions.entries()) {
      if (regionInteractions.length < this.config.minFrequency) continue;

      const commonElements = this.findCommonElements(regionInteractions);
      const confidence = Math.min(
        regionInteractions.length / interactions.length,
        1
      );

      if (
        confidence >= this.config.minConfidence &&
        commonElements.length > 0
      ) {
        patterns.push({
          id: `spatial-region-${region}`,
          type: "spatial",
          elements: commonElements,
          frequency: regionInteractions.length,
          confidence,
          timestamp: Date.now(),
        });
      }
    }

    return patterns;
  }

  /**
   * Find contextual patterns (context-dependent patterns)
   */
  private findContextualPatterns(interactions: Interaction[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Group by page/URL
    const pagePatterns = new Map<string, Interaction[]>();
    for (const interaction of interactions) {
      const page = interaction.context.page;
      if (!pagePatterns.has(page)) {
        pagePatterns.set(page, []);
      }
      pagePatterns.get(page)!.push(interaction);
    }

    // Find patterns on each page
    for (const [page, pageInteractions] of pagePatterns.entries()) {
      if (pageInteractions.length < this.config.minFrequency) continue;

      const commonElements = this.findCommonElements(pageInteractions);
      const confidence = Math.min(
        pageInteractions.length / interactions.length,
        1
      );

      if (
        confidence >= this.config.minConfidence &&
        commonElements.length > 0
      ) {
        patterns.push({
          id: `contextual-page-${this.hash(page)}`,
          type: "contextual",
          elements: commonElements,
          frequency: pageInteractions.length,
          confidence,
          timestamp: Date.now(),
        });
      }
    }

    return patterns;
  }

  /**
   * Find common elements in a set of interactions
   */
  private findCommonElements(interactions: Interaction[]): UIElement[] {
    const elementCounts = new Map<
      string,
      { element: UIElement; count: number }
    >();

    for (const interaction of interactions) {
      const id = interaction.element.id;
      const existing = elementCounts.get(id);
      if (existing) {
        existing.count++;
      } else {
        elementCounts.set(id, { element: interaction.element, count: 1 });
      }
    }

    // Return elements that appear in at least 20% of interactions
    const threshold = Math.max(1, Math.floor(interactions.length * 0.2));
    const common: UIElement[] = [];

    for (const { element, count } of elementCounts.values()) {
      if (count >= threshold) {
        common.push(element);
      }
    }

    return common;
  }

  /**
   * Cluster similar patterns
   */
  private clusterPatterns(patterns: Pattern[]): PatternCluster[] {
    const clusters: PatternCluster[] = [];
    const assigned = new Set<string>();

    for (const pattern of patterns) {
      if (assigned.has(pattern.id)) continue;

      const similar = this.findSimilarPatterns(pattern, patterns);
      if (similar.length > 0) {
        const clusterId = `cluster-${clusters.length}`;
        const cluster: PatternCluster = {
          id: clusterId,
          patterns: [pattern, ...similar],
          centroid: pattern,
          similarity: this.calculateClusterSimilarity([pattern, ...similar]),
        };

        clusters.push(cluster);
        similar.forEach(p => assigned.add(p.id));
        assigned.add(pattern.id);
      }
    }

    return clusters;
  }

  /**
   * Find patterns similar to a given pattern
   */
  private findSimilarPatterns(
    pattern: Pattern,
    allPatterns: Pattern[]
  ): Pattern[] {
    const similar: Pattern[] = [];

    for (const other of allPatterns) {
      if (other.id === pattern.id) continue;

      const similarity = this.calculatePatternSimilarity(pattern, other);
      if (similarity >= this.config.clusteringThreshold) {
        similar.push(other);
      }
    }

    return similar;
  }

  /**
   * Calculate similarity between two patterns
   */
  private calculatePatternSimilarity(p1: Pattern, p2: Pattern): number {
    if (p1.type !== p2.type) return 0;

    // Jaccard similarity of elements
    const set1 = new Set(p1.elements.map(e => e.id));
    const set2 = new Set(p2.elements.map(e => e.id));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate cluster similarity
   */
  private calculateClusterSimilarity(patterns: Pattern[]): number {
    if (patterns.length <= 1) return 1;

    let totalSimilarity = 0;
    let count = 0;

    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        totalSimilarity += this.calculatePatternSimilarity(
          patterns[i]!,
          patterns[j]!
        );
        count++;
      }
    }

    return count > 0 ? totalSimilarity / count : 1;
  }

  /**
   * Find outlier interactions
   */
  private findOutliers(
    interactions: Interaction[],
    patterns: Pattern[]
  ): Outlier[] {
    const outliers: Outlier[] = [];
    const patternElements = new Set<string>();

    for (const pattern of patterns) {
      for (const element of pattern.elements) {
        patternElements.add(element.id);
      }
    }

    for (const interaction of interactions) {
      if (!patternElements.has(interaction.element.id)) {
        outliers.push({
          interaction,
          score: 1,
          reason: "Element not in any common pattern",
        });
      }
    }

    return outliers;
  }

  /**
   * Convert sequence to key for Map
   */
  private sequenceToKey(sequence: Interaction[]): string {
    return sequence.map(i => `${i.type}:${i.element.id}`).join("->");
  }

  /**
   * Convert key back to sequence
   */
  private keyToSequence(key: string): Interaction[] {
    const parts = key.split("->");
    return parts.map(part => {
      const [type, elementId] = part.split(":");
      return {
        type: type as any,
        element: {
          id: elementId,
          type: "",
          position: { x: 0, y: 0, width: 0, height: 0 },
        },
        timestamp: 0,
        position: { x: 0, y: 0 },
        context: { page: "", viewport: { width: 0, height: 0 }, timestamp: 0 },
      };
    });
  }

  /**
   * Hash a string
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get all stored patterns
   */
  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: PatternType): Pattern[] {
    return this.getPatterns().filter(p => p.type === type);
  }

  /**
   * Get all clusters
   */
  getClusters(): PatternCluster[] {
    return Array.from(this.clusters.values());
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
    this.clusters.clear();
  }
}
