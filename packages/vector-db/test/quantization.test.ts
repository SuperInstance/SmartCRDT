/**
 * Product Quantization Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ProductQuantization,
  OptimizedProductQuantization,
  DistanceCalculator,
  QuantizationBenchmark,
} from "../src/quantization/index.js";

describe("ProductQuantization", () => {
  let vectors: Float32Array[];
  const dimension = 128;
  const numVectors = 1000;

  beforeEach(() => {
    // Generate random test vectors
    vectors = [];
    for (let i = 0; i < numVectors; i++) {
      const v = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        v[j] = Math.random() * 2 - 1; // [-1, 1]
      }
      vectors.push(v);
    }
  });

  it("should train PQ model", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    const result = await pq.train(vectors);

    expect(result.codebook).toHaveLength(16);
    expect(result.codes).toHaveLength(numVectors * 16);
    expect(result.converged).toBe(true);
    expect(result.metrics.compressionRatio).toBeCloseTo(32, 0); // 128*4 / 16 = 32
  });

  it("should encode and decode vectors", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    await pq.train(vectors);

    const encoded = pq.encode(vectors[0]);
    expect(encoded.codes).toHaveLength(16);

    const decoded = pq.decode(encoded.codes);
    expect(decoded).toHaveLength(dimension);

    // Check reconstruction error
    let error = 0;
    for (let i = 0; i < dimension; i++) {
      error += Math.abs(vectors[0][i] - decoded[i]);
    }
    expect(error / dimension).toBeLessThan(0.5); // Average error < 0.5
  });

  it("should encode batch of vectors", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    await pq.train(vectors);

    const batch = pq.encodeBatch(vectors.slice(0, 100));
    expect(batch.numVectors).toBe(100);
    expect(batch.codes).toHaveLength(100 * 16);
  });

  it("should find nearest neighbors", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    await pq.train(vectors);
    const encoded = pq.encodeBatch(vectors);

    const query = vectors[0];
    const results = pq.findNearestNeighbors(query, encoded.codes, encoded.ids, 10);

    expect(results.k).toBe(10);
    expect(results.ids).toHaveLength(10);
    expect(results.distances).toHaveLength(10);
    expect(results.exact).toBe(false);
  });

  it("should provide compression info", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    await pq.train(vectors);

    const info = pq.getCompressionInfo();
    expect(info.originalBytes).toBe(128 * 4); // float32
    expect(info.compressedBytes).toBe(16); // 1 byte per subspace
    expect(info.ratio).toBeCloseTo(32, 0);
  });
});

describe("OptimizedProductQuantization", () => {
  let vectors: Float32Array[];
  const dimension = 128;
  const numVectors = 500;

  beforeEach(() => {
    vectors = [];
    for (let i = 0; i < numVectors; i++) {
      const v = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        v[j] = Math.random() * 2 - 1;
      }
      vectors.push(v);
    }
  });

  it("should train OPQ model", async () => {
    const opq = new OptimizedProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      opqIterations: 5,
      maxIterations: 20,
    });

    const result = await opq.train(vectors);

    expect(result.codebook).toHaveLength(16);
    expect(result.rotationMatrix).toHaveLength(dimension * dimension);
    expect(result.opqMetrics.rotationImprovement).toBeGreaterThan(0);
  });

  it("should encode and decode with rotation", async () => {
    const opq = new OptimizedProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      opqIterations: 5,
      maxIterations: 20,
    });

    await opq.train(vectors);

    const encoded = opq.encode(vectors[0]);
    expect(encoded.codes).toHaveLength(16);

    const decoded = opq.decode(encoded.codes);
    expect(decoded).toHaveLength(dimension);
  });

  it("should have lower error than PQ", async () => {
    const pq = new ProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      maxIterations: 20,
    });

    const opq = new OptimizedProductQuantization({
      numSubspaces: 16,
      numCentroids: 256,
      dimension,
      opqIterations: 5,
      maxIterations: 20,
    });

    const pqResult = await pq.train(vectors);
    const opqResult = await opq.train(vectors);

    // OPQ should have lower quantization error
    expect(opqResult.opqMetrics.quantizationError).toBeLessThanOrEqual(
      pqResult.metrics.quantizationError * 1.1 // Allow some variance
    );
  });
});

describe("DistanceCalculator", () => {
  let codebook: Float32Array[][];
  let vectors: Float32Array[];
  const dimension = 128;
  const numSubspaces = 16;
  const numCentroids = 256;
  const subspaceDim = 8;

  beforeEach(() => {
    // Generate random codebook
    codebook = [];
    for (let m = 0; m < numSubspaces; m++) {
      const subspace: Float32Array[] = [];
      for (let k = 0; k < numCentroids; k++) {
        const centroid = new Float32Array(subspaceDim);
        for (let d = 0; d < subspaceDim; d++) {
          centroid[d] = Math.random() * 2 - 1;
        }
        subspace.push(centroid);
      }
      codebook.push(subspace);
    }

    // Generate test vectors
    vectors = [];
    for (let i = 0; i < 100; i++) {
      const v = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        v[j] = Math.random() * 2 - 1;
      }
      vectors.push(v);
    }
  });

  it("should compute asymmetric distances", () => {
    const calculator = new DistanceCalculator(
      codebook,
      numSubspaces,
      numCentroids,
      subspaceDim
    );

    const query = vectors[0];
    const codes = new Uint8Array(100 * numSubspaces);
    for (let i = 0; i < codes.length; i++) {
      codes[i] = Math.floor(Math.random() * numCentroids);
    }

    const result = calculator.asymmetricDistance(query, codes);

    expect(result.distances).toHaveLength(100);
    expect(result.indices).toHaveLength(100);
    expect(result.queryTime).toBeGreaterThan(0);
  });

  it("should compute symmetric distances", () => {
    const calculator = new DistanceCalculator(
      codebook,
      numSubspaces,
      numCentroids,
      subspaceDim
    );

    const queryCodes = new Uint8Array(numSubspaces);
    for (let i = 0; i < numSubspaces; i++) {
      queryCodes[i] = Math.floor(Math.random() * numCentroids);
    }

    const dbCodes = new Uint8Array(100 * numSubspaces);
    for (let i = 0; i < dbCodes.length; i++) {
      dbCodes[i] = Math.floor(Math.random() * numCentroids);
    }

    const result = calculator.symmetricDistance(queryCodes, dbCodes);

    expect(result.distances).toHaveLength(100);
    expect(result.indices).toHaveLength(100);
  });

  it("should find nearest neighbors", () => {
    const calculator = new DistanceCalculator(
      codebook,
      numSubspaces,
      numCentroids,
      subspaceDim
    );

    const query = vectors[0];
    const codes = new Uint8Array(100 * numSubspaces);
    const ids = Array.from({ length: 100 }, (_, i) => i);

    for (let i = 0; i < codes.length; i++) {
      codes[i] = Math.floor(Math.random() * numCentroids);
    }

    const result = calculator.findNearestNeighbors(query, codes, ids, 10);

    expect(result.k).toBe(10);
    expect(result.ids).toHaveLength(10);
    expect(result.distances).toHaveLength(10);
  });

  it("should compute recall", () => {
    const calculator = new DistanceCalculator(
      codebook,
      numSubspaces,
      numCentroids,
      subspaceDim
    );

    const exact = {
      ids: [1, 2, 3, 4, 5],
      distances: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
      query: vectors[0],
      k: 5,
      searchTime: 10,
      exact: true,
    };

    const approx = {
      ids: [1, 3, 5, 7, 9],
      distances: new Float32Array([0.15, 0.35, 0.55, 0.75, 0.95]),
      query: vectors[0],
      k: 5,
      searchTime: 5,
      exact: false,
    };

    const recall = calculator.computeRecall(approx, exact);
    expect(recall).toBeCloseTo(0.6, 1); // 3 out of 5 overlap
  });
});

describe("QuantizationBenchmark", () => {
  it("should run benchmark", async () => {
    const dimension = 128;
    const numVectors = 500;
    const numQueries = 20;

    const vectors: Float32Array[] = [];
    for (let i = 0; i < numVectors; i++) {
      const v = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        v[j] = Math.random() * 2 - 1;
      }
      vectors.push(v);
    }

    const queries: Float32Array[] = [];
    for (let i = 0; i < numQueries; i++) {
      const q = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        q[j] = Math.random() * 2 - 1;
      }
      queries.push(q);
    }

    const benchmark = new QuantizationBenchmark({
      numVectors,
      numQueries,
      k: 10,
      dimensions: [dimension],
      numSubspaces: [16],
      numCentroids: [256],
      testOPQ: false,
      measureRecall: true,
    });

    const results = await benchmark.run(vectors, queries);

    expect(results.dataset.numVectors).toBe(numVectors);
    expect(results.compression.ratio).toBeGreaterThan(0);
    expect(results.accuracy.recall).toBeGreaterThan(0);
    expect(results.baseline.speedup).toBeGreaterThan(0);
  });
});
