"use strict";
/**
 * ACP Handshake Protocol
 *
 * Multi-model collaboration handshake for Assisted Collaborative Processing (ACP).
 *
 * This module implements the handshake protocol that coordinates multiple models
 * to work together on complex requests. The handshake process:
 * 1. Client sends ACPHandshakeRequest with desired models and collaboration mode
 * 2. Server validates request, checks model availability, filters by preferences
 * 3. Server generates execution plan with steps and aggregation strategy
 * 4. Server returns ACPHandshakeResponse with selected models and estimates
 * 5. Models coordinate based on collaboration mode and execute the plan
 * 6. Results are aggregated and returned to client
 *
 * Collaboration Modes:
 * - SEQUENTIAL: Models process one after another, each building on previous output
 * - PARALLEL: Models process simultaneously, results aggregated
 * - CASCADE: Output of one model feeds into the next as input
 * - ENSEMBLE: Multiple models process independently, outputs combined (voting/averaging)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACPHandshake = exports.AggregationStrategy = void 0;
exports.createHandshakeRequest = createHandshakeRequest;
var atp_acp_js_1 = require("./atp-acp.js");
/**
 * Aggregation Strategy
 *
 * Defines how outputs from multiple models are combined.
 */
var AggregationStrategy;
(function (AggregationStrategy) {
    /** Return the first response received */
    AggregationStrategy["FIRST"] = "first";
    /** Return the last response received (for sequential/cascade) */
    AggregationStrategy["LAST"] = "last";
    /** Majority voting across models */
    AggregationStrategy["MAJORITY_VOTE"] = "majority_vote";
    /** Weighted average based on confidence scores */
    AggregationStrategy["WEIGHTED_AVERAGE"] = "weighted_average";
    /** Return the response with highest confidence */
    AggregationStrategy["BEST"] = "best";
    /** Concatenate all responses */
    AggregationStrategy["CONCATENATE"] = "concatenate";
    /** Return all responses (let client decide) */
    AggregationStrategy["ALL"] = "all";
})(AggregationStrategy || (exports.AggregationStrategy = AggregationStrategy = {}));
/**
 * ACPHandshake - Multi-model collaboration coordinator
 *
 * Processes handshake requests and generates execution plans for
 * multi-model collaboration.
 */
var ACPHandshake = /** @class */ (function () {
    function ACPHandshake() {
        this.modelRegistry = new Map([
            [
                "gpt-4",
                {
                    id: "gpt-4",
                    available: true,
                    avgLatency: 800,
                    costPer1kTokens: 0.03,
                    quality: 0.95,
                },
            ],
            [
                "gpt-3.5-turbo",
                {
                    id: "gpt-3.5-turbo",
                    available: true,
                    avgLatency: 300,
                    costPer1kTokens: 0.002,
                    quality: 0.85,
                },
            ],
            [
                "claude-3",
                {
                    id: "claude-3",
                    available: true,
                    avgLatency: 600,
                    costPer1kTokens: 0.015,
                    quality: 0.92,
                },
            ],
            [
                "llama-3.1-8b",
                {
                    id: "llama-3.1-8b",
                    available: true,
                    avgLatency: 200,
                    costPer1kTokens: 0,
                    quality: 0.75,
                },
            ],
            [
                "mistral",
                {
                    id: "mistral",
                    available: true,
                    avgLatency: 250,
                    costPer1kTokens: 0.001,
                    quality: 0.8,
                },
            ],
            [
                "codellama",
                {
                    id: "codellama",
                    available: true,
                    avgLatency: 350,
                    costPer1kTokens: 0,
                    quality: 0.78,
                },
            ],
        ]);
    }
    /**
     * Process handshake request and generate response
     *
     * Validates request, checks model availability, filters by preferences,
     * creates execution plan, and estimates resources.
     *
     * @param request - Handshake request from client
     * @returns Handshake response with execution plan
     *
     * @example
     * ```typescript
     * const handshake = new ACPHandshake();
     * const response = await handshake.processHandshake({
     *   id: 'acp-123',
     *   query: 'Design a secure authentication system',
     *   intent: IntentCategory.CODE_GENERATION,
     *   collaborationMode: CollaborationMode.CASCADE,
     *   models: ['gpt-4', 'codellama', 'mistral'],
     *   preferences: { maxLatency: 2000, maxCost: 0.05 },
     *   timestamp: Date.now()
     * });
     * ```
     */
    ACPHandshake.prototype.processHandshake = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var availableModels, selectedModels, executionPlan, estimatedLatency, estimatedCost, minModelQuality;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // 1. Validate request
                        this.validateRequest(request);
                        return [4 /*yield*/, this.checkAvailability(request.models)];
                    case 1:
                        availableModels = _a.sent();
                        if (availableModels.length === 0) {
                            return [2 /*return*/, {
                                    requestId: request.id,
                                    status: "rejected",
                                    selectedModels: [],
                                    reason: "No requested models available",
                                    executionPlan: this.createEmptyPlan(),
                                    estimatedLatency: 0,
                                    estimatedCost: 0,
                                }];
                        }
                        selectedModels = this.filterByPreferences(availableModels, request.preferences);
                        if (selectedModels.length === 0) {
                            return [2 /*return*/, {
                                    requestId: request.id,
                                    status: "rejected",
                                    selectedModels: availableModels,
                                    reason: "No models match preferences (cost/latency constraints)",
                                    executionPlan: this.createEmptyPlan(),
                                    estimatedLatency: 0,
                                    estimatedCost: 0,
                                }];
                        }
                        executionPlan = this.createExecutionPlan(request.collaborationMode, selectedModels);
                        estimatedLatency = this.estimateLatency(executionPlan);
                        estimatedCost = this.estimateCost(executionPlan);
                        // 6. Check constraints
                        if (request.preferences.maxLatency &&
                            estimatedLatency > request.preferences.maxLatency) {
                            return [2 /*return*/, {
                                    requestId: request.id,
                                    status: "rejected",
                                    selectedModels: selectedModels,
                                    reason: "Estimated latency (".concat(estimatedLatency, "ms) exceeds maximum (").concat(request.preferences.maxLatency, "ms)"),
                                    executionPlan: executionPlan,
                                    estimatedLatency: estimatedLatency,
                                    estimatedCost: estimatedCost,
                                }];
                        }
                        if (request.preferences.maxCost &&
                            estimatedCost > request.preferences.maxCost) {
                            return [2 /*return*/, {
                                    requestId: request.id,
                                    status: "rejected",
                                    selectedModels: selectedModels,
                                    reason: "Estimated cost ($".concat(estimatedCost.toFixed(4), ") exceeds maximum ($").concat(request.preferences.maxCost.toFixed(4), ")"),
                                    executionPlan: executionPlan,
                                    estimatedLatency: estimatedLatency,
                                    estimatedCost: estimatedCost,
                                }];
                        }
                        // Check minimum quality
                        if (request.preferences.minQuality) {
                            minModelQuality = Math.min.apply(Math, selectedModels.map(function (m) { var _a, _b; return (_b = (_a = _this.modelRegistry.get(m)) === null || _a === void 0 ? void 0 : _a.quality) !== null && _b !== void 0 ? _b : 0; }));
                            if (minModelQuality < request.preferences.minQuality) {
                                return [2 /*return*/, {
                                        requestId: request.id,
                                        status: "rejected",
                                        selectedModels: selectedModels,
                                        reason: "Model quality (".concat(minModelQuality.toFixed(2), ") below minimum (").concat(request.preferences.minQuality.toFixed(2), ")"),
                                        executionPlan: executionPlan,
                                        estimatedLatency: estimatedLatency,
                                        estimatedCost: estimatedCost,
                                    }];
                            }
                        }
                        return [2 /*return*/, {
                                requestId: request.id,
                                status: "accepted",
                                selectedModels: selectedModels,
                                executionPlan: executionPlan,
                                estimatedLatency: estimatedLatency,
                                estimatedCost: estimatedCost,
                            }];
                }
            });
        });
    };
    /**
     * Validate handshake request
     *
     * Ensures all required fields are present and valid.
     *
     * @param request - Request to validate
     * @throws Error if validation fails
     *
     * @private
     */
    ACPHandshake.prototype.validateRequest = function (request) {
        if (!request.id) {
            throw new Error("Request ID is required");
        }
        if (!request.query) {
            throw new Error("Query is required");
        }
        if (request.models.length === 0) {
            throw new Error("At least one model must be specified");
        }
        if (!Object.values(atp_acp_js_1.CollaborationMode).includes(request.collaborationMode)) {
            throw new Error("Invalid collaboration mode: ".concat(request.collaborationMode));
        }
    };
    /**
     * Check model availability
     *
     * Filters requested models to only those available in the registry.
     *
     * @param models - Requested model identifiers
     * @returns Array of available model identifiers
     *
     * @private
     */
    ACPHandshake.prototype.checkAvailability = function (models) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, models.filter(function (model) {
                        var _a;
                        var metadata = _this.modelRegistry.get(model);
                        return (_a = metadata === null || metadata === void 0 ? void 0 : metadata.available) !== null && _a !== void 0 ? _a : false;
                    })];
            });
        });
    };
    /**
     * Filter models by preferences
     *
     * Applies cost, latency, and quality filters based on preferences.
     *
     * @param models - Available model identifiers
     * @param preferences - User preferences
     * @returns Filtered model identifiers
     *
     * @private
     */
    ACPHandshake.prototype.filterByPreferences = function (models, preferences) {
        var _this = this;
        var filtered = __spreadArray([], models, true);
        // Filter by max cost
        if (preferences.maxCost) {
            filtered = filtered.filter(function (model) {
                var _a;
                var metadata = _this.modelRegistry.get(model);
                // Assume average 1K tokens per query
                return ((_a = metadata === null || metadata === void 0 ? void 0 : metadata.costPer1kTokens) !== null && _a !== void 0 ? _a : 0) <= preferences.maxCost;
            });
        }
        // Filter by priority (prefer faster models)
        if (preferences.priority === atp_acp_js_1.Urgency.HIGH ||
            preferences.priority === atp_acp_js_1.Urgency.CRITICAL) {
            // Sort by latency (fastest first) and take top 2
            filtered = filtered
                .sort(function (a, b) {
                var _a, _b, _c, _d;
                var latencyA = (_b = (_a = _this.modelRegistry.get(a)) === null || _a === void 0 ? void 0 : _a.avgLatency) !== null && _b !== void 0 ? _b : Infinity;
                var latencyB = (_d = (_c = _this.modelRegistry.get(b)) === null || _c === void 0 ? void 0 : _c.avgLatency) !== null && _d !== void 0 ? _d : Infinity;
                return latencyA - latencyB;
            })
                .slice(0, 2);
        }
        return filtered;
    };
    /**
     * Create execution plan based on collaboration mode
     *
     * Generates ordered steps and selects aggregation strategy.
     *
     * @param mode - Collaboration mode
     * @param models - Selected models
     * @returns Execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createExecutionPlan = function (mode, models) {
        switch (mode) {
            case atp_acp_js_1.CollaborationMode.SEQUENTIAL:
                return this.createSequentialPlan(models);
            case atp_acp_js_1.CollaborationMode.PARALLEL:
                return this.createParallelPlan(models);
            case atp_acp_js_1.CollaborationMode.CASCADE:
                return this.createCascadePlan(models);
            case atp_acp_js_1.CollaborationMode.ENSEMBLE:
                return this.createEnsemblePlan(models);
            default:
                // Fallback to sequential
                return this.createSequentialPlan(models);
        }
    };
    /**
     * Create sequential execution plan
     *
     * Models process one after another, each building on previous output.
     *
     * @param models - Models to use
     * @returns Sequential execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createSequentialPlan = function (models) {
        var _this = this;
        return {
            mode: atp_acp_js_1.CollaborationMode.SEQUENTIAL,
            steps: models.map(function (model, i) {
                var _a, _b;
                return ({
                    stepNumber: i + 1,
                    model: model,
                    inputSource: i === 0 ? "original" : "previous",
                    outputTarget: i === models.length - 1 ? "final" : "next",
                    estimatedLatency: (_b = (_a = _this.modelRegistry.get(model)) === null || _a === void 0 ? void 0 : _a.avgLatency) !== null && _b !== void 0 ? _b : 500,
                });
            }),
            aggregationStrategy: AggregationStrategy.LAST,
        };
    };
    /**
     * Create parallel execution plan
     *
     * Models process simultaneously with original query, results aggregated.
     *
     * @param models - Models to use
     * @returns Parallel execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createParallelPlan = function (models) {
        var _this = this;
        var maxLatency = Math.max.apply(Math, models.map(function (m) { var _a, _b; return (_b = (_a = _this.modelRegistry.get(m)) === null || _a === void 0 ? void 0 : _a.avgLatency) !== null && _b !== void 0 ? _b : 300; }));
        return {
            mode: atp_acp_js_1.CollaborationMode.PARALLEL,
            steps: models.map(function (model, i) { return ({
                stepNumber: i + 1,
                model: model,
                inputSource: "original",
                outputTarget: "aggregator",
                estimatedLatency: maxLatency, // All run in parallel, so max latency
            }); }),
            aggregationStrategy: AggregationStrategy.BEST,
        };
    };
    /**
     * Create cascade execution plan
     *
     * Output of each model feeds into the next as input.
     * Similar to sequential but with explicit refinement focus.
     *
     * @param models - Models to use
     * @returns Cascade execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createCascadePlan = function (models) {
        var _this = this;
        return {
            mode: atp_acp_js_1.CollaborationMode.CASCADE,
            steps: models.map(function (model, i) {
                var _a, _b;
                return ({
                    stepNumber: i + 1,
                    model: model,
                    inputSource: i === 0 ? "original" : "previous",
                    outputTarget: i === models.length - 1 ? "final" : "next",
                    estimatedLatency: (_b = (_a = _this.modelRegistry.get(model)) === null || _a === void 0 ? void 0 : _a.avgLatency) !== null && _b !== void 0 ? _b : 400,
                });
            }),
            aggregationStrategy: AggregationStrategy.LAST,
        };
    };
    /**
     * Create ensemble execution plan
     *
     * Multiple models process independently, outputs combined via voting/averaging.
     *
     * @param models - Models to use
     * @returns Ensemble execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createEnsemblePlan = function (models) {
        var _this = this;
        var maxLatency = Math.max.apply(Math, models.map(function (m) { var _a, _b; return (_b = (_a = _this.modelRegistry.get(m)) === null || _a === void 0 ? void 0 : _a.avgLatency) !== null && _b !== void 0 ? _b : 350; }));
        return {
            mode: atp_acp_js_1.CollaborationMode.ENSEMBLE,
            steps: models.map(function (model, i) { return ({
                stepNumber: i + 1,
                model: model,
                inputSource: "original",
                outputTarget: "aggregator",
                estimatedLatency: maxLatency,
            }); }),
            aggregationStrategy: AggregationStrategy.WEIGHTED_AVERAGE,
        };
    };
    /**
     * Create empty execution plan
     *
     * Used for rejected requests.
     *
     * @returns Empty execution plan
     *
     * @private
     */
    ACPHandshake.prototype.createEmptyPlan = function () {
        return {
            mode: atp_acp_js_1.CollaborationMode.SEQUENTIAL,
            steps: [],
            aggregationStrategy: AggregationStrategy.FIRST,
        };
    };
    /**
     * Estimate total latency for execution plan
     *
     * For parallel/ensemble: returns max step latency (all run concurrently)
     * For sequential/cascade: returns sum of step latencies
     *
     * @param plan - Execution plan
     * @returns Estimated latency in milliseconds
     *
     * @private
     */
    ACPHandshake.prototype.estimateLatency = function (plan) {
        if (plan.mode === atp_acp_js_1.CollaborationMode.PARALLEL ||
            plan.mode === atp_acp_js_1.CollaborationMode.ENSEMBLE) {
            // Parallel execution: max of step latencies
            return Math.max.apply(Math, __spreadArray(__spreadArray([], plan.steps.map(function (s) { return s.estimatedLatency; }), false), [0], false));
        }
        else {
            // Sequential execution: sum of step latencies
            return plan.steps.reduce(function (sum, step) { return sum + step.estimatedLatency; }, 0);
        }
    };
    /**
     * Estimate total cost for execution plan
     *
     * Sum of model costs (all models incur cost regardless of mode).
     *
     * @param plan - Execution plan
     * @returns Estimated cost in USD
     *
     * @private
     */
    ACPHandshake.prototype.estimateCost = function (plan) {
        var _this = this;
        // Assume average 1K tokens per model invocation
        var tokensPerInvocation = 1;
        return plan.steps.reduce(function (sum, step) {
            var _a;
            var metadata = _this.modelRegistry.get(step.model);
            var costPerInvocation = ((_a = metadata === null || metadata === void 0 ? void 0 : metadata.costPer1kTokens) !== null && _a !== void 0 ? _a : 0.01) * tokensPerInvocation;
            return sum + costPerInvocation;
        }, 0);
    };
    /**
     * Register or update model metadata
     *
     * Allows dynamic model registration (useful for testing).
     *
     * @param metadata - Model metadata to register
     */
    ACPHandshake.prototype.registerModel = function (metadata) {
        this.modelRegistry.set(metadata.id, metadata);
    };
    /**
     * Get metadata for a model
     *
     * @param modelId - Model identifier
     * @returns Model metadata or undefined
     */
    ACPHandshake.prototype.getModelMetadata = function (modelId) {
        return this.modelRegistry.get(modelId);
    };
    /**
     * Get all registered models
     *
     * @returns Array of all registered model identifiers
     */
    ACPHandshake.prototype.getRegisteredModels = function () {
        return Array.from(this.modelRegistry.keys());
    };
    /**
     * Validate an ACPHandshakeRequest
     *
     * Performs comprehensive validation of an ACP handshake request to ensure
     * it conforms to the protocol specification. This includes checking required
     * fields, types, enum values, ranges, arrays, and preferences.
     *
     * Note: This method dynamically imports the ProtocolValidator to avoid
     * circular dependencies. For better performance in hot loops, create
     * a ProtocolValidator instance separately.
     *
     * @param request - ACPHandshakeRequest to validate
     * @returns Validation result with errors and warnings
     * @throws Error if validation module is not available
     *
     * @example
     * ```typescript
     * const handshake = new ACPHandshake();
     * const result = await handshake.validate(handshakeRequest);
     * if (!result.valid) {
     *   console.error('Validation failed:', result.errors);
     *   for (const error of result.errors) {
     *     console.error(`  ${error.field}: ${error.message}`);
     *   }
     * }
     * ```
     */
    ACPHandshake.prototype.validate = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var ProtocolValidator, validator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./validation.js"); })];
                    case 1:
                        ProtocolValidator = (_a.sent()).ProtocolValidator;
                        validator = new ProtocolValidator();
                        return [2 /*return*/, validator.validateACPHandshake(request)];
                }
            });
        });
    };
    return ACPHandshake;
}());
exports.ACPHandshake = ACPHandshake;
/**
 * Create handshake request
 *
 * Helper function to create a properly formatted handshake request.
 *
 * @param query - User query text
 * @param models - Models to use
 * @param mode - Collaboration mode
 * @param preferences - Optional preferences
 * @returns Formatted handshake request
 *
 * @example
 * ```typescript
 * const request = createHandshakeRequest(
 *   'Explain quantum computing',
 *   ['gpt-4', 'claude-3'],
 *   CollaborationMode.PARALLEL,
 *   { maxLatency: 1000, maxCost: 0.05 }
 * );
 * ```
 */
function createHandshakeRequest(query, models, mode, preferences) {
    return {
        id: "acp-".concat(Date.now(), "-").concat(Math.random().toString(36).substr(2, 9)),
        query: query,
        intent: atp_acp_js_1.IntentCategory.QUERY,
        collaborationMode: mode,
        models: models,
        preferences: preferences !== null && preferences !== void 0 ? preferences : {},
        timestamp: Date.now(),
    };
}
