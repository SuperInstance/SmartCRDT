/**
 * Stage 1: Basic Concepts
 *
 * Learning Objectives:
 * - Basic shapes: Circles, squares, triangles
 * - Colors: Primary, secondary, gradients
 * - Typography: Basic fonts, sizes, weights
 * - Simple patterns: Stripes, checks, dots
 *
 * Target: 5,000+ basic examples
 * Difficulty Range: 0-0.25
 */

import type {
  BasicConcept,
  ConceptVariation,
  Stage1Config,
  Stage1Example,
  TrainingExample,
  DataGenerator,
  StageEvaluator,
  GeneratorProgress,
  EvaluationResult,
  BatchEvaluationResult,
  StageProgress,
} from "../types.js";

export class Stage1Basic {
  private config: Stage1Config;
  private generator: BasicConceptsGenerator;
  private evaluator: BasicConceptsEvaluator;

  constructor(config: Partial<Stage1Config> = {}) {
    this.config = {
      examples: 5000,
      epochs: 10,
      batchSize: 32,
      masteryThreshold: 0.9,
      patience: 3,
      prerequisites: [],
      concepts: this.getDefaultConcepts(),
      difficulty: "very_easy" as const,
      colorSpaces: ["rgb", "hsl"],
      shapeComplexity: ["simple"],
      ...config,
    };

    this.generator = new BasicConceptsGenerator(this.config);
    this.evaluator = new BasicConceptsEvaluator();
  }

  /**
   * Get default basic concepts for Stage 1
   */
  private getDefaultConcepts(): BasicConcept[] {
    return [
      // Shapes
      {
        type: "shape",
        name: "circle",
        variations: [
          { parameters: { radius: [10, 20, 30, 40, 50] }, weight: 1.0 },
          { parameters: { fill: [true, false] }, weight: 0.5 },
        ],
        labels: ["circle", "round", "circular"],
      },
      {
        type: "shape",
        name: "square",
        variations: [
          { parameters: { size: [20, 30, 40, 50, 60] }, weight: 1.0 },
          { parameters: { rotation: [0, 45] }, weight: 0.3 },
        ],
        labels: ["square", "rectangle", "quadrilateral"],
      },
      {
        type: "shape",
        name: "triangle",
        variations: [
          { parameters: { size: [20, 30, 40, 50] }, weight: 1.0 },
          {
            parameters: { orientation: ["up", "down", "left", "right"] },
            weight: 0.5,
          },
        ],
        labels: ["triangle", "triangular"],
      },
      {
        type: "shape",
        name: "star",
        variations: [
          {
            parameters: { points: [5, 6, 7], size: [30, 40, 50] },
            weight: 1.0,
          },
        ],
        labels: ["star", "star-shaped"],
      },

      // Colors
      {
        type: "color",
        name: "primary_red",
        variations: [
          { parameters: { rgb: [255, 0, 0], hsl: [0, 100, 50] }, weight: 1.0 },
        ],
        labels: ["red", "primary color"],
      },
      {
        type: "color",
        name: "primary_blue",
        variations: [
          {
            parameters: { rgb: [0, 0, 255], hsl: [240, 100, 50] },
            weight: 1.0,
          },
        ],
        labels: ["blue", "primary color"],
      },
      {
        type: "color",
        name: "primary_yellow",
        variations: [
          {
            parameters: { rgb: [255, 255, 0], hsl: [60, 100, 50] },
            weight: 1.0,
          },
        ],
        labels: ["yellow", "primary color"],
      },
      {
        type: "color",
        name: "gradient_linear",
        variations: [
          {
            parameters: { direction: [0, 45, 90, 135], stops: 2 },
            weight: 1.0,
          },
        ],
        labels: ["gradient", "linear gradient", "color transition"],
      },

      // Typography
      {
        type: "typography",
        name: "font_weight",
        variations: [
          { parameters: { weight: [300, 400, 500, 600, 700] }, weight: 1.0 },
          { parameters: { size: [12, 14, 16, 18, 20] }, weight: 0.8 },
        ],
        labels: ["font", "text", "typography"],
      },
      {
        type: "typography",
        name: "font_style",
        variations: [
          { parameters: { style: ["normal", "italic"] }, weight: 1.0 },
        ],
        labels: ["italic", "oblique", "styled"],
      },

      // Patterns
      {
        type: "pattern",
        name: "stripes",
        variations: [
          {
            parameters: { orientation: ["horizontal", "vertical", "diagonal"] },
            weight: 1.0,
          },
          { parameters: { spacing: [5, 10, 15] }, weight: 0.7 },
        ],
        labels: ["stripes", "striped", "lined"],
      },
      {
        type: "pattern",
        name: "checks",
        variations: [{ parameters: { cellSize: [10, 15, 20] }, weight: 1.0 }],
        labels: ["checks", "checkered", "plaid"],
      },
      {
        type: "pattern",
        name: "dots",
        variations: [
          {
            parameters: { spacing: [8, 12, 16], radius: [2, 3, 4] },
            weight: 1.0,
          },
        ],
        labels: ["dots", "dotted", "polka dots"],
      },
      {
        type: "pattern",
        name: "zigzag",
        variations: [
          {
            parameters: { amplitude: [5, 10, 15], frequency: [10, 15, 20] },
            weight: 1.0,
          },
        ],
        labels: ["zigzag", "chevron", "zigzag pattern"],
      },
    ];
  }

  /**
   * Initialize the stage
   */
  async initialize(): Promise<void> {
    await this.generator.initialize(this.config);
  }

  /**
   * Generate training examples
   */
  async generateExamples(count: number): Promise<Stage1Example[]> {
    return await this.generator.generate(count);
  }

  /**
   * Evaluate predictions
   */
  evaluate(example: Stage1Example, prediction: Float32Array): EvaluationResult {
    return this.evaluator.evaluate(example, prediction);
  }

  /**
   * Check if stage is mastered
   */
  isMastered(progress: StageProgress): boolean {
    return progress.mastery >= this.config.masteryThreshold;
  }

  /**
   * Get configuration
   */
  getConfig(): Stage1Config {
    return { ...this.config };
  }

  /**
   * Get generator progress
   */
  getGeneratorProgress(): GeneratorProgress {
    return this.generator.getProgress();
  }
}

/**
 * Generator for basic concept examples
 */
class BasicConceptsGenerator implements DataGenerator {
  private config: Stage1Config;
  private progress: GeneratorProgress = {
    generated: 0,
    target: 0,
    complete: false,
  };
  private random: () => number;

  constructor(config: Stage1Config) {
    this.config = config;
    // Seeded random for reproducibility
    let seed = 12345;
    this.random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  async initialize(config: Stage1Config): Promise<void> {
    this.config = config;
    this.progress = {
      generated: 0,
      target: config.examples,
      complete: false,
    };
  }

  async generate(count: number): Promise<Stage1Example[]> {
    const examples: Stage1Example[] = [];

    for (let i = 0; i < count; i++) {
      const concept = this.selectConcept();
      const variation = this.selectVariation(concept);
      const example = this.generateExample(concept, variation);
      examples.push(example);
      this.progress.generated++;
    }

    if (this.progress.generated >= this.progress.target) {
      this.progress.complete = true;
    }

    return examples;
  }

  private selectConcept(): BasicConcept {
    const index = Math.floor(this.random() * this.config.concepts.length);
    return this.config.concepts[index];
  }

  private selectVariation(concept: BasicConcept): ConceptVariation {
    const totalWeight = concept.variations.reduce(
      (sum, v) => sum + v.weight,
      0
    );
    let random = this.random() * totalWeight;

    for (const variation of concept.variations) {
      random -= variation.weight;
      if (random <= 0) {
        return variation;
      }
    }

    return concept.variations[0];
  }

  private generateExample(
    concept: BasicConcept,
    variation: ConceptVariation
  ): Stage1Example {
    // Generate synthetic image data
    const width = 64;
    const height = 64;
    const channels = 3;
    const data = new Uint8Array(width * height * channels);

    // Fill with concept-specific pattern
    this.fillImageData(data, width, height, channels, concept, variation);

    // Generate embedding (simulated for now)
    const embedding = this.generateEmbedding(concept, variation);

    // Calculate difficulty based on concept complexity
    const difficulty = this.calculateDifficulty(concept, variation);

    return {
      id: `stage1_${this.progress.generated}_${Date.now()}`,
      stageId: "stage1_basic",
      imageData: { width, height, channels, data },
      embedding,
      metadata: {
        labels: concept.labels,
        attributes: {
          concept: concept.name,
          type: concept.type,
          variation: variation.parameters,
        },
      },
      difficulty,
      timestamp: Date.now(),
      concept,
      variation,
    };
  }

  private fillImageData(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    concept: BasicConcept,
    variation: ConceptVariation
  ): void {
    // Fill background
    for (let i = 0; i < data.length; i += channels) {
      data[i] = 240; // R
      data[i + 1] = 240; // G
      data[i + 2] = 240; // B
    }

    // Draw concept-specific pattern
    if (concept.type === "shape") {
      this.drawShape(data, width, height, channels, concept, variation);
    } else if (concept.type === "color") {
      this.drawColor(data, width, height, channels, concept, variation);
    } else if (concept.type === "pattern") {
      this.drawPattern(data, width, height, channels, concept, variation);
    } else if (concept.type === "typography") {
      this.drawText(data, width, height, channels, concept, variation);
    }
  }

  private drawShape(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    concept: BasicConcept,
    variation: ConceptVariation
  ): void {
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const color = [100, 150, 200];

    if (concept.name === "circle") {
      const radius = (variation.parameters.radius as number[])[0] || 20;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (dist <= radius) {
            const idx = (y * width + x) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    } else if (concept.name === "square") {
      const size = (variation.parameters.size as number[])[0] || 40;
      const halfSize = Math.floor(size / 2);
      for (let y = centerY - halfSize; y < centerY + halfSize; y++) {
        for (let x = centerX - halfSize; x < centerX + halfSize; x++) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const idx = (y * width + x) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    } else if (concept.name === "triangle") {
      const size = (variation.parameters.size as number[])[0] || 30;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Simple triangle check
          const dx = Math.abs(x - centerX);
          const dy = y - (centerY - size / 2);
          if (dy >= 0 && dy <= size && dx <= dy / 2) {
            const idx = (y * width + x) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    }
  }

  private drawColor(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    concept: BasicConcept,
    variation: ConceptVariation
  ): void {
    if (concept.name.includes("gradient")) {
      const direction = (variation.parameters.direction as number[])[0] || 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const t = direction === 90 ? y / height : x / width;
          const idx = (y * width + x) * channels;
          data[idx] = Math.floor(255 * (1 - t));
          data[idx + 1] = Math.floor(100 + 155 * t);
          data[idx + 2] = Math.floor(200 * t);
        }
      }
    } else {
      const rgb = variation.parameters.rgb as number[];
      for (let i = 0; i < data.length; i += channels) {
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
      }
    }
  }

  private drawPattern(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    concept: BasicConcept,
    variation: ConceptVariation
  ): void {
    const color = [80, 80, 80];

    if (concept.name === "stripes") {
      const orientation = variation.parameters.orientation as string;
      const spacing = (variation.parameters.spacing as number[])[0] || 10;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let inStripe = false;
          if (orientation === "horizontal") {
            inStripe = y % (spacing * 2) < spacing;
          } else if (orientation === "vertical") {
            inStripe = x % (spacing * 2) < spacing;
          } else if (orientation === "diagonal") {
            inStripe = (x + y) % (spacing * 2) < spacing;
          }

          if (inStripe) {
            const idx = (y * width + x) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    } else if (concept.name === "checks") {
      const cellSize = (variation.parameters.cellSize as number[])[0] || 10;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const cellX = Math.floor(x / cellSize);
          const cellY = Math.floor(y / cellSize);
          if ((cellX + cellY) % 2 === 0) {
            const idx = (y * width + x) * channels;
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
          }
        }
      }
    } else if (concept.name === "dots") {
      const spacing = (variation.parameters.spacing as number[])[0] || 12;
      const radius = (variation.parameters.radius as number[])[0] || 3;

      for (let cy = radius; cy < height - radius; cy += spacing) {
        for (let cx = radius; cx < width - radius; cx += spacing) {
          for (let y = cy - radius; y < cy + radius; y++) {
            for (let x = cx - radius; x < cx + radius; x++) {
              if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
                const idx = (y * width + x) * channels;
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
              }
            }
          }
        }
      }
    }
  }

  private drawText(
    data: Uint8Array,
    width: number,
    height: number,
    channels: number,
    concept: BasicConcept,
    variation: ConceptVariation
  ): void {
    // Simple text representation (horizontal line with varying thickness)
    const weight = (variation.parameters.weight as number[])[0] || 400;
    const thickness = Math.floor(weight / 100);

    for (
      let y = Math.floor(height / 2) - thickness;
      y < Math.floor(height / 2) + thickness;
      y++
    ) {
      for (let x = 10; x < width - 10; x++) {
        const idx = (y * width + x) * channels;
        data[idx] = 50;
        data[idx + 1] = 50;
        data[idx + 2] = 50;
      }
    }
  }

  private generateEmbedding(
    concept: BasicConcept,
    variation: ConceptVariation
  ): Float32Array {
    // Generate deterministic embedding based on concept
    const embedding = new Float32Array(768);
    const seed = this.hashString(
      concept.name + JSON.stringify(variation.parameters)
    );

    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = this.seededRandom(seed + i);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private calculateDifficulty(
    concept: BasicConcept,
    variation: ConceptVariation
  ): number {
    // Base difficulty by type
    let base = 0.0;
    if (concept.type === "shape") base = 0.05;
    else if (concept.type === "color") base = 0.08;
    else if (concept.type === "typography") base = 0.12;
    else if (concept.type === "pattern") base = 0.18;

    // Adjust by complexity
    const variationCount = concept.variations.length;
    const complexity = variationCount / 5;

    return Math.min(0.25, base + complexity * 0.05);
  }

  getProgress(): GeneratorProgress {
    return { ...this.progress };
  }

  reset(): void {
    this.progress = {
      generated: 0,
      target: this.config.examples,
      complete: false,
    };
  }
}

/**
 * Evaluator for basic concept predictions
 */
class BasicConceptsEvaluator implements StageEvaluator {
  evaluate(example: Stage1Example, prediction: Float32Array): EvaluationResult {
    // Calculate cosine similarity between target and prediction
    const target = example.embedding;
    const similarity = this.cosineSimilarity(target, prediction);

    // Calculate MSE loss
    const mse = this.mse(target, prediction);

    return {
      loss: mse,
      accuracy: similarity,
      confidence: similarity > 0.8 ? similarity : similarity * 0.8,
      metrics: {
        cosine_similarity: similarity,
        mse: mse,
        euclidean_distance: this.euclideanDistance(target, prediction),
      },
    };
  }

  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult {
    const results = examples.map((ex, i) =>
      this.evaluate(ex as Stage1Example, predictions[i])
    );

    const totalLoss = results.reduce((sum, r) => sum + r.loss, 0);
    const totalAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0);
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);

    return {
      totalLoss,
      averageLoss: totalLoss / results.length,
      averageAccuracy: totalAccuracy / results.length,
      averageConfidence: totalConfidence / results.length,
      metrics: {
        total_loss: totalLoss,
        total_accuracy: totalAccuracy,
      },
      perExample: results,
    };
  }

  isMastered(progress: StageProgress): boolean {
    return progress.mastery >= 0.9 && progress.loss < 0.1;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private mse(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum / a.length;
  }

  private euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
