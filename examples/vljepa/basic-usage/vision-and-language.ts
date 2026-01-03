/**
 * VL-JEPA Basic Usage: Vision + Language Processing
 *
 * This example demonstrates the core VL-JEPA capability:
 * processing visual frames and user intent together to predict UI changes.
 *
 * @package @lsi/vljepa-examples
 */

import {
  VLJEPABridge,
  createVLJEPABridge,
  type VLJEPAPrediction,
  type UIFrame,
} from '@lsi/vljepa';

/**
 * Capture a UI frame from the browser
 * In a real implementation, this would use html2canvas or similar
 */
function captureUIFrame(): UIFrame {
  // Simulated implementation
  return {
    data: {} as ImageData, // Would be actual ImageData
    timestamp: Date.now(),
    metadata: {
      url: window.location.href,
      title: document.title,
      elementType: 'body',
    },
  };
}

/**
 * Basic VL-JEPA Example: Process UI frame and user intent together
 *
 * Scenario: User points at a button and says "make this pop"
 * VL-JEPA processes the visual context + language intent to predict the goal state
 */
export async function basicVisionLanguageExample(): Promise<void> {
  console.log('=== VL-JEPA Basic Example: Vision + Language ===\n');

  // 1. Initialize VL-JEPA bridge
  const vljepa = await createVLJEPABridge({
    embeddingDim: 768,
    targetLatency: 100, // <100ms for real-time
    useWebGPU: true,
    onDevice: true, // Privacy-preserving: no data leaves device
  });

  console.log('✓ VL-JEPA initialized');
  console.log('  - Embedding dimension: 768');
  console.log('  - Target latency: <100ms');
  console.log('  - WebGPU: enabled');
  console.log('  - On-device: enabled\n');

  // 2. Capture current UI state
  const uiFrame = captureUIFrame();
  console.log('✓ UI frame captured');
  console.log(`  - Timestamp: ${uiFrame.timestamp}`);
  console.log(`  - URL: ${uiFrame.metadata?.url}\n`);

  // 3. User intent (what they want to change)
  const userIntent = 'make this button pop';
  console.log(`✓ User intent: "${userIntent}"\n`);

  // 4. X-Encoder: Process visual frame
  console.log('Processing visual frame...');
  const startTime = performance.now();
  const visionEmbedding = await vljepa.encodeVision(uiFrame);
  const visionTime = performance.now() - startTime;
  console.log(`✓ X-Encoder output:`);
  console.log(`  - Embedding: [${visionEmbedding.embedding.slice(0, 5).join(', ')}, ...] (${visionEmbedding.embedding.length} dim)`);
  console.log(`  - Confidence: ${(visionEmbedding.confidence * 100).toFixed(1)}%`);
  console.log(`  - Latency: ${visionTime.toFixed(1)}ms\n`);

  // 5. Y-Encoder: Process user intent
  console.log('Processing language intent...');
  const langStart = performance.now();
  const intentEmbedding = await vljepa.encodeLanguage(userIntent);
  const langTime = performance.now() - langStart;
  console.log(`✓ Y-Encoder output:`);
  console.log(`  - Embedding: [${intentEmbedding.embedding.slice(0, 5).join(', ')}, ...] (${intentEmbedding.embedding.length} dim)`);
  console.log(`  - Confidence: ${(intentEmbedding.confidence * 100).toFixed(1)}%`);
  console.log(`  - Latency: ${langTime.toFixed(1)}ms\n`);

  // 6. Predictor: Predict goal state
  console.log('Predicting goal state...');
  const predictStart = performance.now();
  const prediction = await vljepa.predict(
    visionEmbedding.embedding,
    intentEmbedding.embedding
  );
  const predictTime = performance.now() - predictStart;

  console.log('✓ Predictor output:');
  console.log(`  - Goal embedding: [${prediction.goalEmbedding.slice(0, 5).join(', ')}, ...] (${prediction.goalEmbedding.length} dim)`);
  console.log(`  - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log(`  - Semantic similarity: ${(prediction.semanticSimilarity * 100).toFixed(1)}%`);
  console.log(`  - World model consistency: ${(prediction.worldModelConsistency * 100).toFixed(1)}%`);
  console.log(`  - Latency: ${predictTime.toFixed(1)}ms\n`);

  // 7. Suggested actions
  console.log('✓ Suggested actions:');
  prediction.actions.forEach((action, index) => {
    console.log(`  ${index + 1}. ${action.type.toUpperCase()}: ${action.target}`);
    console.log(`     Confidence: ${(action.confidence * 100).toFixed(1)}%`);
    if (action.reasoning) {
      console.log(`     Reasoning: ${action.reasoning}`);
    }
  });

  console.log('\n=== Summary ===');
  console.log(`Total processing time: ${(visionTime + langTime + predictTime).toFixed(1)}ms`);
  console.log(`VL-JEPA advantage: 2.85x faster than traditional VLMs`);

  // Cleanup
  vljepa.dispose();
}

/**
 * Convenience method: One-shot prediction
 */
export async function quickPredict(
  frame: UIFrame,
  intent: string
): Promise<VLJEPAPrediction> {
  const vljepa = await createVLJEPABridge();

  try {
    return await vljepa.encodeAndPredict(frame, intent);
  } finally {
    vljepa.dispose();
  }
}

/**
 * Batch processing example: Process multiple UI frames
 */
export async function batchProcessingExample(): Promise<void> {
  const vljepa = await createVLJEPABridge();

  const intents = [
    'center the button',
    'make the text larger',
    'add more padding',
    'change color to blue',
  ];

  const frame = captureUIFrame();

  console.log('=== Batch Processing Example ===\n');

  const results = await Promise.all(
    intents.map(async (intent) => {
      const start = performance.now();
      const prediction = await vljepa.encodeAndPredict(frame, intent);
      const time = performance.now() - start;

      return {
        intent,
        confidence: prediction.confidence,
        time: time.toFixed(1),
        actions: prediction.actions.length,
      };
    })
  );

  console.table(results);

  vljepa.dispose();
}

/**
 * Error handling example
 */
export async function errorHandlingExample(): Promise<void> {
  try {
    const vljepa = await createVLJEPABridge();

    // Invalid frame (will throw)
    await vljepa.encodeVision({} as UIFrame);
  } catch (error) {
    if (error instanceof Error) {
      console.error('VL-JEPA Error:', error.message);
      console.error('This is expected when input is invalid.');
    }
  }
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await basicVisionLanguageExample();
    console.log('\n---\n');
    await batchProcessingExample();
  })().catch(console.error);
}
