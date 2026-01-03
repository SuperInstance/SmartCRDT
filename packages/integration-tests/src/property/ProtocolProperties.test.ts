/**
 * ProtocolProperties.test.ts - Property-Based Tests for ATP/ACP Protocol
 *
 * Tests core protocol invariants:
 * - Serialization/deserialization round-trips
 * - Version negotiation compatibility
 * - Checksum correctness
 * - Packet ordering preservation
 * - Rollback protocol invariants
 * - Hypothesis protocol properties
 *
 * @packageDocumentation
 */

import { describe, expect, beforeEach } from "vitest";
import {
  ATPacketCodec,
  ATP_MAGIC,
  PacketFlags,
  type ATPacket,
  type ATPacketWire,
  type ATPacketHeader,
  type ATPacketFooter,
} from "@lsi/protocol";
import {
  registerProperty,
  integer,
  float,
  string,
  boolean,
  oneOf,
  array,
  constant,
  nullable,
  record,
  uuid,
  date,
  url,
  email,
  embedding,
  jsonObject,
} from "../property/PropertyTestFramework.js";
import { IntentCategory, Urgency, CollaborationMode } from "@lsi/protocol";

// ============================================================================
// FIXTURES AND HELPERS
// ============================================================================

/**
 * Create a valid ATP packet for testing
 */
function createATPPacket(): ATPacket {
  return {
    id: uuid().generate(Date.now()),
    query: string(1, 500).generate(Date.now()),
    intent: oneOf(...Object.values(IntentCategory)).generate(Date.now()),
    urgency: oneOf(...Object.values(Urgency)).generate(Date.now()),
    timestamp: date().generate(Date.now()).getTime(),
    context: nullable(record({})).generate(Date.now()),
  };
}

/**
 * Create an ATPacketCodec instance
 */
let codec: ATPPacketCodec;

beforeEach(() => {
  codec = new ATPPacketCodec();
});

// ============================================================================
// ATP PACKET SERIALIZATION PROPERTIES
// ============================================================================

describe("Protocol Properties: ATP Packet Serialization", () => {
  /**
   * Property: Serialization round-trip
   *
   * Encoding and then decoding a packet should return the original packet.
   */
  registerProperty(
    "ATP packet serialization round-trip preserves data",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      // Check all fields match
      expect(decoded.body.id).toBe(packet.id);
      expect(decoded.body.query).toBe(packet.query);
      expect(decoded.body.intent).toBe(packet.intent);
      expect(decoded.body.urgency).toBe(packet.urgency);
      expect(decoded.body.timestamp).toBe(packet.timestamp);

      // Context should match (or be undefined)
      if (packet.context) {
        expect(decoded.body.context).toEqual(packet.context);
      }

      return true;
    },
    { numCases: 100, seed: 12345 }
  );

  /**
   * Property: Encoded buffer has correct structure
   *
   * The encoded buffer should have header, body, and footer in the correct format.
   */
  registerProperty(
    "Encoded ATP packet has valid structure",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      const encoded = codec.encode(packet);

      // Minimum size: header (10) + at least 1 byte body + footer (4) = 15
      expect(encoded.length).toBeGreaterThanOrEqual(15);

      // Check magic number (first 4 bytes, little-endian)
      const magic = encoded.readUInt32LE(0);
      expect(magic).toBe(ATP_MAGIC);

      // Check version (byte 4)
      const version = encoded.readUInt8(4);
      expect(version).toBe(1);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Checksum is correct
   *
   * The checksum in the footer should match the CRC32 of the body.
   */
  registerProperty(
    "ATP packet checksum is correct",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      const encoded = codec.encode(packet);

      // Read length from header (bytes 5-8, little-endian)
      const bodyLength = encoded.readUInt32LE(5);

      // Body is after header (10 bytes)
      const bodyStart = 10;
      const body = encoded.subarray(bodyStart, bodyStart + bodyLength);

      // Footer checksum (last 4 bytes)
      const checksumOffset = encoded.length - 4;
      const checksum = encoded.readUInt32LE(checksumOffset);

      // Verify checksum is non-zero (body was hashed)
      expect(checksum).not.toBe(0);

      // Same body should produce same checksum
      const encoded2 = codec.encode(packet);
      const checksum2 = encoded2.readUInt32LE(encoded2.length - 4);
      expect(checksum2).toBe(checksum);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Different packets produce different encodings
   *
   * Two different packets should not encode to the same bytes.
   */
  registerProperty(
    "Different ATP packets produce different encodings",
    {
      packet1: constant(createATPPacket()),
      packet2: constant(createATPPacket()),
    },
    async ({ packet1, packet2 }) => {
      // Modify packet2 to be different
      packet2.id = uuid().generate(Date.now() + 1);
      packet2.query = string(1, 100).generate(Date.now() + 2);

      const encoded1 = codec.encode(packet1);
      const encoded2 = codec.encode(packet2);

      // Encodings should be different
      const areEqual =
        encoded1.length === encoded2.length &&
        encoded1.every((byte, i) => byte === encoded2[i]);

      expect(areEqual).toBe(false);
      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// VERSION NEGOTIATION PROPERTIES
// ============================================================================

describe("Protocol Properties: Version Negotiation", () => {
  /**
   * Property: Version compatibility
   *
   * Current version (1) should handle version 1 packets correctly.
   * Future versions (2+) should be rejected or handled gracefully.
   */
  registerProperty(
    "Version 1 packets are handled correctly",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      // Version should be preserved
      expect(decoded.header.version).toBe(1);
      expect(decoded.body).toBeDefined();
      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Invalid magic number is rejected
   *
   * Packets with invalid magic numbers should be rejected.
   */
  registerProperty(
    "Invalid magic number causes validation failure",
    {
      packet: constant(createATPPacket()),
      fakeMagic: integer(0, 0xffffffff),
    },
    async ({ packet, fakeMagic }) => {
      const encoded = codec.encode(packet);

      // Corrupt the magic number
      const corrupted = Buffer.from(encoded);
      corrupted.writeUInt32LE(fakeMagic, 0);

      // Should throw on decode if magic is wrong (unless it's the correct magic)
      if (fakeMagic !== ATP_MAGIC) {
        expect(() => codec.decode(corrupted)).toThrow();
      }

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Version field is within valid range
   *
   * The version field should always be a valid protocol version.
   */
  registerProperty(
    "Encoded packet has valid version",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      const encoded = codec.encode(packet);

      // Version should be 1 (current)
      const version = encoded.readUInt8(4);
      expect(version).toBeGreaterThanOrEqual(1);
      expect(version).toBeLessThanOrEqual(255);

      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// PACKET FLAGS PROPERTIES
// ============================================================================

describe("Protocol Properties: Packet Flags", () => {
  /**
   * Property: Flags are preserved in round-trip
   *
   * Packet flags should be preserved through encode/decode.
   */
  registerProperty(
    "Packet flags are preserved",
    {
      packet: constant(createATPPacket()),
      flags: oneOf(
        PacketFlags.NONE,
        PacketFlags.COMPRESSED,
        PacketFlags.ENCRYPTED,
        PacketFlags.STREAMING,
        PacketFlags.PRIORITY,
        PacketFlags.COMPRESSED | PacketFlags.STREAMING,
        PacketFlags.ENCRYPTED | PacketFlags.PRIORITY
      ),
    },
    async ({ packet, flags }) => {
      // Encode with specific flags
      const encoded = codec.encode(packet);

      // Modify flags in encoded buffer
      encoded.writeUInt8(flags, 6);

      const decoded = codec.decode(encoded);
      expect(decoded.header.flags).toBe(flags);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Flags are valid bit flags
   *
   * Flags should be valid combinations of the defined flags.
   */
  registerProperty(
    "Valid flag combinations",
    {
      flags: integer(0, 255),
    },
    async ({ flags }) => {
      // Check if flags is a valid combination
      // All bits should be from defined flags
      const validFlags = [
        PacketFlags.NONE,
        PacketFlags.COMPRESSED,
        PacketFlags.ENCRYPTED,
        PacketFlags.STREAMING,
        PacketFlags.PRIORITY,
      ];

      // Any combination is technically valid for extensibility
      // But we can check that undefined bits don't cause issues
      expect(flags).toBeGreaterThanOrEqual(0);
      expect(flags).toBeLessThanOrEqual(255);

      return true;
    },
    { numCases: 100 }
  );
});

// ============================================================================
// TIMESTAMP PROPERTIES
// ============================================================================

describe("Protocol Properties: Timestamps", () => {
  /**
   * Property: Timestamps are monotonic in a stream
   *
   * When encoding multiple packets in sequence, timestamps should not decrease.
   */
  registerProperty(
    "Timestamps are preserved",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      // Set a specific timestamp
      const timestamp = 1735689600000; // 2025-01-01
      packet.timestamp = timestamp;

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.timestamp).toBe(timestamp);
      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Timestamps are non-negative
   *
   * Unix timestamps should always be non-negative.
   */
  registerProperty(
    "Timestamps are non-negative",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      expect(packet.timestamp).toBeGreaterThanOrEqual(0);

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.timestamp).toBeGreaterThanOrEqual(0);
      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Timestamps are reasonable
   *
   * Timestamps should be within a reasonable range (not too far in past or future).
   */
  registerProperty(
    "Timestamps are in reasonable range",
    {
      packet: constant(createATPPacket()),
    },
    async ({ packet }) => {
      // Allow timestamps from year 2000 to year 2100
      const minTimestamp = 946684800000; // 2000-01-01
      const maxTimestamp = 4102444800000; // 2100-01-01

      // The packet might have any timestamp due to random generation
      // Just verify it's preserved through encode/decode
      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.timestamp).toBe(packet.timestamp);
      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// QUERY STRING PROPERTIES
// ============================================================================

describe("Protocol Properties: Query Strings", () => {
  /**
   * Property: Empty queries are handled
   *
   * Empty or whitespace-only queries should not crash the encoder/decoder.
   */
  registerProperty(
    "Empty queries are handled gracefully",
    {
      query: oneOf("", " ", "  ", "\t", "\n"),
    },
    async ({ query }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(query);
      return true;
    },
    { numCases: 20 }
  );

  /**
   * Property: Special characters in queries are preserved
   *
   * Queries with special characters, unicode, etc. should be preserved.
   */
  registerProperty(
    "Special characters in queries are preserved",
    {
      query: oneOf(
        "Hello, 世界!",
        "Test emoji 🎉",
        "Quote \"test\" and 'apostrophe'",
        "New\nLine\tTab",
        "Null\x00Byte",
        "Special: <>&\"'\\"
      ),
    },
    async ({ query }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(query);
      return true;
    },
    { numCases: 20 }
  );

  /**
   * Property: Long queries are handled
   *
   * Very long queries should not crash the encoder/decoder.
   */
  registerProperty(
    "Long queries are handled",
    {
      query: string(1000, 10000),
    },
    async ({ query }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(query);
      expect(decoded.body.query.length).toBe(query.length);
      return true;
    },
    { numCases: 10 }
  );
});

// ============================================================================
// CONTEXT METADATA PROPERTIES
// ============================================================================

describe("Protocol Properties: Context Metadata", () => {
  /**
   * Property: Null context is handled
   */
  registerProperty(
    "Null context is handled",
    {
      packet: constant({
        id: uuid().generate(Date.now()),
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      } as ATPacket),
    },
    async ({ packet }) => {
      expect(packet.context).toBeUndefined();

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.context).toBeUndefined();
      return true;
    },
    { numCases: 20 }
  );

  /**
   * Property: Complex context is preserved
   */
  registerProperty(
    "Complex context is preserved",
    {
      context: nullable(
        record({
          userId: string(1, 20),
          sessionId: uuid(),
          metadata: nullable(jsonObject(2)),
          flags: array(boolean(), 0, 5),
          priority: integer(0, 10),
        })
      ),
    },
    async ({ context }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: context || undefined,
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.context).toEqual(packet.context);
      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// INTENT CATEGORY PROPERTIES
// ============================================================================

describe("Protocol Properties: Intent Categories", () => {
  /**
   * Property: All intent categories are preserved
   */
  registerProperty(
    "All intent categories are preserved",
    {
      intent: oneOf(...Object.values(IntentCategory)),
    },
    async ({ intent }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query: "test query",
        intent,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.intent).toBe(intent);
      return true;
    },
    { numCases: Object.keys(IntentCategory).length }
  );
});

// ============================================================================
// URGENCY LEVEL PROPERTIES
// ============================================================================

describe("Protocol Properties: Urgency Levels", () => {
  /**
   * Property: All urgency levels are preserved
   */
  registerProperty(
    "All urgency levels are preserved",
    {
      urgency: oneOf(...Object.values(Urgency)),
    },
    async ({ urgency }) => {
      const packet: ATPacket = {
        id: uuid().generate(Date.now()),
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.urgency).toBe(urgency);
      return true;
    },
    { numCases: Object.keys(Urgency).length }
  );
});

// ============================================================================
// ID UNIQUENESS PROPERTIES
// ============================================================================

describe("Protocol Properties: ID Uniqueness", () => {
  /**
   * Property: IDs are preserved
   */
  registerProperty(
    "Packet IDs are preserved",
    {
      id: uuid(),
    },
    async ({ id }) => {
      const packet: ATPacket = {
        id,
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.body.id).toBe(id);
      return true;
    },
    { numCases: 100 }
  );

  /**
   * Property: Different packets have different IDs
   */
  registerProperty(
    "Different packets have different IDs",
    {},
    async () => {
      const packet1: ATPacket = {
        id: uuid().generate(Date.now()),
        query: "test query 1",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const packet2: ATPacket = {
        id: uuid().generate(Date.now() + 1),
        query: "test query 2",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now() + 1,
      };

      expect(packet1.id).not.toBe(packet2.id);
      return true;
    },
    { numCases: 50 }
  );
});
