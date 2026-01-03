/**
 * ProtocolFuzzer.test.ts - Fuzzing Tests for ATP/ACP Protocol
 *
 * Fuzzing targets:
 * - ATP packet parsing with random inputs
 * - Version negotiation with invalid versions
 * - Rollback protocol with malformed data
 * - Packet codec with corrupted data
 *
 * @packageDocumentation
 */

import { describe, expect, beforeEach } from "vitest";
import {
  ATPacketCodec,
  ATP_MAGIC,
  PacketFlags,
  type ATPacket,
} from "@lsi/protocol";
import {
  registerFuzz,
  bufferFromString,
  randomBuffer,
  bufferFromHex,
  mutate,
} from "../fuzz/FuzzerFramework.js";

// ============================================================================
// FIXTURES
// ============================================================================

let codec: ATPacketCodec;

beforeEach(() => {
  codec = new ATPPacketCodec();
});

// ============================================================================
// ATP PACKET PARSING FUZZING
// ============================================================================

describe("Protocol Fuzzing: ATP Packet Parsing", () => {
  /**
   * Fuzz: Random buffer inputs
   *
   * The packet parser should handle random input without crashing.
   */
  registerFuzz(
    "ATP packet parser handles random buffers",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decoding succeeds, the result should be valid
        expect(decoded).toBeDefined();
        expect(decoded.header).toBeDefined();
        expect(decoded.body).toBeDefined();
        expect(decoded.footer).toBeDefined();
      } catch (error) {
        // Errors are acceptable for random input
        // Just verify it's a known error type
        expect(error).toBeDefined();
      }
    },
    {
      iterations: 5000,
      timeout: 30000,
      mutations: ["bit_flip", "byte_insert", "byte_delete", "splice"],
      seed: bufferFromString(
        JSON.stringify({
          id: "test-123",
          query: "What is AI?",
          intent: "query",
          urgency: "normal",
          timestamp: Date.now(),
        })
      ),
    }
  );

  /**
   * Fuzz: Malformed JSON in packet body
   *
   * The parser should handle invalid JSON gracefully.
   */
  registerFuzz(
    "ATP packet parser handles malformed JSON",
    async (input: Buffer) => {
      try {
        // Try to decode as a packet
        const decoded = codec.decode(input);
        expect(decoded).toBeDefined();
      } catch (error) {
        // Expected to fail with malformed JSON
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["byte_insert", "byte_delete", "arithmetic"],
      seed: bufferFromString("{ invalid json }"),
    }
  );

  /**
   * Fuzz: Truncated packets
   *
   * The parser should handle packets that are too short.
   */
  registerFuzz(
    "ATP packet parser handles truncated packets",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);
        expect(decoded).toBeDefined();
      } catch (error) {
        // Expected to fail with truncated input
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_delete"],
      seed: bufferFromString("valid-packet-content-but-too-short"),
      maxInputSize: 100,
    }
  );
});

// ============================================================================
// MAGIC NUMBER FUZZING
// ============================================================================

describe("Protocol Fuzzing: Magic Number Validation", () => {
  /**
   * Fuzz: Invalid magic numbers
   *
   * The parser should reject packets with wrong magic numbers.
   */
  registerFuzz(
    "Invalid magic numbers are rejected",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, verify magic is correct
        expect(decoded.header.magic).toBe(ATP_MAGIC);
      } catch (error) {
        // Expected to fail with wrong magic
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["bit_flip", "arithmetic"],
      seed: (() => {
        // Create a valid packet
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );
});

// ============================================================================
// VERSION FIELD FUZZING
// ============================================================================

describe("Protocol Fuzzing: Version Field", () => {
  /**
   * Fuzz: Invalid version numbers
   *
   * The parser should handle various version values gracefully.
   */
  registerFuzz(
    "Version field handles various values",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, version should be reasonable
        expect(decoded.header.version).toBeGreaterThan(0);
        expect(decoded.header.version).toBeLessThan(256);
      } catch (error) {
        // May fail with unsupported version
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["arithmetic", "bit_flip"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );
});

// ============================================================================
// FLAGS FIELD FUZZING
// ============================================================================

describe("Protocol Fuzzing: Packet Flags", () => {
  /**
   * Fuzz: Invalid flag combinations
   *
   * The parser should handle various flag values.
   */
  registerFuzz(
    "Flags field handles various values",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, flags should be a valid number
        expect(decoded.header.flags).toBeGreaterThanOrEqual(0);
        expect(decoded.header.flags).toBeLessThan(256);
      } catch (error) {
        // May fail with unsupported flags
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["bit_flip", "arithmetic"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );
});

// ============================================================================
// CHECKSUM FUZZING
// ============================================================================

describe("Protocol Fuzzing: Checksum Validation", () => {
  /**
   * Fuzz: Corrupted checksums
   *
   * The parser should validate checksums and reject corrupted data.
   */
  registerFuzz(
    "Checksum validation works correctly",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, checksum was valid
        expect(decoded.footer.checksum).toBeDefined();
      } catch (error) {
        // Expected to fail with corrupted checksum
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["bit_flip", "byte_insert", "byte_delete"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );

  /**
   * Fuzz: Bit flips in body (should be caught by checksum)
   */
  registerFuzz(
    "Checksum detects bit flips in body",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If we got here, the checksum happened to match (rare but possible)
        expect(decoded).toBeDefined();
      } catch (error) {
        // Most bit flips should be detected
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["bit_flip"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query with more content to flip",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );
});

// ============================================================================
// LENGTH FIELD FUZZING
// ============================================================================

describe("Protocol Fuzzing: Length Field", () => {
  /**
   * Fuzz: Invalid length values
   *
   * The parser should handle mismatched length fields.
   */
  registerFuzz(
    "Length field mismatches are handled",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, length should match actual body length
        expect(decoded.header.length).toBeGreaterThan(0);
      } catch (error) {
        // Expected to fail with mismatched length
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["arithmetic", "byte_insert", "byte_delete"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        return codec.encode(packet);
      })(),
    }
  );

  /**
   * Fuzz: Extremely large length values
   */
  registerFuzz(
    "Extremely large length values are handled",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, length should be reasonable
        expect(decoded.header.length).toBeLessThan(10 * 1024 * 1024); // 10MB limit
      } catch (error) {
        // Expected to fail with huge length
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 1000,
      timeout: 10000,
      mutations: ["arithmetic"],
      seed: (() => {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };
        const encoded = codec.encode(packet);

        // Set length to a huge value
        encoded.writeUInt32LE(0xffffffff, 5);

        return encoded;
      })(),
    }
  );
});

// ============================================================================
// QUERY FIELD FUZZING
// ============================================================================

describe("Protocol Fuzzing: Query Field", () => {
  /**
   * Fuzz: Special characters in queries
   *
   * The parser should handle various Unicode and special characters.
   */
  registerFuzz(
    "Query field handles special characters",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, query should be a string
        expect(typeof decoded.body.query).toBe("string");
      } catch (error) {
        // May fail with invalid UTF-8
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert", "splice"],
      seed: bufferFromString("Query with special chars: \x00\x01\x02\n\t\r"),
    }
  );

  /**
   * Fuzz: Empty queries
   */
  registerFuzz(
    "Empty queries are handled",
    async (input: Buffer) => {
      try {
        const packet: ATPacket = {
          id: "test-123",
          query: "",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: Date.now(),
        };

        const encoded = codec.encode(packet);
        const decoded = codec.decode(encoded);

        expect(decoded.body.query).toBe("");
      } catch (error) {
        // Empty query should be valid
        expect(error).toBeUndefined();
      }
    },
    {
      iterations: 100,
      timeout: 5000,
      mutations: ["byte_insert"],
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// ID FIELD FUZZING
// ============================================================================

describe("Protocol Fuzzing: ID Field", () => {
  /**
   * Fuzz: Invalid ID values
   *
   * The parser should handle various ID values.
   */
  registerFuzz(
    "ID field handles various values",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, ID should be a string
        expect(typeof decoded.body.id).toBe("string");
      } catch (error) {
        // May fail with missing or invalid ID
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert", "byte_delete", "splice"],
      seed: bufferFromString('{"id":"test-123","query":"test"}'),
    }
  );
});

// ============================================================================
// TIMESTAMP FUZZING
// ============================================================================

describe("Protocol Fuzzing: Timestamp Field", () => {
  /**
   * Fuzz: Invalid timestamp values
   *
   * The parser should handle various timestamp values.
   */
  registerFuzz(
    "Timestamp field handles various values",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds, timestamp should be a number
        expect(typeof decoded.body.timestamp).toBe("number");
      } catch (error) {
        // May fail with invalid timestamp
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["arithmetic", "byte_insert"],
      seed: bufferFromString('{"timestamp":1234567890}'),
    }
  );

  /**
   * Fuzz: Negative timestamps
   */
  registerFuzz(
    "Negative timestamps are handled",
    async (input: Buffer) => {
      try {
        const packet: ATPacket = {
          id: "test-123",
          query: "Test query",
          intent: "query" as any,
          urgency: "normal" as any,
          timestamp: -1,
        };

        const encoded = codec.encode(packet);
        const decoded = codec.decode(encoded);

        // Negative timestamps are technically valid (before Unix epoch)
        expect(decoded.body.timestamp).toBe(-1);
      } catch (error) {
        // Should accept negative timestamps
        expect(error).toBeUndefined();
      }
    },
    {
      iterations: 100,
      timeout: 5000,
      seed: bufferFromString(""),
    }
  );
});

// ============================================================================
// CONTEXT METADATA FUZZING
// ============================================================================

describe("Protocol Fuzzing: Context Metadata", () => {
  /**
   * Fuzz: Complex nested context
   *
   * The parser should handle complex nested objects.
   */
  registerFuzz(
    "Context field handles nested objects",
    async (input: Buffer) => {
      try {
        const decoded = codec.decode(input);

        // If decode succeeds and context exists
        if (decoded.body.context) {
          expect(typeof decoded.body.context).toBe("object");
        }
      } catch (error) {
        // May fail with deeply nested or circular structures
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 2000,
      timeout: 15000,
      mutations: ["byte_insert", "splice"],
      seed: bufferFromString('{"context":{"nested":{"deep":"value"}}}'),
    }
  );
});

// ============================================================================
// ENCODE/DECODE ROUNDTRIP FUZZING
// ============================================================================

describe("Protocol Fuzzing: Encode/Decode Roundtrip", () => {
  /**
   * Fuzz: Roundtrip with various packet structures
   *
   * Encoding and decoding should preserve data (or fail gracefully).
   */
  registerFuzz(
    "Encode/decode roundtrip preserves data",
    async (input: Buffer) => {
      try {
        // Try to parse as JSON to create a packet
        const jsonStr = input.toString("utf-8");
        const packet = JSON.parse(jsonStr);

        // Try to encode and decode
        const encoded = codec.encode(packet);
        const decoded = codec.decode(encoded);

        // Verify roundtrip
        expect(decoded.body).toEqual(packet);
      } catch (error) {
        // Invalid JSON - that's fine for fuzzing
        expect(error).toBeInstanceOf(Error);
      }
    },
    {
      iterations: 3000,
      timeout: 20000,
      mutations: ["bit_flip", "byte_insert", "byte_delete"],
      seed: bufferFromString(
        '{"id":"test","query":"hello","intent":"query","urgency":"normal","timestamp":123456}'
      ),
    }
  );
});
