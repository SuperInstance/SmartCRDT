/**
 * @lsi/webgpu-examples/vljepa/16-full-vljepa
 *
 * Complete VL-JEPA Pipeline on GPU.
 * This example demonstrates how to:
 * - Run the full VL-JEPA pipeline end-to-end
 * - Combine X-Encoder, Y-Encoder, and Predictor
 * - Process UI frames with user intent to generate actions
 */

import { XEncoderGPU } from './13-x-encoder-gpu.js';
import { YEncoderGPU } from './14-y-encoder-gpu.js';
import { PredictorGPU, PredictedAction } from './15-predictor-gpu.js';

/**
 * Complete VL-JEPA pipeline result
 */
export interface VLJEPAResult {
  visionEmbedding: Float32Array;
  languageEmbedding: Float32Array;
  goalEmbedding: Float32Array;
  actions: PredictedAction[];
  processingTime: number;
}

/**
 * Complete VL-JEPA pipeline on GPU
 */
export class VLJEPAPipeline {
  private xEncoder: XEncoderGPU;
  private yEncoder: YEncoderGPU;
  private predictor: PredictorGPU;
  private initialized: boolean = false;

  constructor() {
    this.xEncoder = new XEncoderGPU();
    this.yEncoder = new YEncoderGPU();
    this.predictor = new PredictorGPU();
  }

  /**
   * Initialize all components
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.xEncoder.init(),
      this.yEncoder.init(),
      this.predictor.init()
    ]);

    this.initialized = true;
  }

  /**
   * Process UI frame with user intent
   *
   * @param imageFrame - UI frame (224x224x3)
   * @param userIntent - User intent tokens
   * @param weights - Model weights
   * @returns Complete VL-JEPA result
   */
  async process(
    imageFrame: Float32Array,
    userIntent: Uint32Array,
    weights: any
  ): Promise<VLJEPAResult> {
    if (!this.initialized) {
      await this.init();
    }

    const startTime = performance.now();

    // Step 1: Encode vision (X-Encoder)
    const visionEmbedding = await this.xEncoder.encode(imageFrame, weights.x);

    // Step 2: Encode language (Y-Encoder)
    const languageEmbedding = await this.yEncoder.encode(userIntent, weights.y);

    // Step 3: Predict goal and actions (Predictor)
    const { goal: goalEmbedding, actions } = await this.predictor.predict(
      visionEmbedding,
      languageEmbedding,
      weights.predictor
    );

    const endTime = performance.now();

    return {
      visionEmbedding,
      languageEmbedding,
      goalEmbedding,
      actions,
      processingTime: endTime - startTime
    };
  }

  /**
   * Batch process multiple frames
   *
   * @param frames - Array of image frames
   * @param intents - Array of user intents
   * @param weights - Model weights
   * @returns Array of results
   */
  async processBatch(
    frames: Float32Array[],
    intents: Uint32Array[],
    weights: any
  ): Promise<VLJEPAResult[]> {
    const results: VLJEPAResult[] = [];

    for (let i = 0; i < frames.length; i++) {
      const result = await this.process(frames[i], intents[i], weights);
      results.push(result);
    }

    return results;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.xEncoder.dispose();
    this.yEncoder.dispose();
    this.predictor.dispose();
    this.initialized = false;
  }
}

/**
 * Create dummy weights for testing
 */
function createDummyWeights(): any {
  return {
    x: {
      patchEmbedding: new Float32Array(16 * 16 * 3 * 768).map(() => Math.random() * 0.1),
      positionEmbedding: new Float32Array(196 * 768).map(() => Math.random() * 0.01)
    },
    y: {
      tokenEmbedding: new Float32Array(50000 * 768).map(() => Math.random() * 0.1),
      positionEmbedding: new Float32Array(512 * 768).map(() => Math.random() * 0.01),
      layers: Array(12).fill(null).map(() => ({
        attention: {
          Q: new Float32Array(768 * 768).map(() => Math.random() * 0.1),
          K: new Float32Array(768 * 768).map(() => Math.random() * 0.1),
          V: new Float32Array(768 * 768).map(() => Math.random() * 0.1)
        },
        ffn: {
          W1: new Float32Array(768 * 3072).map(() => Math.random() * 0.1),
          W2: new Float32Array(3072 * 768).map(() => Math.random() * 0.1)
        }
      }))
    },
    predictor: {
      combine: {
        Wx: new Float32Array(768 * 2048).map(() => Math.random() * 0.1),
        Wy: new Float32Array(768 * 2048).map(() => Math.random() * 0.1),
        bias: new Float32Array(2048).fill(0)
      },
      goal: {
        W: new Float32Array(2048 * 768).map(() => Math.random() * 0.1),
        bias: new Float32Array(768).fill(0)
      },
      actions: {
        modify: new Float32Array(768).fill(0.1), // Bias toward modify
        create: new Float32Array(768).fill(-0.1),
        delete: new Float32Array(768).fill(-0.2)
      }
    }
  };
}

/**
 * Run complete VL-JEPA pipeline example
 */
export async function runFullVLJEPA(): Promise<void> {
  console.log('=== Complete VL-JEPA Pipeline on GPU ===\n');
  console.log('Processing: UI Frame + User Intent -> Actions\n');

  const pipeline = new VLJEPAPipeline();
  await pipeline.init();

  // Create sample UI frame (224x224x3)
  const imageSize = 224 * 224 * 3;
  const imageFrame = new Float32Array(imageSize);
  for (let i = 0; i < imageSize; i++) {
    imageFrame[i] = Math.random() * 0.5 + 0.25; // Mid-brightness
  }

  // Create sample user intent tokens ("make button pop")
  const userIntent = new Uint32Array([100, 500, 1234, 5678]);

  console.log('Input:');
  console.log('  UI Frame: 224x224x3 RGB image');
  console.log('  User Intent: [100, 500, 1234, 5678] (tokenized text)');
  console.log();

  // Create weights
  const weights = createDummyWeights();

  // Process
  console.log('Running VL-JEPA pipeline on GPU...');
  console.log();

  const result = await pipeline.process(imageFrame, userIntent, weights);

  console.log('--- Results ---');
  console.log();
  console.log('Vision Embedding (X):');
  console.log(`  Dimensions: ${result.visionEmbedding.length}`);
  console.log(`  First 10: [${Array.from(result.visionEmbedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
  console.log();

  console.log('Language Embedding (Y):');
  console.log(`  Dimensions: ${result.languageEmbedding.length}`);
  console.log(`  First 10: [${Array.from(result.languageEmbedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
  console.log();

  console.log('Goal Embedding:');
  console.log(`  Dimensions: ${result.goalEmbedding.length}`);
  console.log(`  First 10: [${Array.from(result.goalEmbedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
  console.log();

  console.log('Predicted Actions:');
  for (let i = 0; i < result.actions.length; i++) {
    const action = result.actions[i];
    const bar = '█'.repeat(Math.floor(action.confidence * 50));
    console.log(`  ${i + 1}. ${action.type.padEnd(8)} ${bar} ${(action.confidence * 100).toFixed(1)}%`);
  }
  console.log();

  console.log('Performance:');
  console.log(`  Total processing time: ${result.processingTime.toFixed(2)}ms`);
  console.log(`  Target: <100ms for real-time UI`);
  console.log(`  Status: ${result.processingTime < 100 ? '✓ PASS' : '✗ FAIL'}`);
  console.log();

  // Batch processing example
  console.log('--- Batch Processing ---');
  const batchFrames = [imageFrame, imageFrame, imageFrame];
  const batchIntents = [userIntent, userIntent, userIntent];

  const batchStart = performance.now();
  const batchResults = await pipeline.processBatch(batchFrames, batchIntents, weights);
  const batchEnd = performance.now();

  console.log(`Processed ${batchResults.length} frames in ${(batchEnd - batchStart).toFixed(2)}ms`);
  console.log(`Average: ${((batchEnd - batchStart) / batchResults.length).toFixed(2)}ms per frame`);

  pipeline.dispose();
}

/**
 * Interactive VL-JEPA demo helper
 */
export async function demoVLJEPARoundtrip(
  imageDescription: string,
  userIntentText: string
): Promise<VLJEPAResult> {
  const pipeline = new VLJEPAPipeline();
  await pipeline.init();

  // In a real implementation, these would come from actual preprocessing
  const imageFrame = new Float32Array(224 * 224 * 3).fill(0.5);
  const tokens = new Uint32Array(4).fill(100);

  const weights = createDummyWeights();
  const result = await pipeline.process(imageFrame, tokens, weights);

  console.log(`\n=== VL-JEPA Demo ===`);
  console.log(`Image: ${imageDescription}`);
  console.log(`Intent: "${userIntentText}"`);
  console.log(`Top Action: ${result.actions[0].type} (${(result.actions[0].confidence * 100).toFixed(1)}%)`);

  pipeline.dispose();
  return result;
}
