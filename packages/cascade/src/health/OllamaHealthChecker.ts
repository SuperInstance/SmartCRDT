/**
 * OllamaHealthChecker - Comprehensive health monitoring for Ollama service
 *
 * Monitors:
 * - Ollama daemon availability (port 11434)
 * - Model availability and load state
 * - Response time and performance metrics
 * - Memory and CPU usage
 * - GPU utilization (if available)
 * - Request queue depth
 *
 * Features:
 * - Fast non-blocking health checks
 * - TTL-based caching to avoid hammering the service
 * - Degraded state detection
 * - Performance metrics collection
 */

import axios, { AxiosInstance } from "axios";
import type {
  OllamaHealthCheckResult,
  OllamaHealthCheckConfig,
} from "@lsi/protocol";

/**
 * Default health check configuration
 */
const DEFAULT_CONFIG: Omit<OllamaHealthCheckConfig, "baseURL" | "defaultModel"> =
  {
    timeout: 5000, // 5 seconds
    cacheTTL: 10000, // 10 seconds
    maxResponseTime: 1000, // 1 second
    maxMemoryUsage: 8192, // 8 GB
    maxCpuUsage: 80, // 80%
    enablePerformanceMetrics: true,
    enableModelCheck: true,
    enableResourceMonitoring: true,
  };

/**
 * Cached health status entry
 */
interface CachedHealthStatus {
  result: OllamaHealthCheckResult;
  timestamp: number;
  validUntil: number;
}

/**
 * OllamaHealthChecker - Comprehensive health monitoring
 */
export class OllamaHealthChecker {
  private axiosInstance: AxiosInstance;
  private config: OllamaHealthCheckConfig;
  private cachedStatus: CachedHealthStatus | null;
  private isChecking: boolean;

  constructor(config: OllamaHealthCheckConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cachedStatus = null;
    this.isChecking = false;

    // Create axios instance with timeout
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Perform comprehensive health check
   *
   * Returns cached result if within TTL, otherwise performs fresh check.
   * Health checks are fast and non-blocking.
   *
   * @returns Health check result with detailed metrics
   */
  async checkHealth(): Promise<OllamaHealthCheckResult> {
    const now = Date.now();

    // Return cached result if still valid
    if (this.cachedStatus && now < this.cachedStatus.validUntil) {
      return this.cachedStatus.result;
    }

    // Prevent concurrent checks
    if (this.isChecking) {
      // Return cached result even if expired, or wait briefly
      if (this.cachedStatus) {
        return this.cachedStatus.result;
      }
      // If no cache, wait a bit and retry
      await this.sleep(100);
      return this.checkHealth();
    }

    this.isChecking = true;

    try {
      const startTime = Date.now();

      // Check 1: Daemon connectivity
      const daemonCheck = await this.checkDaemonConnectivity();

      if (!daemonCheck.running) {
        const result: OllamaHealthCheckResult = {
          healthy: false,
          score: 0,
          message: "Ollama daemon is not running",
          error: daemonCheck.error,
          status: "unreachable",
          timestamp: now,
          duration: Date.now() - startTime,
          daemonRunning: false,
          availableModels: [],
          defaultModelAvailable: false,
          responseTime: Date.now() - startTime,
          healthStatus: "unhealthy",
        };

        this.cacheResult(result);
        return result;
      }

      // Check 2: Model availability
      const modelCheck = await this.checkModelAvailability();

      if (!modelCheck.available) {
        const result: OllamaHealthCheckResult = {
          healthy: false,
          score: 0.2,
          message: `Default model '${this.config.defaultModel}' is not available`,
          error: "Model not found",
          status: "model-unavailable",
          timestamp: now,
          duration: Date.now() - startTime,
          daemonRunning: true,
          daemonVersion: daemonCheck.version,
          availableModels: modelCheck.models || [],
          defaultModelAvailable: false,
          responseTime: Date.now() - startTime,
          healthStatus: "unhealthy",
          degradationReason: "Default model not available",
        };

        this.cacheResult(result);
        return result;
      }

      // Check 3: Performance metrics
      const perfCheck = await this.checkPerformance();

      // Check 4: Resource usage (optional)
      const resourceCheck = this.config.enableResourceMonitoring
        ? await this.checkResources()
        : null;

      // Calculate overall health score and status
      const healthScore = this.calculateHealthScore({
        responseTime: perfCheck.responseTime,
        memoryUsage: resourceCheck?.memoryUsage,
        cpuUsage: resourceCheck?.cpuUsage,
        modelLoaded: perfCheck.modelLoaded,
      });

      const healthStatus = this.determineHealthStatus(healthScore, {
        responseTime: perfCheck.responseTime,
        memoryUsage: resourceCheck?.memoryUsage,
        cpuUsage: resourceCheck?.cpuUsage,
      });

      const result: OllamaHealthCheckResult = {
        healthy: healthStatus !== "unhealthy",
        score: healthScore,
        message: this.getHealthMessage(healthStatus, perfCheck),
        status: healthStatus,
        timestamp: now,
        duration: Date.now() - startTime,
        daemonRunning: true,
        daemonVersion: daemonCheck.version,
        availableModels: modelCheck.models || [],
        defaultModelAvailable: true,
        defaultModelLoaded: perfCheck.modelLoaded,
        modelLoadState: perfCheck.modelLoaded ? "loaded" : "not-loaded",
        responseTime: perfCheck.responseTime,
        memoryUsage: resourceCheck?.memoryUsage,
        cpuUsage: resourceCheck?.cpuUsage,
        gpuUtilization: resourceCheck?.gpuUtilization,
        vramUsage: resourceCheck?.vramUsage,
        pendingRequests: perfCheck.pendingRequests,
        healthStatus,
        degradationReason:
          healthStatus === "degraded"
            ? this.getDegradationReason(perfCheck, resourceCheck)
            : undefined,
        cacheHitRate: perfCheck.cacheHitRate,
        queueDepth: perfCheck.queueDepth,
      };

      this.cacheResult(result);
      return result;
    } catch (error) {
      const errorResult: OllamaHealthCheckResult = {
        healthy: false,
        score: 0,
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        status: "error",
        timestamp: now,
        duration: 0,
        daemonRunning: false,
        availableModels: [],
        defaultModelAvailable: false,
        responseTime: 0,
        healthStatus: "unhealthy",
      };

      // Don't cache error results (allow immediate retry)
      this.isChecking = false;
      return errorResult;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Quick health check - returns cached result if available
   *
   * Use this for fast checks where absolute freshness is not critical.
   *
   * @returns Health check result (possibly cached)
   */
  async quickCheck(): Promise<OllamaHealthCheckResult> {
    const now = Date.now();

    if (this.cachedStatus && now < this.cachedStatus.validUntil) {
      return this.cachedStatus.result;
    }

    return this.checkHealth();
  }

  /**
   * Force health check bypassing cache
   *
   * Use this when you need absolutely fresh health status.
   *
   * @returns Fresh health check result
   */
  async forceCheck(): Promise<OllamaHealthCheckResult> {
    this.cachedStatus = null;
    return this.checkHealth();
  }

  /**
   * Check if Ollama daemon is running
   */
  private async checkDaemonConnectivity(): Promise<{
    running: boolean;
    version?: string;
    error?: string;
  }> {
    try {
      const response = await this.axiosInstance.get("/api/tags");
      const version = response.headers["x-ollama-version"] || "unknown";

      return { running: true, version };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED") {
          return {
            running: false,
            error: "Connection refused - Ollama not running",
          };
        }
        if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
          return {
            running: false,
            error: "Connection timeout - Ollama not responding",
          };
        }
        return {
          running: false,
          error: `HTTP ${error.response?.status}: ${error.message}`,
        };
      }
      return {
        running: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check model availability
   */
  private async checkModelAvailability(): Promise<{
    available: boolean;
    models?: string[];
  }> {
    if (!this.config.enableModelCheck) {
      return { available: true, models: [] };
    }

    try {
      const response = await this.axiosInstance.get("/api/tags");
      const models = response.data.models.map((m: { name: string }) => m.name);

      const defaultModelAvailable = models.some((m: string) =>
        m.startsWith(this.config.defaultModel)
      );

      return { available: defaultModelAvailable, models };
    } catch (error) {
      return { available: false, models: [] };
    }
  }

  /**
   * Check performance metrics
   */
  private async checkPerformance(): Promise<{
    responseTime: number;
    modelLoaded: boolean;
    pendingRequests?: number;
    cacheHitRate?: number;
    queueDepth?: number;
  }> {
    const startTime = Date.now();

    try {
      // Try a simple generate request with empty prompt to check if model is loaded
      await this.axiosInstance.post("/api/generate", {
        model: this.config.defaultModel,
        prompt: "",
        stream: false,
        keep_alive: 0, // Don't keep model loaded
      });

      return {
        responseTime: Date.now() - startTime,
        modelLoaded: true,
      };
    } catch (error) {
      // Model not loaded is OK, just means first request will be slower
      return {
        responseTime: Date.now() - startTime,
        modelLoaded: false,
      };
    }
  }

  /**
   * Check resource usage (memory, CPU, GPU)
   *
   * Note: This requires Ollama to expose stats endpoint
   * Returns null if stats are not available
   */
  private async checkResources(): Promise<{
    memoryUsage?: number;
    cpuUsage?: number;
    gpuUtilization?: number;
    vramUsage?: number;
  } | null> {
    try {
      const response = await this.axiosInstance.get("/api/stats");

      if (response.data) {
        return {
          memoryUsage: response.data.memory_used_mb,
          cpuUsage: response.data.cpu_usage_percent,
          gpuUtilization: response.data.gpu_utilization_percent,
          vramUsage: response.data.vram_used_mb,
        };
      }

      return null;
    } catch (error) {
      // Stats endpoint may not be available, that's OK
      return null;
    }
  }

  /**
   * Calculate overall health score (0-1)
   */
  private calculateHealthScore(metrics: {
    responseTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
    modelLoaded: boolean;
  }): number {
    let score = 1.0;

    // Response time factor (0-0.3 penalty)
    if (metrics.responseTime > this.config.maxResponseTime) {
      const ratio = metrics.responseTime / this.config.maxResponseTime;
      score -= Math.min(0.3, (ratio - 1) * 0.1);
    }

    // Memory usage factor (0-0.2 penalty)
    if (
      metrics.memoryUsage &&
      this.config.maxMemoryUsage &&
      metrics.memoryUsage > this.config.maxMemoryUsage
    ) {
      const ratio = metrics.memoryUsage / this.config.maxMemoryUsage;
      score -= Math.min(0.2, (ratio - 1) * 0.1);
    }

    // CPU usage factor (0-0.2 penalty)
    if (
      metrics.cpuUsage &&
      this.config.maxCpuUsage &&
      metrics.cpuUsage > this.config.maxCpuUsage
    ) {
      const ratio = metrics.cpuUsage / this.config.maxCpuUsage;
      score -= Math.min(0.2, (ratio - 1) * 0.1);
    }

    // Model loaded factor (0-0.1 penalty)
    if (!metrics.modelLoaded) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determine health status based on score and metrics
   */
  private determineHealthStatus(
    score: number,
    metrics: {
      responseTime: number;
      memoryUsage?: number;
      cpuUsage?: number;
    }
  ): "healthy" | "degraded" | "unhealthy" {
    // Unhealthy: daemon not running or model not available (handled before this)
    // Unhealthy: score < 0.3
    if (score < 0.3) {
      return "unhealthy";
    }

    // Degraded: score < 0.7 or any metric significantly exceeded
    if (score < 0.7) {
      return "degraded";
    }

    // Degraded: response time 2x over limit
    if (metrics.responseTime > this.config.maxResponseTime * 2) {
      return "degraded";
    }

    // Degraded: memory or CPU significantly over limit
    if (
      metrics.memoryUsage &&
      this.config.maxMemoryUsage &&
      metrics.memoryUsage > this.config.maxMemoryUsage * 1.5
    ) {
      return "degraded";
    }

    if (
      metrics.cpuUsage &&
      this.config.maxCpuUsage &&
      metrics.cpuUsage > this.config.maxCpuUsage * 1.5
    ) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Get health status message
   */
  private getHealthMessage(
    status: "healthy" | "degraded" | "unhealthy",
    perfCheck: { responseTime: number; modelLoaded: boolean }
  ): string {
    if (status === "healthy") {
      return `Ollama is healthy (${perfCheck.responseTime}ms response time)`;
    }

    if (status === "degraded") {
      return `Ollama is degraded (${perfCheck.responseTime}ms response time)`;
    }

    return "Ollama is unhealthy";
  }

  /**
   * Get degradation reason
   */
  private getDegradationReason(
    perfCheck: { responseTime: number },
    resourceCheck: {
      memoryUsage?: number;
      cpuUsage?: number;
    } | null
  ): string {
    const reasons: string[] = [];

    if (perfCheck.responseTime > this.config.maxResponseTime) {
      reasons.push(`slow response (${perfCheck.responseTime}ms)`);
    }

    if (
      resourceCheck?.memoryUsage &&
      this.config.maxMemoryUsage &&
      resourceCheck.memoryUsage > this.config.maxMemoryUsage
    ) {
      reasons.push(`high memory usage (${resourceCheck.memoryUsage}MB)`);
    }

    if (
      resourceCheck?.cpuUsage &&
      this.config.maxCpuUsage &&
      resourceCheck.cpuUsage > this.config.maxCpuUsage
    ) {
      reasons.push(`high CPU usage (${resourceCheck.cpuUsage}%)`);
    }

    return reasons.length > 0 ? reasons.join(", ") : "performance degraded";
  }

  /**
   * Cache health check result
   */
  private cacheResult(result: OllamaHealthCheckResult): void {
    const now = Date.now();
    this.cachedStatus = {
      result,
      timestamp: now,
      validUntil: now + this.config.cacheTTL,
    };
  }

  /**
   * Clear cached health status
   */
  clearCache(): void {
    this.cachedStatus = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): OllamaHealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OllamaHealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Update axios instance if needed
    if (config.baseURL !== undefined) {
      this.axiosInstance.defaults.baseURL = config.baseURL;
    }
    if (config.timeout !== undefined) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create an OllamaHealthChecker with default configuration
 *
 * @param baseURL - Ollama base URL (default: http://localhost:11434)
 * @param defaultModel - Default model to check (default: llama2)
 * @param config - Optional configuration overrides
 * @returns Configured OllamaHealthChecker
 */
export function createOllamaHealthChecker(
  baseURL?: string,
  defaultModel?: string,
  config?: Partial<Omit<OllamaHealthCheckConfig, "baseURL" | "defaultModel">>
): OllamaHealthChecker {
  const finalConfig: OllamaHealthCheckConfig = {
    baseURL: baseURL || "http://localhost:11434",
    defaultModel: defaultModel || "llama2",
    timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
    cacheTTL: config?.cacheTTL ?? DEFAULT_CONFIG.cacheTTL,
    maxResponseTime: config?.maxResponseTime ?? DEFAULT_CONFIG.maxResponseTime,
    maxMemoryUsage: config?.maxMemoryUsage ?? DEFAULT_CONFIG.maxMemoryUsage,
    maxCpuUsage: config?.maxCpuUsage ?? DEFAULT_CONFIG.maxCpuUsage,
    enablePerformanceMetrics:
      config?.enablePerformanceMetrics ?? DEFAULT_CONFIG.enablePerformanceMetrics,
    enableModelCheck: config?.enableModelCheck ?? DEFAULT_CONFIG.enableModelCheck,
    enableResourceMonitoring:
      config?.enableResourceMonitoring ?? DEFAULT_CONFIG.enableResourceMonitoring,
  };

  return new OllamaHealthChecker(finalConfig);
}
