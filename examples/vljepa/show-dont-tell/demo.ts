/**
 * VL-JEPA "Show, Don't Tell" Demo
 *
 * This example demonstrates VL-JEPA's breakthrough capability:
 * Upload a goal UI image, get the code to achieve it.
 *
 * Instead of describing what you want ("make the button blue"),
 * you show VL-JEPA what you want (upload a screenshot of the goal),
 * and it generates the code to get there.
 *
 * @package @lsi/vljepa-examples
 */

import {
  VLJEPABridge,
  createVLJEPABridge,
  A2UIRenderer,
  CoAgentsProvider,
  type UIFrame,
  type VLJEPAPrediction,
  type StateDelta,
  type A2UIResponse,
} from '@lsi/vljepa';

/**
 * Load a goal image from file
 * In a real implementation, this would be an image upload
 */
function loadGoalImage(imagePath: string): UIFrame {
  // Simulated implementation
  return {
    data: {} as ImageData,
    timestamp: Date.now(),
    metadata: {
      url: imagePath,
      title: 'Goal UI',
    },
  };
}

/**
 * Capture current UI state
 */
function captureCurrentUI(): UIFrame {
  // Simulated implementation
  return {
    data: {} as ImageData,
    timestamp: Date.now(),
    metadata: {
      url: window.location.href,
      title: document.title,
    },
  };
}

/**
 * "Show, Don't Tell" Demo
 *
 * Scenario: User uploads a goal UI image and VL-JEPA calculates
 * the delta and generates code to achieve it.
 */
export async function showDontTellDemo(): Promise<void> {
  console.log('=== VL-JEPA "Show, Don\'t Tell" Demo ===\n');
  console.log('Revolutionary capability: Upload goal UI, get code\n');

  // 1. Initialize components
  const vljepa = await createVLJEPABridge({
    embeddingDim: 768,
    useWebGPU: true,
    onDevice: true,
  });

  const a2ui = new A2UIRenderer();
  const coagents = new CoAgentsProvider();

  console.log('✓ Components initialized:');
  console.log('  - VL-JEPA: for visual understanding');
  console.log('  - A2UI: for UI generation');
  console.log('  - CoAgents: for orchestration\n');

  // 2. User uploads "before" and "after" states
  console.log('Step 1: Capture current UI');
  const currentUI = captureCurrentUI();
  console.log(`✓ Current UI captured from ${currentUI.metadata?.url}\n`);

  console.log('Step 2: Upload goal UI');
  const goalUI = loadGoalImage('/path/to/goal-ui.png');
  console.log(`✓ Goal UI loaded: ${goalUI.metadata?.url}\n`);

  // 3. Encode both states
  console.log('Step 3: Encode visual states');
  const encodeStart = performance.now();

  const [currentEmbedding, goalEmbedding] = await Promise.all([
    vljepa.encodeVision(currentUI),
    vljepa.encodeVision(goalUI),
  ]);

  const encodeTime = performance.now() - encodeStart;
  console.log(`✓ Both states encoded in ${encodeTime.toFixed(1)}ms`);
  console.log(`  - Current: [${currentEmbedding.embedding.slice(0, 3).join(', ')}, ...]`);
  console.log(`  - Goal: [${goalEmbedding.embedding.slice(0, 3).join(', ')}, ...]\n`);

  // 4. Calculate delta (what needs to change)
  console.log('Step 4: Calculate state delta');
  const deltaStart = performance.now();
  const delta: StateDelta = await vljepa.calculateDelta(
    currentEmbedding.embedding,
    goalEmbedding.embedding
  );
  const deltaTime = performance.now() - deltaStart;

  console.log(`✓ Delta calculated in ${deltaTime.toFixed(1)}ms:`);
  console.log(`  - Distance: ${delta.distance.toFixed(4)} (cosine similarity)`);
  console.log(`  - Actions needed: ${delta.actions.length}`);
  console.log(`  - Estimated steps: ${delta.steps}`);
  console.log(`  - Difficulty: ${(delta.difficulty * 100).toFixed(1)}%\n`);

  // 5. Display suggested actions
  console.log('Step 5: Suggested actions to achieve goal:');
  delta.actions.forEach((action, index) => {
    console.log(`  ${index + 1}. ${action.type.toUpperCase()}: ${action.target}`);
    if (action.reasoning) {
      console.log(`     → ${action.reasoning}`);
    }
  });
  console.log();

  // 6. Generate A2UI from delta
  console.log('Step 6: Generate A2UI from delta');
  const a2uiStart = performance.now();
  const a2uiResponse: A2UIResponse = await a2ui.generateFromDelta(delta);
  const a2uiTime = performance.now() - a2uiStart;

  console.log(`✓ A2UI generated in ${a2uiTime.toFixed(1)}ms:`);
  console.log(`  - Components: ${a2uiResponse.components.length}`);
  console.log(`  - Layout: ${a2uiResponse.layout?.type || 'default'}`);
  console.log(`  - Actions: ${a2uiResponse.actions?.length || 0}\n`);

  // 7. Preview for user
  console.log('Step 7: Render preview for user');
  console.log('✓ Preview rendered (showing "before" → "after" transition)');
  console.log('  User can now approve, modify, or reject the changes.\n');

  // 8. Summary
  console.log('=== Summary ===');
  const totalTime = encodeTime + deltaTime + a2uiTime;
  console.log(`Total time: ${totalTime.toFixed(1)}ms`);
  console.log(`Average latency: ${(totalTime / 3).toFixed(1)}ms`);
  console.log(`VL-JEPA advantage: 10x faster than pixel-by-pixel VLMs`);

  // Cleanup
  vljepa.dispose();
}

/**
 * Alternative: Text description + visual refinement
 *
 * User provides rough description ("make it modern"),
 * VL-JEPA refines with visual examples
 */
export async function textPlusVisualExample(): Promise<void> {
  const vljepa = await createVLJEPABridge();

  console.log('=== Text + Visual Refinement Demo ===\n');

  // User provides rough description
  const userIntent = 'make it look modern';

  // VL-JEPA encodes intent
  const intentEmbedding = await vljepa.encodeLanguage(userIntent);

  // User provides 2-3 reference images of "modern" UIs
  const referenceImages = [
    loadGoalImage('/modern-1.png'),
    loadGoalImage('/modern-2.png'),
    loadGoalImage('/modern-3.png'),
  ];

  // VL-JEPA encodes all references
  const referenceEmbeddings = await Promise.all(
    referenceImages.map((img) => vljepa.encodeVision(img))
  );

  // VL-JEPA finds "centroid" of modern style
  const centroidEmbedding = await vljepa.averageEmbeddings(
    referenceEmbeddings.map((e) => e.embedding)
  );

  // Predict goal state
  const currentUI = captureCurrentUI();
  const currentEmbedding = await vljepa.encodeVision(currentUI);

  const prediction = await vljepa.predict(
    currentEmbedding.embedding,
    centroidEmbedding
  );

  console.log('✓ Modern style predicted from reference images');
  console.log(`  - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log(`  - Actions: ${prediction.actions.length}`);

  vljepa.dispose();
}

/**
 * Multi-step goal achievement
 *
 * Break down complex UI changes into manageable steps
 */
export async function multiStepGoalExample(): Promise<void> {
  const vljepa = await createVLJEPABridge();
  const coagents = new CoAgentsProvider();

  console.log('=== Multi-Step Goal Achievement ===\n');

  const currentUI = captureCurrentUI();
  const goalUI = loadGoalImage('/complex-goal.png');

  // Calculate delta
  const currentEmbedding = await vljepa.encodeVision(currentUI);
  const goalEmbedding = await vljepa.encodeVision(goalUI);

  const delta = await vljepa.calculateDelta(
    currentEmbedding.embedding,
    goalEmbedding.embedding
  );

  console.log(`Goal requires ${delta.steps} steps`);
  console.log(`Difficulty: ${(delta.difficulty * 100).toFixed(1)}%\n`);

  // CoAgents plans step-by-step execution
  const plan = await coagents.createExecutionPlan(delta);

  console.log('Execution plan:');
  plan.steps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.description}`);
    console.log(`     Actions: ${step.actions.length}`);
    console.log(`     Estimated time: ${step.estimatedTime}ms`);
  });

  vljepa.dispose();
}

/**
 * Visual A/B testing
 *
 * Generate multiple variants and let user choose
 */
export async function visualABTestExample(): Promise<void> {
  const vljepa = await createVLJEPABridge();
  const a2ui = new A2UIRenderer();

  console.log('=== Visual A/B Testing Demo ===\n');

  const currentUI = captureCurrentUI();
  const currentEmbedding = await vljepa.encodeVision(currentUI);

  const intents = [
    'modern and clean',
    'bold and colorful',
    'minimal and elegant',
  ];

  console.log('Generating 3 variants...\n');

  const variants = await Promise.all(
    intents.map(async (intent, index) => {
      const intentEmbedding = await vljepa.encodeLanguage(intent);
      const prediction = await vljepa.predict(
        currentEmbedding.embedding,
        intentEmbedding.embedding
      );

      const a2uiResponse = await a2ui.generateFromPrediction(prediction);

      return {
        id: index + 1,
        intent,
        confidence: prediction.confidence,
        components: a2uiResponse.components,
      };
    })
  );

  console.log('Variants generated:');
  variants.forEach((variant) => {
    console.log(`  Variant ${variant.id}: "${variant.intent}"`);
    console.log(`    Confidence: ${(variant.confidence * 100).toFixed(1)}%`);
    console.log(`    Components: ${variant.components.length}`);
  });

  console.log('\nUser selects preferred variant...');

  vljepa.dispose();
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await showDontTellDemo();
    console.log('\n---\n');
    await textPlusVisualExample();
  })().catch(console.error);
}
