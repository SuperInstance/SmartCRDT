/**
 * Optimization Suggestion Engine
 *
 * AI-powered performance optimization recommendations:
 * - Context-aware suggestions based on bottleneck patterns
 * - Priority scoring and impact estimation
 * - Implementation guidance with code examples
 * - Dependency analysis
 */

import type { Bottleneck, OptimizationSuggestion, PerformanceConfig } from "../types/index.js";

export class OptimizationSuggestionEngine {
  private config: PerformanceConfig;
  private suggestionTemplates: Map<string, {
    patterns: Array<{
      condition: (bottleneck: Bottleneck) => boolean;
      suggestion: Partial<OptimizationSuggestion>;
    }>;
  }> = new Map();

  constructor(config: PerformanceConfig = this.getDefaultConfig()) {
    this.config = config;
    this.initializeSuggestionTemplates();
  }

  /**
   * Generate optimization suggestions based on detected bottlenecks
   */
  generateSuggestions(
    bottlenecks: Bottleneck[],
    context?: {
      environment?: string;
      loadLevel?: string;
      architecture?: string;
    }
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze each bottleneck
    for (const bottleneck of bottlenecks) {
      const bottleneckSuggestions = this.analyzeBottleneck(bottleneck, context);
      suggestions.push(...bottleneckSuggestions);
    }

    // Remove duplicates and prioritize
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    const prioritizedSuggestions = this.prioritizeSuggestions(uniqueSuggestions);

    // Filter by priority threshold
    return prioritizedSuggestions
      .filter(s => s.priority >= this.config.suggestionPriorityThreshold)
      .slice(0, this.config.maxSuggestions);
  }

  /**
   * Analyze a single bottleneck and generate suggestions
   */
  private analyzeBottleneck(
    bottleneck: Bottleneck,
    context?: { environment?: string; loadLevel?: string; architecture?: string; }
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const template = this.suggestionTemplates.get(bottleneck.type);

    if (!template) return suggestions;

    // Match patterns
    for (const { condition, suggestion } of template.patterns) {
      if (condition(bottleneck)) {
        const fullSuggestion = this.createSuggestion(bottleneck, suggestion, context);
        suggestions.push(fullSuggestion);
      }
    }

    return suggestions;
  }

  /**
   * Create a complete suggestion from template
   */
  private createSuggestion(
    bottleneck: Bottleneck,
    template: Partial<OptimizationSuggestion>,
    context?: { environment?: string; loadLevel?: string; architecture?: string; }
  ): OptimizationSuggestion {
    const baseSuggestion: OptimizationSuggestion = {
      type: 'code',
      priority: 5,
      estimatedImpact: 0,
      difficulty: 5,
      problem: '',
      solution: '',
      sideEffects: []
    };

    // Merge template
    const suggestion = { ...baseSuggestion, ...template };

    // Enhance with bottleneck-specific details
    suggestion.problem = `${bottleneck.description} (severity: ${bottleneck.severity}/10, impact: ${(bottleneck.impact * 100).toFixed(1)}%)`;

    // Adjust priority based on severity and confidence
    suggestion.priority = this.calculatePriority(bottleneck, context);

    // Estimate impact
    suggestion.estimatedImpact = this.estimateImpact(bottleneck, context);

    // Adjust difficulty based on context
    suggestion.difficulty = this.adjustDifficulty(suggestion.difficulty, context);

    // Add side effects
    suggestion.sideEffects = this.analyzeSideEffects(suggestion, context);

    // Add implementation example
    suggestion.example = this.generateImplementationExample(suggestion, bottleneck);

    return suggestion;
  }

  /**
   * Calculate suggestion priority
   */
  private calculatePriority(
    bottleneck: Bottleneck,
    context?: { environment?: string; loadLevel?: string; }
  ): number {
    let priority = bottleneck.severity * bottleneck.confidence;

    // Adjust based on environment
    if (context?.environment === 'production') {
      priority *= 1.2; // Higher priority in production
    }

    // Adjust based on load level
    if (context?.loadLevel === 'high' || context?.loadLevel === 'peak') {
      priority *= 1.3; // Higher priority under high load
    }

    // Cap at 10
    return Math.min(10, Math.max(1, Math.floor(priority)));
  }

  /**
   * Estimate performance improvement
   */
  private estimateImpact(
    bottleneck: Bottleneck,
    context?: { environment?: string; loadLevel?: string; }
  ): number {
    let impact = bottleneck.impact;

    // Multipliers based on bottleneck type
    switch (bottleneck.type) {
      case 'cpu':
        impact *= 0.8; // CPU improvements can be significant but complex
        break;
      case 'memory':
        impact *= 0.9; // Memory improvements often yield high gains
        break;
      case 'io':
        impact *= 0.7; // I/O improvements can be very impactful
        break;
      case 'network':
        impact *= 0.6; // Network depends on external factors
        break;
    }

    // Adjust based on context
    if (context?.loadLevel === 'peak') {
      impact *= 1.2; // Higher impact under peak load
    }

    return Math.min(0.9, Math.max(0.1, impact)); // Cap between 10% and 90%
  }

  /**
   * Adjust implementation difficulty
   */
  private adjustDifficulty(baseDifficulty: number, context?: { environment?: string; }): number {
    let difficulty = baseDifficulty;

    // Make it easier in development
    if (context?.environment === 'development') {
      difficulty *= 0.8;
    }

    return Math.max(1, Math.min(10, Math.floor(difficulty)));
  }

  /**
   * Analyze potential side effects
   */
  private analyzeSideEffects(
    suggestion: OptimizationSuggestion,
    context?: { environment?: string; }
  ): string[] {
    const sideEffects: string[] = [];

    // Generic side effects based on type
    switch (suggestion.type) {
      case 'caching':
        sideEffects.push('May increase memory usage');
        sideEffects.push('Cache invalidation complexity');
        break;
      case 'code':
        sideEffects.push('Potential breaking changes');
        sideEffects.push('Requires thorough testing');
        break;
      case 'architecture':
        sideEffects.push('Significant refactoring effort');
        sideEffects.push('May temporarily reduce performance during migration');
        break;
      case 'config':
        sideEffects.push('Requires monitoring for negative impact');
        sideEffects.push('May need fine-tuning in production');
        break;
      case 'hardware':
        sideEffects.push('Requires infrastructure changes');
        sideEffects.push('Additional cost considerations');
        break;
    }

    // Environment-specific side effects
    if (context?.environment === 'production') {
      sideEffects.unshift('Implementation requires maintenance window');
      sideEffects.push('Risk of service disruption if not carefully deployed');
    }

    return sideEffects;
  }

  /**
   * Generate implementation example
   */
  private generateImplementationExample(
    suggestion: OptimizationSuggestion,
    bottleneck: Bottleneck
  ): string {
    const examples = {
      code: this.getCodeExample(suggestion, bottleneck),
      caching: this.getCachingExample(suggestion, bottleneck),
      config: this.getConfigExample(suggestion, bottleneck),
      architecture: this.getArchitectureExample(suggestion, bottleneck),
      hardware: this.getHardwareExample(suggestion, bottleneck)
    };

    return examples[suggestion.type] || '// Implementation example not available';
  }

  /**
   * Generate code optimization example
   */
  private getCodeExample(suggestion: OptimizationSuggestion, bottleneck: Bottleneck): string {
    switch (bottleneck.type) {
      case 'cpu':
        return `// Optimize CPU-intensive operations
function processData(data: any[]): any[] {
  // Before: O(n²) complexity
  // return data.map(item => slowOperation(item));

  // After: Use memoization or batching
  const cache = new Map();
  return data.map(item => {
    if (cache.has(item.id)) {
      return cache.get(item.id);
    }
    const result = optimizedOperation(item);
    cache.set(item.id, result);
    return result;
  });
}

// Consider using Web Workers for CPU-intensive tasks
const worker = new Worker('processor-worker.js');
worker.postMessage(data);`;

      case 'memory':
        return `// Optimize memory usage
class MemoryEfficientArray {
  private chunks: any[] = [];
  private chunkSize = 1000;

  add(item: any): void {
    if (this.chunks.length === 0 ||
        this.chunks[this.chunks.length - 1].length >= this.chunkSize) {
      this.chunks.push([]);
    }
    this.chunks[this.chunks.length - 1].push(item);
  }

  getAll(): any[] {
    return this.chunks.flat();
  }

  // Implement proper cleanup
  clear(): void {
    this.chunks = [];
    if (global.gc) global.gc(); // Force garbage collection
  }
}`;

      case 'io':
        return `// Optimize I/O operations
import { promises as fs } from 'fs';

// Before: Sequential file operations
async function processDataSequentially(files: string[]): Promise<any[]> {
  const results = [];
  for (const file of files) {
    const data = await fs.readFile(file, 'utf-8');
    results.push(processData(data));
  }
  return results;
}

// After: Parallel processing with concurrency control
import { pLimit } from 'p-limit';
const limit = pLimit(10); // Allow 10 concurrent operations

async function processDataInParallel(files: string[]): Promise<any[]> {
  const promises = files.map(file =>
    limit(() => readFileAndProcess(file))
  );
  return Promise.all(promises);
}`;

      default:
        return '// No specific code example available for this bottleneck';
    }
  }

  /**
   * Generate caching example
   */
  private getCachingExample(suggestion: OptimizationSuggestion, bottleneck: Bottleneck): string {
    return `// Implement caching strategy
import LRUCache from 'lru-cache';

const cache = new LRUCache({
  max: 500, // Maximum number of items
  maxAge: 1000 * 60 * 5, // 5 minutes
  ttl: 1000 * 60 * 5, // Alternative to maxAge
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttlAutopurge: true,
  updateAgeOnGet: true
});

async function getCachedData(key: string): Promise<any> {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const data = await fetchExpensiveData(key);
  cache.set(key, data);
  return data;
}

// Cache invalidation strategies
function invalidatePattern(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}`;
  }

  /**
   * Generate configuration example
   */
  private getConfigExample(suggestion: OptimizationSuggestion, bottleneck: Bottleneck): string {
    return `// Optimize configuration for ${bottleneck.type} bottlenecks

// Before: Default configuration
const config = {
  poolSize: 10,
  timeout: 30000,
  retryAttempts: 3,
  bufferSize: 1024
};

// After: Optimized configuration
const optimizedConfig = {
  // CPU optimization
  poolSize: bottleneck.type === 'cpu' ? 20 : 10,

  // Memory optimization
  bufferSize: bottleneck.type === 'memory' ? 512 : 1024,

  // I/O optimization
  timeout: bottleneck.type === 'io' ? 60000 : 30000,
  retryAttempts: bottleneck.type === 'io' ? 5 : 3,

  // Add monitoring
  metrics: {
    enabled: true,
    interval: 5000
  }
};

// Apply configuration
applyConfiguration(optimizedConfig);`;
  }

  /**
   * Generate architecture example
   */
  private getArchitectureExample(suggestion: OptimizationSuggestion, bottleneck: Bottleneck): string {
    return `// Architecture optimization for ${bottleneck.type} bottlenecks

// Before: Monolithic processing
class MonolithicProcessor {
  async process(data: any[]): Promise<any[]> {
    return data.map(item => this.expensiveOperation(item));
  }

  private expensiveOperation(item: any): any {
    // CPU, memory, or I/O intensive operation
  }
}

// After: Microservices or queue-based architecture
class DistributedProcessor {
  private taskQueue: Queue;
  private workerPool: WorkerPool;

  constructor() {
    this.taskQueue = new Queue('processing', {
      redis: { host: 'redis' }
    });

    this.workerPool = new WorkerPool({
      size: bottleneck.type === 'cpu' ? 4 : 8,
      memoryLimit: bottleneck.type === 'memory' ? '1GB' : '2GB'
    });
  }

  async process(data: any[]): Promise<any[]> {
    // Split into batches for parallel processing
    const batches = this.createBatches(data, 100);

    // Process in parallel with backpressure handling
    const results = await Promise.allSettled(
      batches.map(batch => this.processBatch(batch))
    );

    return results.map(r => r.status === 'fulfilled' ? r.value : null).flat();
  }
}`;
  }

  /**
   * Generate hardware example
   */
  private getHardwareExample(suggestion: OptimizationSuggestion, bottleneck: Bottleneck): string {
    return `// Hardware scaling recommendations for ${bottleneck.type} bottlenecks

// CPU bottleneck scaling
if (bottleneck.type === 'cpu') {
  recommendations = [
    {
      action: 'Scale vertically',
      description: 'Upgrade CPU to higher core count',
      estimatedCost: '$2000-5000',
      estimatedImpact: '30-50%'
    },
    {
      action: 'Scale horizontally',
      description: 'Add more instances with auto-scaling',
      estimatedCost: '$1000-3000/month',
      estimatedImpact: '40-70%'
    },
    {
      action: 'Enable CPU optimization',
      description: 'Enable turbo boost, hyper-threading',
      estimatedCost: '$0',
      estimatedImpact: '5-15%'
    }
  ];
}

// Memory bottleneck scaling
if (bottleneck.type === 'memory') {
  recommendations = [
    {
      action: 'Increase RAM',
      description: 'Upgrade to 32GB+ RAM',
      estimatedCost: '$500-1500',
      estimatedImpact: '20-40%'
    },
    {
      action: 'Enable swap',
      description: 'Configure swap space on SSD',
      estimatedCost: '$0',
      estimatedImpact: '10-25%'
    }
  ];
}

// Implementation
for (const rec of recommendations) {
  console.log(\`\${rec.action}: \${rec.description}\`);
  console.log(\`Cost: \${rec.estimatedCost}, Impact: \${rec.estimatedImpact}\`);
}`;
  }

  /**
   * Remove duplicate suggestions
   */
  private deduplicateSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    const seen = new Set<string>();
    const unique: OptimizationSuggestion[] = [];

    for (const suggestion of suggestions) {
      // Create a unique key based on type, priority, and problem
      const key = `${suggestion.type}-${suggestion.priority}-${suggestion.problem.substring(0, 50)}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Prioritize suggestions
   */
  private prioritizeSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
    return suggestions.sort((a, b) => {
      // Sort by priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Then by estimated impact
      if (a.estimatedImpact !== b.estimatedImpact) {
        return b.estimatedImpact - a.estimatedImpact;
      }

      // Then by difficulty (easier first)
      return a.difficulty - b.difficulty;
    });
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): PerformanceConfig {
    return {
      enableCpuProfiling: true,
      enableMemoryProfiling: true,
      memoryHistoryWindow: 60,
      cpuSpikeThreshold: 90,
      memoryLeakThreshold: 1,
      bottleneckSensitivity: 5,
      suggestionPriorityThreshold: 3,
      maxSuggestions: 10,
      benchmarks: {
        warmupRuns: 3,
        measurementRuns: 10,
        timeout: 5000
      },
      targets: {
        latencyTarget: 100,
        memoryTarget: 600,
        cpuTarget: 80,
        errorRateTarget: 1
      }
    };
  }

  /**
   * Initialize suggestion templates
   */
  private initializeSuggestionTemplates(): void {
    // CPU bottleneck templates
    this.suggestionTemplates.set('cpu', {
      patterns: [
        {
          condition: (b) => b.type === 'cpu' && b.metrics?.usage > 90,
          suggestion: {
            type: 'architecture',
            estimatedImpact: 0.5,
            difficulty: 7,
            solution: 'Consider scaling horizontally or upgrading CPU'
          }
        },
        {
          condition: (b) => b.type === 'cpu' && b.metrics?.usage > 70 && b.metrics?.usage <= 90,
          suggestion: {
            type: 'code',
            estimatedImpact: 0.3,
            difficulty: 5,
            solution: 'Optimize algorithms and use memoization'
          }
        },
        {
          condition: (b) => b.type === 'cpu' && b.metrics?.spikeCount && b.metrics?.spikeCount > 5,
          suggestion: {
            type: 'code',
            estimatedImpact: 0.4,
            difficulty: 6,
            solution: 'Implement rate limiting and request batching'
          }
        }
      ]
    });

    // Memory bottleneck templates
    this.suggestionTemplates.set('memory', {
      patterns: [
        {
          condition: (b) => b.type === 'memory' && b.metrics?.heapUsagePercent > 90,
          suggestion: {
            type: 'architecture',
            estimatedImpact: 0.4,
            difficulty: 8,
            solution: 'Implement memory pooling and object reuse'
          }
        },
        {
          condition: (b) => b.type === 'memory' && b.metrics?.leak?.suspected,
          suggestion: {
            type: 'code',
            estimatedImpact: 0.6,
            difficulty: 4,
            solution: 'Fix memory leaks by properly managing resources'
          }
        },
        {
          condition: (b) => b.type === 'memory' && b.metrics?.heapUsagePercent > 70 && !b.metrics?.leak,
          suggestion: {
            type: 'caching',
            estimatedImpact: 0.3,
            difficulty: 4,
            solution: 'Implement caching strategy with proper TTL'
          }
        }
      ]
    });

    // I/O bottleneck templates
    this.suggestionTemplates.set('io', {
      patterns: [
        {
          condition: (b) => b.type === 'io' && b.metrics?.p99 > 1000,
          suggestion: {
            type: 'hardware',
            estimatedImpact: 0.6,
            difficulty: 9,
            solution: 'Upgrade to SSD storage and increase I/O capacity'
          }
        },
        {
          condition: (b) => b.type === 'io' && b.metrics?.p99 > 500 && b.metrics?.p99 <= 1000,
          suggestion: {
            type: 'architecture',
            estimatedImpact: 0.5,
            difficulty: 7,
            solution: 'Implement asynchronous processing and queue-based architecture'
          }
        },
        {
          condition: (b) => b.type === 'io' && b.metrics?.queuePercent && b.metrics?.queuePercent > 0.5,
          suggestion: {
            type: 'code',
            estimatedImpact: 0.4,
            difficulty: 5,
            solution: 'Optimize queue management and implement parallel processing'
          }
        }
      ]
    });

    // Network bottleneck templates
    this.suggestionTemplates.set('network', {
      patterns: [
        {
          condition: (b) => b.type === 'network' && b.metrics?.networkLatency > 200,
          suggestion: {
            type: 'architecture',
            estimatedImpact: 0.5,
            difficulty: 7,
            solution: 'Implement content delivery network (CDN) and edge computing'
          }
        },
        {
          condition: (b) => b.type === 'network' && b.metrics?.networkLatency > 100 && b.metrics?.networkLatency <= 200,
          suggestion: {
            type: 'caching',
            estimatedImpact: 0.3,
            difficulty: 4,
            solution: 'Implement caching and response compression'
          }
        }
      ]
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}