/**
 * Tests for ChannelManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChannelManager } from '../src/ChannelManager.js';
import type { SSEEvent } from '../src/types.js';
import { SSEErrorCode } from '../src/types.js';

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager({
      auto_create: true,
      auto_delete: false,
      cleanup_interval: 1000,
    });
  });

  describe('createChannel', () => {
    it('should create a new channel', () => {
      const channel = manager.createChannel('test-channel');
      expect(channel).toBeDefined();
      expect(channel.channel_name).toBe('test-channel');
      expect(channel.clients).toBeInstanceOf(Set);
      expect(channel.history).toEqual([]);
    });

    it('should set default metadata', () => {
      const channel = manager.createChannel('test');
      expect(channel.metadata.persistent).toBe(false);
      expect(channel.metadata.max_clients).toBe(0);
      expect(channel.metadata.require_auth).toBe(false);
    });

    it('should allow custom metadata', () => {
      const channel = manager.createChannel('test', {
        persistent: true,
        max_clients: 100,
        description: 'Test channel',
      });

      expect(channel.metadata.persistent).toBe(true);
      expect(channel.metadata.max_clients).toBe(100);
      expect(channel.metadata.description).toBe('Test channel');
    });

    it('should throw error when channel exists', () => {
      manager.createChannel('existing');
      expect(() => {
        manager.createChannel('existing');
      }).toThrow();
    });

    it('should set created_at timestamp', () => {
      const before = Date.now();
      const channel = manager.createChannel('test');
      const after = Date.now();

      expect(channel.created_at).toBeGreaterThanOrEqual(before);
      expect(channel.created_at).toBeLessThanOrEqual(after);
    });

    it('should increment total channels created', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');
      expect(manager.getTotalChannelsCreated()).toBe(2);
    });
  });

  describe('deleteChannel', () => {
    it('should delete existing channel', () => {
      manager.createChannel('to-delete');
      const deleted = manager.deleteChannel('to-delete');
      expect(deleted).toBe(true);
      expect(manager.hasChannel('to-delete')).toBe(false);
    });

    it('should return false for non-existent channel', () => {
      const deleted = manager.deleteChannel('non-existent');
      expect(deleted).toBe(false);
    });

    it('should throw error when channel has clients', () => {
      const channel = manager.createChannel('with-clients');
      channel.clients.add('client1');

      expect(() => {
        manager.deleteChannel('with-clients');
      }).toThrow();
    });

    it('should delete empty channels', () => {
      manager.createChannel('empty');
      const deleted = manager.deleteChannel('empty');
      expect(deleted).toBe(true);
    });
  });

  describe('forceDeleteChannel', () => {
    it('should delete channel with clients', () => {
      const channel = manager.createChannel('with-clients');
      channel.clients.add('client1');
      channel.clients.add('client2');

      const deleted = manager.forceDeleteChannel('with-clients');
      expect(deleted).toBe(true);
      expect(manager.hasChannel('with-clients')).toBe(false);
    });

    it('should clear all clients on force delete', () => {
      const channel = manager.createChannel('test');
      channel.clients.add('client1');

      manager.forceDeleteChannel('test');
      expect(channel.clients.size).toBe(0);
    });
  });

  describe('getChannel', () => {
    it('should return existing channel', () => {
      const created = manager.createChannel('test');
      const retrieved = manager.getChannel('test');
      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-existent channel', () => {
      const retrieved = manager.getChannel('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getOrCreateChannel', () => {
    it('should return existing channel', () => {
      const created = manager.createChannel('test');
      const retrieved = manager.getOrCreateChannel('test');
      expect(retrieved).toBe(created);
    });

    it('should create new channel when auto_create is true', () => {
      const channel = manager.getOrCreateChannel('new-channel');
      expect(channel).toBeDefined();
      expect(channel.channel_name).toBe('new-channel');
    });

    it('should throw error when auto_create is false', () => {
      const noAutoManager = new ChannelManager({
        auto_create: false,
      });

      expect(() => {
        noAutoManager.getOrCreateChannel('non-existent');
      }).toThrow();
    });
  });

  describe('getAllChannels', () => {
    it('should return all channels', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');
      manager.createChannel('ch3');

      const channels = manager.getAllChannels();
      expect(channels).toHaveLength(3);
    });

    it('should return empty array when no channels', () => {
      const channels = manager.getAllChannels();
      expect(channels).toEqual([]);
    });
  });

  describe('getChannelNames', () => {
    it('should return channel names', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');

      const names = manager.getChannelNames();
      expect(names).toContain('ch1');
      expect(names).toContain('ch2');
    });
  });

  describe('hasChannel', () => {
    it('should return true for existing channel', () => {
      manager.createChannel('test');
      expect(manager.hasChannel('test')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(manager.hasChannel('non-existent')).toBe(false);
    });
  });

  describe('addClientToChannel', () => {
    it('should add client to channel', () => {
      const channel = manager.createChannel('test');
      const added = manager.addClientToChannel('test', 'client1');
      expect(added).toBe(true);
      expect(channel.clients.has('client1')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      const added = manager.addClientToChannel('non-existent', 'client1');
      expect(added).toBe(false);
    });

    it('should enforce max clients limit', () => {
      const channel = manager.createChannel('limited', {
        max_clients: 2,
      });

      manager.addClientToChannel('limited', 'client1');
      manager.addClientToChannel('limited', 'client2');

      expect(() => {
        manager.addClientToChannel('limited', 'client3');
      }).toThrow();
    });

    it('should allow unlimited clients when max_clients is 0', () => {
      const channel = manager.createChannel('unlimited', {
        max_clients: 0,
      });

      for (let i = 0; i < 100; i++) {
        manager.addClientToChannel('unlimited', `client${i}`);
      }

      expect(channel.clients.size).toBe(100);
    });
  });

  describe('removeClientFromChannel', () => {
    it('should remove client from channel', () => {
      const channel = manager.createChannel('test');
      channel.clients.add('client1');

      const removed = manager.removeClientFromChannel('test', 'client1');
      expect(removed).toBe(true);
      expect(channel.clients.has('client1')).toBe(false);
    });

    it('should return false for non-existent channel', () => {
      const removed = manager.removeClientFromChannel('non-existent', 'client1');
      expect(removed).toBe(false);
    });

    it('should return false when client not in channel', () => {
      manager.createChannel('test');
      const removed = manager.removeClientFromChannel('test', 'non-existent');
      expect(removed).toBe(false);
    });

    it('should auto-delete empty non-persistent channels', () => {
      const autoDeleteManager = new ChannelManager({
        auto_delete: true,
      });

      const channel = autoDeleteManager.createChannel('ephemeral');
      channel.clients.add('client1');

      autoDeleteManager.removeClientFromChannel('ephemeral', 'client1');
      expect(autoDeleteManager.hasChannel('ephemeral')).toBe(false);
    });

    it('should not auto-delete persistent channels', () => {
      const autoDeleteManager = new ChannelManager({
        auto_delete: true,
      });

      const channel = autoDeleteManager.createChannel('persistent', {
        persistent: true,
      });
      channel.clients.add('client1');

      autoDeleteManager.removeClientFromChannel('persistent', 'client1');
      expect(autoDeleteManager.hasChannel('persistent')).toBe(true);
    });
  });

  describe('removeClientFromAllChannels', () => {
    it('should remove client from all channels', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');
      manager.createChannel('ch3');

      manager.addClientToChannel('ch1', 'client1');
      manager.addClientToChannel('ch2', 'client1');
      manager.addClientToChannel('ch3', 'client1');

      const removed = manager.removeClientFromAllChannels('client1');
      expect(removed).toHaveLength(3);
      expect(removed).toContain('ch1');
      expect(removed).toContain('ch2');
      expect(removed).toContain('ch3');
    });

    it('should return empty array when client not in any channel', () => {
      const removed = manager.removeClientFromAllChannels('non-existent');
      expect(removed).toEqual([]);
    });
  });

  describe('getChannelClients', () => {
    it('should return clients in channel', () => {
      const channel = manager.createChannel('test');
      channel.clients.add('client1');
      channel.clients.add('client2');

      const clients = manager.getChannelClients('test');
      expect(clients).toBeInstanceOf(Set);
      expect(clients.size).toBe(2);
      expect(clients.has('client1')).toBe(true);
    });

    it('should return empty set for non-existent channel', () => {
      const clients = manager.getChannelClients('non-existent');
      expect(clients).toBeInstanceOf(Set);
      expect(clients.size).toBe(0);
    });
  });

  describe('getChannelClientCount', () => {
    it('should return client count', () => {
      const channel = manager.createChannel('test');
      channel.clients.add('client1');
      channel.clients.add('client2');

      expect(manager.getChannelClientCount('test')).toBe(2);
    });

    it('should return 0 for non-existent channel', () => {
      expect(manager.getChannelClientCount('non-existent')).toBe(0);
    });
  });

  describe('addEventToHistory', () => {
    it('should add event to history', () => {
      const channel = manager.createChannel('test');
      const event: SSEEvent = {
        id: 'event1',
        data: 'test',
      };

      manager.addEventToHistory('test', event);

      expect(channel.history).toHaveLength(1);
      expect(channel.history[0]).toEqual(event);
    });

    it('should generate event ID if not provided', () => {
      const channel = manager.createChannel('test');
      const event: SSEEvent = {
        data: 'test',
      };

      manager.addEventToHistory('test', event);

      expect(event.id).toBeDefined();
      expect(event.id).toContain('test_');
    });

    it('should update last_message_id', () => {
      const channel = manager.createChannel('test');
      const event: SSEEvent = {
        id: 'event1',
        data: 'test',
      };

      manager.addEventToHistory('test', event);

      expect(channel.last_message_id).toBe('event1');
    });

    it('should trim history when exceeding max size', () => {
      const channel = manager.createChannel('test');
      channel.max_history_size = 5;

      for (let i = 0; i < 10; i++) {
        manager.addEventToHistory('test', { data: `event${i}` });
      }

      expect(channel.history.length).toBe(5);
    });
  });

  describe('getChannelHistory', () => {
    it('should return all history', () => {
      const channel = manager.createChannel('test');
      const event1: SSEEvent = { id: 'e1', data: 'test1' };
      const event2: SSEEvent = { id: 'e2', data: 'test2' };

      manager.addEventToHistory('test', event1);
      manager.addEventToHistory('test', event2);

      const history = manager.getChannelHistory('test');
      expect(history).toHaveLength(2);
    });

    it('should return events since given ID', () => {
      const channel = manager.createChannel('test');
      const event1: SSEEvent = { id: 'e1', data: 'test1' };
      const event2: SSEEvent = { id: 'e2', data: 'test2' };
      const event3: SSEEvent = { id: 'e3', data: 'test3' };

      manager.addEventToHistory('test', event1);
      manager.addEventToHistory('test', event2);
      manager.addEventToHistory('test', event3);

      const history = manager.getChannelHistory('test', 'e1');
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('e2');
      expect(history[1].id).toBe('e3');
    });

    it('should return empty array for non-existent channel', () => {
      const history = manager.getChannelHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('getChannelStats', () => {
    it('should return channel stats', () => {
      const channel = manager.createChannel('test');
      channel.clients.add('client1');
      channel.clients.add('client2');

      const event: SSEEvent = { data: 'test data' };
      manager.addEventToHistory('test', event);

      const stats = manager.getChannelStats('test');
      expect(stats).toBeDefined();
      expect(stats?.channel).toBe('test');
      expect(stats?.clients).toBe(2);
      expect(stats?.messages_sent).toBeGreaterThan(0);
    });

    it('should return null for non-existent channel', () => {
      const stats = manager.getChannelStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should calculate uptime correctly', async () => {
      manager.createChannel('test');
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = manager.getChannelStats('test');
      expect(stats?.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average message size', () => {
      const channel = manager.createChannel('test');
      manager.addEventToHistory('test', { data: 'short' });
      manager.addEventToHistory('test', { data: 'a much longer message' });

      const stats = manager.getChannelStats('test');
      expect(stats?.avg_message_size).toBeGreaterThan(0);
    });
  });

  describe('getAllChannelStats', () => {
    it('should return stats for all channels', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');

      const stats = manager.getAllChannelStats();
      expect(Object.keys(stats)).toContain('ch1');
      expect(Object.keys(stats)).toContain('ch2');
    });
  });

  describe('clearChannelHistory', () => {
    it('should clear channel history', () => {
      const channel = manager.createChannel('test');
      manager.addEventToHistory('test', { data: 'test1' });
      manager.addEventToHistory('test', { data: 'test2' });

      const cleared = manager.clearChannelHistory('test');
      expect(cleared).toBe(true);
      expect(channel.history).toEqual([]);
    });

    it('should return false for non-existent channel', () => {
      const cleared = manager.clearChannelHistory('non-existent');
      expect(cleared).toBe(false);
    });
  });

  describe('getChannelCount', () => {
    it('should return channel count', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');
      manager.createChannel('ch3');

      expect(manager.getChannelCount()).toBe(3);
    });
  });

  describe('cleanupEmptyChannels', () => {
    it('should remove empty non-persistent channels', () => {
      manager.createChannel('empty1', { persistent: false });
      manager.createChannel('empty2', { persistent: false });
      manager.createChannel('persistent', { persistent: true });

      const cleaned = manager.cleanupEmptyChannels();
      expect(cleaned).toBe(2);
      expect(manager.hasChannel('persistent')).toBe(true);
    });

    it('should not remove channels with clients', () => {
      const channel = manager.createChannel('with-clients', {
        persistent: false,
      });
      channel.clients.add('client1');

      const cleaned = manager.cleanupEmptyChannels();
      expect(cleaned).toBe(0);
      expect(manager.hasChannel('with-clients')).toBe(true);
    });
  });

  describe('closeAll', () => {
    it('should close all channels', () => {
      manager.createChannel('ch1');
      manager.createChannel('ch2');
      manager.createChannel('ch3');

      manager.closeAll();
      expect(manager.getChannelCount()).toBe(0);
    });

    it('should clear message counters', () => {
      manager.createChannel('test');
      manager.addEventToHistory('test', { data: 'test' });

      manager.closeAll();
      // Channel counter should be reset
      expect(manager.getTotalChannelsCreated()).toBeGreaterThan(0);
    });
  });
});
