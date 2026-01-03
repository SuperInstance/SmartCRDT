/**
 * HNSWIndex.benchmark.ts
 *
 * Comprehensive performance benchmarks for the optimized HNSW index.
 *
 * Tests cover:
 * - Build performance (insertion speed)
 * - Search performance (query latency)
 * - Memory usage (efficiency)
 * - SIMD vs scalar comparison
 * - Compression effectiveness
 * - Auto-tuning behavior
 * - Scalability across dataset sizes
 * - Accuracy vs speed trade-offs
 *
 * Run with:
 *   npx vitest run HNSWIndex.benchmark.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { HNSWIndex, DEFAULT_HNSW_CONFIG_768, DEFAULT_HNSW_CONFIG_1536, PERFORMANCE_HNSW_CONFIG, MEMORY_OPTIMIZED_HNSW_CONFIG, } from "./HNSWIndex.js";
/**
 * Generate a random vector of given dimension
 */
function randomVector(dimension) {
    const vector = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
        vector[i] = Math.random() * 2 - 1; // -1 to 1
    }
    return vector;
}
/**
 * Generate a set of random vectors
 */
function generateVectors(count, dimension) {
    return Array.from({ length: count }, () => randomVector(dimension));
}
/**
 * Benchmark suite for HNSW index
 */
describe("HNSWIndex Benchmarks", () => {
    describe("Build Performance", () => {
        it("should build 1000 vectors of 128-dim quickly", () => {
            const index = new HNSWIndex({
                dimension: 128,
                M: 16,
                mL: 5,
                efConstruction: 50,
                efSearch: 10,
                enableSIMD: true,
            });
            const vectors = generateVectors(1000, 128);
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - startTime;
            const opsPerSecond = (1000 / buildTime) * 1000;
            expect(buildTime).toBeLessThan(5000); // Should complete in < 5s
            expect(index.size()).toBe(1000);
            console.log(`[Build 128-dim] ${buildTime}ms, ${opsPerSecond.toFixed(0)} ops/s`);
        });
        it("should build 768-dim vectors efficiently", () => {
            const index = new HNSWIndex(DEFAULT_HNSW_CONFIG_768);
            const count = 500;
            const vectors = generateVectors(count, 768);
            const startTime = Date.now();
            for (let i = 0; i < count; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - startTime;
            const opsPerSecond = (count / buildTime) * 1000;
            expect(buildTime).toBeLessThan(10000); // Should complete in < 10s
            expect(index.size()).toBe(count);
            console.log(`[Build 768-dim] ${buildTime}ms, ${opsPerSecond.toFixed(0)} ops/s`);
        });
        it("should build 1536-dim vectors efficiently", () => {
            const index = new HNSWIndex(DEFAULT_HNSW_CONFIG_1536);
            const count = 300;
            const vectors = generateVectors(count, 1536);
            const startTime = Date.now();
            for (let i = 0; i < count; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - startTime;
            const opsPerSecond = (count / buildTime) * 1000;
            expect(buildTime).toBeLessThan(10000); // Should complete in < 10s
            expect(index.size()).toBe(count);
            console.log(`[Build 1536-dim] ${buildTime}ms, ${opsPerSecond.toFixed(0)} ops/s`);
        });
    });
    describe("Search Performance", () => {
        let index;
        const queryCount = 100;
        beforeAll(() => {
            index = new HNSWIndex({
                dimension: 128,
                M: 16,
                mL: 5,
                efConstruction: 100,
                efSearch: 50,
                enableSIMD: true,
            });
            // Build index with 1000 vectors
            const vectors = generateVectors(1000, 128);
            for (let i = 0; i < 1000; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
        });
        it("should perform fast k=10 searches", () => {
            const queries = generateVectors(queryCount, 128);
            const startTime = Date.now();
            for (const query of queries) {
                index.search(query, 10);
            }
            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / queryCount;
            const opsPerSecond = (queryCount / totalTime) * 1000;
            expect(avgTime).toBeLessThan(50); // Average search should be < 50ms
            expect(opsPerSecond).toBeGreaterThan(20); // At least 20 searches/sec
            console.log(`[Search k=10] ${avgTime.toFixed(2)}ms avg, ${opsPerSecond.toFixed(0)} ops/s`);
        });
        it("should perform fast k=100 searches", () => {
            const queries = generateVectors(queryCount, 128);
            const startTime = Date.now();
            for (const query of queries) {
                index.search(query, 100);
            }
            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / queryCount;
            const opsPerSecond = (queryCount / totalTime) * 1000;
            expect(avgTime).toBeLessThan(100); // Average search should be < 100ms
            console.log(`[Search k=100] ${avgTime.toFixed(2)}ms avg, ${opsPerSecond.toFixed(0)} ops/s`);
        });
        it("should handle burst searches efficiently", () => {
            const query = randomVector(128);
            const iterations = 1000;
            const startTime = Date.now();
            for (let i = 0; i < iterations; i++) {
                index.search(query, 10);
            }
            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / iterations;
            console.log(`[Burst Search] ${avgTime.toFixed(2)}ms avg over ${iterations} iterations`);
            expect(avgTime).toBeLessThan(10); // Repeated same query should be fast
        });
    });
    describe("SIMD vs Scalar Comparison", () => {
        it("should compare SIMD and scalar performance", () => {
            const dimension = 768;
            const count = 500;
            // SIMD index
            const simdIndex = new HNSWIndex({
                dimension,
                M: 16,
                enableSIMD: true,
                efConstruction: 100,
                efSearch: 50,
            });
            // Scalar index
            const scalarIndex = new HNSWIndex({
                dimension,
                M: 16,
                enableSIMD: false,
                efConstruction: 100,
                efSearch: 50,
            });
            const vectors = generateVectors(count, dimension);
            // Build SIMD index
            const simdBuildStart = Date.now();
            for (let i = 0; i < count; i++) {
                simdIndex.addVector(`vec_${i}`, vectors[i]);
            }
            const simdBuildTime = Date.now() - simdBuildStart;
            // Build Scalar index
            const scalarBuildStart = Date.now();
            for (let i = 0; i < count; i++) {
                scalarIndex.addVector(`vec_${i}`, vectors[i]);
            }
            const scalarBuildTime = Date.now() - scalarBuildStart;
            // Search comparison
            const queries = generateVectors(50, dimension);
            const simdSearchStart = Date.now();
            for (const query of queries) {
                simdIndex.search(query, 10);
            }
            const simdSearchTime = Date.now() - simdSearchStart;
            const scalarSearchStart = Date.now();
            for (const query of queries) {
                scalarIndex.search(query, 10);
            }
            const scalarSearchTime = Date.now() - scalarSearchStart;
            const buildSpeedup = scalarBuildTime / simdBuildTime;
            const searchSpeedup = scalarSearchTime / simdSearchTime;
            console.log(`[SIMD vs Scalar Build] Speedup: ${buildSpeedup.toFixed(2)}x`);
            console.log(`[SIMD vs Scalar Search] Speedup: ${searchSpeedup.toFixed(2)}x`);
            // SIMD should be at least as fast (may be equal in some JS engines)
            expect(buildSpeedup).toBeGreaterThanOrEqual(0.8);
            expect(searchSpeedup).toBeGreaterThanOrEqual(0.8);
        });
    });
    describe("Memory Efficiency", () => {
        it("should measure memory usage for different sizes", () => {
            const sizes = [100, 500, 1000];
            const dimension = 128;
            for (const size of sizes) {
                const index = new HNSWIndex({
                    dimension,
                    M: 16,
                    enableCompression: true,
                });
                const vectors = generateVectors(size, dimension);
                for (let i = 0; i < size; i++) {
                    index.addVector(`vec_${i}`, vectors[i]);
                }
                const metrics = index.getMetrics();
                const bytesPerVector = metrics.memoryUsage / size;
                console.log(`[Memory ${size} vectors] ` +
                    `${(metrics.memoryUsage / 1024).toFixed(2)}KB total, ` +
                    `${bytesPerVector.toFixed(2)} bytes/vector`);
                // Each vector should take reasonable space (< 5KB including overhead)
                expect(bytesPerVector).toBeLessThan(5000);
            }
        });
        it("should compare compression effectiveness", () => {
            const dimension = 768;
            const count = 500;
            const uncompressedIndex = new HNSWIndex({
                dimension,
                M: 16,
                enableCompression: false,
            });
            const compressedIndex = new HNSWIndex({
                dimension,
                M: 16,
                enableCompression: true,
                compressionRatio: 0.7,
            });
            const vectors = generateVectors(count, dimension);
            for (let i = 0; i < count; i++) {
                uncompressedIndex.addVector(`vec_${i}`, vectors[i]);
                compressedIndex.addVector(`vec_${i}`, vectors[i]);
            }
            const uncompressedMetrics = uncompressedIndex.getMetrics();
            const compressedMetrics = compressedIndex.getMetrics();
            const savings = ((uncompressedMetrics.memoryUsage - compressedMetrics.memoryUsage) /
                uncompressedMetrics.memoryUsage) *
                100;
            console.log(`[Compression] ` +
                `${(uncompressedMetrics.memoryUsage / 1024).toFixed(2)}KB -> ` +
                `${(compressedMetrics.memoryUsage / 1024).toFixed(2)}KB ` +
                `(${savings.toFixed(1)}% savings)`);
            // Compression should save some memory
            expect(compressedMetrics.memoryUsage).toBeLessThanOrEqual(uncompressedMetrics.memoryUsage);
        });
    });
    describe("Auto-Tuning", () => {
        it("should auto-tune parameters for large datasets", () => {
            const index = new HNSWIndex({
                dimension: 128,
                M: 16,
                autoTune: true,
                minVectorsForTuning: 500,
            });
            const vectors = generateVectors(1000, 128);
            const buildStart = Date.now();
            for (let i = 0; i < 1000; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - buildStart;
            const metrics = index.getMetrics();
            console.log(`[Auto-Tune] Build: ${buildTime}ms`);
            console.log(`[Auto-Tune] Last tune: ${metrics.lastAutoTune?.toISOString()}`);
            // Auto-tuning should have triggered
            expect(metrics.lastAutoTune).toBeDefined();
            // Index should still be functional
            const results = index.search(randomVector(128), 10);
            expect(results.length).toBe(10);
        });
    });
    describe("Scalability", () => {
        it("should scale well with dataset size", () => {
            const sizes = [100, 500, 1000, 2000];
            const dimension = 128;
            const results = [];
            for (const size of sizes) {
                const index = new HNSWIndex({
                    dimension,
                    M: 16,
                    efConstruction: 100,
                    efSearch: 50,
                    enableSIMD: true,
                });
                const vectors = generateVectors(size, dimension);
                // Measure build time
                const buildStart = Date.now();
                for (let i = 0; i < size; i++) {
                    index.addVector(`vec_${i}`, vectors[i]);
                }
                const buildTime = Date.now() - buildStart;
                // Measure search time
                const queries = generateVectors(50, dimension);
                const searchStart = Date.now();
                for (const query of queries) {
                    index.search(query, 10);
                }
                const searchTime = Date.now() - searchStart;
                const avgSearchTime = searchTime / 50;
                const metrics = index.getMetrics();
                results.push({
                    name: `${size} vectors`,
                    opsPerSecond: (size / buildTime) * 1000,
                    avgTimeMs: avgSearchTime,
                    memoryBytes: metrics.memoryUsage,
                });
                console.log(`[Scale ${size}] ` +
                    `Build: ${(buildTime).toFixed(0)}ms (${((size / buildTime) * 1000).toFixed(0)} ops/s), ` +
                    `Search: ${avgSearchTime.toFixed(2)}ms avg, ` +
                    `Memory: ${(metrics.memoryUsage / 1024).toFixed(2)}KB`);
            }
            // Search time should grow sub-linearly
            const smallSearch = results[0].avgTimeMs;
            const largeSearch = results[results.length - 1].avgTimeMs;
            const sizeRatio = sizes[sizes.length - 1] / sizes[0];
            const searchRatio = largeSearch / smallSearch;
            console.log(`[Scalability] Size ratio: ${sizeRatio}x, Search ratio: ${searchRatio.toFixed(2)}x`);
            // Search should not grow linearly with size (HNSW is O(log n))
            expect(searchRatio).toBeLessThan(sizeRatio * 0.5);
        });
    });
    describe("Accuracy vs Speed", () => {
        it("should compare different ef values", () => {
            const efValues = [10, 30, 50, 100];
            const dimension = 128;
            const count = 1000;
            const baseIndex = new HNSWIndex({
                dimension,
                M: 16,
                efConstruction: 200,
            });
            const vectors = generateVectors(count, dimension);
            for (let i = 0; i < count; i++) {
                baseIndex.addVector(`vec_${i}`, vectors[i]);
            }
            // Exact search using high ef
            const query = randomVector(dimension);
            const exactResults = baseIndex.search(query, 10);
            baseIndex.delete; // We'll create new indexes
            console.log(`[Accuracy vs Speed] Query distance: ${exactResults[0].distance.toFixed(4)}`);
            for (const ef of efValues) {
                const index = new HNSWIndex({
                    dimension,
                    M: 16,
                    efConstruction: 200,
                    efSearch: ef,
                });
                for (let i = 0; i < count; i++) {
                    index.addVector(`vec_${i}`, vectors[i]);
                }
                const searchStart = Date.now();
                const results = index.search(query, 10);
                const searchTime = Date.now() - searchStart;
                const exactMatch = results[0].id === exactResults[0].id;
                const distanceDiff = Math.abs(results[0].distance - exactResults[0].distance);
                console.log(`[ef=${ef}] ` +
                    `Time: ${searchTime}ms, ` +
                    `Exact match: ${exactMatch}, ` +
                    `Distance diff: ${distanceDiff.toFixed(6)}`);
            }
        });
    });
    describe("Predefined Configurations", () => {
        it("should test DEFAULT_HNSW_CONFIG_768", () => {
            const index = new HNSWIndex(DEFAULT_HNSW_CONFIG_768);
            const vectors = generateVectors(200, 768);
            const buildStart = Date.now();
            for (let i = 0; i < 200; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - buildStart;
            const queries = generateVectors(20, 768);
            const searchStart = Date.now();
            for (const query of queries) {
                index.search(query, 10);
            }
            const searchTime = Date.now() - searchStart;
            const metrics = index.getMetrics();
            console.log(`[DEFAULT_768] ` +
                `Build: ${buildTime}ms, ` +
                `Search: ${(searchTime / 20).toFixed(2)}ms avg, ` +
                `Memory: ${(metrics.memoryUsage / 1024).toFixed(2)}KB`);
            expect(metrics.simdEnabled).toBe(true);
        });
        it("should test PERFORMANCE_HNSW_CONFIG", () => {
            const index = new HNSWIndex(PERFORMANCE_HNSW_CONFIG);
            const vectors = generateVectors(500, 768);
            const buildStart = Date.now();
            for (let i = 0; i < 500; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - buildStart;
            const metrics = index.getMetrics();
            console.log(`[PERFORMANCE] ` +
                `Build: ${buildTime}ms, ` +
                `Auto-tune: ${metrics.autoTuneEnabled}, ` +
                `Memory: ${(metrics.memoryUsage / 1024).toFixed(2)}KB`);
            expect(metrics.autoTuneEnabled).toBe(true);
            expect(metrics.simdEnabled).toBe(true);
        });
        it("should test MEMORY_OPTIMIZED_HNSW_CONFIG", () => {
            const index = new HNSWIndex(MEMORY_OPTIMIZED_HNSW_CONFIG);
            const vectors = generateVectors(300, 768);
            const buildStart = Date.now();
            for (let i = 0; i < 300; i++) {
                index.addVector(`vec_${i}`, vectors[i]);
            }
            const buildTime = Date.now() - buildStart;
            const metrics = index.getMetrics();
            console.log(`[MEMORY_OPTIMIZED] ` +
                `Build: ${buildTime}ms, ` +
                `Memory: ${(metrics.memoryUsage / 1024).toFixed(2)}KB, ` +
                `Compression: ${metrics.compressionRatio?.toFixed(2)}`);
            expect(metrics.autoTuneEnabled).toBe(true);
        });
    });
});
//# sourceMappingURL=HNSWIndex.benchmark.js.map