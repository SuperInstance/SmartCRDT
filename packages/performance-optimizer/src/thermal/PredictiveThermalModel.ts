/**
 * PredictiveThermalModel - Predictive thermal modeling and proactive management
 *
 * Provides:
 * - Temperature prediction using multiple algorithms
 * - Workload-aware thermal forecasting
 * - Proactive thermal action recommendations
 * - Model training and adaptation
 */

import { EventEmitter } from "events";
import type {
  ThermalPrediction,
  ThermalModelConfig,
  ThermalModelType,
  ThermalComponent,
  ThermalAction,
  ThermalStatus,
  ThermalDataPoint,
  WorkloadCharacteristics,
} from "@lsi/protocol";

/**
 * Model training data
 */
interface TrainingData {
  timestamps: number[];
  temperatures: number[];
  workloads: WorkloadCharacteristics[];
}

/**
 * Model parameters for different algorithms
 */
interface ModelParameters {
  // Linear regression
  slope?: number;
  intercept?: number;

  // Moving average
  windowSize?: number;

  // Exponential smoothing
  alpha?: number;

  // ARIMA (simplified)
  p?: number; // Auto-regressive order
  d?: number; // Differencing order
  q?: number; // Moving average order

  // Neural network (simplified)
  weights?: number[];
  bias?: number;
}

/**
 * PredictiveThermalModel class
 */
export class PredictiveThermalModel extends EventEmitter {
  private config: ThermalModelConfig;
  private models: Map<ThermalComponent, { type: ThermalModelType; params: ModelParameters }>;
  private trainingData: Map<ThermalComponent, TrainingData>;
  private historicalData: ThermalDataPoint[];
  private maxDataPoints: number;

  constructor(config: ThermalModelConfig) {
    super();

    this.config = {
      predictionHorizon: config.predictionHorizon || 60, // 60 seconds
      trainingSamples: config.trainingSamples || 100,
      updateInterval: config.updateInterval || 10000, // 10 seconds
      minConfidence: config.minConfidence || 0.7,
      modelType: config.modelType || ThermalModelType.EXPONENTIAL_SMOOTHING,
    };

    this.models = new Map();
    this.trainingData = new Map();
    this.historicalData = [];
    this.maxDataPoints = this.config.trainingSamples * 2;
  }

  /**
   * Initialize model for a component
   */
  initializeModel(component: ThermalComponent): void {
    this.models.set(component, {
      type: this.config.modelType,
      params: this.getDefaultParameters(this.config.modelType),
    });

    this.trainingData.set(component, {
      timestamps: [],
      temperatures: [],
      workloads: [],
    });
  }

  /**
   * Add historical data point
   */
  addDataPoint(dataPoint: ThermalDataPoint): void {
    this.historicalData.push(dataPoint);

    // Limit history size
    if (this.historicalData.length > this.maxDataPoints) {
      this.historicalData.shift();
    }

    // Update training data for each component
    for (const [component, temperature] of dataPoint.temperatures) {
      const training = this.trainingData.get(component);
      if (training) {
        training.timestamps.push(dataPoint.timestamp);
        training.temperatures.push(temperature);
        training.workloads.push(dataPoint.workload);

        // Limit training data
        if (training.timestamps.length > this.config.trainingSamples) {
          training.timestamps.shift();
          training.temperatures.shift();
          training.workloads.shift();
        }
      }
    }

    // Periodically retrain models
    if (this.historicalData.length % this.config.trainingSamples === 0) {
      this.retrainAllModels();
    }
  }

  /**
   * Predict temperature for component
   */
  async predictTemperature(
    component: ThermalComponent,
    horizon?: number
  ): Promise<ThermalPrediction> {
    const model = this.models.get(component);
    if (!model) {
      throw new Error(`No model initialized for component: ${component}`);
    }

    const training = this.trainingData.get(component);
    if (!training || training.temperatures.length < 5) {
      throw new Error(`Insufficient training data for component: ${component}`);
    }

    const predictionHorizon = horizon || this.config.predictionHorizon;
    const currentTemperature = training.temperatures[training.temperatures.length - 1];
    const currentWorkload = training.workloads[training.workloads.length - 1];

    // Generate prediction using configured model type
    let predictedTemperature: number;
    let confidence: number;

    switch (model.type) {
      case ThermalModelType.LINEAR_REGRESSION:
        ({ predictedTemperature, confidence } = this.predictLinearRegression(
          training,
          predictionHorizon
        ));
        break;

      case ThermalModelType.MOVING_AVERAGE:
        ({ predictedTemperature, confidence } = this.predictMovingAverage(
          training,
          predictionHorizon
        ));
        break;

      case ThermalModelType.EXPONENTIAL_SMOOTHING:
        ({ predictedTemperature, confidence } = this.predictExponentialSmoothing(
          training,
          predictionHorizon
        ));
        break;

      case ThermalModelType.ARIMA:
        ({ predictedTemperature, confidence } = this.predictARIMA(
          training,
          predictionHorizon
        ));
        break;

      case ThermalModelType.NEURAL_NETWORK:
        ({ predictedTemperature, confidence } = this.predictNeuralNetwork(
          training,
          predictionHorizon
        ));
        break;

      default:
        ({ predictedTemperature, confidence } = this.predictExponentialSmoothing(
          training,
          predictionHorizon
        ));
    }

    // Determine predicted status
    const predictedStatus = this.classifyTemperature(predictedTemperature);

    // Recommend action if needed
    const recommendedAction = this.recommendAction(
      currentTemperature,
      predictedTemperature,
      confidence
    );

    const prediction: ThermalPrediction = {
      component,
      currentTemperature,
      predictedTemperature,
      horizon: predictionHorizon,
      confidence,
      timestamp: Date.now(),
      predictedStatus,
      recommendedAction,
    };

    this.emit("prediction:generated", prediction);

    return prediction;
  }

  /**
   * Retrain all models
   */
  retrainAllModels(): void {
    for (const [component, model] of this.models) {
      const training = this.trainingData.get(component);
      if (!training || training.temperatures.length < 5) {
        continue;
      }

      try {
        switch (model.type) {
          case ThermalModelType.LINEAR_REGRESSION:
            model.params = this.trainLinearRegression(training);
            break;
          case ThermalModelType.EXPONENTIAL_SMOOTHING:
            model.params = this.trainExponentialSmoothing(training);
            break;
          case ThermalModelType.NEURAL_NETWORK:
            model.params = this.trainNeuralNetwork(training);
            break;
          default:
            // Other models don't require training
            break;
        }

        this.emit("model:trained", { component, type: model.type });
      } catch (error) {
        this.emit("model:error", { component, error });
      }
    }
  }

  /**
   * Get prediction accuracy (historical)
   */
  getAccuracy(): Map<ThermalComponent, number> {
    const accuracies = new Map<ThermalComponent, number>();

    // Calculate mean absolute percentage error (MAPE)
    for (const [component, training] of this.trainingData) {
      if (training.temperatures.length < 10) {
        continue;
      }

      // Simple accuracy metric based on prediction variance
      const temps = training.temperatures.slice(-20);
      const mean = temps.reduce((sum, t) => sum + t, 0) / temps.length;
      const variance = temps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / temps.length;
      const accuracy = Math.max(0, 1 - variance / 100); // Rough estimate

      accuracies.set(component, accuracy);
    }

    return accuracies;
  }

  // ========================================================================
  // Prediction Methods
  // ========================================================================

  /**
   * Predict using linear regression
   */
  private predictLinearRegression(
    training: TrainingData,
    horizon: number
  ): { predictedTemperature: number; confidence: number } {
    const params = this.models.get(
      training.temperatures[0] as any
    )?.params as ModelParameters;

    if (!params || params.slope === undefined) {
      // Train on the fly
      const trainedParams = this.trainLinearRegression(training);
      params.slope = trainedParams.slope;
      params.intercept = trainedParams.intercept;
    }

    const currentTemp = training.temperatures[training.temperatures.length - 1];
    const timeDiff = horizon / 1000; // Convert to seconds

    const predictedTemperature = currentTemp + (params.slope || 0) * timeDiff;

    // Confidence based on data variance
    const temps = training.temperatures.slice(-10);
    const variance = this.calculateVariance(temps);
    const confidence = Math.max(0, 1 - variance / 50);

    return { predictedTemperature, confidence };
  }

  /**
   * Predict using moving average
   */
  private predictMovingAverage(
    training: TrainingData,
    horizon: number
  ): { predictedTemperature: number; confidence: number } {
    const windowSize = 5;
    const recentTemps = training.temperatures.slice(-windowSize);
    const avgTemp = recentTemps.reduce((sum, t) => sum + t, 0) / recentTemps.length;

    // Add trend component
    const trend =
      (recentTemps[recentTemps.length - 1] - recentTemps[0]) / windowSize;
    const timeFactor = horizon / 1000 / 60; // Minutes

    const predictedTemperature = avgTemp + trend * timeFactor * 10;

    // Confidence based on recent variance
    const variance = this.calculateVariance(recentTemps);
    const confidence = Math.max(0, 1 - variance / 30);

    return { predictedTemperature, confidence };
  }

  /**
   * Predict using exponential smoothing
   */
  private predictExponentialSmoothing(
    training: TrainingData,
    horizon: number
  ): { predictedTemperature: number; confidence: number } {
    const params = this.models.get(training.temperatures[0] as any)?.params as ModelParameters;
    const alpha = params?.alpha || 0.3;

    // Calculate exponential moving average
    let ema = training.temperatures[0];
    for (let i = 1; i < training.temperatures.length; i++) {
      ema = alpha * training.temperatures[i] + (1 - alpha) * ema;
    }

    // Add trend extrapolation
    const recentTrend =
      (training.temperatures[training.temperatures.length - 1] -
        training.temperatures[Math.max(0, training.temperatures.length - 5)]) /
      Math.min(5, training.temperatures.length);

    const timeFactor = horizon / 1000;
    const predictedTemperature = ema + recentTrend * timeFactor * 0.5;

    // Confidence based on fit
    const errors = training.temperatures.slice(-10).map((t) => Math.abs(t - ema));
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const confidence = Math.max(0, 1 - avgError / 20);

    return { predictedTemperature, confidence };
  }

  /**
   * Predict using simplified ARIMA
   */
  private predictARIMA(
    training: TrainingData,
    horizon: number
  ): { predictedTemperature: number; confidence: number } {
    // Simplified ARIMA(1,0,1) model
    const temps = training.temperatures.slice(-20);

    // Auto-regressive component
    const arCoeff = 0.7;
    const maCoeff = 0.3;

    const lastTemp = temps[temps.length - 1];
    const prevTemp = temps[temps.length - 2];

    // Moving average of residuals
    const residuals = temps.map((t, i) =>
      i > 0 ? t - arCoeff * temps[i - 1] : 0
    );
    const ma = residuals.slice(-5).reduce((sum, r) => sum + r, 0) / 5;

    const predictedTemperature = arCoeff * lastTemp + maCoeff * ma;

    // Conservative confidence for ARIMA
    const confidence = 0.75;

    return { predictedTemperature, confidence };
  }

  /**
   * Predict using simplified neural network
   */
  private predictNeuralNetwork(
    training: TrainingData,
    horizon: number
  ): { predictedTemperature: number; confidence: number } {
    const params = this.models.get(training.temperatures[0] as any)?.params;
    const weights = params?.weights || [0.5, 0.3, 0.2];
    const bias = params?.bias || 0;

    // Use recent temperatures as features
    const recentTemps = training.temperatures.slice(-3);
    if (recentTemps.length < 3) {
      // Fallback to simple average
      const avg = recentTemps.reduce((sum, t) => sum + t, 0) / recentTemps.length;
      return { predictedTemperature: avg, confidence: 0.5 };
    }

    // Simple linear combination (single-layer perceptron)
    let predictedTemperature = bias;
    for (let i = 0; i < recentTemps.length; i++) {
      predictedTemperature += weights[i] * recentTemps[i];
    }

    // Add workload influence
    const recentWorkload = training.workloads[training.workloads.length - 1];
    const workloadFactor = (recentWorkload.cpuUtilization + recentWorkload.gpuUtilization) / 2;
    predictedTemperature += workloadFactor * 5;

    // Confidence based on training data size
    const confidence = Math.min(0.9, training.temperatures.length / this.config.trainingSamples);

    return { predictedTemperature, confidence };
  }

  // ========================================================================
  // Training Methods
  // ========================================================================

  /**
   * Train linear regression model
   */
  private trainLinearRegression(training: TrainingData): ModelParameters {
    const n = training.temperatures.length;
    if (n < 2) {
      return { slope: 0, intercept: training.temperatures[0] || 50 };
    }

    // Simple linear regression on time series
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += training.temperatures[i];
      sumXY += i * training.temperatures[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Train exponential smoothing model
   */
  private trainExponentialSmoothing(training: TrainingData): ModelParameters {
    // Optimize alpha using grid search
    const temps = training.temperatures;
    const bestAlpha = this.findOptimalAlpha(temps);

    return { alpha: bestAlpha };
  }

  /**
   * Train neural network model
   */
  private trainNeuralNetwork(training: TrainingData): ModelParameters {
    // Very simplified "neural network" - just linear weights
    const temps = training.temperatures.slice(-100);
    const workloads = training.workloads.slice(-100);

    // Initialize weights
    const weights = [0.5, 0.3, 0.2];
    const learningRate = 0.01;

    // Simple gradient descent
    for (let epoch = 0; epoch < 10; epoch++) {
      for (let i = 3; i < temps.length; i++) {
        const features = [temps[i - 1], temps[i - 2], temps[i - 3]];
        const predicted =
          weights[0] * features[0] +
          weights[1] * features[1] +
          weights[2] * features[2];
        const actual = temps[i];
        const error = actual - predicted;

        // Update weights
        for (let j = 0; j < 3; j++) {
          weights[j] += learningRate * error * features[j];
        }
      }
    }

    return { weights, bias: 0 };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get default parameters for model type
   */
  private getDefaultParameters(type: ThermalModelType): ModelParameters {
    switch (type) {
      case ThermalModelType.LINEAR_REGRESSION:
        return { slope: 0, intercept: 50 };
      case ThermalModelType.MOVING_AVERAGE:
        return { windowSize: 5 };
      case ThermalModelType.EXPONENTIAL_SMOOTHING:
        return { alpha: 0.3 };
      case ThermalModelType.ARIMA:
        return { p: 1, d: 0, q: 1 };
      case ThermalModelType.NEURAL_NETWORK:
        return { weights: [0.5, 0.3, 0.2], bias: 0 };
      default:
        return {};
    }
  }

  /**
   * Calculate variance of array
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Find optimal alpha for exponential smoothing
   */
  private findOptimalAlpha(temps: number[]): number {
    let bestAlpha = 0.3;
    let bestError = Infinity;

    for (const alpha of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      let ema = temps[0];
      let error = 0;

      for (let i = 1; i < temps.length; i++) {
        ema = alpha * temps[i] + (1 - alpha) * ema;
        error += Math.pow(temps[i] - ema, 2);
      }

      if (error < bestError) {
        bestError = error;
        bestAlpha = alpha;
      }
    }

    return bestAlpha;
  }

  /**
   * Classify temperature into status
   */
  private classifyTemperature(temperature: number): ThermalStatus {
    if (temperature >= 90) return ThermalStatus.THROTTLING;
    if (temperature >= 85) return ThermalStatus.CRITICAL;
    if (temperature >= 75) return ThermalStatus.HOT;
    if (temperature >= 65) return ThermalStatus.WARM;
    return ThermalStatus.NORMAL;
  }

  /**
   * Recommend action based on prediction
   */
  private recommendAction(
    currentTemp: number,
    predictedTemp: number,
    confidence: number
  ): ThermalAction | undefined {
    if (confidence < this.config.minConfidence) {
      return undefined;
    }

    const tempIncrease = predictedTemp - currentTemp;

    if (predictedTemp >= 90) {
      return ThermalAction.PAUSE_COMPUTE;
    } else if (predictedTemp >= 85) {
      return ThermalAction.THROTTLE_CPU;
    } else if (predictedTemp >= 80 && tempIncrease > 10) {
      return ThermalAction.REDUCE_LOAD;
    } else if (predictedTemp >= 75) {
      return ThermalAction.INCREASE_FANS;
    }

    return ThermalAction.NONE;
  }
}
