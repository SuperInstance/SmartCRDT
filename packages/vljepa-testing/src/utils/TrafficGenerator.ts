/**
 * TrafficGenerator - Generate realistic traffic patterns for testing
 * Supports Poisson, bursty, periodic, and real-world traffic patterns.
 */

import type {
  TrafficConfig,
  GeneratedTraffic,
  GeneratedRequest,
  TrafficStats,
  TrafficPattern,
  TrafficData,
} from "../types.js";

export class TrafficGenerator {
  private random: () => number;

  constructor(seed?: number) {
    // Seeded random for reproducibility
    if (seed !== undefined) {
      this.random = this.seededRandom(seed);
    } else {
      this.random = Math.random;
    }
  }

  /**
   * Generate traffic based on configuration
   */
  generate(config: TrafficConfig): GeneratedTraffic {
    let timestamps: number[] = [];

    switch (config.pattern) {
      case "poisson":
        timestamps = this.generatePoisson(config);
        break;
      case "bursty":
        timestamps = this.generateBursty(config);
        break;
      case "periodic":
        timestamps = this.generatePeriodic(config);
        break;
      case "real_world":
        timestamps = this.generateRealWorld(config);
        break;
      case "constant":
        timestamps = this.generateConstant(config);
        break;
      default:
        timestamps = this.generatePoisson(config);
    }

    const requests = timestamps.map((ts, i) => this.generateRequest(ts, i));
    const stats = this.calculateStats(timestamps, config);

    return {
      requests,
      duration: config.duration,
      stats,
      pattern: config.pattern,
    };
  }

  /**
   * Generate Poisson traffic (random arrivals)
   */
  private generatePoisson(config: TrafficConfig): number[] {
    const timestamps: number[] = [];
    const lambda = config.rate / 1000; // Requests per ms
    let currentTime = 0;

    while (currentTime < config.duration) {
      // Exponential inter-arrival time for Poisson process
      const interArrival = -Math.log(1 - this.random()) / lambda;
      currentTime += interArrival;

      if (currentTime < config.duration) {
        timestamps.push(currentTime);
      }
    }

    return timestamps;
  }

  /**
   * Generate bursty traffic (bursts of requests)
   */
  private generateBursty(config: TrafficConfig): number[] {
    const timestamps: number[] = [];
    const burstiness = config.burstiness ?? 0.5; // 0-1, higher = more bursty
    let currentTime = 0;

    while (currentTime < config.duration) {
      // Determine if we're in a burst or quiet period
      const inBurst = this.random() < burstiness;

      if (inBurst) {
        // Burst period: high rate
        const burstDuration = 1000 + this.random() * 4000; // 1-5 seconds
        const burstRate = config.rate * (1 + burstiness * 2); // 1-3x rate
        const burstEnd = currentTime + burstDuration;

        while (currentTime < burstEnd && currentTime < config.duration) {
          timestamps.push(currentTime);
          currentTime += 1000 / burstRate;
        }
      } else {
        // Quiet period: low rate
        const quietDuration = 2000 + this.random() * 8000; // 2-10 seconds
        const quietRate = config.rate * (1 - burstiness * 0.5); // 0.5-1x rate
        currentTime += quietDuration;
      }
    }

    return timestamps;
  }

  /**
   * Generate periodic traffic (regular patterns)
   */
  private generatePeriodic(config: TrafficConfig): number[] {
    const timestamps: number[] = [];
    const period = config.period ?? 60000; // Default 1 minute
    let currentTime = 0;

    while (currentTime < config.duration) {
      // Calculate position within period (0-1)
      const periodPos = (currentTime % period) / period;

      // Sinusoidal rate variation
      const rateMultiplier = 0.5 + 0.5 * Math.sin(periodPos * 2 * Math.PI);
      const currentRate = config.rate * rateMultiplier;

      // Add next request
      timestamps.push(currentTime);
      currentTime += 1000 / currentRate;
    }

    return timestamps;
  }

  /**
   * Generate real-world traffic (based on provided data)
   */
  private generateRealWorld(config: TrafficConfig): number[] {
    if (!config.realData) {
      return this.generatePoisson(config);
    }

    const timestamps: number[] = [];
    const data = config.realData;

    // Resample real data to match target rate and duration
    const dataRate =
      data.requestsPerInterval.reduce((a, b) => a + b, 0) /
      (data.timestamps[data.timestamps.length - 1] - data.timestamps[0] || 1);
    const rateScale = config.rate / (dataRate * 1000);

    let dataIdx = 0;
    let currentTime = 0;

    while (
      currentTime < config.duration &&
      dataIdx < data.requestsPerInterval.length
    ) {
      const intervalRequests = Math.floor(
        data.requestsPerInterval[dataIdx] * rateScale
      );
      const intervalDuration =
        data.timestamps[Math.min(dataIdx + 1, data.timestamps.length - 1)] -
        data.timestamps[dataIdx];

      for (
        let i = 0;
        i < intervalRequests && currentTime < config.duration;
        i++
      ) {
        timestamps.push(currentTime);
        currentTime += intervalDuration / intervalRequests;
      }

      dataIdx++;
    }

    return timestamps;
  }

  /**
   * Generate constant traffic (fixed rate)
   */
  private generateConstant(config: TrafficConfig): number[] {
    const timestamps: number[] = [];
    const interval = 1000 / config.rate;
    let currentTime = 0;

    while (currentTime < config.duration) {
      timestamps.push(currentTime);
      currentTime += interval;
    }

    return timestamps;
  }

  /**
   * Generate a request at a specific timestamp
   */
  private generateRequest(timestamp: number, index: number): GeneratedRequest {
    // Vary request types realistically
    const typeRoll = this.random();
    let type: string;
    let priority: number;

    if (typeRoll < 0.7) {
      type = "read";
      priority = 1;
    } else if (typeRoll < 0.9) {
      type = "write";
      priority = 2;
    } else {
      type = "complex";
      priority = 3;
    }

    // Expected latency based on type
    const expectedLatency = type === "read" ? 50 : type === "write" ? 100 : 200;

    return {
      timestamp,
      type,
      payload: {
        type,
        size: this.generateSize(),
      },
      priority,
      expectedLatency,
    };
  }

  /**
   * Generate request size (bytes)
   */
  private generateSize(): number {
    const sizeRoll = this.random();

    if (sizeRoll < 0.5) {
      // Small: 100-1000 bytes
      return 100 + Math.floor(this.random() * 900);
    } else if (sizeRoll < 0.9) {
      // Medium: 1-10 KB
      return 1000 + Math.floor(this.random() * 9000);
    } else {
      // Large: 10-100 KB
      return 10000 + Math.floor(this.random() * 90000);
    }
  }

  /**
   * Calculate traffic statistics
   */
  private calculateStats(
    timestamps: number[],
    config: TrafficConfig
  ): TrafficStats {
    if (timestamps.length === 0) {
      return {
        totalRequests: 0,
        requestsPerSecond: 0,
        burstCount: 0,
        avgBurstSize: 0,
        periodicity: 0,
      };
    }

    const totalRequests = timestamps.length;
    const requestsPerSecond = (totalRequests / config.duration) * 1000;

    // Detect bursts (periods of high request density)
    const burstCount = this.detectBursts(timestamps);
    const avgBurstSize = burstCount > 0 ? totalRequests / burstCount : 0;

    // Detect periodicity (using autocorrelation approximation)
    const periodicity = this.estimatePeriodicity(timestamps);

    return {
      totalRequests,
      requestsPerSecond,
      burstCount,
      avgBurstSize,
      periodicity,
    };
  }

  /**
   * Detect number of bursts in traffic
   */
  private detectBursts(timestamps: number[]): number {
    if (timestamps.length < 10) return 0;

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const stdGap = Math.sqrt(
      gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) /
        gaps.length
    );

    // A burst is detected when gap is significantly below average
    const threshold = avgGap - stdGap;
    let burstCount = 0;
    let inBurst = false;

    for (const gap of gaps) {
      if (gap < threshold && !inBurst) {
        burstCount++;
        inBurst = true;
      } else if (gap >= threshold) {
        inBurst = false;
      }
    }

    return burstCount;
  }

  /**
   * Estimate traffic periodicity
   */
  private estimatePeriodicity(timestamps: number[]): number {
    if (timestamps.length < 100) return 0;

    // Simple periodicity detection using FFT approximation
    // Convert to binary sequence (requests vs no requests in time bins)
    const binSize = 100; // 100ms bins
    const maxTime = timestamps[timestamps.length - 1];
    const numBins = Math.ceil(maxTime / binSize);

    const bins = new Array(numBins).fill(0);
    for (const ts of timestamps) {
      const binIdx = Math.floor(ts / binSize);
      if (binIdx < numBins) {
        bins[binIdx]++;
      }
    }

    // Find most common pattern
    let maxPeriod = 0;
    let maxCorr = 0;

    for (let period = 10; period < numBins / 2; period++) {
      let corr = 0;
      for (let i = 0; i < numBins - period; i++) {
        corr += bins[i] * bins[i + period];
      }

      if (corr > maxCorr) {
        maxCorr = corr;
        maxPeriod = period * binSize;
      }
    }

    return maxPeriod;
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Generate daily traffic pattern (realistic)
   */
  static generateDailyPattern(): TrafficData {
    const timestamps: number[] = [];
    const requestsPerInterval: number[] = [];
    const intervalMs = 300000; // 5 minutes
    const dayMs = 86400000; // 24 hours

    let currentTime = 0;
    while (currentTime < dayMs) {
      timestamps.push(currentTime);

      // Daily traffic pattern: low at night, peak in afternoon
      const hour = currentTime / 3600000;
      let baseRate = 10;

      if (hour >= 0 && hour < 6) {
        baseRate = 5; // Night
      } else if (hour >= 6 && hour < 12) {
        baseRate = 15 + hour * 2; // Morning ramp
      } else if (hour >= 12 && hour < 18) {
        baseRate = 40; // Afternoon peak
      } else if (hour >= 18 && hour < 24) {
        baseRate = 30 - (hour - 18) * 3; // Evening decline
      }

      // Add randomness
      const rate = baseRate * (0.8 + Math.random() * 0.4);
      requestsPerInterval.push(rate);

      currentTime += intervalMs;
    }

    return {
      timestamps,
      requestsPerInterval,
      pattern: "daily",
      source: "synthetic",
    };
  }

  /**
   * Generate weekly traffic pattern
   */
  static generateWeeklyPattern(): TrafficData {
    const dailyPatterns: TrafficData[] = [];

    // Weekdays have higher traffic than weekends
    for (let day = 0; day < 7; day++) {
      const dailyPattern = this.generateDailyPattern();
      const isWeekend = day === 0 || day === 6;
      const scale = isWeekend ? 0.6 : 1;

      dailyPattern.requestsPerInterval = dailyPattern.requestsPerInterval.map(
        r => r * scale
      );
      dailyPatterns.push(dailyPattern);
    }

    // Combine into weekly pattern
    const timestamps: number[] = [];
    const requestsPerInterval: number[] = [];
    let offset = 0;

    for (const pattern of dailyPatterns) {
      timestamps.push(...pattern.timestamps.map(t => t + offset));
      requestsPerInterval.push(...pattern.requestsPerInterval);
      offset += 86400000;
    }

    return {
      timestamps,
      requestsPerInterval,
      pattern: "weekly",
      source: "synthetic",
    };
  }
}
