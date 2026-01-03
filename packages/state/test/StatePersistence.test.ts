/**
 * @lsi/state - StatePersistence Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StatePersistence,
  MemoryBackend,
  LocalStorageBackend,
  JSONSerializer
} from '../src/persistence/index.js';

interface TestState {
  value: number;
  name: string;
}

describe('StatePersistence', () => {
  let persistence: StatePersistence<TestState>;

  beforeEach(() => {
    persistence = new StatePersistence<TestState>(
      new JSONSerializer<TestState>(),
      {
        keyPrefix: 'test',
        storage: new MemoryBackend()
      }
    );
  });

  describe('save/load', () => {
    it('should save and load state', async () => {
      const state: TestState = { value: 42, name: 'test' };

      await persistence.save(state);
      const loaded = await persistence.load();

      expect(loaded).toEqual(state);
    });

    it('should return null when loading nonexistent state', async () => {
      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete saved state', async () => {
      const state: TestState = { value: 42, name: 'test' };

      await persistence.save(state);
      await persistence.delete();

      const loaded = await persistence.load();
      expect(loaded).toBeNull();
    });
  });

  describe('has', () => {
    it('should check if state exists', async () => {
      expect(await persistence.has()).toBe(false);

      await persistence.save({ value: 1, name: 'test' });

      expect(await persistence.has()).toBe(true);
    });
  });

  describe('snapshots', () => {
    it('should save and load snapshots', async () => {
      const snapshot = {
        id: 'snap1',
        state: { value: 100, name: 'snapshot' },
        timestamp: Date.now(),
        label: 'Test Snapshot'
      };

      await persistence.saveSnapshot(snapshot);
      const loaded = await persistence.loadSnapshot('snap1');

      expect(loaded).toEqual(snapshot);
    });

    it('should delete snapshots', async () => {
      const snapshot = {
        id: 'snap1',
        state: { value: 100, name: 'snapshot' },
        timestamp: Date.now()
      };

      await persistence.saveSnapshot(snapshot);
      await persistence.deleteSnapshot('snap1');

      const loaded = await persistence.loadSnapshot('snap1');
      expect(loaded).toBeNull();
    });
  });

  describe('custom keys', () => {
    it('should save with custom key', async () => {
      const state1: TestState = { value: 1, name: 'one' };
      const state2: TestState = { value: 2, name: 'two' };

      await persistence.save(state1, 'key1');
      await persistence.save(state2, 'key2');

      expect(await persistence.load('key1')).toEqual(state1);
      expect(await persistence.load('key2')).toEqual(state2);
    });
  });
});

describe('MemoryBackend', () => {
  it('should store values in memory', async () => {
    const backend = new MemoryBackend();

    await backend.set('key1', 'value1');
    await backend.set('key2', 'value2');

    expect(await backend.get('key1')).toBe('value1');
    expect(await backend.get('key2')).toBe('value2');

    await backend.delete('key1');
    expect(await backend.get('key1')).toBeNull();
    expect(await backend.has('key2')).toBe(true);

    await backend.clear();
    expect(await backend.get('key2')).toBeNull();
  });
});

describe('JSONSerializer', () => {
  it('should serialize and deserialize', () => {
    const serializer = new JSONSerializer<{ a: number; b: string }>();

    const state = { a: 42, b: 'test' };
    const serialized = serializer.serialize(state);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized).toEqual(state);
  });

  it('should handle nested objects', () => {
    const serializer = new JSONSerializer<{
      nested: { value: number };
      items: number[]
    }>();

    const state = {
      nested: { value: 100 },
      items: [1, 2, 3]
    };

    const serialized = serializer.serialize(state);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized).toEqual(state);
  });
});
