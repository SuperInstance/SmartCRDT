/**
 * Tests for PredictiveThermalModel
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PredictiveThermalModel } from "../../src/thermal/PredictiveThermalModel";
import {
  ThermalComponent,
  ThermalModelType,
  ThermalStatus,
  ThermalAction,
  WorkloadType,
} from "@lsi/protocol";

describe("PredictiveThermalModel", () => {
  let model: PredictiveThermalModel;

  beforeEach(() => {
    model = new PredictiveThermalModel({
      predictionHorizon: 60,
      trainingSamples: 50,
      updateInterval: 5000,
      minConfidence: 0.7,
      modelType: ThermalModelType.EXPONENTIAL_SMOOTHING,
    });
  });

  describe("initialization", () => {
    it("should initialize with config", () => {
      expect(model["config"].predictionHorizon).toBe(60);
      expect(model["config"].trainingSamples).toBe(50);
      expect(model["config"].modelType).toBe(ThermalModelType.EXPONENTIAL_SMOOTHING);
    });

    it("should initialize model for component", () => {
      model.initializeModel(ThermalComponent.CPU);

      const cpuModel = model["models"].get(ThermalComponent.CPU);
      expect(cpuModel).toBeDefined();
      expect(cpuModel?.type).toBe(ThermalModelType.EXPONENTIAL_SMOOTHING);
    });
  });

  describe("data point management", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);
      model.initializeModel(ThermalComponent.GPU);
    });

    it("should add data points", () => {
      const dataPoint = {
        timestamp: Date.now(),
        temperatures: new Map([
          [ThermalComponent.CPU, 60],
          [ThermalComponent.GPU, 65],
        ]),
        powerConsumption: 100,
        workload: {
          cpuUtilization: 0.5,
          gpuUtilization: 0.3,
          memoryUtilization: 0.4,
          powerConsumption: 100,
          workloadType: WorkloadType.MEDIUM,
          heatGeneration: 15,
        },
        status: ThermalStatus.NORMAL,
      };

      model.addDataPoint(dataPoint);

      expect(model["historicalData"].length).toBe(1);
      expect(model["trainingData"].get(ThermalComponent.CPU)?.temperatures.length).toBe(1);
    });

    it("should limit historical data size", () => {
      const maxPoints = model["maxDataPoints"];

      for (let i = 0; i < maxPoints + 10; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 60 + i]]),
          powerConsumption: 100,
          workload: {
            cpuUtilization: 0.5,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15,
          },
          status: ThermalStatus.NORMAL,
        });
      }

      expect(model["historicalData"].length).toBeLessThanOrEqual(maxPoints);
    });

    it("should limit training data size", () => {
      const trainingSamples = model["config"].trainingSamples;

      for (let i = 0; i < trainingSamples + 10; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 60]]),
          powerConsumption: 100,
          workload: {
            cpuUtilization: 0.5,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15,
          },
          status: ThermalStatus.NORMAL,
        });
      }

      const training = model["trainingData"].get(ThermalComponent.CPU);
      expect(training?.temperatures.length).toBeLessThanOrEqual(trainingSamples);
    });
  });

  describe("temperature prediction", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);

      // Add training data
      const baseTemp = 60;
      for (let i = 0; i < 50; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, baseTemp + i * 0.2]]), // Gradual warming
          powerConsumption: 100 + i,
          workload: {
            cpuUtilization: 0.5 + i * 0.01,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100 + i,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15 + i * 0.1,
          },
          status: ThermalStatus.NORMAL,
        });
      }
    });

    it("should predict temperature for component", async () => {
      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction).toBeDefined();
      expect(prediction.component).toBe(ThermalComponent.CPU);
      expect(prediction.currentTemperature).toBeGreaterThan(0);
      expect(prediction.predictedTemperature).toBeGreaterThan(0);
      expect(prediction.horizon).toBe(60);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.predictedStatus).toBeDefined();
    });

    it("should throw error for component without model", async () => {
      await expect(
        model.predictTemperature(ThermalComponent.GPU, 60)
      ).rejects.toThrow();
    });

    it("should emit prediction generated event", async () => {
      const spy = vi.fn();
      model.on("prediction:generated", spy);

      await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(spy).toHaveBeenCalled();
      const prediction = spy.mock.calls[0][0];
      expect(prediction.component).toBe(ThermalComponent.CPU);
    });
  });

  describe("prediction with different models", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);

      // Add training data
      for (let i = 0; i < 50; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 60 + Math.sin(i * 0.2) * 5]]),
          powerConsumption: 100,
          workload: {
            cpuUtilization: 0.5,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15,
          },
          status: ThermalStatus.NORMAL,
        });
      }
    });

    it("should predict with moving average model", async () => {
      model["models"].get(ThermalComponent.CPU)!.type = ThermalModelType.MOVING_AVERAGE;

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.predictedTemperature).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it("should predict with linear regression model", async () => {
      model["models"].get(ThermalComponent.CPU)!.type = ThermalModelType.LINEAR_REGRESSION;

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.predictedTemperature).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it("should predict with ARIMA model", async () => {
      model["models"].get(ThermalComponent.CPU)!.type = ThermalModelType.ARIMA;

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.predictedTemperature).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it("should predict with neural network model", async () => {
      model["models"].get(ThermalComponent.CPU)!.type = ThermalModelType.NEURAL_NETWORK;

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.predictedTemperature).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });
  });

  describe("action recommendations", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);

      // Add training data with rising temperatures
      for (let i = 0; i < 50; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 70 + i]]),
          powerConsumption: 100 + i * 2,
          workload: {
            cpuUtilization: 0.7,
            gpuUtilization: 0.5,
            memoryUtilization: 0.6,
            powerConsumption: 100 + i * 2,
            workloadType: WorkloadType.HEAVY_COMPUTE,
            heatGeneration: 25,
          },
          status: ThermalStatus.HOT,
        });
      }
    });

    it("should recommend action for critical predictions", async () => {
      // Force high prediction by setting recent temps high
      const training = model["trainingData"].get(ThermalComponent.CPU);
      training!.temperatures[training!.temperatures.length - 1] = 95;

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.recommendedAction).toBeDefined();
      expect([
        ThermalAction.PAUSE_COMPUTE,
        ThermalAction.THROTTLE_CPU,
        ThermalAction.REDUCE_LOAD,
      ]).toContain(prediction.recommendedAction);
    });

    it("should recommend no action for normal temperatures", async () => {
      // Set normal temps
      const training = model["trainingData"].get(ThermalComponent.CPU);
      for (let i = 0; i < training!.temperatures.length; i++) {
        training!.temperatures[i] = 50 + i * 0.1;
      }

      const prediction = await model.predictTemperature(ThermalComponent.CPU, 60);

      expect(prediction.recommendedAction).toBe(ThermalAction.NONE);
    });
  });

  describe("model training", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);
    });

    it("should retrain all models", () => {
      const spy = vi.fn();
      model.on("model:trained", spy);

      // Add enough data to trigger retraining
      for (let i = 0; i < 100; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 60]]),
          powerConsumption: 100,
          workload: {
            cpuUtilization: 0.5,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15,
          },
          status: ThermalStatus.NORMAL,
        });
      }

      // Retrain should have been triggered
      expect(model["models"].get(ThermalComponent.CPU)?.params).toBeDefined();
    });
  });

  describe("accuracy metrics", () => {
    beforeEach(() => {
      model.initializeModel(ThermalComponent.CPU);

      // Add data
      for (let i = 0; i < 30; i++) {
        model.addDataPoint({
          timestamp: Date.now() + i * 1000,
          temperatures: new Map([[ThermalComponent.CPU, 60 + i * 0.5]]),
          powerConsumption: 100,
          workload: {
            cpuUtilization: 0.5,
            gpuUtilization: 0.3,
            memoryUtilization: 0.4,
            powerConsumption: 100,
            workloadType: WorkloadType.MEDIUM,
            heatGeneration: 15,
          },
          status: ThermalStatus.NORMAL,
        });
      }
    });

    it("should calculate accuracy metrics", () => {
      const accuracies = model.getAccuracy();

      expect(accuracies).toBeInstanceOf(Map);
      expect(accuracies.has(ThermalComponent.CPU)).toBe(true);

      const cpuAccuracy = accuracies.get(ThermalComponent.CPU);
      expect(cpuAccuracy).toBeGreaterThanOrEqual(0);
      expect(cpuAccuracy).toBeLessThanOrEqual(1);
    });
  });

  describe("temperature classification", () => {
    it("should classify temperatures correctly", () => {
      expect(model["classifyTemperature"](50)).toBe(ThermalStatus.NORMAL);
      expect(model["classifyTemperature"](70)).toBe(ThermalStatus.WARM);
      expect(model["classifyTemperature"](77)).toBe(ThermalStatus.HOT);
      expect(model["classifyTemperature"](87)).toBe(ThermalStatus.CRITICAL);
      expect(model["classifyTemperature"](92)).toBe(ThermalStatus.THROTTLING);
    });
  });

  describe("helper methods", () => {
    it("should calculate variance correctly", () => {
      const values = [10, 20, 30, 40, 50];
      const variance = model["calculateVariance"](values);

      expect(variance).toBeCloseTo(200, 0); // Variance of [10,20,30,40,50]
    });

    it("should find optimal alpha for exponential smoothing", () => {
      const temps = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69];
      const alpha = model["findOptimalAlpha"](temps);

      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });
  });
});
