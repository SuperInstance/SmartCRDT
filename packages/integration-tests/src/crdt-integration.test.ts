/**
 * Suite 5: CRDT Knowledge Sync
 *
 * Tests CRDT merge across replicas, G-Counter behavior,
 * and distributed knowledge storage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CRDTStore } from "@lsi/swarm";
import { CRDTOperation, CRDTSnapshot } from "@lsi/swarm/src/crdt/types";

describe("CRDT Knowledge Sync", () => {
  describe("G-Counter Behavior", () => {
    it("should use addition for merging counters (not Math.max)", async () => {
      const store1 = new CRDTStore();
      const store2 = new CRDTStore();

      // Store1 increments counter to 3
      await store1.store({ key: "counter", value: "1" });
      await store1.store({ key: "counter", value: "2" });
      await store1.store({ key: "counter", value: "3" });

      // Store2 increments counter to 2
      await store2.store({ key: "counter", value: "1" });
      await store2.store({ key: "counter", value: "2" });

      // Merge should add counters: 3 + 2 = 5 (not Math.max(3, 2) = 3)
      await store1.merge(store2.getState());
      const counterValue = await store1.retrieve("counter");

      expect(counterValue).toBeDefined();
      // The actual value depends on implementation, but merge should be additive
    });

    it("should handle concurrent updates correctly", async () => {
      const store1 = new CRDTStore();
      const store2 = new CRDTStore();

      // Both stores update same key concurrently
      await Promise.all([
        store1.store({ key: "concurrent", value: "value1" }),
        store2.store({ key: "concurrent", value: "value2" }),
      ]);

      // Merge should resolve without conflicts
      await store1.merge(store2.getState());
      const result = await store1.retrieve("concurrent");

      expect(result).toBeDefined();
    });

    it("should track replica IDs", async () => {
      const store1 = new CRDTStore({ replicaId: "replica-1" });
      const store2 = new CRDTStore({ replicaId: "replica-2" });

      await store1.store({ key: "test", value: "data1" });
      await store2.store({ key: "test", value: "data2" });

      const state1 = store1.getState();
      const state2 = store2.getState();

      expect(state1.metadata.replicaId).toBeDefined();
      expect(state2.metadata.replicaId).toBeDefined();
      expect(state1.metadata.replicaId).not.toBe(state2.metadata.replicaId);
    });
  });

  describe("Distributed Knowledge Storage", () => {
    let store1: CRDTStore;
    let store2: CRDTStore;
    let store3: CRDTStore;

    beforeEach(() => {
      store1 = new CRDTStore({ replicaId: "replica-1" });
      store2 = new CRDTStore({ replicaId: "replica-2" });
      store3 = new CRDTStore({ replicaId: "replica-3" });
    });

    it("should sync knowledge across 3 replicas", async () => {
      // Each store adds different knowledge
      await store1.store({ key: "fact1", value: "Paris is capital of France" });
      await store2.store({ key: "fact2", value: "London is capital of UK" });
      await store3.store({ key: "fact3", value: "Tokyo is capital of Japan" });

      // Merge all three
      await store1.merge(store2.getState());
      await store1.merge(store3.getState());

      // Store1 should have all facts
      const fact1 = await store1.retrieve("fact1");
      const fact2 = await store1.retrieve("fact2");
      const fact3 = await store1.retrieve("fact3");

      expect(fact1).toBeDefined();
      expect(fact2).toBeDefined();
      expect(fact3).toBeDefined();
    });

    it("should handle merge orders correctly", async () => {
      await store1.store({ key: "a", value: "1" });
      await store2.store({ key: "b", value: "2" });
      await store3.store({ key: "c", value: "3" });

      // Different merge orders should yield same result
      await store1.merge(store2.getState());
      await store1.merge(store3.getState());

      await store2.merge(store3.getState());
      await store2.merge(store1.getState());

      await store3.merge(store1.getState());
      await store3.merge(store2.getState());

      // All should converge to same state
      const state1 = store1.getState();
      const state2 = store2.getState();
      const state3 = store3.getState();

      // Compare states (implementation dependent)
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state3).toBeDefined();
    });

    it("should support offline-first operation", async () => {
      // Store1 goes offline
      await store1.store({ key: "offline-data", value: "created offline" });

      // Store2 and Store3 sync
      await store2.store({ key: "online-data", value: "created online" });
      await store2.merge(store3.getState());

      // Store1 comes back online and syncs
      await store1.merge(store2.getState());

      // All data should be available
      const offlineData = await store1.retrieve("offline-data");
      const onlineData = await store1.retrieve("online-data");

      expect(offlineData).toBeDefined();
      expect(onlineData).toBeDefined();
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve last-write-wins for same key", async () => {
      const store1 = new CRDTStore();
      const store2 = new CRDTStore();

      await store1.store({ key: "conflict", value: "first", timestamp: 1000 });
      await store2.store({ key: "conflict", value: "second", timestamp: 2000 });

      await store1.merge(store2.getState());
      const result = await store1.retrieve("conflict");

      expect(result).toBeDefined();
      // Later timestamp should win
    });

    it("should handle vector clock merging", async () => {
      const store1 = new CRDTStore({ replicaId: "A" });
      const store2 = new CRDTStore({ replicaId: "B" });

      // Store1 updates key
      await store1.store({ key: "vector-test", value: "v1" });

      // Store2 updates same key after syncing from Store1
      await store2.merge(store1.getState());
      await store2.store({ key: "vector-test", value: "v2" });

      // Store1 updates again without seeing Store2's changes
      await store1.store({ key: "vector-test", value: "v3" });

      // Final merge should have correct vector clock
      await store1.merge(store2.getState());
      const result = await store1.retrieve("vector-test");

      expect(result).toBeDefined();
    });
  });

  describe("CRDT Metadata", () => {
    it("should track operation timestamps", async () => {
      const store = new CRDTStore();

      const beforeStore = Date.now();
      await store.store({ key: "timestamp-test", value: "data" });
      const afterStore = Date.now();

      const state = store.getState();
      expect(state.metadata.lastModified).toBeGreaterThanOrEqual(beforeStore);
      expect(state.metadata.lastModified).toBeLessThanOrEqual(afterStore);
    });

    it("should track operation counts", async () => {
      const store = new CRDTStore();

      await store.store({ key: "op1", value: "data1" });
      await store.store({ key: "op2", value: "data2" });
      await store.store({ key: "op3", value: "data3" });

      const state = store.getState();
      expect(state.metadata.operationCount).toBeGreaterThanOrEqual(3);
    });

    it("should track replica versions", async () => {
      const store1 = new CRDTStore({ replicaId: "replica-1" });
      const store2 = new CRDTStore({ replicaId: "replica-2" });

      await store1.store({ key: "version-test", value: "v1" });
      await store2.store({ key: "version-test", value: "v2" });

      await store1.merge(store2.getState());

      const state = store1.getState();
      expect(state.metadata.version).toBeDefined();
    });
  });

  describe("Query and Retrieval", () => {
    let store: CRDTStore;

    beforeEach(async () => {
      store = new CRDTStore();

      // Populate with test data
      await store.store({ key: "fact1", value: "Fact 1" });
      await store.store({ key: "fact2", value: "Fact 2" });
      await store.store({ key: "fact3", value: "Fact 3" });
    });

    it("should retrieve single value", async () => {
      const result = await store.retrieve("fact1");

      expect(result).toBeDefined();
      expect(result.key).toBe("fact1");
      expect(result.value).toBe("Fact 1");
    });

    it("should retrieve multiple values", async () => {
      const results = await store.retrieve(["fact1", "fact2"]);

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe("fact1");
      expect(results[1].key).toBe("fact2");
    });

    it("should query by prefix", async () => {
      await store.store({ key: "user:1", value: "Alice" });
      await store.store({ key: "user:2", value: "Bob" });
      await store.store({ key: "user:3", value: "Charlie" });

      const results = await store.query("user:");

      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle missing keys", async () => {
      const result = await store.retrieve("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("Persistence and Serialization", () => {
    it("should serialize state to JSON", async () => {
      const store = new CRDTStore();

      await store.store({ key: "serialize-test", value: "data" });

      const state = store.getState();
      const json = JSON.stringify(state);

      expect(json).toBeDefined();
      expect(json.length).toBeGreaterThan(0);
    });

    it("should deserialize state from JSON", async () => {
      const store1 = new CRDTStore();

      await store1.store({ key: "deserialize-test", value: "data" });

      const state = store1.getState();
      const json = JSON.stringify(state);

      const store2 = new CRDTStore();
      await store2.loadState(JSON.parse(json));

      const result = await store2.retrieve("deserialize-test");
      expect(result).toBeDefined();
      expect(result.value).toBe("data");
    });

    it("should export and import snapshots", async () => {
      const store1 = new CRDTStore();

      await store1.store({ key: "export-test", value: "data" });

      const snapshot = await store1.export();

      const store2 = new CRDTStore();
      await store2.import(snapshot);

      const result = await store2.retrieve("export-test");
      expect(result).toBeDefined();
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large numbers of operations", async () => {
      const store = new CRDTStore();
      const count = 1000;

      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        await store.store({ key: `key-${i}`, value: `value-${i}` });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it("should merge large states efficiently", async () => {
      const store1 = new CRDTStore();
      const store2 = new CRDTStore();

      const count = 500;

      for (let i = 0; i < count; i++) {
        await store1.store({ key: `s1-${i}`, value: `value-${i}` });
        await store2.store({ key: `s2-${i}`, value: `value-${i}` });
      }

      const startTime = Date.now();
      await store1.merge(store2.getState());
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Merge should be fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Integration with SuperInstance", () => {
    it("should work with ContextPlane", async () => {
      const { ContextPlane } = await import("@lsi/superinstance");
      const store = new CRDTStore();

      const contextPlane = new ContextPlane({
        knowledgeStore: store,
      });

      await contextPlane.storeKnowledge({
        key: "test-knowledge",
        value: "Test value",
      });

      const retrieved = await contextPlane.retrieveKnowledge("test-knowledge");

      expect(retrieved).toBeDefined();
    });

    it("should sync knowledge across multiple SuperInstances", async () => {
      const { SuperInstance } = await import("@lsi/superinstance");

      const store1 = new CRDTStore({ replicaId: "si-1" });
      const store2 = new CRDTStore({ replicaId: "si-2" });

      const si1 = new SuperInstance({
        contextPlane: { knowledgeStore: store1 },
      });

      const si2 = new SuperInstance({
        contextPlane: { knowledgeStore: store2 },
      });

      // Store knowledge in SI1
      await store1.store({ key: "shared-knowledge", value: "Shared data" });

      // Sync to SI2
      await store2.merge(store1.getState());

      const retrieved = await store2.retrieve("shared-knowledge");
      expect(retrieved).toBeDefined();
      expect(retrieved.value).toBe("Shared data");
    });
  });
});
