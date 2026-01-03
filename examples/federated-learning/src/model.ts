/**
 * @fileoverview Simple ML model for federated learning demo
 *
 * Implements a binary classifier using logistic regression.
 * This is deliberately simple to keep the demo understandable
 * while demonstrating real federated learning concepts.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Model parameters (weights and bias)
 */
export interface ModelParameters {
  /** Feature weights */
  weights: number[];
  /** Bias term */
  bias: number;
}

/**
 * Training data point
 */
export interface DataPoint {
  /** Feature vector */
  features: number[];
  /** Binary label (0 or 1) */
  label: number;
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  /** Learning rate */
  learningRate: number;
  /** Number of local epochs */
  epochs: number;
  /** Batch size (1 = stochastic, >1 = mini-batch) */
  batchSize: number;
  /** L2 regularization factor */
  regularization: number;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  /** Loss value */
  loss: number;
  /** Accuracy */
  accuracy: number;
  /** Number of samples processed */
  samples: number;
}

/**
 * Model update (delta from global model)
 */
export interface ModelUpdate {
  /** Weight updates (deltas) */
  weightDeltas: number[];
  /** Bias update (delta) */
  biasDelta: number;
  /** Number of training samples */
  numSamples: number;
  /** Training metrics */
  metrics: TrainingMetrics;
  /** Client identifier */
  clientId: string;
}

// ============================================================================
// Logistic Regression Model
// ============================================================================

/**
 * Simple logistic regression classifier
 */
export class LogisticRegressionModel {
  private params: ModelParameters;
  private readonly featureDim: number;

  constructor(featureDim: number) {
    this.featureDim = featureDim;
    // Initialize with small random values
    this.params = {
      weights: Array.from({ length: featureDim }, () => (Math.random() - 0.5) * 0.01),
      bias: 0,
    };
  }

  /**
   * Get current model parameters
   */
  getParameters(): ModelParameters {
    return {
      weights: [...this.params.weights],
      bias: this.params.bias,
    };
  }

  /**
   * Set model parameters
   */
  setParameters(params: ModelParameters): void {
    this.params = {
      weights: [...params.weights],
      bias: params.bias,
    };
  }

  /**
   * Apply parameter updates (add deltas)
   */
  applyUpdates(updates: ModelUpdate): void {
    for (let i = 0; i < this.params.weights.length; i++) {
      this.params.weights[i] += updates.weightDeltas[i];
    }
    this.params.bias += updates.biasDelta;
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(z: number): number {
    // Numerically stable sigmoid
    if (z >= 0) {
      return 1 / (1 + Math.exp(-z));
    } else {
      const expZ = Math.exp(z);
      return expZ / (1 + expZ);
    }
  }

  /**
   * Forward pass - compute prediction
   */
  private forward(features: number[]): number {
    let z = this.params.bias;
    for (let i = 0; i < features.length; i++) {
      z += this.params.weights[i] * features[i];
    }
    return this.sigmoid(z);
  }

  /**
   * Predict class label
   */
  predict(features: number[]): number {
    const prob = this.forward(features);
    return prob >= 0.5 ? 1 : 0;
  }

  /**
   * Predict probability
   */
  predictProbability(features: number[]): number {
    return this.forward(features);
  }

  /**
   * Compute binary cross-entropy loss with L2 regularization
   */
  private computeLoss(
    predictions: number[],
    labels: number[],
    numSamples: number
  ): number {
    let dataLoss = 0;
    for (let i = 0; i < predictions.length; i++) {
      const p = Math.min(Math.max(predictions[i], 1e-7), 1 - 1e-7); // Clip for stability
      const y = labels[i];
      // Numerically stable BCE loss
      const logP = Math.log(p);
      const log1MinusP = Math.log(1 - p);
      dataLoss += y * logP + (1 - y) * log1MinusP;
    }
    dataLoss = -dataLoss / numSamples;

    // L2 regularization with small coefficient
    let weightNorm = 0;
    for (const w of this.params.weights) {
      weightNorm += w * w;
    }
    const regLoss = 0.5 * 0.0001 * weightNorm; // Reduced regularization

    return dataLoss + regLoss;
  }

  /**
   * Train on local data (gradient descent)
   */
  train(data: DataPoint[], config: TrainingConfig): ModelUpdate {
    const { learningRate, epochs, batchSize, regularization } = config;
    const numSamples = data.length;
    const numBatches = Math.ceil(numSamples / batchSize);

    // Store initial parameters for computing updates
    const initialParams = this.getParameters();

    // Training loop
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle data
      const shuffled = [...data].sort(() => Math.random() - 0.5);

      // Mini-batch gradient descent
      for (let batch = 0; batch < numBatches; batch++) {
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, numSamples);
        const batchData = shuffled.slice(start, end);

        // Compute gradients
        const gradients = this.computeGradients(batchData, regularization);

        // Update parameters
        for (let i = 0; i < this.params.weights.length; i++) {
          this.params.weights[i] -= learningRate * gradients.weightGradients[i];
        }
        this.params.bias -= learningRate * gradients.biasGradient;
      }
    }

    // Compute final metrics
    const predictions = data.map((point) => this.forward(point.features));
    const labels = data.map((point) => point.label);
    const loss = this.computeLoss(predictions, labels, numSamples);
    const accuracy = this.computeAccuracy(data);

    // Compute parameter updates (deltas)
    const weightDeltas = this.params.weights.map(
      (w, i) => w - initialParams.weights[i]
    );
    const biasDelta = this.params.bias - initialParams.bias;

    return {
      weightDeltas,
      biasDelta,
      numSamples,
      metrics: { loss, accuracy, samples: numSamples },
      clientId: '', // Will be set by caller
    };
  }

  /**
   * Compute gradients for a batch
   */
  private computeGradients(
    batch: DataPoint[],
    regularization: number
  ): { weightGradients: number[]; biasGradient: number } {
    const batchSize = batch.length;
    const weightGradients = new Array(this.featureDim).fill(0);
    let biasGradient = 0;

    // Accumulate gradients
    for (const point of batch) {
      const prediction = this.forward(point.features);
      const error = prediction - point.label;

      biasGradient += error;
      for (let i = 0; i < this.featureDim; i++) {
        weightGradients[i] += error * point.features[i];
      }
    }

    // Average and add regularization
    for (let i = 0; i < this.featureDim; i++) {
      weightGradients[i] = weightGradients[i] / batchSize + regularization * this.params.weights[i];
    }
    biasGradient /= batchSize;

    return { weightGradients, biasGradient };
  }

  /**
   * Compute accuracy on dataset
   */
  private computeAccuracy(data: DataPoint[]): number {
    let correct = 0;
    for (const point of data) {
      const pred = this.predict(point.features);
      if (pred === point.label) {
        correct++;
      }
    }
    return correct / data.length;
  }

  /**
   * Evaluate on dataset
   */
  evaluate(data: DataPoint[]): TrainingMetrics {
    const predictions = data.map((point) => this.forward(point.features));
    const labels = data.map((point) => point.label);
    const loss = this.computeLoss(predictions, labels, data.length);
    const accuracy = this.computeAccuracy(data);

    return { loss, accuracy, samples: data.length };
  }
}

// ============================================================================
// Data Generation Utilities
// ============================================================================

/**
 * Generate synthetic binary classification data
 *
 * Creates two classes with different Gaussian distributions.
 * Class 0: centered at (-1, -1, ..., -1)
 * Class 1: centered at (1, 1, ..., 1)
 */
export function generateSyntheticData(
  numSamples: number,
  featureDim: number,
  label: 0 | 1,
  noise: number = 0.5,
  shift: number[] = []
): DataPoint[] {
  const data: DataPoint[] = [];
  const center = label === 0 ? -1 : 1;
  const shiftArray = shift.length > 0 ? shift : Array(featureDim).fill(0);

  for (let i = 0; i < numSamples; i++) {
    const features: number[] = [];
    for (let j = 0; j < featureDim; j++) {
      // Sample from Gaussian with mean at center
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      features.push(center + noise * z + shiftArray[j]);
    }
    data.push({ features, label });
  }

  return data;
}

/**
 * Generate non-IID data for each client
 *
 * Creates realistic federated learning scenario where each client
 * has different data distributions.
 */
export function generateClientData(
  clientId: string,
  numSamples: number,
  featureDim: number
): { data: DataPoint[]; distribution: string } {
  // Create different distributions for different clients
  const distributions: Record<string, { ratio: number; shift: number[]; name: string }> = {
    client_0: {
      ratio: 0.7, // 70% class 0, 30% class 1
      shift: Array(featureDim).fill(-0.5), // Shifted toward class 0
      name: 'skewed-to-class-0',
    },
    client_1: {
      ratio: 0.5, // Balanced
      shift: Array(featureDim).fill(0), // Centered
      name: 'balanced',
    },
    client_2: {
      ratio: 0.3, // 30% class 0, 70% class 1
      shift: Array(featureDim).fill(0.5), // Shifted toward class 1
      name: 'skewed-to-class-1',
    },
  };

  const config = distributions[clientId] || distributions.client_1;
  const numClass0 = Math.floor(numSamples * config.ratio);
  const numClass1 = numSamples - numClass0;

  const class0Data = generateSyntheticData(numClass0, featureDim, 0, 0.5, config.shift);
  const class1Data = generateSyntheticData(numClass1, featureDim, 1, 0.5, config.shift);

  return {
    data: [...class0Data, ...class1Data].sort(() => Math.random() - 0.5),
    distribution: config.name,
  };
}
