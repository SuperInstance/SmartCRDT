/**
 * BehaviorProfiler - Build behavior profiles and detect deviations
 *
 * This component learns normal behavior patterns for users, services, and
 * systems, then detects deviations that may indicate security incidents
 * or privacy violations.
 *
 * Features:
 * - Profile creation and management
 * - Learning from access events
 * - Pattern recognition and clustering
 * - Anomaly scoring with adaptive thresholds
 * - Profile similarity analysis
 * - Automatic baseline updates
 * - Time-based forgetting
 *
 * @packageDocumentation
 */

import { randomBytes } from "crypto";

/**
 * Access pattern for behavior profiling
 */
export interface AccessPattern {
  /** Resource type (e.g., 'database', 'api', 'file') */
  resource_type: string;
  /** Access frequency (accesses per hour) */
  frequency: number;
  /** Average data volume per access (bytes) */
  avg_volume: number;
  /** Typical hours when accessed (0-23) */
  typical_hours: number[];
  /** Typical locations/IPs */
  typical_locations: string[];
  /** Resources commonly accessed together */
  co_accessed_resources: string[];
}

/**
 * Temporal pattern for behavior profiling
 */
export interface TemporalPattern {
  /** Hour of day (0-23) */
  hour: number;
  /** Activity level (0-1) */
  activity_level: number;
  /** Day of week (0-6) */
  day_of_week: number;
  /** Typical access types for this time */
  access_types: string[];
}

/**
 * Volume pattern for behavior profiling
 */
export interface VolumePattern {
  /** Minimum volume */
  min: number;
  /** Maximum volume */
  max: number;
  /** Mean volume */
  mean: number;
  /** Standard deviation */
  std_dev: number;
  /** Percentile (50th, 95th, 99th) */
  percentiles: { p50: number; p95: number; p99: number };
}

/**
 * Baseline metrics for behavior profile
 */
export interface BaselineMetrics {
  /** Number of samples in baseline */
  sample_count: number;
  /** When baseline was created */
  created_at: Date;
  /** When baseline was last updated */
  updated_at: Date;
  /** Access frequency per hour */
  access_frequency: number;
  /** Volume statistics */
  volume_stats: VolumePattern;
  /** Record count statistics */
  record_stats: VolumePattern;
  /** Session duration statistics (ms) */
  session_duration: VolumePattern;
  /** Error rate (0-1) */
  error_rate: number;
}

/**
 * Sequence score for event sequences
 */
export interface SequenceScore {
  /** Overall anomaly score (0-1) */
  score: number;
  /** Individual event scores */
  event_scores: number[];
  /** Pattern matches */
  pattern_matches: string[];
  /** Confidence in score */
  confidence: number;
  /** Whether sequence is anomalous */
  is_anomalous: boolean;
}

/**
 * Access event for profiling
 */
export interface AccessEvent {
  /** Unique event identifier */
  id: string;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Entity performing the access */
  entity_id: string;
  /** Entity type */
  entity_type: "user" | "service" | "system";
  /** Resource being accessed */
  resource_id: string;
  /** Resource type */
  resource_type: string;
  /** Access type */
  access_type: "read" | "write" | "delete" | "admin";
  /** Whether access was granted */
  granted: boolean;
  /** Data volume accessed (bytes) */
  data_volume: number;
  /** Number of records accessed */
  record_count: number;
  /** IP address or location */
  location: string;
  /** Session identifier */
  session_id: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Access event sequence
 */
export interface AccessEventSequence {
  /** Events in sequence */
  events: AccessEvent[];
  /** Sequence identifier */
  sequence_id: string;
  /** Sequence start time */
  start_time: Date;
  /** Sequence end time */
  end_time: Date;
}

/**
 * Behavior profile
 */
export interface BehaviorProfile {
  /** Entity identifier */
  entity_id: string;
  /** Entity type */
  entity_type: "user" | "service" | "system";
  /** When profile was created */
  created_at: Date;
  /** When profile was last updated */
  updated_at: Date;
  /** Access patterns */
  access_patterns: AccessPattern[];
  /** Temporal patterns */
  temporal_patterns: TemporalPattern[];
  /** Volume patterns (single aggregated pattern) */
  volume_patterns: VolumePattern;
  /** Baseline metrics */
  baseline_metrics: BaselineMetrics;
  /** Anomaly threshold (0-1) */
  anomaly_threshold: number;
  /** Risk score (0-1) */
  risk_score: number;
  /** Number of anomalies detected */
  anomaly_count: number;
  /** Profile version (for updates) */
  version: number;
}

/**
 * Profile cluster
 */
export interface ProfileCluster {
  /** Cluster identifier */
  id: string;
  /** Profiles in cluster */
  profiles: BehaviorProfile[];
  /** Cluster centroid (average profile) */
  centroid: Partial<BehaviorProfile>;
  /** Cluster label */
  label: string;
  /** Average intra-cluster distance */
  cohesion: number;
}

/**
 * Profile type classification
 */
export type ProfileType =
  | "regular_user"
  | "power_user"
  | "admin_user"
  | "automated_service"
  | "background_service"
  | "external_service"
  | "unknown";

/**
 * Anomaly score
 */
export interface AnomalyScore {
  /** Overall score (0-1, higher = more anomalous) */
  score: number;
  /** Component scores */
  components: {
    temporal: number;
    volume: number;
    resource: number;
    location: number;
    sequence: number;
  };
  /** Confidence in the score */
  confidence: number;
  /** Whether score exceeds threshold */
  is_anomalous: boolean;
  /** Reason for anomaly */
  reasons: string[];
}

/**
 * Duration for time-based operations
 */
export interface Duration {
  /** Magnitude */
  value: number;
  /** Unit */
  unit: "milliseconds" | "seconds" | "minutes" | "hours" | "days";
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  /** Minimum samples for valid baseline */
  min_baseline_samples?: number;
  /** Maximum age of events to consider (ms) */
  max_event_age?: number;
  /** Learning rate for baseline updates (0-1) */
  learning_rate?: number;
  /** Default anomaly threshold (0-1) */
  default_threshold?: number;
  /** Enable automatic threshold adjustment */
  adaptive_threshold?: boolean;
  /** Number of clusters for profile grouping */
  cluster_count?: number;
  /** Minimum similarity for clustering (0-1) */
  min_cluster_similarity?: number;
  /** Retention period for old behavior (ms) */
  retention_period?: number;
  /** Forgetting factor for old behavior (0-1) */
  forgetting_factor?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ProfilerConfig> = {
  min_baseline_samples: 50,
  max_event_age: 30 * 24 * 60 * 60 * 1000, // 30 days
  learning_rate: 0.1,
  default_threshold: 0.7,
  adaptive_threshold: true,
  cluster_count: 5,
  min_cluster_similarity: 0.7,
  retention_period: 90 * 24 * 60 * 60 * 1000, // 90 days
  forgetting_factor: 0.05,
};

/**
 * BehaviorProfiler - Learn and profile entity behavior
 *
 * The profiler builds behavioral profiles from access events, enabling
 * detection of deviations that may indicate security incidents or privacy
 * violations.
 */
export class BehaviorProfiler {
  private config: Required<ProfilerConfig>;
  private profiles: Map<string, BehaviorProfile>;
  private eventHistory: Map<string, AccessEvent[]>;
  private clusters: ProfileCluster[];

  constructor(config: ProfilerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profiles = new Map();
    this.eventHistory = new Map();
    this.clusters = [];
  }

  /**
   * Create a new behavior profile
   *
   * @param entity_id - Entity identifier
   * @returns New behavior profile
   */
  create_profile(entity_id: string): BehaviorProfile {
    const now = new Date();

    const profile: BehaviorProfile = {
      entity_id,
      entity_type: "user", // Will be updated as we learn
      created_at: now,
      updated_at: now,
      access_patterns: [],
      temporal_patterns: this.createDefaultTemporalPatterns(),
      volume_patterns: this.createDefaultVolumePatterns(),
      baseline_metrics: {
        sample_count: 0,
        created_at: now,
        updated_at: now,
        access_frequency: 0,
        volume_stats: this.createDefaultVolumePatterns(),
        record_stats: this.createDefaultVolumePatterns(),
        session_duration: this.createDefaultVolumePatterns(),
        error_rate: 0,
      },
      anomaly_threshold: this.config.default_threshold,
      risk_score: 0,
      anomaly_count: 0,
      version: 1,
    };

    this.profiles.set(entity_id, profile);
    return profile;
  }

  /**
   * Get profile for entity
   *
   * @param entity_id - Entity identifier
   * @returns Behavior profile or undefined
   */
  get_profile(entity_id: string): BehaviorProfile | undefined {
    return this.profiles.get(entity_id);
  }

  /**
   * Update profile with new events
   *
   * @param entity_id - Entity identifier
   * @param events - New access events
   * @returns Updated profile
   */
  update_profile(entity_id: string, events: AccessEvent[]): BehaviorProfile {
    let profile = this.profiles.get(entity_id);

    if (!profile) {
      profile = this.create_profile(entity_id);
    }

    // Get existing event history
    const history = this.eventHistory.get(entity_id) || [];
    const allEvents = [...history, ...events];

    // Filter by max age
    const now = Date.now();
    const filteredEvents = allEvents.filter(
      e => now - e.timestamp.getTime() < this.config.max_event_age
    );

    // Update event history
    this.eventHistory.set(entity_id, filteredEvents);

    // Learn from events
    this.learn_from_events(profile, events);

    // Update profile metadata
    profile.updated_at = new Date();
    profile.version++;

    // Update threshold if adaptive
    if (this.config.adaptive_threshold) {
      this.adjust_threshold(profile);
    }

    return profile;
  }

  /**
   * Delete profile for entity
   *
   * @param entity_id - Entity identifier
   */
  delete_profile(entity_id: string): void {
    this.profiles.delete(entity_id);
    this.eventHistory.delete(entity_id);
  }

  /**
   * Learn from access events
   *
   * @param profile - Profile to update
   * @param events - Events to learn from
   */
  learn_from_events(profile: BehaviorProfile, events: AccessEvent[]): void {
    if (events.length === 0) return;

    // Detect entity type
    profile.entity_type = this.detect_entity_type(events);

    // Update access patterns
    this.update_access_patterns(profile, events);

    // Update temporal patterns
    this.update_temporal_patterns(profile, events);

    // Update volume patterns
    this.update_volume_patterns(profile, events);

    // Update baseline metrics
    this.update_baseline_metrics(profile, events);

    // Calculate risk score
    profile.risk_score = this.calculate_risk_score(profile);
  }

  /**
   * Learn a specific access pattern
   *
   * @param profile - Profile to update
   * @param pattern - Pattern to learn
   */
  learn_pattern(profile: BehaviorProfile, pattern: AccessPattern): void {
    // Check if pattern already exists
    const existing = profile.access_patterns.find(
      p => p.resource_type === pattern.resource_type
    );

    if (existing) {
      // Update existing pattern with learning rate
      const lr = this.config.learning_rate;
      existing.frequency =
        existing.frequency * (1 - lr) + pattern.frequency * lr;
      existing.avg_volume =
        existing.avg_volume * (1 - lr) + pattern.avg_volume * lr;
      existing.typical_hours = pattern.typical_hours;
      existing.typical_locations = pattern.typical_locations;
      existing.co_accessed_resources = pattern.co_accessed_resources;
    } else {
      // Add new pattern
      profile.access_patterns.push({ ...pattern });
    }
  }

  /**
   * Forget old behavior
   *
   * Reduces influence of old behavior patterns over time.
   *
   * @param profile - Profile to update
   * @param retention_period - How long to keep behavior
   */
  forget_old_behavior(
    profile: BehaviorProfile,
    retention_period: Duration
  ): void {
    const now = Date.now();
    const retentionMs =
      retention_period.value *
      (retention_period.unit === "milliseconds"
        ? 1
        : retention_period.unit === "seconds"
          ? 1000
          : retention_period.unit === "minutes"
            ? 60000
            : retention_period.unit === "hours"
              ? 3600000
              : 86400000);

    // Filter event history
    const history = this.eventHistory.get(profile.entity_id) || [];
    const recentEvents = history.filter(
      e => now - e.timestamp.getTime() < retentionMs
    );

    this.eventHistory.set(profile.entity_id, recentEvents);

    // Decay patterns
    const decayFactor = 1 - this.config.forgetting_factor;
    for (const pattern of profile.access_patterns) {
      pattern.frequency *= decayFactor;
    }

    // Remove patterns with very low frequency
    profile.access_patterns = profile.access_patterns.filter(
      p => p.frequency > 0.01
    );

    profile.updated_at = new Date();
    profile.version++;
  }

  /**
   * Score anomaly for single event
   *
   * @param profile - Behavior profile
   * @param event - Event to score
   * @returns Anomaly score
   */
  score_anomaly(profile: BehaviorProfile, event: AccessEvent): AnomalyScore {
    const reasons: string[] = [];

    // Temporal component
    const temporalScore = this.score_temporal_anomaly(profile, event, reasons);

    // Volume component
    const volumeScore = this.score_volume_anomaly(profile, event, reasons);

    // Resource component
    const resourceScore = this.score_resource_anomaly(profile, event, reasons);

    // Location component
    const locationScore = this.score_location_anomaly(profile, event, reasons);

    // Sequence component (not applicable for single event)
    const sequenceScore = 0;

    // Overall score (weighted average)
    const overallScore =
      temporalScore * 0.25 +
      volumeScore * 0.35 +
      resourceScore * 0.25 +
      locationScore * 0.15;

    // Confidence based on sample count
    const confidence = Math.min(
      1,
      profile.baseline_metrics.sample_count / this.config.min_baseline_samples
    );

    return {
      score: overallScore,
      components: {
        temporal: temporalScore,
        volume: volumeScore,
        resource: resourceScore,
        location: locationScore,
        sequence: sequenceScore,
      },
      confidence,
      is_anomalous: overallScore > profile.anomaly_threshold,
      reasons,
    };
  }

  /**
   * Score anomaly for event sequence
   *
   * @param profile - Behavior profile
   * @param events - Event sequence to score
   * @returns Sequence score
   */
  score_sequence(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): SequenceScore {
    if (events.length === 0) {
      return {
        score: 0,
        event_scores: [],
        pattern_matches: [],
        confidence: 0,
        is_anomalous: false,
      };
    }

    // Score each event individually
    const eventScores = events.map(e => this.score_anomaly(profile, e).score);

    // Detect patterns in sequence
    const patternMatches = this.detect_sequence_patterns(profile, events);

    // Calculate sequence-level anomalies
    const avgScore =
      eventScores.reduce((sum, s) => sum + s, 0) / eventScores.length;
    const maxScore = Math.max(...eventScores);
    const scoreVariance =
      eventScores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
      eventScores.length;

    // Anomaly if: high average score OR very high max score OR high variance
    const sequenceScore = Math.max(avgScore, maxScore * 0.7, scoreVariance * 2);

    // Confidence based on sample count
    const confidence = Math.min(
      1,
      profile.baseline_metrics.sample_count / this.config.min_baseline_samples
    );

    return {
      score: Math.min(1, sequenceScore),
      event_scores: eventScores,
      pattern_matches: patternMatches,
      confidence,
      is_anomalous: sequenceScore > profile.anomaly_threshold,
    };
  }

  /**
   * Get anomaly threshold for profile
   *
   * @param profile - Behavior profile
   * @returns Anomaly threshold
   */
  get_anomaly_threshold(profile: BehaviorProfile): number {
    return profile.anomaly_threshold;
  }

  /**
   * Cluster profiles by similarity
   *
   * @param profiles - Profiles to cluster
   * @returns Profile clusters
   */
  cluster_profiles(profiles: BehaviorProfile[]): ProfileCluster[] {
    if (profiles.length === 0) {
      return [];
    }

    // Simple clustering using k-means-like approach
    const k = Math.min(this.config.cluster_count, profiles.length);
    const clusters: ProfileCluster[] = [];

    // Initialize with random profiles as centroids
    const shuffled = [...profiles].sort(() => Math.random() - 0.5);
    const centroids = shuffled.slice(0, k);

    for (let i = 0; i < k; i++) {
      clusters.push({
        id: `cluster_${i}`,
        profiles: [],
        centroid: centroids[i],
        label: this.classify_profile(centroids[i]),
        cohesion: 0,
      });
    }

    // Assign profiles to nearest centroid
    let maxIterations = 10;
    for (let iter = 0; iter < maxIterations; iter++) {
      // Clear assignments
      for (const cluster of clusters) {
        cluster.profiles = [];
      }

      // Assign each profile
      for (const profile of profiles) {
        let minDist = Infinity;
        let nearestCluster = clusters[0];

        for (const cluster of clusters) {
          const dist = this.profile_distance(
            profile,
            cluster.centroid as BehaviorProfile
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = cluster;
          }
        }

        nearestCluster.profiles.push(profile);
      }

      // Update centroids
      for (const cluster of clusters) {
        if (cluster.profiles.length > 0) {
          cluster.centroid = this.average_profile(cluster.profiles);
          cluster.label = this.classify_profile(
            cluster.centroid as BehaviorProfile
          );
        }
      }
    }

    // Calculate cohesion
    for (const cluster of clusters) {
      if (cluster.profiles.length <= 1) {
        cluster.cohesion = 1;
        continue;
      }

      let totalDist = 0;
      let count = 0;

      for (const profile of cluster.profiles) {
        totalDist += this.profile_distance(
          profile,
          cluster.centroid as BehaviorProfile
        );
        count++;
      }

      cluster.cohesion = count > 0 ? 1 - totalDist / count : 0;
    }

    this.clusters = clusters;
    return clusters;
  }

  /**
   * Find profiles similar to given profile
   *
   * @param profile - Profile to compare
   * @param max_distance - Maximum distance threshold
   * @returns Similar profiles
   */
  find_similar_profiles(
    profile: BehaviorProfile,
    max_distance: number
  ): BehaviorProfile[] {
    const similar: BehaviorProfile[] = [];

    for (const [entity_id, other_profile] of this.profiles) {
      if (entity_id === profile.entity_id) continue;

      const dist = this.profile_distance(profile, other_profile);
      if (dist <= max_distance) {
        similar.push(other_profile);
      }
    }

    return similar.sort(
      (a, b) =>
        this.profile_distance(profile, a) - this.profile_distance(profile, b)
    );
  }

  /**
   * Classify profile type
   *
   * @param profile - Profile to classify
   * @returns Profile type
   */
  classify_profile(profile: BehaviorProfile): ProfileType {
    // Heuristics for classification
    const { access_patterns, temporal_patterns, baseline_metrics } = profile;
    const { sample_count, access_frequency } = baseline_metrics;

    if (sample_count < this.config.min_baseline_samples) {
      return "unknown";
    }

    // Check for automated patterns
    const hasRegularTemporal = temporal_patterns.some(
      tp => tp.activity_level > 0.8 && tp.access_types.length === 1
    );

    if (hasRegularTemporal && access_frequency > 100) {
      return "automated_service";
    }

    // Check for background service
    if (access_frequency > 1000) {
      return "background_service";
    }

    // Check for admin behavior
    const hasAdminAccess = access_patterns.some(
      ap => ap.resource_type === "admin" || ap.resource_type === "system"
    );

    if (hasAdminAccess) {
      return "admin_user";
    }

    // Check for power user
    if (access_frequency > 50 && access_patterns.length > 5) {
      return "power_user";
    }

    // Check for external service
    const hasExternalAccess = access_patterns.some(ap =>
      ap.typical_locations.some(
        loc => loc.startsWith("external") || loc.includes("remote")
      )
    );

    if (hasExternalAccess) {
      return "external_service";
    }

    return "regular_user";
  }

  /**
   * Get all profiles
   *
   * @returns All behavior profiles
   */
  get_all_profiles(): BehaviorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile clusters
   *
   * @returns Current profile clusters
   */
  get_clusters(): ProfileCluster[] {
    return this.clusters;
  }

  /**
   * Clear all profiles
   */
  clear_profiles(): void {
    this.profiles.clear();
    this.eventHistory.clear();
    this.clusters = [];
  }

  // Private helper methods

  private createDefaultTemporalPatterns(): TemporalPattern[] {
    const patterns: TemporalPattern[] = [];
    for (let hour = 0; hour < 24; hour++) {
      patterns.push({
        hour,
        activity_level: 0,
        day_of_week: 0,
        access_types: [],
      });
    }
    return patterns;
  }

  private createDefaultVolumePatterns(): VolumePattern {
    return {
      min: 0,
      max: 0,
      mean: 0,
      std_dev: 0,
      percentiles: { p50: 0, p95: 0, p99: 0 },
    };
  }

  private detect_entity_type(
    events: AccessEvent[]
  ): "user" | "service" | "system" {
    // Check for service/system indicators
    const hasServiceId = events.some(
      e => e.entity_id.includes("service") || e.entity_id.includes("system")
    );
    const hasSystemAccess = events.some(e => e.access_type === "admin");

    if (hasServiceId || hasSystemAccess) {
      return "service";
    }

    // Check for user-like patterns
    const hasVariableTiming = this.hasVariableTiming(events);
    if (hasVariableTiming) {
      return "user";
    }

    return "user";
  }

  private hasVariableTiming(events: AccessEvent[]): boolean {
    if (events.length < 10) return false;

    const hours = events.map(e => e.timestamp.getHours());
    const uniqueHours = new Set(hours);
    return uniqueHours.size > 3;
  }

  private update_access_patterns(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): void {
    // Group by resource type
    const byResource = new Map<string, AccessEvent[]>();
    for (const event of events) {
      if (!byResource.has(event.resource_type)) {
        byResource.set(event.resource_type, []);
      }
      byResource.get(event.resource_type)!.push(event);
    }

    // Update or create patterns
    for (const [resourceType, resourceEvents] of byResource) {
      const timeSpan =
        Math.max(...resourceEvents.map(e => e.timestamp.getTime())) -
        Math.min(...resourceEvents.map(e => e.timestamp.getTime()));
      const hours = Math.max(1, timeSpan / (1000 * 60 * 60));

      const pattern: AccessPattern = {
        resource_type: resourceType,
        frequency: resourceEvents.length / hours,
        avg_volume:
          resourceEvents.reduce((sum, e) => sum + e.data_volume, 0) /
          resourceEvents.length,
        typical_hours: this.get_typical_hours(resourceEvents),
        typical_locations: this.get_typical_locations(resourceEvents),
        co_accessed_resources: this.get_co_accessed_resources(
          resourceEvents,
          events
        ),
      };

      this.learn_pattern(profile, pattern);
    }
  }

  private update_temporal_patterns(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): void {
    const hourCounts = new Map<number, number>();

    for (const event of events) {
      const hour = event.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    const maxCount = Math.max(...hourCounts.values(), 1);

    for (const pattern of profile.temporal_patterns) {
      const count = hourCounts.get(pattern.hour) || 0;
      pattern.activity_level = count / maxCount;
      pattern.access_types = [
        ...new Set(
          events
            .filter(e => e.timestamp.getHours() === pattern.hour)
            .map(e => e.access_type)
        ),
      ];
    }
  }

  private update_volume_patterns(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): void {
    const volumes = events.map(e => e.data_volume);
    profile.volume_patterns = this.calculate_volume_stats(volumes);
  }

  private update_baseline_metrics(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): void {
    const history = this.eventHistory.get(profile.entity_id) || [];
    const allEvents = [...history, ...events];

    const metrics = profile.baseline_metrics;
    metrics.sample_count = allEvents.length;
    metrics.updated_at = new Date();

    // Access frequency
    const timeSpan =
      Math.max(...allEvents.map(e => e.timestamp.getTime())) -
      Math.min(...allEvents.map(e => e.timestamp.getTime()));
    const hours = Math.max(1, timeSpan / (1000 * 60 * 60));
    metrics.access_frequency = allEvents.length / hours;

    // Volume stats
    metrics.volume_stats = profile.volume_patterns;

    // Record stats
    const records = allEvents.map(e => e.record_count);
    metrics.record_stats = this.calculate_volume_stats(records);

    // Session duration (approximated)
    const sessions = this.group_by_session(allEvents);
    const durations = sessions.map(
      s => s[s.length - 1].timestamp.getTime() - s[0].timestamp.getTime()
    );
    metrics.session_duration = this.calculate_volume_stats(durations);

    // Error rate
    const errors = allEvents.filter(e => !e.granted).length;
    metrics.error_rate = errors / allEvents.length;
  }

  private calculate_volume_stats(values: number[]): VolumePattern {
    if (values.length === 0) {
      return this.createDefaultVolumePatterns();
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const variance =
      sorted.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / sorted.length;
    const std_dev = Math.sqrt(variance);

    return {
      min,
      max,
      mean,
      std_dev,
      percentiles: {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      },
    };
  }

  private get_typical_hours(events: AccessEvent[]): number[] {
    const hourCounts = new Map<number, number>();
    for (const event of events) {
      hourCounts.set(
        event.timestamp.getHours(),
        (hourCounts.get(event.timestamp.getHours()) || 0) + 1
      );
    }

    const maxCount = Math.max(...hourCounts.values(), 1);
    return Array.from(hourCounts.entries())
      .filter(([_, count]) => count >= maxCount * 0.3)
      .map(([hour, _]) => hour);
  }

  private get_typical_locations(events: AccessEvent[]): string[] {
    const locationCounts = new Map<string, number>();
    for (const event of events) {
      locationCounts.set(
        event.location,
        (locationCounts.get(event.location) || 0) + 1
      );
    }

    const maxCount = Math.max(...locationCounts.values(), 1);
    return Array.from(locationCounts.entries())
      .filter(([_, count]) => count >= maxCount * 0.2)
      .map(([location, _]) => location);
  }

  private get_co_accessed_resources(
    resourceEvents: AccessEvent[],
    allEvents: AccessEvent[]
  ): string[] {
    const resourceTimes = new Map<string, number[]>();

    for (const event of resourceEvents) {
      const windowStart = event.timestamp.getTime() - 60000; // 1 minute before
      const windowEnd = event.timestamp.getTime() + 60000; // 1 minute after

      const coAccessed = allEvents
        .filter(
          e =>
            e.resource_id !== event.resource_id &&
            e.timestamp.getTime() >= windowStart &&
            e.timestamp.getTime() <= windowEnd
        )
        .map(e => e.resource_type);

      for (const resource of coAccessed) {
        if (!resourceTimes.has(resource)) {
          resourceTimes.set(resource, []);
        }
        resourceTimes.get(resource)!.push(event.timestamp.getTime());
      }
    }

    return Array.from(resourceTimes.entries())
      .filter(([_, times]) => times.length >= resourceEvents.length * 0.3)
      .map(([resource, _]) => resource);
  }

  private group_by_session(events: AccessEvent[]): AccessEvent[][] {
    const sessions = new Map<string, AccessEvent[]>();

    for (const event of events) {
      if (!sessions.has(event.session_id)) {
        sessions.set(event.session_id, []);
      }
      sessions.get(event.session_id)!.push(event);
    }

    return Array.from(sessions.values());
  }

  private calculate_risk_score(profile: BehaviorProfile): number {
    let risk = 0;

    // Risk factors
    const hasHighVolumeAccess = profile.volume_patterns.mean > 10000000; // 10MB
    const hasHighErrorRate = profile.baseline_metrics.error_rate > 0.1;
    const hasMassAccess = profile.baseline_metrics.access_frequency > 1000;
    const hasAnomalousCount = profile.anomaly_count > 10;

    if (hasHighVolumeAccess) risk += 0.2;
    if (hasHighErrorRate) risk += 0.3;
    if (hasMassAccess) risk += 0.2;
    if (hasAnomalousCount) risk += 0.3;

    return Math.min(1, risk);
  }

  private adjust_threshold(profile: BehaviorProfile): void {
    // Adjust threshold based on false positive rate
    const targetFPRate = 0.05;
    const currentFPRate =
      profile.anomaly_count > 0
        ? profile.anomaly_count / profile.baseline_metrics.sample_count
        : 0;

    if (currentFPRate > targetFPRate * 2) {
      // Too many false positives, increase threshold
      profile.anomaly_threshold = Math.min(
        0.95,
        profile.anomaly_threshold + 0.05
      );
    } else if (
      currentFPRate < targetFPRate / 2 &&
      profile.anomaly_threshold > 0.5
    ) {
      // Too few detections, decrease threshold
      profile.anomaly_threshold = Math.max(
        0.5,
        profile.anomaly_threshold - 0.05
      );
    }
  }

  private score_temporal_anomaly(
    profile: BehaviorProfile,
    event: AccessEvent,
    reasons: string[]
  ): number {
    const hour = event.timestamp.getHours();
    const pattern = profile.temporal_patterns.find(p => p.hour === hour);

    if (!pattern) {
      return 0.5; // Unknown hour
    }

    const activityLevel = pattern.activity_level;

    if (activityLevel < 0.1) {
      reasons.push(`Access at unusual hour (${hour}:00)`);
      return 0.8;
    }

    return 1 - activityLevel;
  }

  private score_volume_anomaly(
    profile: BehaviorProfile,
    event: AccessEvent,
    reasons: string[]
  ): number {
    const { mean, std_dev } = profile.volume_patterns;

    if (std_dev === 0) {
      return 0;
    }

    const zScore = Math.abs((event.data_volume - mean) / std_dev);

    if (zScore > 3) {
      reasons.push(
        `Unusual data volume (${event.data_volume} bytes, expected ~${mean.toFixed(0)})`
      );
      return Math.min(1, zScore / 5);
    }

    return Math.min(1, zScore / 3);
  }

  private score_resource_anomaly(
    profile: BehaviorProfile,
    event: AccessEvent,
    reasons: string[]
  ): number {
    const pattern = profile.access_patterns.find(
      p => p.resource_type === event.resource_type
    );

    if (!pattern) {
      reasons.push(
        `First-time access to resource type: ${event.resource_type}`
      );
      return 0.6;
    }

    return 0; // Known resource type
  }

  private score_location_anomaly(
    profile: BehaviorProfile,
    event: AccessEvent,
    reasons: string[]
  ): number {
    const pattern = profile.access_patterns.find(p =>
      p.typical_locations.includes(event.location)
    );

    if (!pattern) {
      reasons.push(`Access from unusual location: ${event.location}`);
      return 0.4;
    }

    return 0;
  }

  private detect_sequence_patterns(
    profile: BehaviorProfile,
    events: AccessEvent[]
  ): string[] {
    const patterns: string[] = [];

    // Check for rapid sequential access
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(
        events[i].timestamp.getTime() - events[i - 1].timestamp.getTime()
      );
    }

    const avgInterval =
      intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    if (avgInterval < 1000) {
      patterns.push("rapid_sequential_access");
    }

    // Check for resource hopping
    const uniqueResources = new Set(events.map(e => e.resource_id));
    if (uniqueResources.size > events.length * 0.8) {
      patterns.push("resource_hopping");
    }

    // Check for escalating privileges
    const accessTypes = events.map(e => e.access_type);
    if (
      accessTypes.includes("admin") &&
      !accessTypes.every(t => t === "admin")
    ) {
      patterns.push("privilege_escalation");
    }

    return patterns;
  }

  private profile_distance(p1: BehaviorProfile, p2: BehaviorProfile): number {
    // Simple distance based on access patterns
    const p1Resources = new Set(p1.access_patterns.map(p => p.resource_type));
    const p2Resources = new Set(p2.access_patterns.map(p => p.resource_type));

    const intersection = new Set(
      [...p1Resources].filter(r => p2Resources.has(r))
    );
    const union = new Set([...p1Resources, ...p2Resources]);

    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    return 1 - jaccard;
  }

  private average_profile(
    profiles: BehaviorProfile[]
  ): Partial<BehaviorProfile> {
    if (profiles.length === 0) {
      return {};
    }

    // Average volume patterns
    const avgVolume = {
      min:
        profiles.reduce((sum, p) => sum + p.volume_patterns.min, 0) /
        profiles.length,
      max:
        profiles.reduce((sum, p) => sum + p.volume_patterns.max, 0) /
        profiles.length,
      mean:
        profiles.reduce((sum, p) => sum + p.volume_patterns.mean, 0) /
        profiles.length,
      std_dev:
        profiles.reduce((sum, p) => sum + p.volume_patterns.std_dev, 0) /
        profiles.length,
      percentiles: {
        p50:
          profiles.reduce(
            (sum, p) => sum + p.volume_patterns.percentiles.p50,
            0
          ) / profiles.length,
        p95:
          profiles.reduce(
            (sum, p) => sum + p.volume_patterns.percentiles.p95,
            0
          ) / profiles.length,
        p99:
          profiles.reduce(
            (sum, p) => sum + p.volume_patterns.percentiles.p99,
            0
          ) / profiles.length,
      },
    };

    return {
      entity_type: profiles[0].entity_type,
      volume_patterns: avgVolume,
      access_patterns: [],
      temporal_patterns: [],
      baseline_metrics: profiles[0].baseline_metrics,
      anomaly_threshold:
        profiles.reduce((sum, p) => sum + p.anomaly_threshold, 0) /
        profiles.length,
      risk_score:
        profiles.reduce((sum, p) => sum + p.risk_score, 0) / profiles.length,
      anomaly_count:
        profiles.reduce((sum, p) => sum + p.anomaly_count, 0) / profiles.length,
    };
  }
}
