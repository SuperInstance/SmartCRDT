/**
 * @lsi/performance-tests
 *
 * Performance benchmarks for @lsi/swarm package.
 *
 * Tests:
 * - CRDT store operations
 * - Merge performance
 * - Growth vector operations
 * - Memory efficiency
 */

import { describe, bench, beforeEach } from "vitest";
import {
  CRDTStore,
  mergePrincipleMetadata,
  computeConfidence,
} from "@lsi/swarm";
import type { Principle, PrincipleMetadata } from "@lsi/swarm";

describe("@lsi/swarm Benchmarks", () => {
  let store1: CRDTStore;
  let store2: CRDTStore;

  beforeEach(() => {
    store1 = new CRDTStore("replica-1");
    store2 = new CRDTStore("replica-2");
  });

  describe("Basic Operations", () => {
    bench("set operation", () => {
      const principle: Principle = {
        id: "test-principle",
        statement: "Test principle statement",
        metadata: {
          applicationCount: 1,
          successCount: 1,
          fitness: 0.8,
          avgWorth: 0.75,
          confidence: 0.5,
          updatedAt: Date.now(),
          origin: "test",
        },
      };
      return store1.set("key-1", principle);
    });

    bench("get operation", () => {
      store1.set("key-1", {
        id: "test",
        statement: "test",
        metadata: {
          applicationCount: 1,
          successCount: 1,
          fitness: 0.5,
          avgWorth: 0.5,
          confidence: 0.5,
          updatedAt: Date.now(),
          origin: "test",
        },
      });
      return store1.get("key-1");
    });

    bench("has operation", () => {
      store1.set("key-1", {
        id: "test",
        statement: "test",
        metadata: {
          applicationCount: 1,
          successCount: 1,
          fitness: 0.5,
          avgWorth: 0.5,
          confidence: 0.5,
          updatedAt: Date.now(),
          origin: "test",
        },
      });
      return store1.has("key-1");
    });

    bench("delete operation", () => {
      store1.set("key-1", {
        id: "test",
        statement: "test",
        metadata: {
          applicationCount: 1,
          successCount: 1,
          fitness: 0.5,
          avgWorth: 0.5,
          confidence: 0.5,
          updatedAt: Date.now(),
          origin: "test",
        },
      });
      return store1.delete("key-1");
    });
  });

  describe("Merge Operations", () => {
    bench("merge - empty stores", () => {
      return store1.merge(store2);
    });

    bench("merge - 10 entries", () => {
      for (let i = 0; i < 10; i++) {
        const principle: Principle = {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: i + 1,
            successCount: i,
            fitness: 0.5 + i * 0.05,
            avgWorth: 0.5 + i * 0.03,
            confidence: 1 - 1 / (i + 2),
            updatedAt: Date.now() + i,
            origin: "replica-1",
          },
        };
        store1.set(`key-${i}`, principle);
      }
      return store1.merge(store2);
    });

    bench("merge - 100 entries", () => {
      for (let i = 0; i < 100; i++) {
        const principle: Principle = {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: i + 1,
            successCount: i,
            fitness: 0.5 + i * 0.005,
            avgWorth: 0.5 + i * 0.003,
            confidence: 1 - 1 / (i + 2),
            updatedAt: Date.now() + i,
            origin: "replica-1",
          },
        };
        store1.set(`key-${i}`, principle);
      }
      return store1.merge(store2);
    });

    bench("merge - 1000 entries", () => {
      for (let i = 0; i < 1000; i++) {
        const principle: Principle = {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: i + 1,
            successCount: i,
            fitness: 0.5 + i * 0.0005,
            avgWorth: 0.5 + i * 0.0003,
            confidence: 1 - 1 / (i + 2),
            updatedAt: Date.now() + i,
            origin: "replica-1",
          },
        };
        store1.set(`key-${i}`, principle);
      }
      return store1.merge(store2);
    });

    bench("merge - conflicting entries", () => {
      // Both stores have the same keys with different values
      for (let i = 0; i < 50; i++) {
        const principle1: Principle = {
          id: `principle-${i}`,
          statement: `Statement from replica-1`,
          metadata: {
            applicationCount: 10,
            successCount: 8,
            fitness: 0.7,
            avgWorth: 0.65,
            confidence: 0.92,
            updatedAt: Date.now(),
            origin: "replica-1",
          },
        };
        const principle2: Principle = {
          id: `principle-${i}`,
          statement: `Statement from replica-2`,
          metadata: {
            applicationCount: 15,
            successCount: 12,
            fitness: 0.75,
            avgWorth: 0.7,
            confidence: 0.94,
            updatedAt: Date.now() + 1000,
            origin: "replica-2",
          },
        };
        store1.set(`key-${i}`, principle1);
        store2.set(`key-${i}`, principle2);
      }
      return store1.merge(store2);
    });
  });

  describe("Growth Vector Operations", () => {
    bench("exportGrowthVector - 10 changes", () => {
      for (let i = 0; i < 10; i++) {
        store1.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      return store1.exportGrowthVector();
    });

    bench("exportGrowthVector - 100 changes", () => {
      for (let i = 0; i < 100; i++) {
        store1.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      return store1.exportGrowthVector();
    });

    bench("exportGrowthVector - no changes (cached)", () => {
      for (let i = 0; i < 10; i++) {
        store1.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      // First export
      store1.exportGrowthVector();
      // Second export should be empty
      return store1.exportGrowthVector();
    });

    bench("mergeGrowthVector - 100 entries", () => {
      const vector = new Map();
      for (let i = 0; i < 100; i++) {
        vector.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      return store1.mergeGrowthVector(vector);
    });
  });

  describe("Metadata Operations", () => {
    bench("mergePrincipleMetadata", () => {
      const meta1: PrincipleMetadata = {
        applicationCount: 100,
        successCount: 85,
        fitness: 0.85,
        avgWorth: 0.8,
        confidence: 0.99,
        updatedAt: Date.now(),
        origin: "replica-1",
      };
      const meta2: PrincipleMetadata = {
        applicationCount: 150,
        successCount: 130,
        fitness: 0.87,
        avgWorth: 0.82,
        confidence: 0.993,
        updatedAt: Date.now() + 1000,
        origin: "replica-2",
      };
      return mergePrincipleMetadata(meta1, meta2);
    });

    bench("computeConfidence", () => {
      return computeConfidence(100);
    });
  });

  describe("Full State Operations", () => {
    bench("exportFullState - 1000 entries", () => {
      for (let i = 0; i < 1000; i++) {
        store1.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      return store1.exportFullState();
    });

    bench("importFullState - 1000 entries", () => {
      const state = new Map();
      for (let i = 0; i < 1000; i++) {
        state.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
      return store1.importFullState(state);
    });
  });

  describe("Iteration Operations", () => {
    beforeEach(() => {
      for (let i = 0; i < 1000; i++) {
        store1.set(`key-${i}`, {
          id: `principle-${i}`,
          statement: `Statement ${i}`,
          metadata: {
            applicationCount: 1,
            successCount: 1,
            fitness: 0.5,
            avgWorth: 0.5,
            confidence: 0.5,
            updatedAt: Date.now(),
            origin: "test",
          },
        });
      }
    });

    bench("keys() iteration - 1000 entries", () => {
      return Array.from(store1.keys());
    });

    bench("values() iteration - 1000 entries", () => {
      return Array.from(store1.values());
    });

    bench("entries() iteration - 1000 entries", () => {
      return Array.from(store1.entries());
    });
  });
});
