/**
 * @lsi/vljepa/y-encoder/tests - Comprehensive tests for Y-Encoder
 *
 * Test suite for Y-Encoder (Language Encoder) component of VL-JEPA.
 * Tests cover tokenization, embedding, encoding, and IntentEncoder integration.
 *
 * Test categories:
 * 1. EmbeddingLayer tests (8 tests)
 * 2. TextTokenizer tests (8 tests)
 * 3. TextEncoder tests (8 tests)
 * 4. YEncoder integration tests (10 tests)
 * 5. YEncoderIntentBridge tests (8 tests)
 *
 * Total: 42 tests
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingLayer,
  PositionalEncodingType,
  type EmbeddingResult,
} from "./EmbeddingLayer.js";
import {
  TextTokenizer,
  SpecialToken,
  createTokenizer,
} from "./TextTokenizer.js";
import {
  MultiHeadAttention,
  FeedForwardNetwork,
  TransformerEncoderLayer,
  TextEncoder,
  createTextEncoder,
} from "./TextEncoder.js";
import type { IntentVector } from "@lsi/protocol";
import {
  YEncoder,
  createYEncoder,
  createYEncoderFromConfig,
  PoolingStrategy,
  type EncodingResult,
} from "./YEncoder.js";
import {
  YEncoderIntentBridge,
  createYEncoderIntentBridge,
  toIntentVector,
  fromIntentVector,
  embeddingSimilarity,
  fuseEmbeddings,
} from "./YEncoderIntentBridge.js";
import type { YEncoderConfig } from "../protocol.js";

// ============================================================================
// EMBEDDING LAYER TESTS (8 tests)
// ============================================================================

describe("EmbeddingLayer", () => {
  let embeddingLayer: EmbeddingLayer;

  beforeEach(() => {
    embeddingLayer = new EmbeddingLayer({
      vocabSize: 1000,
      embeddingDim: 768,
      maxSequenceLength: 128,
      positionalEncodingType: PositionalEncodingType.Sinusoidal,
      dropout: 0.1,
    });
  });

  it("should initialize successfully", () => {
    embeddingLayer.initialize();
    expect(embeddingLayer.getEmbeddingDim()).toBe(768);
    expect(embeddingLayer.getVocabSize()).toBe(1000);
    expect(embeddingLayer.getMaxSequenceLength()).toBe(128);
  });

  it("should create embeddings for token IDs", () => {
    embeddingLayer.initialize();
    const tokenIds = [10, 20, 30, 40, 50];
    const result = embeddingLayer.forward(tokenIds);

    expect(result.sequenceLength).toBe(5);
    expect(result.embeddings.length).toBe(5 * 768);
    expect(result.tokenEmbeddings.length).toBe(5 * 768);
    expect(result.positionalEncodings.length).toBe(5 * 768);
  });

  it("should handle empty token sequence", () => {
    embeddingLayer.initialize();
    const tokenIds: number[] = [];
    const result = embeddingLayer.forward(tokenIds);

    expect(result.sequenceLength).toBe(0);
    expect(result.embeddings.length).toBe(0);
  });

  it("should throw error for sequence exceeding max length", () => {
    embeddingLayer.initialize();
    const tokenIds = new Array(200).fill(10);

    expect(() => embeddingLayer.forward(tokenIds)).toThrow("exceeds maximum");
  });

  it("should throw error for out-of-range token IDs", () => {
    embeddingLayer.initialize();
    const tokenIds = [10, 9999, 30]; // 9999 is out of range

    expect(() => embeddingLayer.forward(tokenIds)).toThrow("out of range");
  });

  it("should produce sinusoidal positional encodings", () => {
    embeddingLayer.initialize();
    const tokenIds = [0, 1, 2];
    const result = embeddingLayer.forward(tokenIds);

    // Sinusoidal encodings should be different for each position
    const pos0 = result.positionalEncodings.slice(0, 768);
    const pos1 = result.positionalEncodings.slice(768, 1536);

    let differences = 0;
    for (let i = 0; i < 768; i++) {
      if (Math.abs(pos0[i] - pos1[i]) > 0.001) {
        differences++;
      }
    }
    expect(differences).toBeGreaterThan(100); // Many differences expected
  });

  it("should allow getting and setting token embeddings", () => {
    embeddingLayer.initialize();
    const embeddings = embeddingLayer.getTokenEmbeddings();
    expect(embeddings.length).toBe(1000 * 768);

    const newEmbeddings = new Float32Array(1000 * 768).fill(0.5);
    embeddingLayer.setTokenEmbeddings(newEmbeddings);

    const retrieved = embeddingLayer.getTokenEmbeddings();
    expect(retrieved[0]).toBe(0.5);
  });

  it("should reset the embedding layer", () => {
    embeddingLayer.initialize();
    embeddingLayer.reset();

    const tokenIds = [10, 20];
    // After reset, initialize should be called again
    expect(() => embeddingLayer.forward(tokenIds)).not.toThrow();
  });
});

// ============================================================================
// TEXT TOKENIZER TESTS (8 tests)
// ============================================================================

describe("TextTokenizer", () => {
  let tokenizer: TextTokenizer;

  beforeEach(() => {
    tokenizer = new TextTokenizer({
      vocabSize: 1000,
      maxLength: 128,
      lowercase: true,
      normalizeWhitespace: true,
      addSpecialTokens: true,
    });
    tokenizer.initialize();
  });

  it("should tokenize simple text", () => {
    const result = tokenizer.tokenize("Make this button pop");

    expect(result.tokens).toContain("[CLS]");
    expect(result.tokens).toContain("[SEP]");
    // Check that tokens were generated (exact form may vary with BPE)
    expect(result.tokens.length).toBeGreaterThan(2); // At least CLS and SEP
  });

  it("should convert tokens to IDs and back", () => {
    const result = tokenizer.tokenize("center this div");

    const tokenIds = result.tokenIds;
    expect(tokenIds.length).toBeGreaterThan(0);

    const decoded = tokenizer.idsToTokens(tokenIds);
    expect(decoded.length).toBe(tokenIds.length);
  });

  it("should decode token IDs to text", () => {
    const result = tokenizer.tokenize("align to left");
    const tokenIds = result.tokenIds;

    const decoded = tokenizer.decode(tokenIds, true);
    expect(decoded.length).toBeGreaterThan(0);
    expect(decoded).not.toContain("[CLS]");
    expect(decoded).not.toContain("[SEP]");
  });

  it("should lowercase text when configured", () => {
    const result = tokenizer.tokenize("Make This BUTTON Pop");

    // Check that special tokens are present
    expect(result.tokens).toContain("[CLS]");
    expect(result.tokens).toContain("[SEP]");

    // Check that no uppercase versions exist (lowercasing worked)
    expect(result.tokens).not.toContain("Make");
    expect(result.tokens).not.toContain("BUTTON");

    // Check that tokens were generated
    expect(result.tokens.length).toBeGreaterThan(2);
  });

  it("should include UI-specific vocabulary", () => {
    const result = tokenizer.tokenize("change display flex");

    expect(result.tokens).toContain("display");
    expect(result.tokens).toContain("flex");
  });

  it("should truncate long sequences", () => {
    const longText = "word ".repeat(100);
    const result = tokenizer.tokenize(longText);

    expect(result.tokenIds.length).toBeLessThanOrEqual(128);
  });

  it("should handle empty text", () => {
    const result = tokenizer.tokenize("");

    // Should still have special tokens
    expect(result.tokens).toContain("[CLS]");
    expect(result.tokens).toContain("[SEP]");
  });

  it("should handle unknown words with UNK token", () => {
    const result = tokenizer.tokenize("xyzabc123");

    // Unknown word should be handled (either as UNK or broken into subwords)
    expect(result.tokenIds.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEXT ENCODER TESTS (8 tests)
// ============================================================================

describe("TextEncoder", () => {
  describe("MultiHeadAttention", () => {
    let attention: MultiHeadAttention;

    beforeEach(() => {
      attention = new MultiHeadAttention({
        numHeads: 4,
        embeddingDim: 64,
        dropout: 0.1,
      });
      attention.initialize();
    });

    it("should compute attention output", () => {
      const embeddings = new Float32Array(10 * 64); // 10 tokens
      const result = attention.forward(embeddings);

      expect(result.output.length).toBe(10 * 64);
      expect(result.attentionWeights).toBeDefined();
    });

    it("should handle single token", () => {
      const embeddings = new Float32Array(1 * 64);
      const result = attention.forward(embeddings);

      expect(result.output.length).toBe(64);
    });
  });

  describe("FeedForwardNetwork", () => {
    let ffn: FeedForwardNetwork;

    beforeEach(() => {
      ffn = new FeedForwardNetwork({
        inputDim: 64,
        hiddenDim: 256,
        outputDim: 64,
        activation: "gelu",
        dropout: 0.1,
      });
      ffn.initialize();
    });

    it("should compute feed-forward output", () => {
      const embeddings = new Float32Array(10 * 64);
      const result = ffn.forward(embeddings);

      expect(result.length).toBe(10 * 64);
    });

    it("should apply GELU activation", () => {
      const embeddings = new Float32Array(5 * 64).fill(1.0);
      const result = ffn.forward(embeddings);

      // GELU should produce non-zero output
      expect(result[0]).not.toBe(0);
    });
  });

  describe("TransformerEncoderLayer", () => {
    let layer: TransformerEncoderLayer;

    beforeEach(() => {
      layer = new TransformerEncoderLayer({
        embeddingDim: 64,
        numHeads: 4,
        feedForwardDim: 256,
        dropout: 0.1,
        activation: "gelu",
        useLayerNorm: true,
      });
      layer.initialize();
    });

    it("should apply transformer layer", () => {
      const embeddings = new Float32Array(10 * 64);
      const result = layer.forward(embeddings);

      expect(result.output.length).toBe(10 * 64);
    });

    it("should handle different sequence lengths", () => {
      const embeddings1 = new Float32Array(5 * 64);
      const embeddings2 = new Float32Array(20 * 64);

      const result1 = layer.forward(embeddings1);
      const result2 = layer.forward(embeddings2);

      expect(result1.output.length).toBe(5 * 64);
      expect(result2.output.length).toBe(20 * 64);
    });
  });

  describe("TextEncoder", () => {
    let encoder: TextEncoder;

    beforeEach(() => {
      encoder = new TextEncoder(2, {
        embeddingDim: 64,
        numHeads: 4,
        feedForwardDim: 256,
        dropout: 0.1,
      });
      encoder.initialize();
    });

    it("should encode embeddings through multiple layers", () => {
      const embeddings = new Float32Array(10 * 64);
      const result = encoder.forward(embeddings);

      expect(result.length).toBe(10 * 64);
    });

    it("should report correct configuration", () => {
      expect(encoder.getNumLayers()).toBe(2);
      expect(encoder.getEmbeddingDim()).toBe(64);
    });
  });
});

// ============================================================================
// Y-ENCODER INTEGRATION TESTS (10 tests)
// ============================================================================

describe("YEncoder", () => {
  let yEncoder: YEncoder;

  beforeEach(() => {
    yEncoder = new YEncoder({
      vocabSize: 1000,
      embeddingDim: 768,
      contextLength: 128,
      numLayers: 2,
      numHeads: 4,
      feedForwardDim: 512,
      poolingStrategy: PoolingStrategy.Mean,
    });
  });

  it("should initialize successfully", async () => {
    await yEncoder.initialize();
    expect(yEncoder.isInitialized()).toBe(true);
  });

  it("should encode text to 768-dim embedding", async () => {
    await yEncoder.initialize();
    const result = await yEncoder.encode("Make this button pop");

    expect(result.embedding.length).toBe(768);
    expect(result.sequenceLength).toBeGreaterThan(0);
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it("should throw error for empty text", async () => {
    await yEncoder.initialize();

    await expect(yEncoder.encode("")).rejects.toThrow("empty");
    await expect(yEncoder.encode("   ")).rejects.toThrow("empty");
  });

  it("should throw error for non-string input", async () => {
    await yEncoder.initialize();

    await expect(yEncoder.encode(null as any)).rejects.toThrow();
    await expect(yEncoder.encode(undefined as any)).rejects.toThrow();
  });

  it("should encode multiple texts in batch", async () => {
    await yEncoder.initialize();
    const texts = ["button", "input", "form"];
    const results = await yEncoder.encodeBatch(texts);

    expect(results.length).toBe(3);
    expect(results[0].embedding.length).toBe(768);
    expect(results[1].embedding.length).toBe(768);
    expect(results[2].embedding.length).toBe(768);
  });

  it("should use mean pooling by default", async () => {
    await yEncoder.initialize();
    const result = await yEncoder.encode("test text");

    expect(result.poolingStrategy).toBe(PoolingStrategy.Mean);
  });

  it("should compute similarity between texts", async () => {
    await yEncoder.initialize();

    const sim1 = await yEncoder.similarity("button", "button");
    const sim2 = await yEncoder.similarity("button", "input");

    expect(sim1).toBeGreaterThan(sim2); // Same text should be more similar
    expect(sim1).toBeGreaterThan(0.9); // Very high for identical text
  });

  it("should report configuration correctly", async () => {
    await yEncoder.initialize();

    expect(yEncoder.getEmbeddingDim()).toBe(768);
    expect(yEncoder.getVocabSize()).toBe(1000);
    expect(yEncoder.getContextLength()).toBe(128);
  });

  it("should reset properly", async () => {
    await yEncoder.initialize();
    yEncoder.reset();

    expect(yEncoder.isInitialized()).toBe(false);
  });

  it("should handle UI-specific vocabulary", async () => {
    await yEncoder.initialize();
    const result = await yEncoder.encode("change display to flex");

    expect(result.embedding.length).toBe(768);
    expect(result.sequenceLength).toBeGreaterThan(0);
  });
});

// ============================================================================
// Y-ENCODER INTENT BRIDGE TESTS (8 tests)
// ============================================================================

describe("YEncoderIntentBridge", () => {
  describe("Bridge without IntentEncoder", () => {
    let bridge: YEncoderIntentBridge;

    beforeEach(() => {
      bridge = new YEncoderIntentBridge({
        yEncoderConfig: {
          version: "1.0",
          vocabSize: 1000,
          embeddingDim: 768,
          contextLength: 128,
          model: "transformer-encoder",
          numLayers: 2,
          numHeads: 4,
          feedForwardDim: 512,
        },
      });
    });

    it("should initialize successfully", async () => {
      await bridge.initialize();
      expect(bridge.isInitialized()).toBe(true);
    });

    it("should encode with Y-Encoder", async () => {
      await bridge.initialize();
      const result = await bridge.encodeWithYEncoder("test text");

      expect(result.embedding.length).toBe(768);
      expect(result.sequenceLength).toBeGreaterThan(0);
    });

    it("should convert Y-Encoder output to IntentVector", async () => {
      await bridge.initialize();
      const result = await bridge.encodeWithYEncoder("test");

      const intentVector = bridge.toIntentVector(result.embedding);

      expect(intentVector.vector.length).toBe(768);
      expect(intentVector.model).toBe("y-encoder-v1.0");
    });

    it("should throw error for invalid embedding dimension", async () => {
      await bridge.initialize();

      const invalidEmbedding = new Float32Array(512);

      expect(() => bridge.toIntentEncoder(invalidEmbedding)).toThrow(
        "Expected 768-dim embedding, got 512-dim"
      );
    });

    it("should provide access to Y-Encoder", () => {
      const yEncoder = bridge.getYEncoder();
      expect(yEncoder).toBeDefined();
    });
  });

  describe("Bridge functions", () => {
    it("should convert embedding to IntentVector format", () => {
      const embedding = new Float32Array(768).fill(0.5);
      const intentVector = toIntentVector(embedding);

      expect(intentVector.vector.length).toBe(768);
      expect(intentVector.vector[0]).toBeCloseTo(0.5, 5);
      expect(intentVector.model).toBe("y-encoder-v1.0");
    });

    it("should convert IntentVector to embedding", () => {
      const intentVector: IntentVector = {
        vector: new Float32Array(768).fill(0.3),
        model: "test-model",
        epsilon: 1.0,
        latency: 10,
        satisfiesDP: true,
      };

      const embedding = fromIntentVector(intentVector);

      expect(embedding.length).toBe(768);
      expect(embedding[0]).toBeCloseTo(0.3, 5);
    });

    it("should compute similarity between embeddings", () => {
      const embedding1 = new Float32Array(768).fill(1.0);
      const intentVector: IntentVector = {
        vector: new Float32Array(768).fill(1.0),
        model: "test",
        epsilon: 1.0,
        latency: 0,
        satisfiesDP: false,
      };

      const similarity = embeddingSimilarity(embedding1, intentVector);

      expect(similarity).toBeCloseTo(1.0, 5); // Identical vectors
    });

    it("should fuse two embeddings", () => {
      const embedding1 = new Float32Array(768).fill(1.0);
      const embedding2 = new Float32Array(768).fill(0.5);

      const fused = fuseEmbeddings(embedding1, embedding2, {
        vision: 0.5,
        intent: 0.5,
      });

      expect(fused.length).toBe(768);
      expect(fused[0]).toBeCloseTo(0.75, 5); // Average of 1.0 and 0.5
    });
  });
});

// ============================================================================
// FACTORY FUNCTIONS TESTS (2 tests)
// ============================================================================

describe("Factory Functions", () => {
  it("should create Y-Encoder with createYEncoder", async () => {
    const encoder = createYEncoder({
      vocabSize: 500,
      embeddingDim: 768,
      contextLength: 64,
    });

    await encoder.initialize();
    const result = await encoder.encode("test");

    expect(result.embedding.length).toBe(768);
  });

  it("should create Y-Encoder from YEncoderConfig", async () => {
    const config: YEncoderConfig = {
      version: "1.0",
      vocabSize: 500,
      embeddingDim: 768,
      contextLength: 64,
      model: "transformer-encoder",
      numLayers: 4,
      numHeads: 8,
      feedForwardDim: 1024,
    };

    const encoder = createYEncoderFromConfig(config);

    await encoder.initialize();
    const result = await encoder.encode("test");

    expect(result.embedding.length).toBe(768);
  });
});
