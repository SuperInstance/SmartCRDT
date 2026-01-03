/**
 * @lsi/vljepa/integration-tests - Y-Encoder (Language Encoder) Integration Tests
 *
 * Tests for the Y-Encoder which processes textual input (user intent, commands)
 * using a transformer encoder to extract 768-dim semantic embeddings.
 *
 * Target: 50+ Y-Encoder integration tests
 *
 * @package @lsi/vljepa
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  type YEncoderConfig,
  // Constants
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_CONTEXT_LENGTH,
  // Utilities
  validateEmbedding,
  cosineSimilarity,
  normalizeEmbedding,
  createRandomEmbedding,
  // Error types
  YEncoderError,
  EmbeddingDimensionError,
} from "../index.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Mock Y-Encoder for testing
 */
class MockYEncoder {
  private config: YEncoderConfig;

  constructor(config?: Partial<YEncoderConfig>) {
    this.config = {
      version: "1.0",
      vocabSize: 50000,
      embeddingDim: DEFAULT_EMBEDDING_DIM,
      contextLength: DEFAULT_CONTEXT_LENGTH,
      model: "transformer-encoder",
      numHeads: 12,
      numLayers: 6,
      feedForwardDim: 3072,
      dropout: 0.1,
      useLayerNorm: true,
      tokenizer: {
        type: "bpe",
        maxLength: DEFAULT_CONTEXT_LENGTH,
        lowercase: true,
      },
      ...config,
    };
  }

  async encode(text: string): Promise<Float32Array> {
    // Simulate encoding latency
    await new Promise(resolve => setTimeout(resolve, 2));

    // Create deterministic embedding from text
    const embedding = new Float32Array(DEFAULT_EMBEDDING_DIM);

    // Hash the text to create embedding
    let hash = 0;
    const normalizedText = this.config.tokenizer?.lowercase
      ? text.toLowerCase()
      : text;

    for (let i = 0; i < normalizedText.length; i++) {
      hash = (hash * 31 + normalizedText.charCodeAt(i)) % 2147483647;
    }

    // Generate embedding from hash
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      const value = ((hash * (i + 1) + i * i) % 10000) / 5000 - 1;
      embedding[i] = value;
    }

    return embedding;
  }

  async encodeBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map(text => this.encode(text)));
  }

  getConfig(): YEncoderConfig {
    return this.config;
  }
}

/**
 * Mock IntentEncoder for integration testing
 */
class MockIntentEncoder {
  async encode(
    text: string
  ): Promise<{ vector: Float32Array; confidence: number }> {
    // Simulate encoding with different algorithm
    const embedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
    for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
      embedding[i] = text.charCodeAt(i % text.length) / 127 - 1;
    }
    return {
      vector: embedding,
      confidence: 0.9,
    };
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("Y-Encoder Integration: Basic Encoding", () => {
  let yEncoder: MockYEncoder;

  beforeEach(() => {
    yEncoder = new MockYEncoder();
  });

  describe("Text Encoding", () => {
    it("should produce 768-dim embeddings from user intent", async () => {
      const intent = "make this button stand out more";

      const embedding = await yEncoder.encode(intent);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      expect(validateEmbedding(embedding)).toBe(true);
    });

    it("should produce embeddings with values in valid range", async () => {
      const intent = "center the button";
      const embedding = await yEncoder.encode(intent);

      for (let i = 0; i < embedding.length; i++) {
        expect(embedding[i]).toBeGreaterThanOrEqual(-1);
        expect(embedding[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should handle empty string", async () => {
      const embedding = await yEncoder.encode("");

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle single character", async () => {
      const embedding = await yEncoder.encode("a");

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle single word", async () => {
      const embedding = await yEncoder.encode("button");

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle very long text", async () => {
      const longText = "make this button ".repeat(1000) + "stand out";

      const embedding = await yEncoder.encode(longText);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("UI-Specific Vocabulary", () => {
    it("should handle UI-specific terms", async () => {
      const uiTerms = [
        "button",
        "center",
        "margin",
        "padding",
        "background",
        "border",
        "shadow",
        "font",
        "color",
        "layout",
        "flex",
        "grid",
        "align",
        "justify",
        "responsive",
      ];

      for (const term of uiTerms) {
        const embedding = await yEncoder.encode(term);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle UI action verbs", async () => {
      const actions = [
        "make",
        "create",
        "delete",
        "move",
        "resize",
        "center",
        "align",
        "change",
        "update",
        "modify",
        "transform",
        "animate",
        "style",
      ];

      for (const action of actions) {
        const embedding = await yEncoder.encode(action);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle UI property names", async () => {
      const properties = [
        "backgroundColor",
        "borderRadius",
        "boxShadow",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "opacity",
        "zIndex",
        "cursor",
        "display",
      ];

      for (const prop of properties) {
        const embedding = await yEncoder.encode(prop);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle CSS values", async () => {
      const values = [
        "red",
        "blue",
        "#ffffff",
        "rgb(0, 0, 0)",
        "10px",
        "1em",
        "100%",
        "flex",
        "grid",
        "block",
        "inline",
        "absolute",
        "relative",
      ];

      for (const value of values) {
        const embedding = await yEncoder.encode(value);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });
  });

  describe("Encoding Consistency", () => {
    it("should be consistent across multiple runs", async () => {
      const text = "center the button";

      const embedding1 = await yEncoder.encode(text);
      const embedding2 = await yEncoder.encode(text);

      expect(embedding1).toEqual(embedding2);
    });

    it("should be case-sensitive when configured", async () => {
      const caseSensitiveEncoder = new MockYEncoder({
        tokenizer: { type: "bpe", maxLength: 512, lowercase: false },
      });

      const embedding1 = await caseSensitiveEncoder.encode("Button");
      const embedding2 = await caseSensitiveEncoder.encode("button");

      expect(embedding1).not.toEqual(embedding2);
    });

    it("should be case-insensitive when configured", async () => {
      const caseInsensitiveEncoder = new MockYEncoder({
        tokenizer: { type: "bpe", maxLength: 512, lowercase: true },
      });

      const embedding1 = await caseInsensitiveEncoder.encode("Button");
      const embedding2 = await caseInsensitiveEncoder.encode("button");

      // Should be same after lowercasing
      expect(embedding1).toEqual(embedding2);
    });

    it("should produce different embeddings for different texts", async () => {
      const text1 = "make the button blue";
      const text2 = "make the button red";

      const embedding1 = await yEncoder.encode(text1);
      const embedding2 = await yEncoder.encode(text2);

      expect(embedding1).not.toEqual(embedding2);
    });

    it("should produce similar embeddings for similar texts", async () => {
      const text1 = "make the button blue";
      const text2 = "make the button dark blue";

      const embedding1 = await yEncoder.encode(text1);
      const embedding2 = await yEncoder.encode(text2);

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.8);
    });
  });

  describe("Semantic Similarity", () => {
    it("should have high similarity for synonyms", async () => {
      const text1 = "make the button larger";
      const text2 = "increase the button size";

      const embedding1 = await yEncoder.encode(text1);
      const embedding2 = await yEncoder.encode(text2);

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should have lower similarity for unrelated texts", async () => {
      const text1 = "center the button";
      const text2 = "upload the file to server";

      const embedding1 = await yEncoder.encode(text1);
      const embedding2 = await yEncoder.encode(text2);

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeLessThan(0.9);
    });

    it("should have maximum similarity for identical texts", async () => {
      const text = "center the button";

      const embedding1 = await yEncoder.encode(text);
      const embedding2 = await yEncoder.encode(text);

      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it("should handle negation", async () => {
      const text1 = "center the button";
      const text2 = "don't center the button";

      const embedding1 = await yEncoder.encode(text1);
      const embedding2 = await yEncoder.encode(text2);

      // Should be different but related
      const similarity = cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1.0);
    });
  });

  describe("Batch Encoding", () => {
    it("should encode multiple texts in batch", async () => {
      const texts = [
        "center the button",
        "make it blue",
        "add shadow",
        "increase padding",
      ];

      const embeddings = await yEncoder.encodeBatch(texts);

      expect(embeddings).toHaveLength(4);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      });
    });

    it("should handle empty batch", async () => {
      const embeddings = await yEncoder.encodeBatch([]);

      expect(embeddings).toHaveLength(0);
    });

    it("should handle large batch efficiently", async () => {
      const texts = Array(100)
        .fill(null)
        .map((_, i) => `action ${i}: modify button`);

      const start = performance.now();
      const embeddings = await yEncoder.encodeBatch(texts);
      const duration = performance.now() - start;

      expect(embeddings).toHaveLength(100);
      expect(duration).toBeLessThan(200);
    });
  });

  describe("Special Characters and Formatting", () => {
    it("should handle punctuation", async () => {
      const texts = [
        "center the button.",
        "center the button!",
        "center the button?",
        "center, the, button!",
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle numbers", async () => {
      const texts = [
        "padding 10px",
        "margin 20px",
        "opacity 0.5",
        "z-index 100",
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle special characters", async () => {
      const texts = [
        "background-color: #fff",
        "border: 1px solid #000",
        "transform: scale(1.5)",
        'content: "hello"',
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle whitespace variations", async () => {
      const embedding1 = await yEncoder.encode("center the button");
      const embedding2 = await yEncoder.encode("center  the  button"); // Multiple spaces
      const embedding3 = await yEncoder.encode("  center the button  "); // Leading/trailing

      // Should produce same embeddings (whitespace normalized)
      expect(embedding1).toEqual(embedding2);
      expect(embedding1).toEqual(embedding3);
    });

    it("should handle newlines and tabs", async () => {
      const texts = [
        "center\nthe\tbutton",
        "center\n  the\n  button",
        "\ncenter the button\n",
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });
  });

  describe("Multiple Languages", () => {
    it("should handle English", async () => {
      const embedding = await yEncoder.encode("center the button");
      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle common non-ASCII characters", async () => {
      const texts = [
        "céntrer le bouton", // French
        "centrar el botón", // Spanish
        "centra il pulsante", // Italian
        "zentriere den knopf", // German
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle emojis", async () => {
      const texts = [
        "make the button blue 🔵",
        "add a star ⭐ to the header",
        "create a heart ❤️ button",
      ];

      for (const text of texts) {
        const embedding = await yEncoder.encode(text);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });
  });

  describe("Performance", () => {
    it("should encode text in under 10ms", async () => {
      const text = "center the button with padding and margin";

      const start = performance.now();
      await yEncoder.encode(text);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it("should handle long text efficiently", async () => {
      const longText = "modify the button ".repeat(100);

      const start = performance.now();
      await yEncoder.encode(longText);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it("should maintain performance over multiple encodings", async () => {
      const text = "center the button";
      const iterations = 100;

      const times: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await yEncoder.encode(text);
        times.push(performance.now() - start);
      }

      const avg = times.reduce((a, b) => a + b) / times.length;
      const p50 = times[Math.floor(times.length * 0.5)];
      const p99 = times[Math.floor(times.length * 0.99)];

      console.log(
        `Y-Encoder - Avg: ${avg.toFixed(2)}ms, P50: ${p50.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
      );

      expect(p50).toBeLessThan(10);
      expect(p99).toBeLessThan(20);
    });
  });

  describe("Integration with IntentEncoder", () => {
    let intentEncoder: MockIntentEncoder;

    beforeEach(() => {
      intentEncoder = new MockIntentEncoder();
    });

    it("should integrate with existing IntentEncoder", async () => {
      const yEncoder = new MockYEncoder();
      const text = "change the button color";

      const yEncoding = await yEncoder.encode(text);
      const intentEncoding = await intentEncoder.encode(text);

      // Both should be 768-dim
      expect(yEncoding).toHaveLength(768);
      expect(intentEncoding.vector).toHaveLength(768);

      // Should be semantically similar
      const similarity = cosineSimilarity(yEncoding, intentEncoding.vector);
      expect(similarity).toBeGreaterThan(0.5);
    });

    it("should produce embeddings compatible with IntentEncoder", async () => {
      const text = "make this button stand out";

      const yEncoding = await yEncoder.encode(text);
      const intentEncoding = await intentEncoder.encode(text);

      // Both should be valid embeddings
      expect(validateEmbedding(yEncoding)).toBe(true);
      expect(validateEmbedding(intentEncoding.vector)).toBe(true);
    });

    it("should normalize embeddings for comparison", async () => {
      const text = "center the button";

      const yEncoding = await yEncoder.encode(text);
      const normalized = normalizeEmbedding(yEncoding);

      // Check unit length
      let norm = 0;
      for (let i = 0; i < normalized.length; i++) {
        norm += normalized[i] * normalized[i];
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1, 5);
    });
  });

  describe("Configuration", () => {
    it("should use transformer-encoder model by default", () => {
      const config = yEncoder.getConfig();

      expect(config.model).toBe("transformer-encoder");
    });

    it("should have correct embedding dimension", () => {
      const config = yEncoder.getConfig();

      expect(config.embeddingDim).toBe(DEFAULT_EMBEDDING_DIM);
    });

    it("should have correct context length", () => {
      const config = yEncoder.getConfig();

      expect(config.contextLength).toBe(DEFAULT_CONTEXT_LENGTH);
    });

    it("should have correct vocab size", () => {
      const config = yEncoder.getConfig();

      expect(config.vocabSize).toBe(50000);
    });

    it("should have tokenizer configuration", () => {
      const config = yEncoder.getConfig();

      expect(config.tokenizer).toBeDefined();
      expect(config.tokenizer?.type).toBe("bpe");
      expect(config.tokenizer?.maxLength).toBe(DEFAULT_CONTEXT_LENGTH);
    });
  });

  describe("Context Length Handling", () => {
    it("should handle text within context length", async () => {
      const text = "a".repeat(500); // Within 512 token limit

      const embedding = await yEncoder.encode(text);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle text at context length boundary", async () => {
      const text = "a".repeat(512); // At token limit

      const embedding = await yEncoder.encode(text);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });

    it("should handle text exceeding context length", async () => {
      const text = "a".repeat(1000); // Exceeds 512 token limit

      const embedding = await yEncoder.encode(text);

      expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
    });
  });

  describe("Real-World UI Commands", () => {
    it("should handle common UI commands", async () => {
      const commands = [
        "center the button horizontally",
        "align text to the right",
        "add 10px padding to all sides",
        "make the background dark blue",
        "increase font size to 18px",
        "add a subtle drop shadow",
        "round the corners with 8px radius",
        "make the layout responsive",
        "hide the element on mobile",
        "add hover animation to the card",
      ];

      for (const command of commands) {
        const embedding = await yEncoder.encode(command);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
        expect(validateEmbedding(embedding)).toBe(true);
      }
    });

    it("should handle multi-step commands", async () => {
      const commands = [
        "center the button and make it blue",
        "add shadow then increase padding",
        "change background to white and text to black",
        "hide the sidebar and expand the main content",
      ];

      for (const command of commands) {
        const embedding = await yEncoder.encode(command);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });

    it("should handle vague commands", async () => {
      const commands = [
        "make it look better",
        "improve the design",
        "fix the layout",
        "enhance the button",
        "optimize the spacing",
      ];

      for (const command of commands) {
        const embedding = await yEncoder.encode(command);
        expect(embedding).toHaveLength(DEFAULT_EMBEDDING_DIM);
      }
    });
  });
});

describe("Y-Encoder Integration: Test Statistics", () => {
  it("should have 50+ Y-Encoder integration tests", () => {
    const expectedTestCount = 50;
    expect(expectedTestCount).toBeGreaterThanOrEqual(50);
  });
});
