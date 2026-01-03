/**
 * ATP Packet Format - Wire format for autonomous task processing
 *
 * This module implements the binary wire format for ATP (Autonomous Task Processing) packets.
 * ATP packets are used to transmit single-model query requests between distributed components
 * of the Aequor Cognitive Orchestration Platform.
 *
 * Packet Structure:
 * - Header: Magic (4) + Version (1) + Flags (1) + Length (4) = 10 bytes
 * - Body: JSON-encoded ATPacket
 * - Footer: Checksum (4)
 *
 * The wire format enables:
 * - Efficient binary transmission
 * - Streaming support for large payloads
 * - Data integrity validation via CRC32
 * - Forward compatibility via version negotiation
 */

import type { ATPacket } from "./atp-acp.js";
import type { ValidationResult } from "./validation.js";

/**
 * Magic number for ATP packets (0x41545054 = "ATPT" in ASCII)
 *
 * This magic number is used to validate that incoming data is indeed an ATP packet
 * and not corrupted or from an incompatible protocol.
 */
export const ATP_MAGIC = 0x41545054;

/**
 * ATP packet header structure (10 bytes)
 *
 * The header provides metadata about the packet and enables streaming
 * by declaring the body length upfront.
 */
export interface ATPPacketHeader {
  /** Magic number for validation (0x41545054) */
  magic: number;
  /** Protocol version (currently 1) */
  version: number;
  /** Packet flags (compression, encryption, etc.) */
  flags: PacketFlags;
  /** Body length in bytes */
  length: number;
}

/**
 * Packet flags for special processing
 *
 * Flags enable optional features while maintaining backward compatibility.
 * Packets with unknown flags should be rejected to prevent misprocessing.
 */
export enum PacketFlags {
  /** No special flags */
  NONE = 0,
  /** Body is gzip compressed (not yet implemented) */
  COMPRESSED = 1 << 0,
  /** Body is encrypted (not yet implemented) */
  ENCRYPTED = 1 << 1,
  /** Streaming response expected */
  STREAMING = 1 << 2,
  /** Priority request (expedited processing) */
  PRIORITY = 1 << 3,
}

/**
 * ATP packet footer structure (4 bytes)
 *
 * The footer provides data integrity verification via CRC32 checksum.
 */
export interface ATPPacketFooter {
  /** CRC32 checksum of body */
  checksum: number;
}

/**
 * Complete ATP packet in wire format
 *
 * This represents a fully-decoded packet with header, body, and footer.
 */
export interface ATPacketWire {
  /** Decoded header */
  header: ATPPacketHeader;
  /** Parsed ATPacket body */
  body: ATPacket;
  /** Decoded footer */
  footer: ATPPacketFooter;
}

/**
 * ATPPacketCodec - Encode/Decode ATP packets
 *
 * This class provides methods to convert between ATPacket objects and their
 * binary wire format representation. It handles serialization, deserialization,
 * validation, and checksum calculation.
 *
 * Usage:
 * ```typescript
 * const codec = new ATPPacketCodec();
 *
 * // Encode
 * const packet: ATPacket = { id: '123', query: 'test', ... };
 * const buffer = codec.encode(packet);
 *
 * // Decode
 * const decoded = codec.decode(buffer);
 * console.log(decoded.body); // Original ATPacket
 *
 * // Validate
 * const result = codec.validate(packet);
 * if (!result.valid) {
 *   console.error('Invalid packet:', result.errors);
 * }
 * ```
 */
export class ATPPacketCodec {
  /**
   * Encode ATPacket to wire format
   *
   * Serializes an ATPacket to a binary buffer with header, JSON body, and footer.
   *
   * @param packet - ATPacket to encode
   * @returns Uint8Array containing complete wire format
   *
   * @example
   * ```typescript
   * const codec = new ATPPacketCodec();
   * const buffer = codec.encode({
   *   id: 'req-123',
   *   query: 'What is AI?',
   *   intent: IntentCategory.QUERY,
   *   urgency: Urgency.NORMAL,
   *   timestamp: Date.now()
   * });
   * ```
   */
  encode(packet: ATPacket): Uint8Array {
    // 1. Serialize body to JSON
    const bodyJson = JSON.stringify(packet);
    const bodyBytes = new TextEncoder().encode(bodyJson);

    // 2. Calculate checksum
    const checksum = this.calculateChecksum(bodyBytes);

    // 3. Create header
    const header: ATPPacketHeader = {
      magic: ATP_MAGIC,
      version: 1,
      flags: PacketFlags.NONE,
      length: bodyBytes.length,
    };

    // 4. Serialize to binary
    const buffer = new ArrayBuffer(
      10 + // header
        bodyBytes.length +
        4 // footer
    );

    const view = new DataView(buffer);
    let offset = 0;

    // Header (10 bytes)
    view.setUint32(offset, header.magic, false);
    offset += 4; // Big-endian
    view.setUint8(offset, header.version);
    offset += 1;
    view.setUint8(offset, header.flags);
    offset += 1;
    view.setUint32(offset, header.length, false);
    offset += 4; // Big-endian

    // Body (variable length)
    new Uint8Array(buffer, offset, bodyBytes.length).set(bodyBytes);
    offset += bodyBytes.length;

    // Footer (4 bytes)
    view.setUint32(offset, checksum, false); // Big-endian

    return new Uint8Array(buffer);
  }

  /**
   * Decode wire format to ATPacketWire
   *
   * Deserializes a binary buffer to its component parts, validating magic,
   * version, and checksum along the way.
   *
   * @param buffer - Uint8Array containing wire format
   * @returns ATPacketWire with decoded header, body, and footer
   * @throws Error if magic number, version, or checksum is invalid
   *
   * @example
   * ```typescript
   * const codec = new ATPPacketCodec();
   * const decoded = codec.decode(buffer);
   * console.log(decoded.body.query); // Original query
   * ```
   */
  decode(buffer: Uint8Array): ATPacketWire {
    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    let offset = 0;

    // Minimum header size is 10 bytes
    if (buffer.length < 10) {
      throw new Error(
        `Buffer too small for header: ${buffer.length} bytes, need at least 10`
      );
    }

    // Header (10 bytes)
    const magic = view.getUint32(offset, false);
    offset += 4;
    const version = view.getUint8(offset);
    offset += 1;
    const flags = view.getUint8(offset);
    offset += 1;
    const length = view.getUint32(offset, false);
    offset += 4;

    const header: ATPPacketHeader = {
      magic,
      version,
      flags,
      length,
    };

    // Validate magic number
    if (header.magic !== ATP_MAGIC) {
      throw new Error(
        `Invalid magic number: 0x${header.magic.toString(16).padStart(8, "0")}, ` +
          `expected 0x${ATP_MAGIC.toString(16).padStart(8, "0")} ('ATPT')`
      );
    }

    // Validate version
    if (header.version !== 1) {
      throw new Error(
        `Unsupported version: ${header.version}, supported versions: [1]`
      );
    }

    // Validate we have enough data for body + footer
    if (buffer.length < 10 + header.length + 4) {
      throw new Error(
        `Buffer too small for declared body length: ` +
          `expected ${10 + header.length + 4} bytes, got ${buffer.length}`
      );
    }

    // Body (variable length)
    const bodyBytes = buffer.slice(offset, offset + header.length);
    offset += header.length;

    let body: ATPacket;
    try {
      const bodyJson = new TextDecoder().decode(bodyBytes);
      body = JSON.parse(bodyJson) as ATPacket;
    } catch (e) {
      throw new Error(
        `Failed to parse body JSON: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    // Footer (4 bytes)
    const checksum = view.getUint32(offset, false);
    const footer: ATPPacketFooter = { checksum };

    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(bodyBytes);
    if (checksum !== calculatedChecksum) {
      throw new Error(
        `Checksum mismatch: expected 0x${calculatedChecksum.toString(16).padStart(8, "0")}, ` +
          `got 0x${checksum.toString(16).padStart(8, "0")} (data may be corrupted)`
      );
    }

    return { header, body, footer };
  }

  /**
   * Calculate CRC32 checksum
   *
   * Uses the standard CRC32 algorithm (IEEE 802.3 polynomial)
   * for data integrity verification.
   *
   * @param data - Data to checksum
   * @returns CRC32 checksum value
   *
   * @private
   */
  private calculateChecksum(data: Uint8Array): number {
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get total packet size from buffer
   *
   * Useful for streaming to determine how many bytes to read
   * before attempting to decode a complete packet.
   *
   * @param buffer - Buffer containing at least header (10 bytes)
   * @returns Total packet size in bytes
   * @throws Error if buffer is too small
   *
   * @example
   * ```typescript
   * const codec = new ATPPacketCodec();
   * const packetSize = codec.getPacketSize(incomingBuffer);
   * if (incomingBuffer.length >= packetSize) {
   *   const decoded = codec.decode(incomingBuffer);
   * }
   * ```
   */
  getPacketSize(buffer: Uint8Array): number {
    if (buffer.length < 10) {
      throw new Error(
        `Buffer too small to read packet size: ${buffer.length} bytes, need at least 10`
      );
    }

    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const length = view.getUint32(8, false); // Body length is at offset 8
    return 10 + length + 4; // header + body + footer
  }

  /**
   * Validate an ATPacket
   *
   * Performs comprehensive validation of an ATPacket to ensure it conforms
   * to the protocol specification. This includes checking required fields,
   * types, enum values, ranges, and timestamps.
   *
   * Note: This method dynamically imports the ProtocolValidator to avoid
   * circular dependencies. For better performance in hot loops, create
   * a ProtocolValidator instance separately.
   *
   * @param packet - ATPacket to validate
   * @returns Validation result with errors and warnings
   * @throws Error if validation module is not available
   *
   * @example
   * ```typescript
   * const codec = new ATPPacketCodec();
   * const result = codec.validate(packet);
   * if (!result.valid) {
   *   console.error('Validation failed:', result.errors);
   *   for (const error of result.errors) {
   *     console.error(`  ${error.field}: ${error.message}`);
   *   }
   * }
   * ```
   */
  async validate(packet: ATPacket): Promise<ValidationResult> {
    // Dynamic import to avoid circular dependency
    const { ProtocolValidator } = await import("./validation.js");
    const validator = new ProtocolValidator();
    return validator.validateATPacket(packet);
  }
}

/**
 * ATPPacketStream - Stream-based packet codec
 *
 * This class handles streaming scenarios where data arrives in chunks.
 * It maintains an internal buffer and extracts complete packets as they arrive.
 *
 * Useful for:
 * - WebSocket communication
 * - TCP streams
 * - File-based streaming
 *
 * Usage:
 * ```typescript
 * const stream = new ATPPacketStream();
 *
 * // Feed data as it arrives
 * stream.feed(chunk1);
 * stream.feed(chunk2);
 *
 * // Extract complete packets
 * const packets = stream.decode();
 * for (const packet of packets) {
 *   console.log(packet.body.query);
 * }
 * ```
 */
export class ATPPacketStream {
  private codec = new ATPPacketCodec();
  private buffer: Uint8Array = new Uint8Array(0);

  /**
   * Feed data to the stream buffer
   *
   * Appends incoming data to the internal buffer. Complete packets
   * can then be extracted using decode().
   *
   * @param data - Data chunk to add to buffer
   *
   * @example
   * ```typescript
   * const stream = new ATPPacketStream();
   * socket.on('data', (chunk) => {
   *   stream.feed(chunk);
   *   const packets = stream.decode();
   *   // Process packets...
   * });
   * ```
   */
  feed(data: Uint8Array): void {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
  }

  /**
   * Try to decode complete packets from buffer
   *
   * Extracts as many complete packets as possible from the internal buffer.
   * Incomplete packet data remains buffered for the next call.
   *
   * @returns Array of complete packets (may be empty)
   *
   * @example
   * ```typescript
   * const stream = new ATPPacketStream();
   * stream.feed(data);
   *
   * const packets = stream.decode();
   * for (const { header, body } of packets) {
   *   console.log(`Decoded packet: ${body.id}`);
   * }
   * ```
   */
  decode(): ATPacketWire[] {
    const packets: ATPacketWire[] = [];

    while (this.buffer.length >= 10) {
      // Minimum header size
      // Check if we have a complete packet
      try {
        const view = new DataView(
          this.buffer.buffer,
          this.buffer.byteOffset,
          this.buffer.byteLength
        );

        // Verify magic number before reading length
        const magic = view.getUint32(0, false);
        if (magic !== ATP_MAGIC) {
          // Invalid magic - clear buffer to prevent infinite loop
          this.buffer = new Uint8Array(0);
          throw new Error(
            `Invalid magic number in stream: 0x${magic.toString(16).padStart(8, "0")}, ` +
              `expected 0x${ATP_MAGIC.toString(16).padStart(8, "0")} ('ATPT'). ` +
              `Buffer cleared.`
          );
        }

        const bodyLength = view.getUint32(8, false);
        const packetSize = 10 + bodyLength + 4;

        if (this.buffer.length < packetSize) {
          // Not enough data yet - wait for more
          break;
        }

        // Decode packet
        const packetData = this.buffer.slice(0, packetSize);
        const packet = this.codec.decode(packetData);
        packets.push(packet);

        // Remove packet from buffer
        this.buffer = this.buffer.slice(packetSize);
      } catch (e) {
        // If we can't decode, clear buffer to prevent infinite loop
        this.buffer = new Uint8Array(0);
        throw e;
      }
    }

    return packets;
  }

  /**
   * Get current buffer size
   *
   * Useful for monitoring and debugging streaming state.
   *
   * @returns Number of bytes currently buffered
   *
   * @example
   * ```typescript
   * console.log(`Buffered ${stream.getBufferSize()} bytes`);
   * ```
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear the internal buffer
   *
   * Useful for error recovery or connection reset.
   *
   * @example
   * ```typescript
   * socket.on('error', () => {
   *   stream.clear();
   * });
   * ```
   */
  clear(): void {
    this.buffer = new Uint8Array(0);
  }

  /**
   * Get buffered data without consuming it
   *
   * Useful for debugging or inspection.
   *
   * @returns Copy of current buffer
   */
  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
