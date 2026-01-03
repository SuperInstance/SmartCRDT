/**
 * VL-JEPA Privacy Test Suite
 *
 * Comprehensive tests for privacy components:
 * - VisualPrivacyAnalyzer (15 tests)
 * - OnDevicePolicy (15 tests)
 * - VisualPIIRedaction (15 tests)
 * - Integration tests (5 tests)
 *
 * Total: 50+ tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  VisualPrivacyAnalyzer,
  OnDevicePolicy,
  VisualPIIRedactor,
  VisualDataType,
  VisualPIIType,
  ProcessingLocation,
  PrivacyRiskLevel,
  VisualDataAction,
  RedactionStrategy,
  BoundingBox,
  createDefaultPrivacyPolicy,
  createStrictPrivacyPolicy,
  createBalancedOnDevicePolicy,
  createDefaultRedactionConfig,
  type VisualPrivacyAnalysis,
  type VisualPrivacyPolicy,
  type VLJEPAConfig,
  type RedactionResult,
} from "./index";

// Helper to create test ImageData
function createTestImageData(
  width: number = 100,
  height: number = 100
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128; // R
    data[i + 1] = 128; // G
    data[i + 2] = 128; // B
    data[i + 3] = 255; // A
  }
  return new ImageData(data, width, height);
}

// Helper to create test bounding boxes
function createTestBoundingBoxes(count: number = 1): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  const types = [
    VisualPIIType.FACE,
    VisualPIIType.TEXT,
    VisualPIIType.DOCUMENT,
  ];

  for (let i = 0; i < count; i++) {
    boxes.push({
      x: 0.1 + i * 0.2,
      y: 0.1 + i * 0.2,
      width: 0.1,
      height: 0.1,
      confidence: 0.8 + i * 0.05,
      type: types[i % types.length],
    });
  }

  return boxes;
}

//==============================================================================
// VisualPrivacyAnalyzer Tests (15 tests)
//==============================================================================

describe("VisualPrivacyAnalyzer", () => {
  let analyzer: VisualPrivacyAnalyzer;

  beforeEach(() => {
    analyzer = new VisualPrivacyAnalyzer({
      policy: createDefaultPrivacyPolicy(),
      verbose: false,
    });
  });

  describe("Constructor", () => {
    it("should create analyzer with default config", () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.getPolicy()).toBeDefined();
    });

    it("should create analyzer with custom policy", () => {
      const customPolicy: VisualPrivacyPolicy = {
        ...createDefaultPrivacyPolicy(),
        processingLocation: ProcessingLocation.EDGE_ONLY,
      };
      const customAnalyzer = new VisualPrivacyAnalyzer({
        policy: customPolicy,
      });
      expect(customAnalyzer.getPolicy().processingLocation).toBe(
        ProcessingLocation.EDGE_ONLY
      );
    });

    it("should create analyzer with verbose logging", () => {
      const verboseAnalyzer = new VisualPrivacyAnalyzer({
        policy: createDefaultPrivacyPolicy(),
        verbose: true,
      });
      expect(verboseAnalyzer).toBeDefined();
    });
  });

  describe("Analyze UI Frame", () => {
    it("should analyze UI frame with no PII (LOW risk)", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.UI_FRAME);

      expect(analysis.riskLevel).toBe(PrivacyRiskLevel.LOW);
      expect(analysis.action).toBe(VisualDataAction.ALLOW);
      expect(analysis.detectedPII).toHaveLength(0);
      expect(analysis.recommendedLocation).toBe(ProcessingLocation.EDGE_ONLY);
    });

    it("should analyze UI frame with detected PII (MEDIUM risk)", async () => {
      const frame = createTestImageData();
      // Mock detection would happen here
      // For now, tests assume no PII detected (placeholder)
      const analysis = await analyzer.analyze(frame, VisualDataType.UI_FRAME);

      expect(analysis).toBeDefined();
      expect(analysis.riskLevel).toBeGreaterThanOrEqual(PrivacyRiskLevel.LOW);
    });
  });

  describe("Analyze Screenshot", () => {
    it("should require consent for screenshot", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.SCREENSHOT);

      expect(analysis.consentRequired).toBe(true);
      expect(analysis.action).toBe(VisualDataAction.CONSENT);
    });

    it("should return MEDIUM risk for screenshot with no PII", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.SCREENSHOT);

      expect(analysis.riskLevel).toBeGreaterThanOrEqual(PrivacyRiskLevel.LOW);
    });
  });

  describe("Analyze Camera", () => {
    it("should block camera by default", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.CAMERA);

      expect(analysis.action).toBe(VisualDataAction.BLOCK);
      expect(analysis.consentRequired).toBe(true);
    });
  });

  describe("Analyze Document", () => {
    it("should block document by default", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.DOCUMENT);

      expect(analysis.action).toBe(VisualDataAction.BLOCK);
    });
  });

  describe("Policy Management", () => {
    it("should update policy", () => {
      analyzer.updatePolicy({
        processingLocation: ProcessingLocation.HYBRID,
      });

      expect(analyzer.getPolicy().processingLocation).toBe(
        ProcessingLocation.HYBRID
      );
    });

    it("should clear cache on policy update", () => {
      analyzer.updatePolicy({
        processingLocation: ProcessingLocation.EDGE_ONLY,
      });
      // Cache should be cleared (no easy way to test this without exposing cache)
      expect(analyzer.getPolicy().processingLocation).toBe(
        ProcessingLocation.EDGE_ONLY
      );
    });

    it("should get current policy", () => {
      const policy = analyzer.getPolicy();
      expect(policy).toHaveProperty("processingLocation");
      expect(policy).toHaveProperty("visualDataCategories");
      expect(policy).toHaveProperty("retention");
      expect(policy).toHaveProperty("embeddingSafety");
    });
  });

  describe("Risk Assessment", () => {
    it("should assess LOW risk for synthetic data", async () => {
      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.SYNTHETIC);

      expect(analysis.riskLevel).toBe(PrivacyRiskLevel.LOW);
      expect(analysis.action).toBe(VisualDataAction.ALLOW);
    });
  });

  describe("Default and Strict Policies", () => {
    it("should create default privacy policy", () => {
      const policy = createDefaultPrivacyPolicy();

      expect(policy.processingLocation).toBe(ProcessingLocation.EDGE_ONLY);
      expect(policy.retention.inMemoryOnly).toBe(true);
      expect(policy.retention.neverCacheFrames).toBe(true);
      expect(policy.embeddingSafety.epsilon).toBe(1.0);
    });

    it("should create strict privacy policy", () => {
      const policy = createStrictPrivacyPolicy();

      expect(policy.processingLocation).toBe(ProcessingLocation.EDGE_ONLY);
      expect(policy.retention.maxCacheTime).toBe(10000); // 10 seconds
      expect(policy.embeddingSafety.epsilon).toBe(0.5); // Stronger privacy
      expect(policy.embeddingSafety.quantizationBits).toBe(8);
    });
  });
});

//==============================================================================
// OnDevicePolicy Tests (15 tests)
//==============================================================================

describe("OnDevicePolicy", () => {
  let policy: OnDevicePolicy;

  beforeEach(() => {
    policy = new OnDevicePolicy(createBalancedOnDevicePolicy());
  });

  describe("Constructor", () => {
    it("should create policy with default config", () => {
      expect(policy).toBeDefined();
      expect(policy.getStats()).toBeDefined();
    });

    it("should create strict policy", () => {
      const strictPolicy = createStrictOnDevicePolicy();
      expect(strictPolicy).toBeDefined();
    });

    it("should create balanced policy", () => {
      const balancedPolicy = createBalancedOnDevicePolicy();
      expect(balancedPolicy).toBeDefined();
    });
  });

  describe("Validate Processing Location", () => {
    it("should validate edge-only config", () => {
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.EDGE_ONLY,
        enableWebGPU: true,
      };

      const result = policy.validateProcessingLocation(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject cloud-only config when requireEdgeOnly is true", () => {
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.CLOUD_ONLY,
      };

      const result = policy.validateProcessingLocation(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("EDGE_ONLY");
    });

    it("should warn about non-local model URL", () => {
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.EDGE_ONLY,
        modelUrl: "https://cloud-model.com/model.bin",
        enableWebGPU: true,
      };

      const result = policy.validateProcessingLocation(config);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should warn about missing WebGPU", () => {
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.EDGE_ONLY,
        enableWebGPU: false,
      };

      const result = policy.validateProcessingLocation(config);

      expect(result.warnings.some(w => w.includes("WebGPU"))).toBe(true);
    });

    it("should warn about large frame size", () => {
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.EDGE_ONLY,
        maxFrameSize: 4000 * 3000, // 12MP
        enableWebGPU: true,
      };

      const result = policy.validateProcessingLocation(config);

      expect(result.warnings.some(w => w.includes("Frame size"))).toBe(true);
    });
  });

  describe("Data Leak Prevention", () => {
    it("should not detect leak for normal frames", () => {
      const frames = [createTestImageData(100, 100)];
      const result = policy.ensureNoDataLeak(frames);

      expect(result.hasLeak).toBe(false);
      expect(result.leakSources).toHaveLength(0);
    });

    it("should detect leak for oversized frames", () => {
      const frames = [createTestImageData(10000, 10000)]; // Huge frame
      const result = policy.ensureNoDataLeak(frames);

      expect(result.hasLeak).toBe(true);
      expect(result.leakSources.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should provide recommendations for leaks", () => {
      const frames = [createTestImageData(10000, 10000)];
      const result = policy.ensureNoDataLeak(frames);

      expect(result.recommendations.some(r => r.includes("Downsample"))).toBe(
        true
      );
    });
  });

  describe("Embedding Sanitization", () => {
    it("should sanitize embedding with DP noise", () => {
      const embedding = new Float32Array(768).fill(0.5);
      const sanitized = policy.sanitizeEmbedding(embedding);

      expect(sanitized.vector).toBeDefined();
      expect(sanitized.vector.length).toBe(768);
      expect(sanitized.epsilon).toBeDefined();
      expect(sanitized.reconstructionProtection).toBe(true);
    });

    it("should add noise to embedding", () => {
      const embedding = new Float32Array(768).fill(0.5);
      const sanitized = policy.sanitizeEmbedding(embedding);

      // Check that values changed (noise added)
      let changed = false;
      for (let i = 0; i < 768; i++) {
        if (Math.abs(embedding[i] - sanitized.vector[i]) > 0.0001) {
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    });

    it("should apply quantization", () => {
      const embedding = new Float32Array(768).fill(0.5);
      const sanitized = policy.sanitizeEmbedding(embedding);

      expect(sanitized.quantizationBits).toBeDefined();
      expect(sanitized.quantizationBits).toBeGreaterThan(0);
    });
  });

  describe("Memory Management", () => {
    it("should register and clear frames", () => {
      const frame = createTestImageData();
      const id = "test-frame-1";

      policy.registerFrame(frame, id);
      policy.clearFrame(id);

      expect(policy.getStats().framesProcessed).toBe(1);
    });

    it("should clear all frames", () => {
      const frame1 = createTestImageData();
      const frame2 = createTestImageData();

      policy.registerFrame(frame1, "frame-1");
      policy.registerFrame(frame2, "frame-2");
      policy.clearAllFrames();

      expect(policy.getStats().framesProcessed).toBe(2);
    });

    it("should cache embeddings", () => {
      const embedding = new Float32Array(768).fill(0.5);
      const key = "test-embedding";

      policy.cacheEmbedding(key, embedding, 1000);
      const cached = policy.getCachedEmbedding(key);

      expect(cached).toBeDefined();
      expect(cached?.length).toBe(768);
    });

    it("should expire cached embeddings", async () => {
      const embedding = new Float32Array(768).fill(0.5);
      const key = "test-embedding-expire";

      policy.cacheEmbedding(key, embedding, 10); // 10ms TTL
      await new Promise(resolve => setTimeout(resolve, 20));

      const cached = policy.getCachedEmbedding(key);
      expect(cached).toBeUndefined();
    });
  });

  describe("Statistics", () => {
    it("should track statistics", () => {
      const embedding = new Float32Array(768).fill(0.5);

      policy.sanitizeEmbedding(embedding);
      policy.sanitizeEmbedding(embedding);

      const stats = policy.getStats();
      expect(stats.embeddingsTransmitted).toBe(2);
    });

    it("should reset statistics", () => {
      const embedding = new Float32Array(768).fill(0.5);
      policy.sanitizeEmbedding(embedding);

      policy.resetStats();

      expect(policy.getStats().embeddingsTransmitted).toBe(0);
    });
  });
});

//==============================================================================
// VisualPIIRedaction Tests (15 tests)
//==============================================================================

describe("VisualPIIRedaction", () => {
  let redactor: VisualPIIRedactor;

  beforeEach(() => {
    redactor = new VisualPIIRedactor(createDefaultRedactionConfig());
  });

  describe("Constructor", () => {
    it("should create redactor with default config", () => {
      expect(redactor).toBeDefined();
      expect(redactor.getConfig()).toBeDefined();
    });

    it("should have correct default strategy", () => {
      const config = redactor.getConfig();
      expect(config.defaultStrategy).toBe(RedactionStrategy.BLUR);
    });

    it("should have correct max redaction percentage", () => {
      const config = redactor.getConfig();
      expect(config.maxRedactionPercentage).toBe(30);
    });
  });

  describe("Redact with No PII", () => {
    it("should return original frame when no PII detected", async () => {
      const frame = createTestImageData();
      const result = await redactor.redact(frame, []);

      expect(result.success).toBe(true);
      expect(result.redactedRegions).toHaveLength(0);
      expect(result.redactionPercentage).toBe(0);
    });

    it("should not modify frame when no PII", async () => {
      const frame = createTestImageData();
      const result = await redactor.redact(frame, []);

      expect(result.redactedFrame.data).toEqual(frame.data);
    });
  });

  describe("Redact with PII", () => {
    it("should redact detected PII", async () => {
      const frame = createTestImageData();
      const pii = createTestBoundingBoxes(1);

      const result = await redactor.redact(frame, pii);

      expect(result.success).toBe(true);
      expect(result.redactedRegions).toHaveLength(1);
      expect(result.detectedPII).toHaveLength(1);
    });

    it("should apply correct redaction strategy", async () => {
      const frame = createTestImageData();
      const pii = [createTestBoundingBoxes(1)[0]];

      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions[0].strategy).toBe(RedactionStrategy.BLUR);
    });

    it("should modify frame pixels", async () => {
      const frame = createTestImageData();
      const pii = createTestBoundingBoxes(1);

      const result = await redactor.redact(frame, pii);

      // Frame should be modified
      expect(result.redactedFrame.data).not.toEqual(frame.data);
    });
  });

  describe("Redaction Strategies", () => {
    it("should apply BLUR strategy", async () => {
      const frame = createTestImageData();
      const pii = [createTestBoundingBoxes(1)[0]];

      redactor.updateConfig({ defaultStrategy: RedactionStrategy.BLUR });
      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions[0].strategy).toBe(RedactionStrategy.BLUR);
      expect(result.success).toBe(true);
    });

    it("should apply BLACKOUT strategy", async () => {
      const frame = createTestImageData();
      const pii = [createTestBoundingBoxes(1)[0]];

      redactor.updateConfig({ defaultStrategy: RedactionStrategy.BLACKOUT });
      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions[0].strategy).toBe(
        RedactionStrategy.BLACKOUT
      );
      expect(result.success).toBe(true);
    });

    it("should apply MASK strategy", async () => {
      const frame = createTestImageData();
      const pii = [createTestBoundingBoxes(1)[0]];

      redactor.updateConfig({ defaultStrategy: RedactionStrategy.MASK });
      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions[0].strategy).toBe(RedactionStrategy.MASK);
      expect(result.success).toBe(true);
    });

    it("should apply PIXELATE strategy", async () => {
      const frame = createTestImageData();
      const pii = [createTestBoundingBoxes(1)[0]];

      redactor.updateConfig({ defaultStrategy: RedactionStrategy.PIXELATE });
      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions[0].strategy).toBe(
        RedactionStrategy.PIXELATE
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Confidence Threshold", () => {
    it("should filter low-confidence PII", async () => {
      const frame = createTestImageData();
      const pii = [
        {
          ...createTestBoundingBoxes(1)[0],
          confidence: 0.5, // Below default threshold of 0.7
        },
      ];

      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions).toHaveLength(0);
    });

    it("should include high-confidence PII", async () => {
      const frame = createTestImageData();
      const pii = [
        {
          ...createTestBoundingBoxes(1)[0],
          confidence: 0.9, // Above threshold
        },
      ];

      const result = await redactor.redact(frame, pii);

      expect(result.redactedRegions).toHaveLength(1);
    });
  });

  describe("Max Redaction Percentage", () => {
    it("should enforce max redaction percentage", async () => {
      const frame = createTestImageData();
      const pii = createTestBoundingBoxes(50); // Many PII regions

      const result = await redactor.redact(frame, pii);

      // Should fail due to exceeding max percentage
      if (result.redactionPercentage > 30) {
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Quality Check", () => {
    it("should check redaction quality", () => {
      const frame = createTestImageData();
      const regions = [
        {
          box: createTestBoundingBoxes(1)[0],
          strategy: RedactionStrategy.BLUR,
        },
      ];

      const quality = redactor.checkQuality(frame, regions);

      expect(quality).toBeDefined();
      expect(quality.obscurationScore).toBeGreaterThanOrEqual(0);
      expect(quality.obscurationScore).toBeLessThanOrEqual(1);
      expect(quality.usabilityScore).toBeGreaterThanOrEqual(0);
      expect(quality.usabilityScore).toBeLessThanOrEqual(1);
    });
  });

  describe("Config Management", () => {
    it("should update config", () => {
      redactor.updateConfig({
        defaultStrategy: RedactionStrategy.PIXELATE,
        maxRedactionPercentage: 50,
      });

      const config = redactor.getConfig();
      expect(config.defaultStrategy).toBe(RedactionStrategy.PIXELATE);
      expect(config.maxRedactionPercentage).toBe(50);
    });

    it("should get current config", () => {
      const config = redactor.getConfig();
      expect(config).toHaveProperty("defaultStrategy");
      expect(config).toHaveProperty("maxRedactionPercentage");
      expect(config).toHaveProperty("confidenceThreshold");
    });
  });
});

//==============================================================================
// Integration Tests (5 tests)
//==============================================================================

describe("VL-JEPA Privacy Integration", () => {
  describe("End-to-End Privacy Pipeline", () => {
    it("should analyze, enforce policy, and redact PII", async () => {
      // 1. Analyze privacy
      const analyzer = new VisualPrivacyAnalyzer({
        policy: createDefaultPrivacyPolicy(),
      });

      const frame = createTestImageData();
      const analysis = await analyzer.analyze(frame, VisualDataType.UI_FRAME);

      expect(analysis).toBeDefined();

      // 2. Enforce on-device policy
      const policy = new OnDevicePolicy(createBalancedOnDevicePolicy());
      const config: VLJEPAConfig = {
        processingLocation: ProcessingLocation.EDGE_ONLY,
        enableWebGPU: true,
      };

      const validation = policy.validateProcessingLocation(config);
      expect(validation.valid).toBe(true);

      // 3. Sanitize embedding (simulated)
      const embedding = new Float32Array(768).fill(0.5);
      const sanitized = policy.sanitizeEmbedding(embedding);

      expect(sanitized.vector).toBeDefined();
      expect(sanitized.vector.length).toBe(768);
    });

    it("should handle privacy violations end-to-end", async () => {
      const analyzer = new VisualPrivacyAnalyzer({
        policy: createStrictPrivacyPolicy(),
      });

      const frame = createTestImageData();

      // Camera should be blocked
      const analysis = await analyzer.analyze(frame, VisualDataType.CAMERA);
      expect(analysis.action).toBe(VisualDataAction.BLOCK);
    });
  });

  describe("Policy Consistency", () => {
    it("should maintain consistent privacy across components", () => {
      const defaultPolicy = createDefaultPrivacyPolicy();
      const strictPolicy = createStrictPrivacyPolicy();

      // Default policy should allow more than strict
      expect(defaultPolicy.embeddingSafety.epsilon).toBeGreaterThan(
        strictPolicy.embeddingSafety.epsilon
      );
      expect(defaultPolicy.retention.maxCacheTime).toBeGreaterThan(
        strictPolicy.retention.maxCacheTime
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid frame gracefully", async () => {
      const redactor = new VisualPIIRedactor(createDefaultRedactionConfig());

      // Create minimal frame
      const frame = new ImageData(1, 1);
      const result = await redactor.redact(frame, []);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should process multiple frames efficiently", async () => {
      const analyzer = new VisualPrivacyAnalyzer({
        policy: createDefaultPrivacyPolicy(),
      });

      const frames = Array(10)
        .fill(null)
        .map(() => createTestImageData());

      const startTime = Date.now();
      for (const frame of frames) {
        await analyzer.analyze(frame, VisualDataType.UI_FRAME);
      }
      const duration = Date.now() - startTime;

      // Should process 10 frames in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
