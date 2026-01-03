/**
 * @fileoverview Tests for Common Base Types
 *
 * Tests verify:
 * - Base types can be extended
 * - Type compatibility works correctly
 * - Utility types function as expected
 * - Default values can be created
 */

import { describe, it, expect } from "vitest";
import type {
  BaseConfig,
  LoggingConfig,
  NetworkConfig,
  CacheConfig,
  ServiceConfig,
  BaseResult,
  ResultWithRequest,
  PaginatedResult,
  BaseRequest,
  BaseResponse,
  Adapter,
  StatusLevel,
  StatusInfo,
  HealthStatus,
  HealthCheckResult,
  BaseEvent,
  ErrorEvent,
  SystemEvent,
  SystemEventType,
  StateSnapshot,
  StateTransition,
  BaseOptions,
  QueryOptions,
  RouterConfig,
  PrivacyConfig,
  TrainingConfig,
  CheckpointConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExecutionResult,
  ExecutionStep,
  OptimizationResult,
  SystemState,
  AgentState,
  CacheState,
  RequestId,
  EventId,
  createRequestId,
  createEventId,
  RequiredFields,
  OptionalFields,
  KeysOfType,
  DeepPartial,
  DeepRequired,
} from "./common.js";

// ============================================================================
// CONFIG TYPE TESTS
// ============================================================================

describe("BaseConfig", () => {
  it("should accept partial config", () => {
    const config: BaseConfig = {
      timeout: 5000,
      retries: 3,
    };
    expect(config.timeout).toBe(5000);
    expect(config.retries).toBe(3);
  });

  it("should accept full config with logging", () => {
    const logging: LoggingConfig = {
      level: "debug",
      enabled: true,
      format: "json",
      timestamps: true,
    };

    const config: BaseConfig = {
      timeout: 5000,
      retries: 3,
      logging,
    };

    expect(config.logging?.level).toBe("debug");
  });

  it("should be extendable", () => {
    interface MyConfig extends BaseConfig {
      apiUrl: string;
      maxConnections: number;
    }

    const config: MyConfig = {
      timeout: 5000,
      retries: 3,
      apiUrl: "https://api.example.com",
      maxConnections: 10,
    };

    expect(config.apiUrl).toBe("https://api.example.com");
    expect(config.maxConnections).toBe(10);
  });
});

describe("NetworkConfig", () => {
  it("should accept network configuration", () => {
    const config: NetworkConfig = {
      baseURL: "https://api.example.com",
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      apiKey: "secret-key",
    };

    expect(config.baseURL).toBe("https://api.example.com");
  });
});

describe("CacheConfig", () => {
  it("should accept cache configuration", () => {
    const config: CacheConfig = {
      enabled: true,
      ttl: 60000,
      maxSize: 1000,
      evictionPolicy: "lru",
    };

    expect(config.enabled).toBe(true);
    expect(config.evictionPolicy).toBe("lru");
  });
});

describe("ServiceConfig", () => {
  it("should combine all config types", () => {
    const config: ServiceConfig = {
      name: "my-service",
      version: "1.0.0",
      enabled: true,
      baseURL: "https://api.example.com",
      timeout: 5000,
      enabled: true,
      ttl: 60000,
      maxSize: 100,
      level: "info",
    };

    expect(config.name).toBe("my-service");
    expect(config.baseURL).toBe("https://api.example.com");
  });
});

// ============================================================================
// RESULT TYPE TESTS
// ============================================================================

describe("BaseResult", () => {
  it("should accept successful result", () => {
    const result: BaseResult<string> = {
      success: true,
      data: "Hello, World!",
      timestamp: Date.now(),
      duration: 100,
    };

    expect(result.success).toBe(true);
    expect(result.data).toBe("Hello, World!");
  });

  it("should accept failed result", () => {
    const result: BaseResult<string> = {
      success: false,
      error: new Error("Something went wrong"),
      timestamp: Date.now(),
      duration: 50,
    };

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("should accept result with metadata", () => {
    const result: BaseResult<string> = {
      success: true,
      data: "Hello, World!",
      timestamp: Date.now(),
      metadata: {
        requestId: "req-123",
        userId: "user-456",
      },
    };

    expect(result.metadata?.requestId).toBe("req-123");
  });
});

describe("ResultWithRequest", () => {
  it("should include request ID", () => {
    const result: ResultWithRequest<string> = {
      success: true,
      data: "Hello, World!",
      timestamp: Date.now(),
      requestId: "req-123",
    };

    expect(result.requestId).toBe("req-123");
  });
});

describe("PaginatedResult", () => {
  it("should include pagination info", () => {
    const result: PaginatedResult<string> = {
      success: true,
      data: ["item1", "item2", "item3"],
      timestamp: Date.now(),
      page: 0,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrevious: false,
    };

    expect(result.page).toBe(0);
    expect(result.total).toBe(25);
    expect(result.hasNext).toBe(true);
  });
});

// ============================================================================
// REQUEST/RESPONSE TYPE TESTS
// ============================================================================

describe("BaseRequest", () => {
  it("should accept request with payload", () => {
    interface MyPayload {
      query: string;
      limit: number;
    }

    const request: BaseRequest<MyPayload> = {
      id: "req-123",
      timestamp: Date.now(),
      timeout: 5000,
      payload: {
        query: "test",
        limit: 10,
      },
    };

    expect(request.payload?.query).toBe("test");
  });
});

describe("BaseResponse", () => {
  it("should accept response", () => {
    const response: BaseResponse<string> = {
      success: true,
      data: "Response data",
      timestamp: Date.now(),
      requestId: "req-123",
      duration: 100,
      fromCache: false,
    };

    expect(response.requestId).toBe("req-123");
    expect(response.fromCache).toBe(false);
  });
});

// ============================================================================
// STATUS TYPE TESTS
// ============================================================================

describe("StatusInfo", () => {
  it("should accept status info", () => {
    const status: StatusInfo = {
      status: "active",
      message: "Running normally",
      progress: 0.5,
      timestamp: Date.now(),
    };

    expect(status.status).toBe("active");
    expect(status.progress).toBe(0.5);
  });

  it("should accept all status levels", () => {
    const levels: StatusLevel[] = [
      "idle",
      "active",
      "busy",
      "error",
      "offline",
    ];
    levels.forEach(level => {
      const status: StatusInfo = {
        status: level,
        timestamp: Date.now(),
      };
      expect(status.status).toBe(level);
    });
  });
});

describe("HealthStatus", () => {
  it("should extend status with health info", () => {
    const health: HealthStatus = {
      status: "active",
      timestamp: Date.now(),
      healthy: true,
      score: 0.95,
      message: "All systems operational",
    };

    expect(health.healthy).toBe(true);
    expect(health.score).toBe(0.95);
  });
});

describe("HealthCheckResult", () => {
  it("should accept healthy result", () => {
    const result: HealthCheckResult = {
      healthy: true,
      score: 1.0,
      message: "Service is healthy",
      timestamp: Date.now(),
      duration: 50,
    };

    expect(result.healthy).toBe(true);
  });

  it("should accept unhealthy result", () => {
    const result: HealthCheckResult = {
      healthy: false,
      score: 0.3,
      message: "Service is degraded",
      error: "Connection timeout",
      timestamp: Date.now(),
    };

    expect(result.healthy).toBe(false);
    expect(result.error).toBe("Connection timeout");
  });
});

// ============================================================================
// EVENT TYPE TESTS
// ============================================================================

describe("BaseEvent", () => {
  it("should accept base event", () => {
    const event: BaseEvent = {
      type: "test.event",
      timestamp: Date.now(),
      source: "test-service",
      id: "event-123",
      correlationId: "corr-456",
    };

    expect(event.type).toBe("test.event");
    expect(event.source).toBe("test-service");
  });
});

describe("ErrorEvent", () => {
  it("should accept error event", () => {
    const error = new Error("Test error");
    const event: ErrorEvent = {
      type: "error",
      timestamp: Date.now(),
      source: "test-service",
      error,
      context: {
        userId: "user-123",
      },
      stack: error.stack,
    };

    expect(event.type).toBe("error");
    expect(event.error.message).toBe("Test error");
  });
});

describe("SystemEvent", () => {
  it("should accept all system event types", () => {
    const types: SystemEventType[] = [
      "system.started",
      "system.stopped",
      "system.error",
      "cache.hit",
      "cache.miss",
      "cache.invalidate",
      "route.decision",
      "checkpoint.triggered",
      "checkpoint.approved",
      "checkpoint.rejected",
    ];

    types.forEach(type => {
      const event: SystemEvent = {
        type,
        timestamp: Date.now(),
        source: "system",
      };
      expect(event.type).toBe(type);
    });
  });
});

// ============================================================================
// STATE TYPE TESTS
// ============================================================================

describe("StateSnapshot", () => {
  it("should capture state with version", () => {
    interface MyState {
      value: number;
      label: string;
    }

    const snapshot: StateSnapshot<MyState> = {
      state: {
        value: 42,
        label: "test",
      },
      timestamp: Date.now(),
      version: 1,
      previousVersion: 0,
    };

    expect(snapshot.state.value).toBe(42);
    expect(snapshot.version).toBe(1);
  });
});

describe("StateTransition", () => {
  it("should capture state transition", () => {
    interface MyState {
      value: number;
    }

    const transition: StateTransition<MyState> = {
      from: { value: 1 },
      to: { value: 2 },
      timestamp: Date.now(),
      reason: "increment",
      trigger: "user-action",
    };

    expect(transition.from.value).toBe(1);
    expect(transition.to.value).toBe(2);
    expect(transition.reason).toBe("increment");
  });
});

// ============================================================================
// OPTIONS TYPE TESTS
// ============================================================================

describe("BaseOptions", () => {
  it("should accept base options", () => {
    const options: BaseOptions = {
      timeout: 5000,
      metadata: {
        trace: true,
      },
    };

    expect(options.timeout).toBe(5000);
  });
});

describe("QueryOptions", () => {
  it("should accept query options", () => {
    const options: QueryOptions = {
      filter: { status: "active" },
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 0,
      pageSize: 20,
      include: ["id", "name"],
      exclude: ["password"],
    };

    expect(options.sortOrder).toBe("desc");
    expect(options.page).toBe(0);
  });
});

// ============================================================================
// SPECIALIZED CONFIG TYPE TESTS
// ============================================================================

describe("RouterConfig", () => {
  it("should accept router configuration", () => {
    const config: RouterConfig = {
      complexityThreshold: 0.7,
      confidenceThreshold: 0.6,
      maxLatency: 1000,
      enableCostAware: true,
      enableCache: true,
      timeout: 5000,
    };

    expect(config.complexityThreshold).toBe(0.7);
    expect(config.enableCache).toBe(true);
  });
});

describe("PrivacyConfig", () => {
  it("should accept privacy configuration", () => {
    const config: PrivacyConfig = {
      enableRedaction: true,
      epsilon: 1.0,
      strictMode: false,
      minPrivacyLevel: "sensitive",
    };

    expect(config.enableRedaction).toBe(true);
    expect(config.epsilon).toBe(1.0);
  });
});

describe("TrainingConfig", () => {
  it("should accept training configuration", () => {
    const config: TrainingConfig = {
      epochs: 10,
      batchSize: 32,
      learningRate: 0.001,
      checkpointInterval: 1000,
      evalInterval: 500,
      device: "cuda",
    };

    expect(config.epochs).toBe(10);
    expect(config.device).toBe("cuda");
  });
});

describe("CheckpointConfig", () => {
  it("should accept checkpoint configuration", () => {
    const config: CheckpointConfig = {
      id: "cp-123",
      type: "approval",
      message: "Please approve this action",
      nodeId: "node-456",
      timeout: 30000,
      required: true,
    };

    expect(config.type).toBe("approval");
    expect(config.required).toBe(true);
  });
});

// ============================================================================
// SPECIALIZED RESULT TYPE TESTS
// ============================================================================

describe("ValidationResult", () => {
  it("should accept successful validation", () => {
    const result: ValidationResult = {
      success: true,
      valid: true,
      errors: [],
      warnings: [],
      timestamp: Date.now(),
    };

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should accept failed validation", () => {
    const error: ValidationError = {
      code: "INVALID_VALUE",
      message: "Value must be positive",
      path: "field.nested",
      value: -1,
    };

    const warning: ValidationWarning = {
      code: "DEPRECATED_FIELD",
      message: "This field is deprecated",
      path: "oldField",
    };

    const result: ValidationResult = {
      success: false,
      valid: false,
      errors: [error],
      warnings: [warning],
      timestamp: Date.now(),
    };

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_VALUE");
  });
});

describe("ExecutionResult", () => {
  it("should accept execution result", () => {
    const steps: ExecutionStep[] = [
      {
        name: "step1",
        status: "completed",
        startTime: Date.now() - 100,
        endTime: Date.now(),
        duration: 100,
        output: "step1 output",
      },
    ];

    const result: ExecutionResult<string> = {
      success: true,
      data: "final result",
      timestamp: Date.now(),
      executionTime: 200,
      memoryUsed: 1024 * 1024,
      steps,
    };

    expect(result.executionTime).toBe(200);
    expect(result.steps?.length).toBe(1);
  });
});

describe("OptimizationResult", () => {
  it("should accept optimization result", () => {
    const result: OptimizationResult<number> = {
      success: true,
      data: 100,
      timestamp: Date.now(),
      original: 80,
      optimized: 100,
      improvement: 20,
      improvementPercent: 25,
    };

    expect(result.original).toBe(80);
    expect(result.optimized).toBe(100);
    expect(result.improvementPercent).toBe(25);
  });
});

// ============================================================================
// SPECIALIZED STATE TYPE TESTS
// ============================================================================

describe("SystemState", () => {
  it("should accept system state", () => {
    const state: SystemState = {
      status: "active",
      uptime: 3600000,
      health: "healthy",
      metrics: {
        cpu: 50,
        memory: 60,
      },
    };

    expect(state.status).toBe("active");
    expect(state.health).toBe("healthy");
  });
});

describe("AgentState", () => {
  it("should accept agent state", () => {
    const state: AgentState = {
      agentId: "agent-123",
      status: "busy",
      uptime: 3600000,
      health: "healthy",
      currentTask: "process-request",
      queueSize: 5,
      processedCount: 100,
      errorCount: 2,
    };

    expect(state.currentTask).toBe("process-request");
    expect(state.queueSize).toBe(5);
  });
});

describe("CacheState", () => {
  it("should accept cache state", () => {
    const state: CacheState = {
      size: 500,
      maxSize: 1000,
      hitRate: 0.85,
      hits: 850,
      misses: 150,
      evictions: 50,
    };

    expect(state.hitRate).toBe(0.85);
    expect(state.hits).toBe(850);
  });
});

// ============================================================================
// UTILITY TYPE TESTS
// ============================================================================

describe("Branded ID Types", () => {
  it("should create branded request ID", () => {
    const id = createRequestId("req-123");
    const typedId: RequestId = id;

    // Should accept string operations
    expect(typedId).toBe("req-123");
    expect(typedId.toUpperCase()).toBe("REQ-123");
  });

  it("should create branded event ID", () => {
    const id = createEventId("event-456");
    const typedId: EventId = id;

    expect(typedId).toBe("event-456");
  });
});

describe("Utility Types", () => {
  it("should make fields required", () => {
    interface TestType {
      optional1?: string;
      optional2?: number;
      required: boolean;
    }

    type WithRequired = RequiredFields<TestType, "optional1">;

    const value: WithRequired = {
      optional1: "test",
      required: true,
      // optional2 is still optional
    };

    expect(value.optional1).toBe("test");
  });

  it("should make fields optional", () => {
    interface TestType {
      required1: string;
      required2: number;
      optional?: boolean;
    }

    type WithOptional = OptionalFields<TestType, "required1">;

    const value: WithOptional = {
      required2: 42,
      // required1 is now optional
    };

    expect(value.required2).toBe(42);
  });

  it("should extract keys of type", () => {
    interface TestType {
      str1: string;
      str2: string;
      num: number;
      bool: boolean;
    }

    type StringKeys = KeysOfType<TestType, string>;

    // StringKeys should be 'str1' | 'str2'
    const key1: StringKeys = "str1";
    const key2: StringKeys = "str2";

    expect(key1).toBe("str1");
    expect(key2).toBe("str2");
  });

  it("should create deep partial type", () => {
    interface NestedType {
      level1: {
        level2: {
          value: string;
        };
      };
    }

    const partial: DeepPartial<NestedType> = {
      level1: {
        // All nested fields are optional
        level2: {
          value: "test",
        },
      },
    };

    expect(partial.level1?.level2?.value).toBe("test");
  });

  it("should create deep required type", () => {
    interface NestedPartial {
      level1?: {
        level2?: {
          value?: string;
        };
      };
    }

    const required: DeepRequired<NestedPartial> = {
      level1: {
        level2: {
          value: "test",
        },
      },
    };

    expect(required.level1.level2.value).toBe("test");
  });
});
