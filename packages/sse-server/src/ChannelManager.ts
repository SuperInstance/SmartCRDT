/**
 * ChannelManager - Manages SSE channels
 *
 * Handles channel creation/deletion, client subscription management,
 * channel lifecycle, permissions, and event history for replay.
 */

import type {
  SSEChannel,
  SSEEvent,
  ChannelStats,
  ChannelManagerOptions,
  ChannelMetadata,
} from "./types.js";
import { SSEError, SSEErrorCode } from "./types.js";

/**
 * Default channel manager options
 */
const DEFAULT_OPTIONS: ChannelManagerOptions = {
  auto_create: true,
  auto_delete: false,
  cleanup_interval: 300000, // 5 minutes
  default_metadata: {
    persistent: false,
    max_clients: 0, // Unlimited
    require_auth: false,
  },
};

/**
 * Channel Manager class
 */
export class ChannelManager {
  private channels: Map<string, SSEChannel> = new Map();
  private options: ChannelManagerOptions;
  private cleanup_interval: NodeJS.Timeout | null = null;
  private channel_counter: number = 0;
  private message_counters: Map<string, number> = new Map();
  private closed: boolean = false;

  constructor(options?: Partial<ChannelManagerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanup();
  }

  /**
   * Create a new channel
   */
  createChannel(name: string, metadata?: Partial<ChannelMetadata>): SSEChannel {
    if (this.closed) {
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "Channel manager is closed"
      );
    }

    if (this.channels.has(name)) {
      throw new SSEError(
        SSEErrorCode.CHANNEL_EXISTS,
        `Channel already exists: ${name}`
      );
    }

    const now = Date.now();
    const channel: SSEChannel = {
      channel_name: name,
      clients: new Set(),
      last_message_id: "",
      created_at: now,
      metadata: {
        persistent: false,
        max_clients: 0,
        require_auth: false,
        ...this.options.default_metadata,
        ...metadata,
      },
      history: [],
      max_history_size: 100,
    };

    this.channels.set(name, channel);
    this.message_counters.set(name, 0);
    this.channel_counter++;

    return channel;
  }

  /**
   * Delete a channel
   */
  deleteChannel(name: string): boolean {
    const channel = this.channels.get(name);
    if (!channel) {
      return false;
    }

    // Check if channel has clients
    if (channel.clients.size > 0) {
      throw new SSEError(
        SSEErrorCode.CHANNEL_EXISTS,
        `Cannot delete channel with active clients: ${name}`
      );
    }

    this.channels.delete(name);
    this.message_counters.delete(name);
    return true;
  }

  /**
   * Force delete a channel (disconnects all clients)
   */
  forceDeleteChannel(name: string): boolean {
    const channel = this.channels.get(name);
    if (!channel) {
      return false;
    }

    // Clear all clients
    channel.clients.clear();
    this.channels.delete(name);
    this.message_counters.delete(name);
    return true;
  }

  /**
   * Get a channel
   */
  getChannel(name: string): SSEChannel | undefined {
    return this.channels.get(name);
  }

  /**
   * Get or create a channel
   */
  getOrCreateChannel(
    name: string,
    metadata?: Partial<ChannelMetadata>
  ): SSEChannel {
    let channel = this.channels.get(name);

    if (!channel) {
      if (this.options.auto_create) {
        channel = this.createChannel(name, metadata);
      } else {
        throw new SSEError(
          SSEErrorCode.CHANNEL_NOT_FOUND,
          `Channel not found: ${name}`
        );
      }
    }

    return channel;
  }

  /**
   * Get all channels
   */
  getAllChannels(): SSEChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channel names
   */
  getChannelNames(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if channel exists
   */
  hasChannel(name: string): boolean {
    return this.channels.has(name);
  }

  /**
   * Add client to channel
   */
  addClientToChannel(channelName: string, clientId: string): boolean {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return false;
    }

    // Check max clients
    if (
      channel.metadata.max_clients > 0 &&
      channel.clients.size >= channel.metadata.max_clients
    ) {
      throw new SSEError(
        SSEErrorCode.CONNECTION_LIMIT,
        `Channel is full: ${channelName}`,
        { limit: channel.metadata.max_clients }
      );
    }

    channel.clients.add(clientId);
    return true;
  }

  /**
   * Remove client from channel
   */
  removeClientFromChannel(channelName: string, clientId: string): boolean {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return false;
    }

    const removed = channel.clients.delete(clientId);

    // Auto-delete if empty and not persistent
    if (
      removed &&
      this.options.auto_delete &&
      !channel.metadata.persistent &&
      channel.clients.size === 0
    ) {
      this.deleteChannel(channelName);
    }

    return removed;
  }

  /**
   * Remove client from all channels
   */
  removeClientFromAllChannels(clientId: string): string[] {
    const removed: string[] = [];

    for (const channelName of this.channels.keys()) {
      if (this.removeClientFromChannel(channelName, clientId)) {
        removed.push(channelName);
      }
    }

    return removed;
  }

  /**
   * Get clients in channel
   */
  getChannelClients(channelName: string): Set<string> {
    const channel = this.getChannel(channelName);
    return channel ? new Set(channel.clients) : new Set();
  }

  /**
   * Get channel client count
   */
  getChannelClientCount(channelName: string): number {
    const channel = this.getChannel(channelName);
    return channel ? channel.clients.size : 0;
  }

  /**
   * Add event to channel history
   */
  addEventToHistory(channelName: string, event: SSEEvent): void {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return;
    }

    // Add event ID if not present
    if (!event.id) {
      event.id = this.generateEventId(channelName);
    }

    // Update last message ID
    channel.last_message_id = event.id;

    // Add to history
    channel.history.push({ ...event });

    // Trim history if needed
    if (channel.history.length > channel.max_history_size) {
      channel.history.shift();
    }

    // Increment message counter
    const counter = this.message_counters.get(channelName) || 0;
    this.message_counters.set(channelName, counter + 1);
  }

  /**
   * Get channel history
   */
  getChannelHistory(channelName: string, sinceEventId?: string): SSEEvent[] {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return [];
    }

    if (!sinceEventId) {
      return [...channel.history];
    }

    // Find events since given ID
    const startIndex = channel.history.findIndex(e => e.id === sinceEventId);
    if (startIndex === -1) {
      return [...channel.history];
    }

    return channel.history.slice(startIndex + 1);
  }

  /**
   * Get channel statistics
   */
  getChannelStats(channelName: string): ChannelStats | null {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return null;
    }

    const now = Date.now();
    const uptime = Math.floor((now - channel.created_at) / 1000);
    const messages_sent = this.message_counters.get(channelName) || 0;
    const avg_message_size = this.calculateAverageMessageSize(channel);

    return {
      channel: channelName,
      clients: channel.clients.size,
      messages_sent,
      messages_per_second: uptime > 0 ? messages_sent / uptime : 0,
      avg_message_size,
      uptime,
    };
  }

  /**
   * Get all channel statistics
   */
  getAllChannelStats(): Record<string, ChannelStats> {
    const stats: Record<string, ChannelStats> = {};

    for (const channelName of this.channels.keys()) {
      const channelStats = this.getChannelStats(channelName);
      if (channelStats) {
        stats[channelName] = channelStats;
      }
    }

    return stats;
  }

  /**
   * Clear channel history
   */
  clearChannelHistory(channelName: string): boolean {
    const channel = this.getChannel(channelName);
    if (!channel) {
      return false;
    }

    channel.history = [];
    return true;
  }

  /**
   * Get total channel count
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Get total channels created
   */
  getTotalChannelsCreated(): number {
    return this.channel_counter;
  }

  /**
   * Cleanup empty channels
   */
  cleanupEmptyChannels(): number {
    let cleaned = 0;
    const toDelete: string[] = [];

    for (const [name, channel] of this.channels.entries()) {
      // Skip persistent channels
      if (channel.metadata.persistent) {
        continue;
      }

      // Delete empty channels
      if (channel.clients.size === 0) {
        toDelete.push(name);
      }
    }

    for (const name of toDelete) {
      this.deleteChannel(name);
      cleaned++;
    }

    return cleaned;
  }

  /**
   * Close all channels
   */
  closeAll(): void {
    this.stopCleanup();
    this.channels.clear();
    this.message_counters.clear();
    this.closed = true;
  }

  /**
   * Generate unique event ID for channel
   */
  private generateEventId(channelName: string): string {
    const timestamp = Date.now();
    const counter = this.message_counters.get(channelName) || 0;
    return `${channelName}_${timestamp}_${counter}`;
  }

  /**
   * Calculate average message size in channel
   */
  private calculateAverageMessageSize(channel: SSEChannel): number {
    if (channel.history.length === 0) {
      return 0;
    }

    const totalSize = channel.history.reduce((sum, event) => {
      return sum + JSON.stringify(event).length;
    }, 0);

    return Math.floor(totalSize / channel.history.length);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanup_interval || this.options.cleanup_interval <= 0) {
      return;
    }

    this.cleanup_interval = setInterval(() => {
      this.cleanupEmptyChannels();
    }, this.options.cleanup_interval);
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanup(): void {
    if (this.cleanup_interval) {
      clearInterval(this.cleanup_interval);
      this.cleanup_interval = null;
    }
  }
}
