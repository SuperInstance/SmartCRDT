/**
 * MessageParser - Parse SSE (Server-Sent Events) format
 *
 * Handles parsing of SSE wire format:
 * - Lines starting with "data:" are data fields
 * - Lines starting with "event:" are event types
 * - Lines starting with "id:" are event IDs
 * - Lines starting with "retry:" set retry delay
 * - Empty lines dispatch the current event
 */

import type { SSELine, SSEEventBlock, SSEMessage } from "./types.js";

/**
 * Parse SSE wire format into messages
 */
export class MessageParser {
  private lastEventId = "";

  /**
   * Parse SSE stream content into messages
   * @param raw Raw SSE stream content
   * @param origin Origin URL of the stream
   * @returns Array of parsed messages
   */
  parse(raw: string, origin: string): SSEMessage[] {
    const lines = this.splitLines(raw);
    const blocks = this.groupIntoBlocks(lines);
    return this.convertBlocksToMessages(blocks, origin);
  }

  /**
   * Parse a single SSE line
   * @param line Single line from SSE stream
   * @returns Parsed line
   */
  parseLine(line: string, lineNum: number): SSELine {
    const trimmed = line.trim();

    // Ignore empty lines (they dispatch events, handled in groupIntoBlocks)
    if (trimmed === "") {
      return { field: null, value: "", line: lineNum };
    }

    // Ignore comment lines (start with :)
    if (trimmed.startsWith(":")) {
      return {
        field: "comment",
        value: trimmed.slice(1).trim(),
        line: lineNum,
      };
    }

    // Parse field:value
    const colonIndex = trimmed.indexOf(":");

    if (colonIndex === 0) {
      // Line starts with colon but no field name - treat as data per spec
      return {
        field: "data",
        value: trimmed.slice(1).trimStart(),
        line: lineNum,
      };
    }

    if (colonIndex === -1) {
      // No colon - entire line is field name with empty value
      return { field: trimmed, value: "", line: lineNum };
    }

    // Normal field:value
    const field = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trimStart();

    return { field, value, line: lineNum };
  }

  /**
   * Split raw content into lines
   * @param raw Raw SSE content
   * @returns Array of lines
   */
  splitLines(raw: string): string[] {
    // Handle both \n and \r\n line endings
    return raw.split(/\r?\n/);
  }

  /**
   * Group lines into event blocks (separated by empty lines)
   * @param lines Array of lines
   * @returns Array of event blocks
   */
  groupIntoBlocks(lines: string[]): SSEEventBlock[] {
    const blocks: SSEEventBlock[] = [];
    let currentBlock: Partial<SSEEventBlock> = {
      event: "message",
      data: "",
      id: null,
      retry: null,
    };
    let dataLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = this.parseLine(line, i);

      // Empty line dispatches current event
      if (parsed.field === null && parsed.value === "") {
        if (dataLines.length > 0 || currentBlock.event !== "message") {
          blocks.push({
            event: currentBlock.event || "message",
            data: dataLines.join("\n"),
            id: currentBlock.id || null,
            retry: currentBlock.retry || null,
          });
        }

        // Reset for next event
        currentBlock = {
          event: "message",
          data: "",
          id: null,
          retry: null,
        };
        dataLines = [];
        continue;
      }

      // Ignore comments
      if (parsed.field === "comment") {
        continue;
      }

      // Process field
      switch (parsed.field) {
        case "event":
          currentBlock.event = parsed.value || "message";
          break;

        case "data":
          dataLines.push(parsed.value);
          break;

        case "id":
          // Only set if non-empty (per spec)
          if (parsed.value) {
            currentBlock.id = parsed.value;
            this.lastEventId = parsed.value;
          }
          break;

        case "retry":
          // Parse retry delay (integer in ms)
          const retryMs = parseInt(parsed.value, 10);
          if (!isNaN(retryMs) && retryMs >= 0) {
            currentBlock.retry = retryMs;
          }
          break;

        default:
          // Unknown fields - ignore per spec
          break;
      }
    }

    // Handle last block if not terminated by empty line
    if (dataLines.length > 0 || currentBlock.event !== "message") {
      blocks.push({
        event: currentBlock.event || "message",
        data: dataLines.join("\n"),
        id: currentBlock.id || null,
        retry: currentBlock.retry || null,
      });
    }

    return blocks;
  }

  /**
   * Convert event blocks to SSE messages
   * @param blocks Event blocks
   * @param origin Origin URL
   * @returns Array of SSE messages
   */
  convertBlocksToMessages(
    blocks: SSEEventBlock[],
    origin: string
  ): SSEMessage[] {
    const messages: SSEMessage[] = [];

    for (const block of blocks) {
      const message: SSEMessage = {
        id: block.id || this.lastEventId || null,
        event: block.event,
        data: block.data,
        origin,
        timestamp: Date.now(),
      };

      // Try to parse data as JSON
      if (block.data) {
        try {
          message.json = JSON.parse(block.data);
        } catch {
          // Not JSON - leave undefined
        }
      }

      messages.push(message);
    }

    return messages;
  }

  /**
   * Parse a single complete SSE message
   * @param data Message data string
   * @param event Event type (default 'message')
   * @param id Message ID
   * @param origin Origin URL
   * @returns Parsed SSE message
   */
  parseMessage(
    data: string,
    event = "message",
    id: string | null = null,
    origin: string
  ): SSEMessage {
    const message: SSEMessage = {
      id,
      event,
      data,
      origin,
      timestamp: Date.now(),
    };

    // Try to parse as JSON
    try {
      message.json = JSON.parse(data);
    } catch {
      // Not JSON
    }

    return message;
  }

  /**
   * Validate SSE message format
   * @param message Message to validate
   * @returns True if valid
   */
  validateMessage(message: SSEMessage): boolean {
    // Must have data, event, and origin
    if (!message.data || typeof message.data !== "string") {
      return false;
    }

    if (!message.event || typeof message.event !== "string") {
      return false;
    }

    if (!message.origin || typeof message.origin !== "string") {
      return false;
    }

    // Timestamp must be a valid number
    if (typeof message.timestamp !== "number" || message.timestamp <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Get the last event ID
   * @returns Last event ID
   */
  getLastEventId(): string {
    return this.lastEventId;
  }

  /**
   * Reset the last event ID
   */
  resetLastEventId(): void {
    this.lastEventId = "";
  }

  /**
   * Check if a string is valid JSON
   * @param str String to check
   * @returns True if valid JSON
   */
  isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely parse JSON with fallback
   * @param str String to parse
   * @param fallback Fallback value if parsing fails
   * @returns Parsed object or fallback
   */
  safeJSONParse<T>(str: string, fallback: T): T {
    try {
      return JSON.parse(str) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Escape special characters in SSE data
   * @param data Raw data
   * @returns Escaped data
   */
  escapeData(data: string): string {
    // SSE doesn't require escaping, but newlines need special handling
    // Multi-line data should use multiple data: lines
    return data;
  }

  /**
   * Format data for SSE transmission
   * @param data Raw data
   * @returns Formatted SSE data lines
   */
  formatData(data: string): string[] {
    // Split on newlines and prefix each line with "data:"
    const lines = data.split("\n");
    return lines.map(line => `data:${line}`);
  }

  /**
   * Build SSE event string for sending
   * @param event Event type
   * @param data Event data
   * @param id Event ID (optional)
   * @param retry Retry delay (optional)
   * @returns Formatted SSE event string
   */
  buildEvent(event: string, data: string, id?: string, retry?: number): string {
    const lines: string[] = [];

    // Event type
    if (event && event !== "message") {
      lines.push(`event:${event}`);
    }

    // Data lines
    lines.push(...this.formatData(data));

    // Event ID
    if (id) {
      lines.push(`id:${id}`);
    }

    // Retry delay
    if (retry !== undefined && retry >= 0) {
      lines.push(`retry:${retry}`);
    }

    // Empty line to terminate event
    lines.push("");

    return lines.join("\n");
  }
}

/**
 * Default singleton instance
 */
export const defaultParser = new MessageParser();
