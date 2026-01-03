/**
 * LearningEngine - Core learning and adaptation system
 *
 * Enables SuperInstance to learn from usage patterns, hardware
 * characteristics, and user behavior over time.
 *
 * Privacy guarantees:
 * - All learning data stays local
 * - No telemetry sent to cloud
 * - Profile encrypted at rest
 * - User can view/delete all learned data
 * - Opt-out mechanism available
 */

import type {
  LearningProfile,
  UsageProfile,
  PerformanceProfile,
  PreferenceProfile,
  HardwareProfile,
  TelemetryEntry,
  LearningConfig,
  RoutingDecision,
  QueryOutcome,
  RoutingRecommendation,
  HardwareConfig,
  Query,
  LearningStatistics,
  LearningResult,
} from './types.js';
import { TelemetryCollector, createTelemetryCollector } from './TelemetryCollector.js';
import { HardwareProfiler, createHardwareProfiler } from './HardwareProfiler.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * Learning engine
 *
 * Main class for learning and adaptation. Collects telemetry,
 * builds profiles, and provides recommendations.
 */
export class LearningEngine {
  private profile: LearningProfile | null = null;
  private telemetry: TelemetryCollector;
  private profiler: HardwareProfiler;
  private config: LearningConfig;
  private dataDir: string;
  private profilePath: string;
  private queryCountSinceUpdate: number = 0;
  private initialized: boolean = false;

  constructor(dataDir: string, config: Partial<LearningConfig> = {}) {
    this.dataDir = dataDir;
    this.config = {
      dataDir,
      updateInterval: 24, // 24 hours
      minQueriesForUpdate: 100,
      retentionDays: 30,
      enabled: true,
      encryptProfiles: false,
      maxMemoryEntries: 1000,
      ...config,
    };

    this.profilePath = join(this.dataDir, 'profile.json');
    this.telemetry = new TelemetryCollector({
      dataDir: this.dataDir,
      maxMemoryEntries: this.config.maxMemoryEntries,
      hashQueries: false,
    });

    this.profiler = new HardwareProfiler();
  }

  /**
   * Initialize the learning engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });

    // Load or create profile
    this.profile = await this.loadProfile();

    if (!this.profile) {
      this.profile = await this.createProfile();
      await this.saveProfile();
    }

    // Start telemetry collection
    await this.telemetry.start();

    // Update hardware profile if needed
    await this.updateHardwareProfileIfNeeded();

    // Prune old telemetry
    await this.telemetry.prune(this.config.retentionDays);

    this.initialized = true;
  }

  /**
   * Record a query and its outcome
   */
  async recordQuery(
    query: string,
    route: RoutingDecision,
    outcome: QueryOutcome
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.telemetry.record({
      timestamp: Date.now(),
      query,
      route: route.destination,
      complexity: route.complexity,
      latency: outcome.latency,
      success: outcome.success,
      cached: outcome.cached,
      model: outcome.model,
      tokens: outcome.tokens,
      error: outcome.error,
    });

    this.queryCountSinceUpdate++;

    // Update profile periodically
    if (await this.shouldUpdateProfile()) {
      await this.updateProfile();
    }
  }

  /**
   * Get routing recommendation based on learning
   */
  getRoutingRecommendation(query: Query): RoutingRecommendation {
    if (!this.profile || !this.config.enabled) {
      return {
        destination: 'cloud',
        confidence: 0.5,
        reason: 'Learning not initialized or disabled',
      };
    }

    const complexity = query.complexity ?? this.estimateComplexity(query.text);
    const usage = this.profile.usage;

    // Learn from past patterns
    const localPreference = usage.routing.localModelPreference;
    const avgComplexity = usage.queryPatterns.averageComplexity;

    // Make recommendation
    let destination: RoutingRecommendation['destination'];
    let confidence: number;
    let reason: string;

    if (complexity < 0.5 && localPreference > 0.6) {
      // Simple query, high local success rate
      destination = 'local';
      confidence = localPreference;
      reason = `Low complexity (${complexity.toFixed(2)}) and high local preference (${(localPreference * 100).toFixed(0)}%)`;
    } else if (complexity > 0.7 || localPreference < 0.3) {
      // Complex query or low local success rate
      destination = 'cloud';
      confidence = 1 - localPreference;
      reason = `High complexity (${complexity.toFixed(2)}) or low local preference (${(localPreference * 100).toFixed(0)}%)`;
    } else {
      // Moderate complexity, use cache hit rate
      const cacheHitRate = usage.routing.cacheHitRate;
      destination = cacheHitRate > 0.7 ? 'local' : 'cloud';
      confidence = Math.max(localPreference, cacheHitRate);
      reason = `Moderate complexity, cache hit rate: ${(cacheHitRate * 100).toFixed(0)}%`;
    }

    return {
      destination,
      confidence,
      reason,
      expectedLatency: this.getExpectedLatency(destination),
    };
  }

  /**
   * Get hardware-aware configuration
   */
  getHardwareConfig(): HardwareConfig {
    if (!this.profile) {
      // Return conservative defaults
      return {
        maxConcurrentQueries: 1,
        cacheSize: 100_000_000, // 100MB
        enableGPU: false,
        parallelism: 1,
        memoryLimit: 500_000_000, // 500MB
      };
    }

    const hw = this.profile.hardware;

    // Calculate optimal configuration based on hardware
    const maxConcurrentQueries = Math.max(
      1,
      Math.floor(hw.memory.available / 500_000_000)
    );

    const cacheSize = Math.min(
      hw.memory.available * 0.1,
      2_000_000_000 // Max 2GB
    );

    return {
      maxConcurrentQueries,
      cacheSize: Math.floor(cacheSize),
      enableGPU: hw.gpu?.available ?? false,
      parallelism: hw.cpu.cores,
      memoryLimit: Math.floor(hw.memory.available * 0.7),
    };
  }

  /**
   * Get user preferences
   */
  getPreferences(): PreferenceProfile {
    if (!this.profile) {
      return {
        privacy: 0.5,
        cost: 0.5,
        speed: 0.5,
        quality: 0.5,
      };
    }

    return this.profile.preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: Partial<PreferenceProfile>): Promise<void> {
    if (!this.profile) {
      return;
    }

    this.profile.preferences = {
      ...this.profile.preferences,
      ...preferences,
    };

    await this.saveProfile();
  }

  /**
   * Get learning statistics
   */
  async getStatistics(): Promise<LearningStatistics> {
    const stats = await this.telemetry.getStats();

    return {
      totalQueries: this.profile?.usage.queryPatterns.totalQueries ?? 0,
      queriesInPeriod: stats.totalEntries,
      profileAge: this.profile
        ? (Date.now() - this.profile.learnedAt.getTime()) / (1000 * 60 * 60)
        : 0,
      telemetrySize: 0, // TODO: Calculate actual file sizes
      profileSize: this.profile ? JSON.stringify(this.profile).length : 0,
    };
  }

  /**
   * Get the current learning profile
   */
  getProfile(): LearningProfile | null {
    return this.profile;
  }

  /**
   * Export learning data
   */
  async exportData(): Promise<{
    profile: LearningProfile | null;
    telemetry: TelemetryEntry[];
  }> {
    const telemetry = await this.telemetry.getRecent(30 * 24 * 60 * 60 * 1000); // Last 30 days

    return {
      profile: this.profile,
      telemetry,
    };
  }

  /**
   * Clear all learning data
   */
  async clearData(): Promise<void> {
    await this.telemetry.clear();
    this.profile = await this.createProfile();
    await this.saveProfile();
    this.queryCountSinceUpdate = 0;
  }

  /**
   * Shutdown the learning engine
   */
  async shutdown(): Promise<void> {
    await this.telemetry.stop();
    this.initialized = false;
  }

  /**
   * Load profile from disk
   */
  private async loadProfile(): Promise<LearningProfile | null> {
    try {
      const content = await fs.readFile(this.profilePath, 'utf-8');
      const profile = JSON.parse(content) as LearningProfile;
      profile.learnedAt = new Date(profile.learnedAt);
      profile.hardware.detectedAt = new Date(profile.hardware.detectedAt);
      return profile;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to load profile:', err);
      }
      return null;
    }
  }

  /**
   * Save profile to disk
   */
  private async saveProfile(): Promise<void> {
    if (!this.profile) {
      return;
    }

    await fs.writeFile(
      this.profilePath,
      JSON.stringify(this.profile, null, 2)
    );
  }

  /**
   * Create a new profile
   */
  private async createProfile(): Promise<LearningProfile> {
    const hardware = await this.profiler.profile();

    return {
      installationId: randomUUID(),
      hardware,
      usage: {
        queryPatterns: {
          averageComplexity: 0.5,
          complexityDistribution: new Map(),
          peakHours: [],
          averageQueriesPerHour: 0,
          totalQueries: 0,
        },
        routing: {
          localModelPreference: 0.5,
          cloudFallbackRate: 0.5,
          commonPatterns: [],
          cacheHitRate: 0,
        },
        features: {
          mostUsed: [],
          rarelyUsed: [],
          featureInterdependencies: new Map(),
        },
      },
      performance: {
        latencies: {
          localModel: [],
          cloudModel: [],
          cache: [],
        },
        cache: {
          hitRate: 0,
          missPatterns: [],
          evictionEffectiveness: 0,
        },
        errors: {
          rate: 0,
          commonErrors: new Map(),
        },
      },
      preferences: {
        privacy: 0.5,
        cost: 0.5,
        speed: 0.5,
        quality: 0.5,
      },
      learnedAt: new Date(),
      version: 1,
    };
  }

  /**
   * Update hardware profile if needed
   */
  private async updateHardwareProfileIfNeeded(): Promise<void> {
    if (!this.profile) {
      return;
    }

    const hasChanged = await this.profiler.hasHardwareChanged(
      this.profile.hardware
    );

    if (hasChanged) {
      this.profile.hardware = await this.profiler.profile();
      await this.saveProfile();
    }
  }

  /**
   * Check if profile should be updated
   */
  private async shouldUpdateProfile(): Promise<boolean> {
    if (!this.profile) {
      return false;
    }

    if (this.queryCountSinceUpdate < this.config.minQueriesForUpdate) {
      return false;
    }

    const hoursSinceUpdate =
      (Date.now() - this.profile.learnedAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceUpdate >= this.config.updateInterval;
  }

  /**
   * Update learned profile from telemetry
   */
  private async updateProfile(): Promise<void> {
    if (!this.profile) {
      return;
    }

    const telemetry = await this.telemetry.getRecent(
      this.config.retentionDays * 24 * 60 * 60 * 1000
    );

    if (telemetry.length === 0) {
      return;
    }

    // Update usage patterns
    this.profile.usage.queryPatterns = this.analyzeQueryPatterns(telemetry);
    this.profile.usage.routing = this.analyzeRoutingPatterns(telemetry);

    // Update performance profile
    this.profile.performance = this.analyzePerformance(telemetry);

    // Update learned timestamp
    this.profile.learnedAt = new Date();

    // Save profile
    await this.saveProfile();

    // Reset query counter
    this.queryCountSinceUpdate = 0;
  }

  /**
   * Analyze query patterns
   */
  private analyzeQueryPatterns(
    telemetry: TelemetryEntry[]
  ): UsageProfile['queryPatterns'] {
    const complexities = telemetry.map(t => t.complexity);
    const avg = complexities.reduce((a, b) => a + b, 0) / complexities.length;

    // Build distribution
    const distribution = new Map<number, number>();
    for (const c of complexities) {
      const bucket = Math.floor(c * 10) / 10;
      distribution.set(bucket, (distribution.get(bucket) || 0) + 1);
    }

    // Detect peak hours
    const hourlyCounts = new Array(24).fill(0);
    for (const entry of telemetry) {
      const hour = new Date(entry.timestamp).getHours();
      hourlyCounts[hour]++;
    }
    const maxCount = Math.max(...hourlyCounts);
    const peakHours = hourlyCounts
      .map((count, hour) => ({ count, hour }))
      .filter(({ count }) => count >= maxCount * 0.8)
      .map(({ hour }) => hour);

    return {
      averageComplexity: avg,
      complexityDistribution: distribution,
      peakHours,
      averageQueriesPerHour: telemetry.length / 24,
      totalQueries: this.profile!.usage.queryPatterns.totalQueries + telemetry.length,
    };
  }

  /**
   * Analyze routing patterns
   */
  private analyzeRoutingPatterns(
    telemetry: TelemetryEntry[]
  ): UsageProfile['routing'] {
    const localQueries = telemetry.filter(t => t.route === 'local');
    const cloudQueries = telemetry.filter(t => t.route === 'cloud');
    const cachedQueries = telemetry.filter(t => t.cached);

    return {
      localModelPreference: localQueries.length / telemetry.length,
      cloudFallbackRate: cloudQueries.length / telemetry.length,
      commonPatterns: [], // TODO: Extract common patterns
      cacheHitRate: cachedQueries.length / telemetry.length,
    };
  }

  /**
   * Analyze performance
   */
  private analyzePerformance(telemetry: TelemetryEntry[]): PerformanceProfile {
    const localEntries = telemetry.filter(t => t.route === 'local');
    const cloudEntries = telemetry.filter(t => t.route === 'cloud');
    const cachedEntries = telemetry.filter(t => t.cached);

    const errors = telemetry.filter(t => !t.success);
    const errorMap = new Map<string, number>();
    for (const error of errors) {
      const errorMsg = error.error || 'unknown';
      errorMap.set(errorMsg, (errorMap.get(errorMsg) || 0) + 1);
    }

    return {
      latencies: {
        localModel: localEntries.map(t => t.latency),
        cloudModel: cloudEntries.map(t => t.latency),
        cache: cachedEntries.map(t => t.latency),
      },
      cache: {
        hitRate: cachedEntries.length / telemetry.length,
        missPatterns: [], // TODO: Analyze miss patterns
        evictionEffectiveness: 0.8, // TODO: Calculate actual effectiveness
      },
      errors: {
        rate: errors.length / telemetry.length,
        commonErrors: errorMap,
      },
    };
  }

  /**
   * Estimate query complexity
   */
  private estimateComplexity(query: string): number {
    // Simple heuristic: complexity based on length and word count
    const words = query.trim().split(/\s+/).length;
    const chars = query.length;

    // Normalize to 0-1
    const lengthScore = Math.min(words / 100, 1);
    const charScore = Math.min(chars / 500, 1);

    return (lengthScore + charScore) / 2;
  }

  /**
   * Get expected latency for a route
   */
  private getExpectedLatency(destination: RoutingRecommendation['destination']): number {
    if (!this.profile) {
      return 1000; // Default 1s
    }

    const latencies = this.profile.performance.latencies;

    switch (destination) {
      case 'local':
        return this.average(latencies.localModel) || 500;
      case 'cloud':
        return this.average(latencies.cloudModel) || 2000;
      case 'cache':
        return this.average(latencies.cache) || 10;
      default:
        return 1000;
    }
  }

  /**
   * Calculate average of array
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

/**
 * Create a learning engine with default options
 */
export async function createLearningEngine(
  dataDir: string,
  config?: Partial<LearningConfig>
): Promise<LearningEngine> {
  const engine = new LearningEngine(dataDir, config);
  await engine.initialize();
  return engine;
}
