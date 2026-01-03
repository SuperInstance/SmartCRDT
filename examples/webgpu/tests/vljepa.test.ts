/**
 * WebGPU Examples - VL-JEPA Integration Tests
 *
 * Tests for VL-JEPA integration examples: X-Encoder, Y-Encoder,
 * Predictor, and full pipeline.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  XEncoderGPU,
  DEFAULT_X_ENCODER_CONFIG,
  runXEncoderGPU
} from '../src/vljepa/13-x-encoder-gpu.js';
import {
  YEncoderGPU,
  DEFAULT_Y_ENCODER_CONFIG,
  runYEncoderGPU
} from '../src/vljepa/14-y-encoder-gpu.js';
import {
  PredictorGPU,
  DEFAULT_PREDICTOR_CONFIG,
  runPredictorGPU,
  JEPAAction
} from '../src/vljepa/15-predictor-gpu.js';
import {
  VLJEPAPipeline,
  runFullVLJEPA,
  demoVLJEPARoundtrip
} from '../src/vljepa/16-full-vljepa.js';

const isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

describe('X-Encoder (Vision)', () => {
  let encoder: XEncoderGPU;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      encoder = new XEncoderGPU();
      await encoder.init();
    }
  });

  afterEach(() => {
    if (encoder) {
      encoder.dispose();
    }
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = DEFAULT_X_ENCODER_CONFIG;

      expect(config.imageSize).toBe(224);
      expect(config.patchSize).toBe(16);
      expect(config.embeddingDim).toBe(768);
      expect(config.numLayers).toBe(12);
      expect(config.numHeads).toBe(12);
    });

    it('should accept custom configuration', async () => {
      const customEncoder = new XEncoderGPU({
        imageSize: 128,
        patchSize: 8,
        embeddingDim: 512,
        numLayers: 6,
        numHeads: 8
      });

      expect(customEncoder).toBeTruthy();

      if (isWebGPUAvailable) {
        await customEncoder.init();
        customEncoder.dispose();
      }
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Patch Extraction', () => {
    it('should extract patches from image', async () => {
      const imageSize = 224 * 224 * 3;
      const image = new Float32Array(imageSize);
      for (let i = 0; i < imageSize; i++) {
        image[i] = Math.random();
      }

      const patches = await encoder.extractPatches(image);

      const numPatches = Math.pow(224 / 16, 2); // 196
      const patchDim = 16 * 16 * 3; // 768

      expect(patches.length).toBe(numPatches * patchDim);
    });

    it('should handle standard input size', async () => {
      const image = new Float32Array(224 * 224 * 3).fill(0.5);

      const patches = await encoder.extractPatches(image);

      expect(patches).toBeInstanceOf(Float32Array);
      expect(patches.length).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Patch Embedding', () => {
    it('should project patches to embedding space', async () => {
      const numPatches = 196;
      const patchDim = 16 * 16 * 3;
      const patches = new Float32Array(numPatches * patchDim).fill(1);

      const weights = new Float32Array(patchDim * 768).fill(0.01);

      const embedded = await encoder.patchEmbedding(patches, weights);

      expect(embedded.length).toBe(numPatches * 768);
    });

    it('should handle different embedding dimensions', async () => {
      const numPatches = 4;
      const patchDim = 8;
      const patches = new Float32Array(numPatches * patchDim).fill(1);

      const weights = new Float32Array(patchDim * 512).fill(0.01);

      const customEncoder = new XEncoderGPU({
        imageSize: 32,
        patchSize: 8,
        embeddingDim: 512,
        numLayers: 2,
        numHeads: 4
      });

      await customEncoder.init();

      const embedded = await customEncoder.patchEmbedding(patches, weights);

      expect(embedded.length).toBe(numPatches * 512);

      customEncoder.dispose();
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Position Embeddings', () => {
    it('should add positional embeddings', async () => {
      const patches = new Float32Array(196 * 768).fill(1);
      const posEmbeddings = new Float32Array(196 * 768).fill(0.1);

      const result = await encoder.addPositionEmbeddings(patches, posEmbeddings);

      expect(result.length).toBe(patches.length);
      expect(result[0]).toBeCloseTo(1.1, 0.001);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Full Encoding', () => {
    it('should produce 768-dim embeddings', async () => {
      const image = new Float32Array(224 * 224 * 3).fill(0.5);

      const weights = {
        patchEmbedding: new Float32Array(16 * 16 * 3 * 768).fill(0.01),
        positionEmbedding: new Float32Array(196 * 768).fill(0.001)
      };

      const embedding = await encoder.encode(image, weights);

      expect(embedding.length).toBe(768);
    });

    it('should handle different inputs', async () => {
      const image1 = new Float32Array(224 * 224 * 3).fill(0);
      const image2 = new Float32Array(224 * 224 * 3).fill(1);

      const weights = {
        patchEmbedding: new Float32Array(16 * 16 * 3 * 768).fill(0.01),
        positionEmbedding: new Float32Array(196 * 768).fill(0.001)
      };

      const emb1 = await encoder.encode(image1, weights);
      const emb2 = await encoder.encode(image2, weights);

      // Different inputs should produce different embeddings
      let diff = 0;
      for (let i = 0; i < 768; i++) {
        diff += Math.abs(emb1[i] - emb2[i]);
      }
      expect(diff).toBeGreaterThan(0);
    });
  });
});

describe('Y-Encoder (Language)', () => {
  let encoder: YEncoderGPU;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      encoder = new YEncoderGPU();
      await encoder.init();
    }
  });

  afterEach(() => {
    if (encoder) {
      encoder.dispose();
    }
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = DEFAULT_Y_ENCODER_CONFIG;

      expect(config.vocabSize).toBe(50000);
      expect(config.maxSeqLen).toBe(512);
      expect(config.embeddingDim).toBe(768);
      expect(config.numLayers).toBe(12);
      expect(config.numHeads).toBe(12);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Token Embedding', () => {
    it('should lookup token embeddings', async () => {
      const tokens = new Uint32Array([100, 200, 300]);
      const embeddingMatrix = new Float32Array(50000 * 768).fill(0.01);

      const embeddings = await encoder.tokenEmbedding(tokens, embeddingMatrix);

      expect(embeddings.length).toBe(tokens.length * 768);
    });

    it('should handle different sequence lengths', async () => {
      const tokens = new Uint32Array(10);
      const embeddingMatrix = new Float32Array(50000 * 768).fill(0.01);

      const embeddings = await encoder.tokenEmbedding(tokens, embeddingMatrix);

      expect(embeddings.length).toBe(10 * 768);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Feed Forward Network', () => {
    it('should apply feed forward layer', async () => {
      const hidden = new Float32Array(4 * 768).fill(0.5);

      const weights = {
        W1: new Float32Array(768 * 3072).fill(0.01),
        W2: new Float32Array(3072 * 768).fill(0.01)
      };

      const output = await encoder.feedForward(hidden, weights);

      expect(output.length).toBe(hidden.length);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Full Encoding', () => {
    it('should encode tokens to embeddings', async () => {
      const tokens = new Uint32Array([100, 500, 1000]);

      const weights = {
        tokenEmbedding: new Float32Array(50000 * 768).fill(0.01),
        positionEmbedding: new Float32Array(512 * 768).fill(0.001),
        layers: Array(12).fill(null).map(() => ({
          attention: {
            Q: new Float32Array(768 * 768).fill(0.01),
            K: new Float32Array(768 * 768).fill(0.01),
            V: new Float32Array(768 * 768).fill(0.01)
          },
          ffn: {
            W1: new Float32Array(768 * 3072).fill(0.01),
            W2: new Float32Array(3072 * 768).fill(0.01)
          }
        }))
      };

      const embedding = await encoder.encode(tokens, weights);

      expect(embedding.length).toBe(768);
    });
  });
});

describe('Predictor', () => {
  let predictor: PredictorGPU;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      predictor = new PredictorGPU();
      await predictor.init();
    }
  });

  afterEach(() => {
    if (predictor) {
      predictor.dispose();
    }
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = DEFAULT_PREDICTOR_CONFIG;

      expect(config.embeddingDim).toBe(768);
      expect(config.hiddenDim).toBe(2048);
      expect(config.numLayers).toBe(4);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Combine Embeddings', () => {
    it('should combine X and Y embeddings', async () => {
      const x = new Float32Array(768).fill(1);
      const y = new Float32Array(768).fill(0.5);

      const weights = {
        Wx: new Float32Array(768 * 2048).fill(0.01),
        Wy: new Float32Array(768 * 2048).fill(0.01),
        bias: new Float32Array(2048).fill(0)
      };

      const combined = await predictor.combineEmbeddings(x, y, weights);

      expect(combined.length).toBe(2048);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Predict Goal', () => {
    it('should predict goal state', async () => {
      const combined = new Float32Array(2048).fill(0.5);

      const weights = {
        W: new Float32Array(2048 * 768).fill(0.01),
        bias: new Float32Array(768).fill(0)
      };

      const goal = await predictor.predictGoal(combined, weights);

      expect(goal.length).toBe(768);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Predict Actions', () => {
    it('should predict actions from goal', async () => {
      const goal = new Float32Array(768).fill(0.5);

      const weights = {
        modify: new Float32Array(768).fill(0.1),
        create: new Float32Array(768).fill(-0.1),
        delete: new Float32Array(768).fill(-0.2)
      };

      const actions = await predictor.predictActions(goal, weights);

      expect(actions.length).toBe(3);
      expect(actions[0].type).toBe('modify'); // Highest weight
      expect(actions[0].confidence).toBeGreaterThan(0);
    });

    it('should sort actions by confidence', async () => {
      const goal = new Float32Array(768).fill(0.5);

      const weights = {
        modify: new Float32Array(768).fill(0.3),
        create: new Float32Array(768).fill(0.2),
        delete: new Float32Array(768).fill(0.1)
      };

      const actions = await predictor.predictActions(goal, weights);

      expect(actions[0].confidence).toBeGreaterThanOrEqual(actions[1].confidence);
      expect(actions[1].confidence).toBeGreaterThanOrEqual(actions[2].confidence);
    });
  });
});

describe('Full VL-JEPA Pipeline', () => {
  let pipeline: VLJEPAPipeline;

  beforeEach(async () => {
    if (isWebGPUAvailable) {
      pipeline = new VLJEPAPipeline();
      await pipeline.init();
    }
  });

  afterEach(() => {
    if (pipeline) {
      pipeline.dispose();
    }
  });

  describe.skipIf(!isWebGPUAvailable)('End-to-End Processing', () => {
    it('should process UI frame and intent', async () => {
      const imageFrame = new Float32Array(224 * 224 * 3).fill(0.5);
      const userIntent = new Uint32Array([100, 500]);

      const weights = {
        x: {
          patchEmbedding: new Float32Array(16 * 16 * 3 * 768).fill(0.01),
          positionEmbedding: new Float32Array(196 * 768).fill(0.001)
        },
        y: {
          tokenEmbedding: new Float32Array(50000 * 768).fill(0.01),
          positionEmbedding: new Float32Array(512 * 768).fill(0.001),
          layers: Array(12).fill(null).map(() => ({
            attention: {
              Q: new Float32Array(768 * 768).fill(0.01),
              K: new Float32Array(768 * 768).fill(0.01),
              V: new Float32Array(768 * 768).fill(0.01)
            },
            ffn: {
              W1: new Float32Array(768 * 3072).fill(0.01),
              W2: new Float32Array(3072 * 768).fill(0.01)
            }
          }))
        },
        predictor: {
          combine: {
            Wx: new Float32Array(768 * 2048).fill(0.01),
            Wy: new Float32Array(768 * 2048).fill(0.01),
            bias: new Float32Array(2048).fill(0)
          },
          goal: {
            W: new Float32Array(2048 * 768).fill(0.01),
            bias: new Float32Array(768).fill(0)
          },
          actions: {
            modify: new Float32Array(768).fill(0.1),
            create: new Float32Array(768).fill(-0.1),
            delete: new Float32Array(768).fill(-0.2)
          }
        }
      };

      const result = await pipeline.process(imageFrame, userIntent, weights);

      expect(result.visionEmbedding.length).toBe(768);
      expect(result.languageEmbedding.length).toBe(768);
      expect(result.goalEmbedding.length).toBe(768);
      expect(result.actions.length).toBe(3);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!isWebGPUAvailable)('Batch Processing', () => {
    it('should process multiple frames', async () => {
      const frames = [
        new Float32Array(224 * 224 * 3).fill(0.5),
        new Float32Array(224 * 224 * 3).fill(0.6)
      ];

      const intents = [
        new Uint32Array([100, 500]),
        new Uint32Array([200, 600])
      ];

      const weights = {
        x: {
          patchEmbedding: new Float32Array(16 * 16 * 3 * 768).fill(0.01),
          positionEmbedding: new Float32Array(196 * 768).fill(0.001)
        },
        y: {
          tokenEmbedding: new Float32Array(50000 * 768).fill(0.01),
          positionEmbedding: new Float32Array(512 * 768).fill(0.001),
          layers: Array(12).fill(null).map(() => ({
            attention: {
              Q: new Float32Array(768 * 768).fill(0.01),
              K: new Float32Array(768 * 768).fill(0.01),
              V: new Float32Array(768 * 768).fill(0.01)
            },
            ffn: {
              W1: new Float32Array(768 * 3072).fill(0.01),
              W2: new Float32Array(3072 * 768).fill(0.01)
            }
          }))
        },
        predictor: {
          combine: {
            Wx: new Float32Array(768 * 2048).fill(0.01),
            Wy: new Float32Array(768 * 2048).fill(0.01),
            bias: new Float32Array(2048).fill(0)
          },
          goal: {
            W: new Float32Array(2048 * 768).fill(0.01),
            bias: new Float32Array(768).fill(0)
          },
          actions: {
            modify: new Float32Array(768).fill(0.1),
            create: new Float32Array(768).fill(-0.1),
            delete: new Float32Array(768).fill(-0.2)
          }
        }
      };

      const results = await pipeline.processBatch(frames, intents, weights);

      expect(results.length).toBe(2);
      expect(results[0].visionEmbedding.length).toBe(768);
      expect(results[1].visionEmbedding.length).toBe(768);
    });
  });
});

describe('Action Types', () => {
  it('should have correct action types', () => {
    const actions: JEPAAction[] = ['modify', 'create', 'delete'];

    expect(actions).toContain('modify');
    expect(actions).toContain('create');
    expect(actions).toContain('delete');
  });
});

describe('Performance Targets', () => {
  it.skipIf(!isWebGPUAvailable)('should complete in reasonable time', async () => {
    const pipeline = new VLJEPAPipeline();
    await pipeline.init();

    const imageFrame = new Float32Array(224 * 224 * 3).fill(0.5);
    const userIntent = new Uint32Array([100, 500]);

    const weights = {
      x: { patchEmbedding: new Float32Array(16 * 16 * 3 * 768).fill(0.01), positionEmbedding: new Float32Array(196 * 768).fill(0.001) },
      y: { tokenEmbedding: new Float32Array(50000 * 768).fill(0.01), positionEmbedding: new Float32Array(512 * 768).fill(0.001), layers: [] },
      predictor: {
        combine: { Wx: new Float32Array(768 * 2048).fill(0.01), Wy: new Float32Array(768 * 2048).fill(0.01), bias: new Float32Array(2048).fill(0) },
        goal: { W: new Float32Array(2048 * 768).fill(0.01), bias: new Float32Array(768).fill(0) },
        actions: { modify: new Float32Array(768).fill(0.1), create: new Float32Array(768).fill(-0.1), delete: new Float32Array(768).fill(-0.2) }
      }
    };

    const start = performance.now();
    const result = await pipeline.process(imageFrame, userIntent, weights);
    const end = performance.now();

    // Should process in under 1 second for test data
    expect(end - start).toBeLessThan(1000);

    pipeline.dispose();
  });
});
