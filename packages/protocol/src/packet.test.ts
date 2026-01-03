/**
 * Tests for ATP Packet Format
 *
 * Comprehensive tests for the ATP packet wire format implementation,
 * including encoding, decoding, validation, and streaming scenarios.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ATPPacketCodec,
  ATPPacketStream,
  ATP_MAGIC,
  PacketFlags,
  type ATPacketWire,
} from "./packet";
import { IntentCategory, Urgency, type ATPacket } from "./atp-acp";

describe("ATPPacketCodec", () => {
  const codec = new ATPPacketCodec();

  describe("encode", () => {
    it("should encode a basic ATP packet", () => {
      const packet: ATPacket = {
        id: "test-123",
        query: "What is the weather?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);

      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(10); // At least header size
    });

    it("should encode packet with context", () => {
      const packet: ATPacket = {
        id: "test-with-context",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: { userId: "user-456", sessionId: "session-789" },
      };

      const encoded = codec.encode(packet);

      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(10);
    });

    it("should produce correct magic number", () => {
      const packet: ATPacket = {
        id: "test-magic",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const view = new DataView(encoded.buffer, encoded.byteOffset);

      const magic = view.getUint32(0, false);
      expect(magic).toBe(ATP_MAGIC);
    });

    it("should set version to 1", () => {
      const packet: ATPacket = {
        id: "test-version",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const view = new DataView(encoded.buffer, encoded.byteOffset);

      const version = view.getUint8(4);
      expect(version).toBe(1);
    });

    it("should set flags to NONE by default", () => {
      const packet: ATPacket = {
        id: "test-flags",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const view = new DataView(encoded.buffer, encoded.byteOffset);

      const flags = view.getUint8(5);
      expect(flags).toBe(PacketFlags.NONE);
    });

    it("should set correct body length in header", () => {
      const packet: ATPacket = {
        id: "test-length",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const view = new DataView(encoded.buffer, encoded.byteOffset);

      const bodyLength = view.getUint32(6, false);
      expect(bodyLength).toBeGreaterThan(0);
      expect(bodyLength).toBeLessThan(encoded.length); // Must be less than total
    });

    it("should calculate checksum", () => {
      const packet: ATPacket = {
        id: "test-checksum",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const view = new DataView(encoded.buffer, encoded.byteOffset);

      // Checksum is last 4 bytes
      const checksumOffset = encoded.length - 4;
      const checksum = view.getUint32(checksumOffset, false);

      expect(checksum).toBeGreaterThan(0);
    });
  });

  describe("decode", () => {
    it("should decode encoded packet", () => {
      const original: ATPacket = {
        id: "test-123",
        query: "What is the weather?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body).toEqual(original);
    });

    it("should decode packet with context", () => {
      const original: ATPacket = {
        id: "test-context",
        query: "What is AI?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: { userId: "user-456", sessionId: "session-789" },
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body).toEqual(original);
    });

    it("should decode all intent categories", () => {
      for (const intent of Object.values(IntentCategory)) {
        const packet: ATPacket = {
          id: `test-${intent}`,
          query: "test",
          intent: intent as IntentCategory,
          urgency: Urgency.NORMAL,
          timestamp: Date.now(),
        };

        const encoded = codec.encode(packet);
        const decoded = codec.decode(encoded);

        expect(decoded.body.intent).toBe(intent);
      }
    });

    it("should decode all urgency levels", () => {
      for (const urgency of Object.values(Urgency)) {
        const packet: ATPacket = {
          id: `test-${urgency}`,
          query: "test",
          intent: IntentCategory.QUERY,
          urgency: urgency as Urgency,
          timestamp: Date.now(),
        };

        const encoded = codec.encode(packet);
        const decoded = codec.decode(encoded);

        expect(decoded.body.urgency).toBe(urgency);
      }
    });

    it("should decode header correctly", () => {
      const packet: ATPacket = {
        id: "test-header",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.header.magic).toBe(ATP_MAGIC);
      expect(decoded.header.version).toBe(1);
      expect(decoded.header.flags).toBe(PacketFlags.NONE);
      expect(decoded.header.length).toBeGreaterThan(0);
    });

    it("should decode footer correctly", () => {
      const packet: ATPacket = {
        id: "test-footer",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const decoded = codec.decode(encoded);

      expect(decoded.footer.checksum).toBeGreaterThan(0);
      expect(decoded.footer.checksum).toBeLessThanOrEqual(0xffffffff);
    });
  });

  describe("validation", () => {
    it("should reject invalid magic number", () => {
      const invalid = new Uint8Array([
        0xff,
        0xff,
        0xff,
        0xff, // Invalid magic
        0x01, // Version
        0x00, // Flags
        0x00,
        0x00,
        0x00,
        0x02, // Body length
        0x7b,
        0x7d, // Body: {}
        0x00,
        0x00,
        0x00,
        0x00, // Checksum
      ]);

      expect(() => codec.decode(invalid)).toThrow(/Invalid magic number/);
    });

    it("should reject unsupported version", () => {
      const packet: ATPacket = {
        id: "test",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      // Corrupt version to 99
      encoded[4] = 99;

      expect(() => codec.decode(encoded)).toThrow(/Unsupported version.*99/);
    });

    it("should reject checksum mismatch", () => {
      const packet: ATPacket = {
        id: "test",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      // Corrupt checksum
      encoded[encoded.length - 1] ^= 0xff;

      expect(() => codec.decode(encoded)).toThrow(/Checksum mismatch/);
    });

    it("should reject buffer smaller than header", () => {
      const tooSmall = new Uint8Array([0x41, 0x54, 0x50, 0x54]); // Only magic

      expect(() => codec.decode(tooSmall)).toThrow(
        /Buffer too small for header/
      );
    });

    it("should reject truncated packet", () => {
      const packet: ATPacket = {
        id: "test",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      // Truncate to make it shorter than declared
      const truncated = encoded.slice(0, encoded.length - 5);

      expect(() => codec.decode(truncated)).toThrow(
        /Buffer too small for declared body/
      );
    });

    it("should reject invalid JSON body", () => {
      const invalid = new Uint8Array([
        0x41,
        0x54,
        0x50,
        0x54, // Magic
        0x01, // Version
        0x00, // Flags
        0x00,
        0x00,
        0x00,
        0x05, // Body length
        0x69,
        0x6e,
        0x76,
        0x61,
        0x6c,
        0x69,
        0x64, // "invalid"
        0x00,
        0x00,
        0x00,
        0x00, // Checksum placeholder
      ]);

      // Need valid checksum
      const bodyBytes = invalid.slice(10, 15);
      const checksum = codec["calculateChecksum"](bodyBytes);
      const view = new DataView(invalid.buffer);
      view.setUint32(15, checksum, false);

      expect(() => codec.decode(invalid)).toThrow(/Failed to parse body JSON/);
    });
  });

  describe("getPacketSize", () => {
    it("should return correct packet size", () => {
      const packet: ATPacket = {
        id: "test",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const size = codec.getPacketSize(encoded);

      expect(size).toBe(encoded.length);
    });

    it("should throw for buffer smaller than header", () => {
      const tooSmall = new Uint8Array([0x41, 0x54]); // Only 2 bytes

      expect(() => codec.getPacketSize(tooSmall)).toThrow(
        /Buffer too small to read packet size/
      );
    });
  });

  describe("round-trip encoding/decoding", () => {
    it("should preserve all packet fields", () => {
      const original: ATPacket = {
        id: "round-trip-test",
        query: "Explain quantum computing",
        intent: IntentCategory.ANALYSIS,
        urgency: Urgency.HIGH,
        timestamp: 1704067200000,
        context: {
          userId: "user-123",
          sessionId: "session-456",
          preferences: { language: "en" },
        },
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body).toEqual(original);
    });

    it("should handle unicode in query", () => {
      const original: ATPacket = {
        id: "unicode-test",
        query: "What is 你好 in English?",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(original.query);
    });

    it("should handle special characters", () => {
      const original: ATPacket = {
        id: "special-chars-test",
        query: "Test with \"quotes\" and 'apostrophes' and \n newlines",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(original.query);
    });

    it("should handle large queries", () => {
      const largeQuery = "x".repeat(10000);
      const original: ATPacket = {
        id: "large-query-test",
        query: largeQuery,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(original);
      const decoded = codec.decode(encoded);

      expect(decoded.body.query).toBe(largeQuery);
      expect(decoded.body.query.length).toBe(10000);
    });
  });
});

describe("ATPPacketStream", () => {
  const codec = new ATPPacketCodec();
  const stream = new ATPPacketStream();

  beforeEach(() => {
    stream.clear();
  });

  describe("feed and decode", () => {
    it("should decode single complete packet", () => {
      const packet: ATPacket = {
        id: "stream-test-1",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      stream.feed(encoded);

      const decoded = stream.decode();
      expect(decoded).toHaveLength(1);
      expect(decoded[0].body).toEqual(packet);
    });

    it("should handle partial packet arrival", () => {
      const packet: ATPacket = {
        id: "stream-test-2",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const chunk1 = encoded.slice(0, Math.floor(encoded.length / 2));
      const chunk2 = encoded.slice(Math.floor(encoded.length / 2));

      stream.feed(chunk1);
      let decoded = stream.decode();
      expect(decoded).toHaveLength(0); // Not complete yet

      stream.feed(chunk2);
      decoded = stream.decode();
      expect(decoded).toHaveLength(1);
      expect(decoded[0].body).toEqual(packet);
    });

    it("should decode multiple packets", () => {
      const packets: ATPacket[] = [
        {
          id: "multi-1",
          query: "first",
          intent: IntentCategory.QUERY,
          urgency: Urgency.NORMAL,
          timestamp: Date.now(),
        },
        {
          id: "multi-2",
          query: "second",
          intent: IntentCategory.COMMAND,
          urgency: Urgency.HIGH,
          timestamp: Date.now(),
        },
        {
          id: "multi-3",
          query: "third",
          intent: IntentCategory.CONVERSATION,
          urgency: Urgency.LOW,
          timestamp: Date.now(),
        },
      ];

      const encoded1 = codec.encode(packets[0]);
      const encoded2 = codec.encode(packets[1]);
      const encoded3 = codec.encode(packets[2]);

      // Feed all at once
      const combined = new Uint8Array(
        encoded1.length + encoded2.length + encoded3.length
      );
      combined.set(encoded1, 0);
      combined.set(encoded2, encoded1.length);
      combined.set(encoded3, encoded1.length + encoded2.length);

      stream.feed(combined);

      const decoded = stream.decode();
      expect(decoded).toHaveLength(3);
      expect(decoded[0].body).toEqual(packets[0]);
      expect(decoded[1].body).toEqual(packets[1]);
      expect(decoded[2].body).toEqual(packets[2]);
    });

    it("should buffer incomplete packets", () => {
      const packet: ATPacket = {
        id: "buffer-test",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const chunk1 = encoded.slice(0, 10); // Header only

      stream.feed(chunk1);
      expect(stream.getBufferSize()).toBe(10);

      let decoded = stream.decode();
      expect(decoded).toHaveLength(0);
      expect(stream.getBufferSize()).toBe(10); // Still buffered

      const chunk2 = encoded.slice(10);
      stream.feed(chunk2);

      decoded = stream.decode();
      expect(decoded).toHaveLength(1);
      expect(stream.getBufferSize()).toBe(0); // Consumed
    });

    it("should handle multiple small chunks", () => {
      const packet: ATPacket = {
        id: "chunks-test",
        query: "test query",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      const chunkSize = 5;

      for (let i = 0; i < encoded.length; i += chunkSize) {
        const chunk = encoded.slice(i, i + chunkSize);
        stream.feed(chunk);
      }

      const decoded = stream.decode();
      expect(decoded).toHaveLength(1);
      expect(decoded[0].body).toEqual(packet);
    });
  });

  describe("getBufferSize", () => {
    it("should return 0 initially", () => {
      expect(stream.getBufferSize()).toBe(0);
    });

    it("should return buffer size after feeding", () => {
      const packet: ATPacket = {
        id: "buffer-size-test",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      stream.feed(encoded);

      expect(stream.getBufferSize()).toBe(encoded.length);

      // Decode consumes the packet
      stream.decode();
      expect(stream.getBufferSize()).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear the buffer", () => {
      const packet: ATPacket = {
        id: "clear-test",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const encoded = codec.encode(packet);
      stream.feed(encoded);

      expect(stream.getBufferSize()).toBeGreaterThan(0);

      stream.clear();
      expect(stream.getBufferSize()).toBe(0);
      expect(stream.decode()).toHaveLength(0);
    });
  });

  describe("getBuffer", () => {
    it("should return copy of buffer", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      stream.feed(data);

      const buffer = stream.getBuffer();
      expect(buffer).toEqual(data);
      expect(buffer).not.toBe(data); // Different reference
    });

    it("should return empty buffer initially", () => {
      const buffer = stream.getBuffer();
      expect(buffer).toEqual(new Uint8Array(0));
    });
  });

  describe("error handling", () => {
    it("should clear buffer on invalid magic", () => {
      // Feed invalid data
      stream.feed(
        new Uint8Array([
          0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02,
        ])
      );

      expect(() => stream.decode()).toThrow(/Invalid magic number/);
      expect(stream.getBufferSize()).toBe(0);
    });

    it("should handle multiple packets with one invalid", () => {
      const validPacket: ATPacket = {
        id: "valid",
        query: "test",
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      const validEncoded = codec.encode(validPacket);
      const invalid = new Uint8Array([
        0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02,
      ]);

      // Feed valid then invalid
      stream.feed(validEncoded);
      stream.feed(invalid);

      // Should decode valid packet first
      const decoded1 = stream.decode();
      expect(decoded1).toHaveLength(1);
      expect(decoded1[0].body.id).toBe("valid");

      // Should throw on invalid and clear buffer
      expect(() => stream.decode()).toThrow(/Invalid magic number/);
      expect(stream.getBufferSize()).toBe(0);
    });
  });
});

describe("PacketFlags", () => {
  it("should have correct values", () => {
    expect(PacketFlags.NONE).toBe(0);
    expect(PacketFlags.COMPRESSED).toBe(1 << 0);
    expect(PacketFlags.ENCRYPTED).toBe(1 << 1);
    expect(PacketFlags.STREAMING).toBe(1 << 2);
    expect(PacketFlags.PRIORITY).toBe(1 << 3);
  });
});

describe("ATP_MAGIC constant", () => {
  it("should be 0x41545054 (ATPT)", () => {
    expect(ATP_MAGIC).toBe(0x41545054);
  });

  it("should decode to ATPT in ASCII", () => {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, ATP_MAGIC, false);

    expect(String.fromCharCode(bytes[0])).toBe("A");
    expect(String.fromCharCode(bytes[1])).toBe("T");
    expect(String.fromCharCode(bytes[2])).toBe("P");
    expect(String.fromCharCode(bytes[3])).toBe("T");
  });
});
