/**
 * Product Quantization Usage Examples
 *
 * This file demonstrates various ways to use the Product Quantization
 * implementation for memory-efficient vector storage and fast similarity search.
 */

import { ProductQuantizer, BatchQuantizer } from '../../packages/cascade/src/cadence/cascade/ProductQuantization';
import { HNSWIndexWithPQ } from '../../packages/cascade/src/cadence/cascade/HNSWIndexWithPQ';

// ============================================================================
// Example 1: Basic Product Quantization
// ============================================================================

async function example1_basic_quantization() {
  console.log('=== Example 1: Basic Product Quantization ===\n');

  // Create a quantizer for 1536-dimensional vectors (OpenAI ada-002 embeddings)
  const pq = new ProductQuantizer(1536, 64, 256);

  // Generate training data
  console.log('Generating training data...');
  const trainingVectors: Float32Array[] = [];
  for (let i = 0; i < 500; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1; // Normalized embeddings
    }
    trainingVectors.push(vector);
  }

  // Train the quantizer
  console.log('Training quantizer...');
  const stats = await pq.train(trainingVectors, 20, 0.001);
  console.log(`  Training error: ${stats.error.toFixed(6)}`);
  console.log(`  Training time: ${stats.trainingTimeMs.toFixed(2)}ms`);
  console.log(`  Iterations: ${stats.iterations}`);

  // Quantize a vector
  const vector = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    vector[i] = Math.random() * 2 - 1;
  }

  console.log('\nQuantizing vector...');
  const codes = pq.quantize(vector);
  console.log(`  Original size: ${1536 * 4} bytes`);
  console.log(`  Compressed size: ${codes.length} bytes`);
  console.log(`  Compression ratio: ${(codes.length / (1536 * 4)).toFixed(4)}`);

  // Reconstruct the vector
  console.log('\nReconstructing vector...');
  const reconstructed = pq.reconstruct(codes);
  const mse =
    Array.from(vector)
      .map((v, i) => {
        const diff = v - reconstructed[i];
        return diff * diff;
      })
      .reduce((a, b) => a + b, 0) / vector.length;
  console.log(`  Reconstruction MSE: ${mse.toFixed(6)}`);

  // Get memory statistics
  const memStats = pq.getMemoryStats();
  console.log('\nMemory statistics:');
  console.log(`  Compressed vector size: ${memStats.vectorSize} bytes`);
  console.log(`  Original vector size: ${memStats.originalSize} bytes`);
  console.log(`  Compression ratio: ${memStats.compressionRatio.toFixed(4)}`);
  console.log(`  Centroid memory: ${memStats.centroidMemory} bytes`);
  console.log(`  Total for 10K vectors: ${memStats.totalMemoryForNVectors(10000)} bytes`);
}

// ============================================================================
// Example 2: Batch Operations
// ============================================================================

async function example2_batch_operations() {
  console.log('\n=== Example 2: Batch Operations ===\n');

  const pq = new ProductQuantizer(1536, 64, 256);

  // Train
  const trainingVectors: Float32Array[] = [];
  for (let i = 0; i < 500; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    trainingVectors.push(vector);
  }
  await pq.train(trainingVectors, 20, 0.001);

  // Batch quantize
  console.log('Batch quantizing 100 vectors...');
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 100; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    vectors.push(vector);
  }

  const startTime = performance.now();
  const codesList = BatchQuantizer.batchQuantize(pq, vectors);
  const quantizeTime = performance.now() - startTime;

  console.log(`  Time: ${quantizeTime.toFixed(2)}ms`);
  console.log(`  Per vector: ${(quantizeTime / 100).toFixed(4)}ms`);

  // Batch distance calculation
  console.log('\nComputing distances to query...');
  const query = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    query[i] = Math.random() * 2 - 1;
  }

  const startTime2 = performance.now();
  const distances = BatchQuantizer.batchAsymmetricDistance(pq, query, codesList);
  const distanceTime = performance.now() - startTime2;

  console.log(`  Time: ${distanceTime.toFixed(2)}ms`);
  console.log(`  Per distance: ${(distanceTime / 100).toFixed(4)}ms`);
  console.log(`  Min distance: ${Math.min(...distances).toFixed(4)}`);
  console.log(`  Max distance: ${Math.max(...distances).toFixed(4)}`);
}

// ============================================================================
// Example 3: Top-K Search
// ============================================================================

async function example3_topk_search() {
  console.log('\n=== Example 3: Top-K Search ===\n');

  const pq = new ProductQuantizer(1536, 64, 256);

  // Train
  const trainingVectors: Float32Array[] = [];
  for (let i = 0; i < 500; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    trainingVectors.push(vector);
  }
  await pq.train(trainingVectors, 20, 0.001);

  // Create quantized database
  console.log('Creating database with 10K vectors...');
  const quantizedVectors: { id: string; codes: Uint8Array }[] = [];
  for (let i = 0; i < 10000; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    const codes = pq.quantize(vector);
    quantizedVectors.push({ id: `doc_${i}`, codes });
  }

  // Query
  const query = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    query[i] = Math.random() * 2 - 1;
  }

  console.log('\nSearching for top-10 nearest neighbors...');
  const startTime = performance.now();
  const topK = BatchQuantizer.findTopK(pq, query, quantizedVectors, 10);
  const searchTime = performance.now() - startTime;

  console.log(`  Time: ${searchTime.toFixed(2)}ms`);
  console.log(`  Throughput: ${(10000 / searchTime).toFixed(0)} vectors/sec`);
  console.log('\nTop 10 results:');
  topK.forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.id}: distance = ${result.distance.toFixed(4)}`);
  });
}

// ============================================================================
// Example 4: HNSW Integration
// ============================================================================

async function example4_hnsw_integration() {
  console.log('\n=== Example 4: HNSW Integration ===\n');

  // Create HNSW index with PQ enabled
  const index = new HNSWIndexWithPQ(1536, {
    m: 16,
    efConstruction: 200,
    ef: 50,
    pqEnabled: true,
    pqSubvectors: 64,
    pqCentroids: 256,
    pqTrainingSamples: 500,
  });

  // Insert vectors (PQ trains automatically after 500)
  console.log('Inserting 1000 vectors...');
  const insertStart = performance.now();

  for (let i = 0; i < 1000; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    await index.insert(`doc_${i}`, vector);

    if ((i + 1) % 100 === 0) {
      console.log(`  Inserted ${i + 1} vectors...`);
    }
  }

  const insertTime = performance.now() - insertStart;
  console.log(`\n  Total insert time: ${insertTime.toFixed(2)}ms`);
  console.log(`  Per vector: ${(insertTime / 1000).toFixed(4)}ms`);

  // Search
  const query = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    query[i] = Math.random() * 2 - 1;
  }

  console.log('\nSearching for top-10 nearest neighbors...');
  const searchStart = performance.now();
  const results = index.search(query, 10);
  const searchTime = performance.now() - searchStart;

  console.log(`  Time: ${searchTime.toFixed(2)}ms`);
  console.log('\nTop 10 results:');
  results.forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.id}: distance = ${result.distance.toFixed(4)}`);
  });

  // Statistics
  console.log('\nIndex statistics:');
  console.log(index.getStats());

  console.log('\nMemory statistics:');
  const memStats = index.getMemoryStats();
  if (memStats) {
    console.log(`  PQ compression ratio: ${memStats.pq.compressionRatio.toFixed(4)}`);
    console.log(`  Centroid memory: ${(memStats.pq.centroidMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Index memory: ${(memStats.index.graphMemory / 1024).toFixed(2)} KB`);
    console.log(`  Uncompressed size: ${(memStats.savings.uncompressed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Compressed size: ${memStats.savings.compressed} bytes`);
  }
}

// ============================================================================
// Example 5: Comparison with Baseline
// ============================================================================

async function example5_comparison() {
  console.log('\n=== Example 5: Comparison with Baseline ===\n');

  const pq = new ProductQuantizer(1536, 64, 256);

  // Train
  const trainingVectors: Float32Array[] = [];
  for (let i = 0; i < 500; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    trainingVectors.push(vector);
  }
  await pq.train(trainingVectors, 20, 0.001);

  // Test vectors
  const queries: Float32Array[] = [];
  const dbVectors: Float32Array[] = [];

  for (let i = 0; i < 100; i++) {
    const query = new Float32Array(1536);
    const dbVec = new Float32Array(1536);

    for (let j = 0; j < 1536; j++) {
      query[j] = Math.random() * 2 - 1;
      dbVec[j] = Math.random() * 2 - 1;
    }

    queries.push(query);
    dbVectors.push(dbVec);
  }

  // Baseline: exact distance
  console.log('Computing exact distances (baseline)...');
  const baselineStart = performance.now();

  let baselineTotalError = 0;
  for (let i = 0; i < 100; i++) {
    const query = queries[i];
    const dbVec = dbVectors[i];

    let dist = 0;
    for (let j = 0; j < 1536; j++) {
      const diff = query[j] - dbVec[j];
      dist += diff * diff;
    }
    baselineTotalError += Math.sqrt(dist);
  }

  const baselineTime = performance.now() - baselineStart;
  console.log(`  Time: ${baselineTime.toFixed(2)}ms`);
  console.log(`  Per distance: ${(baselineTime / 100).toFixed(4)}ms`);

  // PQ: asymmetric distance
  console.log('\nComputing quantized distances...');
  const pqStart = performance.now();

  const codesList = dbVectors.map((v) => pq.quantize(v));
  let pqTotalError = 0;
  let maxRelativeError = 0;

  for (let i = 0; i < 100; i++) {
    const query = queries[i];
    const codes = codesList[i];

    const exactDist = Math.sqrt(
      Array.from(query)
        .map((v, j) => {
          const diff = v - dbVectors[i][j];
          return diff * diff;
        })
        .reduce((a, b) => a + b, 0)
    );

    const pqDist = pq.asymmetricDistance(query, codes);
    const relativeError = Math.abs(exactDist - pqDist) / exactDist;
    maxRelativeError = Math.max(maxRelativeError, relativeError);
    pqTotalError += pqDist;
  }

  const pqTime = performance.now() - pqStart;
  console.log(`  Time: ${pqTime.toFixed(2)}ms`);
  console.log(`  Per distance: ${(pqTime / 100).toFixed(4)}ms`);

  console.log('\nComparison:');
  console.log(`  Speedup: ${(baselineTime / pqTime).toFixed(2)}x`);
  console.log(`  Max relative error: ${(maxRelativeError * 100).toFixed(2)}%`);
  console.log(`  Memory reduction: ${((1 - 64 / (1536 * 4)) * 100).toFixed(1)}%`);
}

// ============================================================================
// Example 6: Real-World Scenario - Document Search
// ============================================================================

async function example6_document_search() {
  console.log('\n=== Example 6: Document Search Scenario ===\n');

  // Simulate a document search system
  const index = new HNSWIndexWithPQ(1536, {
    m: 16,
    efConstruction: 200,
    ef: 50,
    pqEnabled: true,
    pqSubvectors: 64,
    pqCentroids: 256,
    pqTrainingSamples: 500,
  });

  // Insert documents
  const documents = [
    'Machine learning is a subset of artificial intelligence',
    'Deep learning uses neural networks with multiple layers',
    'Natural language processing deals with text understanding',
    'Computer vision enables machines to interpret images',
    'Reinforcement learning learns through trial and error',
  ];

  console.log('Indexing documents...');
  for (let i = 0; i < 1000; i++) {
    const vector = new Float32Array(1536);
    for (let j = 0; j < 1536; j++) {
      vector[j] = Math.random() * 2 - 1;
    }
    const doc = documents[i % documents.length];
    await index.insert(`doc_${i}_${doc}`, vector);
  }

  // Search for similar documents
  const query = new Float32Array(1536);
  for (let i = 0; i < 1536; i++) {
    query[i] = Math.random() * 2 - 1;
  }

  console.log('\nSearching for similar documents...');
  const results = index.search(query, 5);

  console.log('\nTop 5 similar documents:');
  results.forEach((result, idx) => {
    console.log(`  ${idx + 1}. ${result.id} (${result.distance.toFixed(4)})`);
  });

  // Memory savings
  const stats = index.getStats();
  console.log('\nMemory savings:');
  console.log(`  Vectors quantized: ${stats.quantizedVectors}`);
  console.log(`  Memory saved: ${stats.memorySaved}`);
  console.log(`  Effective compression: ${((1 - stats.quantizedVectors * 64 / (stats.nodeCount * 1536 * 4)) * 100).toFixed(1)}%`);
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  try {
    await example1_basic_quantization();
    await example2_batch_operations();
    await example3_topk_search();
    await example4_hnsw_integration();
    await example5_comparison();
    await example6_document_search();

    console.log('\n=== All examples completed successfully! ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  example1_basic_quantization,
  example2_batch_operations,
  example3_topk_search,
  example4_hnsw_integration,
  example5_comparison,
  example6_document_search,
};
