/**
 * TrafficGenerator Tests
 * Tests for traffic generation and patterns.
 */

import { describe, it, expect } from 'vitest';
import { TrafficGenerator } from '../src/index.js';

describe('TrafficGenerator', () => {
  describe('Initialization', () => {
    it('should initialize without seed', () => {
      const generator = new TrafficGenerator();
      expect(generator).toBeInstanceOf(TrafficGenerator);
    });

    it('should initialize with seed', () => {
      const generator = new TrafficGenerator(12345);
      expect(generator).toBeInstanceOf(TrafficGenerator);
    });
  });

  describe('Poisson Traffic', () => {
    it('should generate Poisson traffic', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100, // 100 requests per second
        duration: 10000 // 10 seconds
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
      expect(traffic.duration).toBe(10000);
      expect(traffic.pattern).toBe('poisson');
    });

    it('should have correct request count for Poisson', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000 // 5 seconds
      };

      const traffic = generator.generate(config);

      // Should have approximately 500 requests (100 * 5)
      expect(traffic.requests.length).toBeGreaterThan(400);
      expect(traffic.requests.length).toBeLessThan(600);
    });

    it('should generate requests with valid timestamps', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000
      };

      const traffic = generator.generate(config);

      for (let i = 1; i < traffic.requests.length; i++) {
        expect(traffic.requests[i].timestamp).toBeGreaterThan(traffic.requests[i - 1].timestamp);
      }
    });
  });

  describe('Bursty Traffic', () => {
    it('should generate bursty traffic', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'bursty' as const,
        rate: 100,
        duration: 10000,
        burstiness: 0.7
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
      expect(traffic.pattern).toBe('bursty');
    });

    it('should detect bursts in traffic', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'bursty' as const,
        rate: 100,
        duration: 10000,
        burstiness: 0.8
      };

      const traffic = generator.generate(config);

      expect(traffic.stats.burstCount).toBeGreaterThan(0);
    });

    it('should calculate average burst size', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'bursty' as const,
        rate: 100,
        duration: 10000,
        burstiness: 0.7
      };

      const traffic = generator.generate(config);

      expect(traffic.stats.avgBurstSize).toBeGreaterThan(0);
    });
  });

  describe('Periodic Traffic', () => {
    it('should generate periodic traffic', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'periodic' as const,
        rate: 100,
        duration: 10000,
        period: 5000 // 5 second period
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
      expect(traffic.pattern).toBe('periodic');
    });

    it('should detect periodicity', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'periodic' as const,
        rate: 100,
        duration: 15000,
        period: 3000 // 3 second period
      };

      const traffic = generator.generate(config);

      // Should detect some periodicity
      expect(traffic.stats.periodicity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Constant Traffic', () => {
    it('should generate constant traffic', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'constant' as const,
        rate: 100,
        duration: 5000
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
      expect(traffic.pattern).toBe('constant');
    });

    it('should have consistent inter-arrival times', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'constant' as const,
        rate: 100, // 100 req/s = 10ms interval
        duration: 2000
      };

      const traffic = generator.generate(config);

      // Calculate average interval
      const intervals: number[] = [];
      for (let i = 1; i < Math.min(traffic.requests.length, 10); i++) {
        intervals.push(traffic.requests[i].timestamp - traffic.requests[i - 1].timestamp);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // Should be close to 10ms
      expect(avgInterval).toBeCloseTo(10, 1);
    });

    it('should have exact request count', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'constant' as const,
        rate: 100,
        duration: 5000 // Should be exactly 500 requests
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBe(500);
    });
  });

  describe('Real-World Traffic', () => {
    it('should generate real-world traffic from data', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'real_world' as const,
        rate: 100,
        duration: 10000,
        realData: {
          timestamps: [0, 1000, 2000, 3000, 4000, 5000],
          requestsPerInterval: [10, 20, 15, 25, 20, 10],
          pattern: 'test',
          source: 'test'
        }
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
    });

    it('should fall back to Poisson without real data', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'real_world' as const,
        rate: 100,
        duration: 5000
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
    });
  });

  describe('Request Properties', () => {
    it('should generate requests with types', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      const types = new Set(traffic.requests.map(r => r.type));
      expect(types.has('read') || types.has('write') || types.has('complex')).toBe(true);
    });

    it('should assign priorities based on type', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      for (const request of traffic.requests) {
        expect(request.priority).toBeGreaterThan(0);
        expect(request.priority).toBeLessThanOrEqual(3);
      }
    });

    it('should set expected latency based on type', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      const readRequest = traffic.requests.find(r => r.type === 'read');
      const writeRequest = traffic.requests.find(r => r.type === 'write');

      if (readRequest) {
        expect(readRequest.expectedLatency).toBe(50);
      }
      if (writeRequest) {
        expect(writeRequest.expectedLatency).toBe(100);
      }
    });

    it('should generate payload with size', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      for (const request of traffic.requests) {
        expect(request.payload).toBeDefined();
        expect((request.payload as any).size).toBeGreaterThan(0);
      }
    });
  });

  describe('Traffic Statistics', () => {
    it('should calculate total requests', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000
      };

      const traffic = generator.generate(config);

      expect(traffic.stats.totalRequests).toBe(traffic.requests.length);
    });

    it('should calculate requests per second', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000
      };

      const traffic = generator.generate(config);

      expect(traffic.stats.requestsPerSecond).toBeCloseTo(100, 1);
    });
  });

  describe('Predefined Patterns', () => {
    it('should generate daily pattern', () => {
      const pattern = TrafficGenerator.generateDailyPattern();

      expect(pattern.timestamps).toBeDefined();
      expect(pattern.requestsPerInterval).toBeDefined();
      expect(pattern.pattern).toBe('daily');
    });

    it('should have varying traffic in daily pattern', () => {
      const pattern = TrafficGenerator.generateDailyPattern();

      const minRate = Math.min(...pattern.requestsPerInterval);
      const maxRate = Math.max(...pattern.requestsPerInterval);

      expect(maxRate).toBeGreaterThan(minRate);
    });

    it('should generate weekly pattern', () => {
      const pattern = TrafficGenerator.generateWeeklyPattern();

      expect(pattern.timestamps).toBeDefined();
      expect(pattern.requestsPerInterval).toBeDefined();
      expect(pattern.pattern).toBe('weekly');
    });

    it('should have lower weekend traffic', () => {
      const pattern = TrafficGenerator.generateWeeklyPattern();

      // Find weekday and weekend segments
      const dayMs = 86400000;
      const weekendDays = [0, 6]; // Sunday and Saturday

      const weekdayRates: number[] = [];
      const weekendRates: number[] = [];

      for (let day = 0; day < 7; day++) {
        const dayStart = Math.floor((day * dayMs) / 300000);
        const dayEnd = Math.floor(((day + 1) * dayMs) / 300000);

        const dayRates = pattern.requestsPerInterval.slice(dayStart, dayEnd);
        const avgRate = dayRates.reduce((a, b) => a + b, 0) / dayRates.length;

        if (weekendDays.includes(day)) {
          weekendRates.push(avgRate);
        } else {
          weekdayRates.push(avgRate);
        }
      }

      const avgWeekday = weekdayRates.reduce((a, b) => a + b, 0) / weekdayRates.length;
      const avgWeekend = weekendRates.reduce((a, b) => a + b, 0) / weekendRates.length;

      expect(avgWeekend).toBeLessThan(avgWeekday);
    });
  });

  describe('Seeded Random', () => {
    it('should generate reproducible traffic with same seed', () => {
      const seed = 12345;
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000
      };

      const generator1 = new TrafficGenerator(seed);
      const traffic1 = generator1.generate(config);

      const generator2 = new TrafficGenerator(seed);
      const traffic2 = generator2.generate(config);

      expect(traffic1.requests.length).toBe(traffic2.requests.length);

      // First few requests should have same timestamps
      for (let i = 0; i < Math.min(10, traffic1.requests.length); i++) {
        expect(traffic1.requests[i].timestamp).toBe(traffic2.requests[i].timestamp);
      }
    });

    it('should generate different traffic with different seeds', () => {
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 5000
      };

      const generator1 = new TrafficGenerator(12345);
      const traffic1 = generator1.generate(config);

      const generator2 = new TrafficGenerator(54321);
      const traffic2 = generator2.generate(config);

      // Traffic should differ
      const sameTimestamps = traffic1.requests.filter((r, i) =>
        r.timestamp === traffic2.requests[i]?.timestamp
      ).length;

      expect(sameTimestamps).toBeLessThan(traffic1.requests.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 0
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBe(0);
    });

    it('should handle very low rate', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 1, // 1 request per second
        duration: 5000
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeLessThan(10);
    });

    it('should handle very high rate', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 10000, // 10k requests per second
        duration: 1000
      };

      const traffic = generator.generate(config);

      expect(traffic.requests.length).toBeGreaterThan(0);
    });
  });

  describe('Request Size Generation', () => {
    it('should generate small requests mostly', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      const smallRequests = traffic.requests.filter(r =>
        (r.payload as any).size < 1000
      );

      // About 50% should be small
      expect(smallRequests.length / traffic.requests.length).toBeGreaterThan(0.3);
    });

    it('should generate large requests rarely', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: 100,
        duration: 2000
      };

      const traffic = generator.generate(config);

      const largeRequests = traffic.requests.filter(r =>
        (r.payload as any).size > 10000
      );

      // About 10% should be large
      expect(largeRequests.length / traffic.requests.length).toBeLessThan(0.3);
    });
  });
});
