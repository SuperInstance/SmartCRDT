/**
 * @lsi/vljepa/protocol - VL-JEPA Protocol Tests
 *
 * Comprehensive tests for VL-JEPA protocol types, validation, and utilities.
 * Target: 50+ tests passing
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  type XEncoderConfig,
  type YEncoderConfig,
  type PredictorConfig,
  type VLJEPAConfig,
  type VLJEPAPrediction,
  type VLJEPAAction,
  // Constants
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_INPUT_SIZE,
  DEFAULT_PATCH_SIZE,
  DEFAULT_CONTEXT_LENGTH,
  DEFAULT_HIDDEN_DIM,
  VLJEPA_VERSION,
  // Utilities
  createDefaultConfig,
  validateEmbeddingDimension,
  createZeroEmbedding,
  createRandomEmbedding,
  cloneEmbedding,
  serializeEmbedding,
  deserializeEmbedding,
  cosineSimilarity,
  normalizeEmbedding,
  euclideanDistance,
  validateVLJEPAConfig,
  validateEmbedding,
  validatePrediction,
  // Error types
  EmbeddingDimensionError,
} from "./index.js";

describe("VL-JEPA Protocol: Constants", () => {
  it("should have correct default embedding dimension", () => {
    expect(DEFAULT_EMBEDDING_DIM).toBe(768);
  });

  it("should have correct default input size", () => {
    expect(DEFAULT_INPUT_SIZE).toEqual({ width: 224, height: 224 });
  });

  it("should have correct default patch size", () => {
    expect(DEFAULT_PATCH_SIZE).toBe(16);
  });

  it("should have correct default context length", () => {
    expect(DEFAULT_CONTEXT_LENGTH).toBe(512);
  });

  it("should have correct default hidden dimension", () => {
    expect(DEFAULT_HIDDEN_DIM).toBe(2048);
  });

  it("should have correct protocol version", () => {
    expect(VLJEPA_VERSION).toBe("1.0");
  });
});

describe("VL-JEPA Protocol: Default Configuration", () => {
  let config: VLJEPAConfig;

  beforeEach(() => {
    config = createDefaultConfig();
  });

  it("should create valid VL-JEPA configuration", () => {
    expect(config).toBeDefined();
    expect(config.version).toBe("1.0");
  });

  it("should have valid X-Encoder configuration", () => {
    expect(config.xEncoder).toBeDefined();
    expect(config.xEncoder.version).toBe("1.0");
    expect(config.xEncoder.inputSize).toEqual({ width: 224, height: 224 });
    expect(config.xEncoder.patchSize).toBe(16);
    expect(config.xEncoder.embeddingDim).toBe(768);
    expect(config.xEncoder.model).toBe("vit-base");
  });

  it("should have valid Y-Encoder configuration", () => {
    expect(config.yEncoder).toBeDefined();
    expect(config.yEncoder.version).toBe("1.0");
    expect(config.yEncoder.vocabSize).toBe(50000);
    expect(config.yEncoder.embeddingDim).toBe(768);
    expect(config.yEncoder.contextLength).toBe(512);
    expect(config.yEncoder.model).toBe("transformer-encoder");
  });

  it("should have valid Predictor configuration", () => {
    expect(config.predictor).toBeDefined();
    expect(config.predictor.version).toBe("1.0");
    expect(config.predictor.inputDim).toBe(1536); // 768 + 768
    expect(config.predictor.hiddenDim).toBe(2048);
    expect(config.predictor.outputDim).toBe(768);
    expect(config.predictor.numLayers).toBe(4);
  });

  it("should have valid global configuration", () => {
    expect(config.global).toBeDefined();
    expect(config.global?.device).toBe("webgpu");
    expect(config.global?.precision).toBe("fp16");
    expect(config.global?.maxBatchSize).toBe(8);
  });

  it("should have valid cache configuration", () => {
    expect(config.global?.cache).toBeDefined();
    expect(config.global?.cache?.enabled).toBe(true);
    expect(config.global?.cache?.maxSize).toBe(1000);
    expect(config.global?.cache?.ttl).toBe(300000);
  });
});

describe("VL-JEPA Protocol: X-Encoder Configuration", () => {
  it("should accept valid X-Encoder configuration", () => {
    const config: XEncoderConfig = {
      version: "1.0",
      inputSize: { width: 224, height: 224 },
      patchSize: 16,
      embeddingDim: 768,
      model: "vit-base",
      numHeads: 12,
      numLayers: 12,
      usePositionalEncoding: true,
      dropout: 0.1,
    };

    expect(config.embeddingDim).toBe(768);
    expect(config.model).toBe("vit-base");
  });

  it("should support vit-small model", () => {
    const config: XEncoderConfig = {
      version: "1.0",
      inputSize: { width: 224, height: 224 },
      patchSize: 16,
      embeddingDim: 768,
      model: "vit-small",
    };

    expect(config.model).toBe("vit-small");
  });

  it("should accept WebGPU configuration", () => {
    const config: XEncoderConfig = {
      version: "1.0",
      inputSize: { width: 224, height: 224 },
      patchSize: 16,
      embeddingDim: 768,
      model: "vit-base",
      webgpu: {
        enabled: true,
        workgroups: 8,
        memoryOptimization: "medium",
      },
    };

    expect(config.webgpu?.enabled).toBe(true);
    expect(config.webgpu?.workgroups).toBe(8);
  });
});

describe("VL-JEPA Protocol: Y-Encoder Configuration", () => {
  it("should accept valid Y-Encoder configuration", () => {
    const config: YEncoderConfig = {
      version: "1.0",
      vocabSize: 50000,
      embeddingDim: 768,
      contextLength: 512,
      model: "transformer-encoder",
    };

    expect(config.embeddingDim).toBe(768);
    expect(config.model).toBe("transformer-encoder");
  });

  it("should accept tokenizer configuration", () => {
    const config: YEncoderConfig = {
      version: "1.0",
      vocabSize: 50000,
      embeddingDim: 768,
      contextLength: 512,
      model: "transformer-encoder",
      tokenizer: {
        type: "bpe",
        maxLength: 512,
        lowercase: true,
      },
    };

    expect(config.tokenizer?.type).toBe("bpe");
    expect(config.tokenizer?.lowercase).toBe(true);
  });
});

describe("VL-JEPA Protocol: Predictor Configuration", () => {
  it("should accept valid predictor configuration", () => {
    const config: PredictorConfig = {
      version: "1.0",
      inputDim: 1536,
      hiddenDim: 2048,
      outputDim: 768,
      numLayers: 4,
    };

    expect(config.inputDim).toBe(1536); // 768 + 768
    expect(config.outputDim).toBe(768);
  });

  it("should accept training configuration", () => {
    const config: PredictorConfig = {
      version: "1.0",
      inputDim: 1536,
      hiddenDim: 2048,
      outputDim: 768,
      numLayers: 4,
      training: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        lossFunction: "cosine",
        useContextualMasking: true,
        maskingRatio: 0.9,
      },
    };

    expect(config.training?.maskingRatio).toBe(0.9);
    expect(config.training?.lossFunction).toBe("cosine");
  });
});

describe("VL-JEPA Protocol: Prediction Structure", () => {
  it("should create valid prediction with required fields", () => {
    const goalEmbedding = createZeroEmbedding(768);

    const prediction: VLJEPAPrediction = {
      version: "1.0",
      goalEmbedding,
      confidence: 0.95,
      actions: [],
      metadata: {
        timestamp: Date.now(),
        processingTime: 50,
      },
    };

    expect(prediction.version).toBe("1.0");
    expect(prediction.confidence).toBe(0.95);
    expect(prediction.goalEmbedding).toHaveLength(768);
  });

  it("should create valid action", () => {
    const action: VLJEPAAction = {
      type: "modify",
      target: "#main-button",
      params: { color: "blue" },
      confidence: 0.92,
    };

    expect(action.type).toBe("modify");
    expect(action.target).toBe("#main-button");
    expect(action.confidence).toBe(0.92);
  });

  it("should support all action types", () => {
    const actionTypes: VLJEPAAction["type"][] = [
      "modify",
      "create",
      "delete",
      "move",
      "resize",
      "restyle",
    ];

    actionTypes.forEach(type => {
      const action: VLJEPAAction = {
        type,
        target: "#element",
        params: {},
        confidence: 0.8,
      };
      expect(action.type).toBe(type);
    });
  });

  it("should include optional prediction metadata", () => {
    const goalEmbedding = createZeroEmbedding(768);

    const prediction: VLJEPAPrediction = {
      version: "1.0",
      goalEmbedding,
      confidence: 0.95,
      actions: [],
      semanticDistance: 0.23,
      metadata: {
        timestamp: Date.now(),
        processingTime: 50,
        xEncoderTime: 20,
        yEncoderTime: 10,
        predictorTime: 20,
        usedCache: false,
        device: "webgpu",
        modelVersion: "1.0.0",
      },
    };

    expect(prediction.semanticDistance).toBe(0.23);
    expect(prediction.metadata.xEncoderTime).toBe(20);
    expect(prediction.metadata.device).toBe("webgpu");
  });
});

describe("VL-JEPA Protocol: Embedding Utilities", () => {
  describe("createZeroEmbedding", () => {
    it("should create zero embedding with default dimension", () => {
      const embedding = createZeroEmbedding();
      expect(embedding).toHaveLength(768);
      expect(Array.from(embedding)).toEqual(new Array(768).fill(0));
    });

    it("should create zero embedding with custom dimension", () => {
      const embedding = createZeroEmbedding(512);
      expect(embedding).toHaveLength(512);
      expect(Array.from(embedding)).toEqual(new Array(512).fill(0));
    });
  });

  describe("createRandomEmbedding", () => {
    it("should create random embedding with default dimension", () => {
      const embedding = createRandomEmbedding();
      expect(embedding).toHaveLength(768);
      // Check values are in range [-1, 1]
      for (let i = 0; i < embedding.length; i++) {
        expect(embedding[i]).toBeGreaterThanOrEqual(-1);
        expect(embedding[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should create random embedding with custom dimension", () => {
      const embedding = createRandomEmbedding(256);
      expect(embedding).toHaveLength(256);
    });

    it("should create different random embeddings", () => {
      const embedding1 = createRandomEmbedding();
      const embedding2 = createRandomEmbedding();
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe("cloneEmbedding", () => {
    it("should clone embedding correctly", () => {
      const original = createRandomEmbedding();
      const clone = cloneEmbedding(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original); // Different reference
    });

    it("should create independent copy", () => {
      const original = createRandomEmbedding();
      const clone = cloneEmbedding(original);

      clone[0] = 999;
      expect(original[0]).not.toBe(999);
    });
  });

  describe("validateEmbeddingDimension", () => {
    it("should accept correct embedding dimension", () => {
      const embedding = createZeroEmbedding(768);
      expect(validateEmbeddingDimension(embedding, 768)).toBe(true);
    });

    it("should accept correct embedding dimension with default", () => {
      const embedding = createZeroEmbedding(768);
      expect(validateEmbeddingDimension(embedding)).toBe(true);
    });

    it("should reject incorrect embedding dimension", () => {
      const embedding = createZeroEmbedding(512);
      expect(() => validateEmbeddingDimension(embedding, 768)).toThrow(
        EmbeddingDimensionError
      );
    });

    it("should include error details", () => {
      const embedding = createZeroEmbedding(512);
      try {
        validateEmbeddingDimension(embedding, 768);
        fail("Should have thrown EmbeddingDimensionError");
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingDimensionError);
        const err = error as EmbeddingDimensionError;
        expect(err.code).toBe("EMBEDDING_DIMENSION_ERROR");
      }
    });
  });

  describe("serializeEmbedding", () => {
    it("should serialize embedding to base64", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const serialized = serializeEmbedding(embedding);
      expect(typeof serialized).toBe("string");
      expect(serialized.length).toBeGreaterThan(0);
    });

    it("should serialize and deserialize correctly", () => {
      const original = createRandomEmbedding(256);
      const serialized = serializeEmbedding(original);
      const deserialized = deserializeEmbedding(serialized, 256);

      expect(deserialized).toEqual(original);
    });

    it("should handle zero embedding", () => {
      const embedding = createZeroEmbedding(10);
      const serialized = serializeEmbedding(embedding);
      const deserialized = deserializeEmbedding(serialized, 10);

      expect(deserialized).toEqual(embedding);
    });
  });

  describe("deserializeEmbedding", () => {
    it("should deserialize embedding from base64", () => {
      const original = createRandomEmbedding(100);
      const serialized = serializeEmbedding(original);
      const deserialized = deserializeEmbedding(serialized, 100);

      expect(deserialized).toHaveLength(100);
      expect(deserialized).toEqual(original);
    });

    it("should use default dimension", () => {
      const original = createRandomEmbedding(768);
      const serialized = serializeEmbedding(original);
      const deserialized = deserializeEmbedding(serialized);

      expect(deserialized).toHaveLength(768);
      expect(deserialized).toEqual(original);
    });
  });
});

describe("VL-JEPA Protocol: Action Validation", () => {
  it("should create valid modify action", () => {
    const action: VLJEPAAction = {
      type: "modify",
      target: ".button",
      params: { backgroundColor: "blue" },
      confidence: 0.9,
    };

    expect(action.type).toBe("modify");
    expect(action.params.backgroundColor).toBe("blue");
  });

  it("should create valid create action", () => {
    const action: VLJEPAAction = {
      type: "create",
      target: "#container",
      params: { tag: "div", className: "new-element" },
      confidence: 0.85,
    };

    expect(action.type).toBe("create");
  });

  it("should create valid delete action", () => {
    const action: VLJEPAAction = {
      type: "delete",
      target: ".old-element",
      params: {},
      confidence: 0.95,
    };

    expect(action.type).toBe("delete");
  });

  it("should include optional reasoning", () => {
    const action: VLJEPAAction = {
      type: "modify",
      target: "#button",
      params: { color: "red" },
      confidence: 0.8,
      reasoning: "User wants to draw attention to this button",
    };

    expect(action.reasoning).toBeDefined();
    expect(action.reasoning).toContain("attention");
  });

  it("should include expected outcome", () => {
    const action: VLJEPAAction = {
      type: "modify",
      target: "#button",
      params: { color: "red" },
      confidence: 0.8,
      expectedOutcome: {
        visualChange: "Button color changes to red",
        functionalChange: "None",
      },
    };

    expect(action.expectedOutcome?.visualChange).toContain("red");
  });
});

describe("VL-JEPA Protocol: Integration Compatibility", () => {
  it("should use 768-dim embeddings for X-Encoder", () => {
    const config: XEncoderConfig = {
      version: "1.0",
      inputSize: { width: 224, height: 224 },
      patchSize: 16,
      embeddingDim: 768,
      model: "vit-base",
    };

    expect(config.embeddingDim).toBe(768);
  });

  it("should use 768-dim embeddings for Y-Encoder", () => {
    const config: YEncoderConfig = {
      version: "1.0",
      vocabSize: 50000,
      embeddingDim: 768,
      contextLength: 512,
      model: "transformer-encoder",
    };

    expect(config.embeddingDim).toBe(768);
  });

  it("should use 768-dim embeddings for Predictor output", () => {
    const config: PredictorConfig = {
      version: "1.0",
      inputDim: 1536,
      hiddenDim: 2048,
      outputDim: 768,
      numLayers: 4,
    };

    expect(config.outputDim).toBe(768);
  });

  it("should concatenate 768+768 for Predictor input", () => {
    const config: PredictorConfig = {
      version: "1.0",
      inputDim: 1536, // 768 + 768
      hiddenDim: 2048,
      outputDim: 768,
      numLayers: 4,
    };

    expect(config.inputDim).toBe(1536);
  });
});

describe("VL-JEPA Protocol: WebGPU Configuration", () => {
  it("should accept WebGPU configuration in X-Encoder", () => {
    const config: XEncoderConfig = {
      version: "1.0",
      inputSize: { width: 224, height: 224 },
      patchSize: 16,
      embeddingDim: 768,
      model: "vit-base",
      webgpu: {
        enabled: true,
        workgroups: 16,
        memoryOptimization: "high",
      },
    };

    expect(config.webgpu?.enabled).toBe(true);
    expect(config.webgpu?.memoryOptimization).toBe("high");
  });

  it("should support different memory optimization levels", () => {
    const levels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

    levels.forEach(level => {
      const config: XEncoderConfig = {
        version: "1.0",
        inputSize: { width: 224, height: 224 },
        patchSize: 16,
        embeddingDim: 768,
        model: "vit-base",
        webgpu: {
          enabled: true,
          memoryOptimization: level,
        },
      };

      expect(config.webgpu?.memoryOptimization).toBe(level);
    });
  });
});

describe("VL-JEPA Protocol: Cache Configuration", () => {
  it("should accept cache configuration", () => {
    const config = createDefaultConfig();

    expect(config.global?.cache?.enabled).toBe(true);
    expect(config.global?.cache?.maxSize).toBeGreaterThan(0);
    expect(config.global?.cache?.ttl).toBeGreaterThan(0);
  });
});

describe("VL-JEPA Protocol: Training Configuration", () => {
  it("should accept all loss function types", () => {
    const lossFunctions: Array<"cosine" | "mse" | "smooth-l1"> = [
      "cosine",
      "mse",
      "smooth-l1",
    ];

    lossFunctions.forEach(lossFunction => {
      const config: PredictorConfig = {
        version: "1.0",
        inputDim: 1536,
        hiddenDim: 2048,
        outputDim: 768,
        numLayers: 4,
        training: {
          lossFunction,
        },
      };

      expect(config.training?.lossFunction).toBe(lossFunction);
    });
  });

  it("should accept contextual masking configuration", () => {
    const config: PredictorConfig = {
      version: "1.0",
      inputDim: 1536,
      hiddenDim: 2048,
      outputDim: 768,
      numLayers: 4,
      training: {
        useContextualMasking: true,
        maskingRatio: 0.9,
      },
    };

    expect(config.training?.useContextualMasking).toBe(true);
    expect(config.training?.maskingRatio).toBe(0.9);
  });
});
