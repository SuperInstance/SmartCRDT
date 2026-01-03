"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATPPacketStream = exports.ATPPacketCodec = exports.PacketFlags = exports.ATP_MAGIC = void 0;
/**
 * Magic number for ATP packets (0x41545054 = "ATPT" in ASCII)
 *
 * This magic number is used to validate that incoming data is indeed an ATP packet
 * and not corrupted or from an incompatible protocol.
 */
exports.ATP_MAGIC = 0x41545054;
/**
 * Packet flags for special processing
 *
 * Flags enable optional features while maintaining backward compatibility.
 * Packets with unknown flags should be rejected to prevent misprocessing.
 */
var PacketFlags;
(function (PacketFlags) {
    /** No special flags */
    PacketFlags[PacketFlags["NONE"] = 0] = "NONE";
    /** Body is gzip compressed (not yet implemented) */
    PacketFlags[PacketFlags["COMPRESSED"] = 1] = "COMPRESSED";
    /** Body is encrypted (not yet implemented) */
    PacketFlags[PacketFlags["ENCRYPTED"] = 2] = "ENCRYPTED";
    /** Streaming response expected */
    PacketFlags[PacketFlags["STREAMING"] = 4] = "STREAMING";
    /** Priority request (expedited processing) */
    PacketFlags[PacketFlags["PRIORITY"] = 8] = "PRIORITY";
})(PacketFlags || (exports.PacketFlags = PacketFlags = {}));
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
var ATPPacketCodec = /** @class */ (function () {
    function ATPPacketCodec() {
    }
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
    ATPPacketCodec.prototype.encode = function (packet) {
        // 1. Serialize body to JSON
        var bodyJson = JSON.stringify(packet);
        var bodyBytes = new TextEncoder().encode(bodyJson);
        // 2. Calculate checksum
        var checksum = this.calculateChecksum(bodyBytes);
        // 3. Create header
        var header = {
            magic: exports.ATP_MAGIC,
            version: 1,
            flags: PacketFlags.NONE,
            length: bodyBytes.length,
        };
        // 4. Serialize to binary
        var buffer = new ArrayBuffer(10 + // header
            bodyBytes.length +
            4 // footer
        );
        var view = new DataView(buffer);
        var offset = 0;
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
    };
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
    ATPPacketCodec.prototype.decode = function (buffer) {
        var view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        var offset = 0;
        // Minimum header size is 10 bytes
        if (buffer.length < 10) {
            throw new Error("Buffer too small for header: ".concat(buffer.length, " bytes, need at least 10"));
        }
        // Header (10 bytes)
        var magic = view.getUint32(offset, false);
        offset += 4;
        var version = view.getUint8(offset);
        offset += 1;
        var flags = view.getUint8(offset);
        offset += 1;
        var length = view.getUint32(offset, false);
        offset += 4;
        var header = {
            magic: magic,
            version: version,
            flags: flags,
            length: length,
        };
        // Validate magic number
        if (header.magic !== exports.ATP_MAGIC) {
            throw new Error("Invalid magic number: 0x".concat(header.magic.toString(16).padStart(8, "0"), ", ") +
                "expected 0x".concat(exports.ATP_MAGIC.toString(16).padStart(8, "0"), " ('ATPT')"));
        }
        // Validate version
        if (header.version !== 1) {
            throw new Error("Unsupported version: ".concat(header.version, ", supported versions: [1]"));
        }
        // Validate we have enough data for body + footer
        if (buffer.length < 10 + header.length + 4) {
            throw new Error("Buffer too small for declared body length: " +
                "expected ".concat(10 + header.length + 4, " bytes, got ").concat(buffer.length));
        }
        // Body (variable length)
        var bodyBytes = buffer.slice(offset, offset + header.length);
        offset += header.length;
        var body;
        try {
            var bodyJson = new TextDecoder().decode(bodyBytes);
            body = JSON.parse(bodyJson);
        }
        catch (e) {
            throw new Error("Failed to parse body JSON: ".concat(e instanceof Error ? e.message : String(e)));
        }
        // Footer (4 bytes)
        var checksum = view.getUint32(offset, false);
        var footer = { checksum: checksum };
        // Validate checksum
        var calculatedChecksum = this.calculateChecksum(bodyBytes);
        if (checksum !== calculatedChecksum) {
            throw new Error("Checksum mismatch: expected 0x".concat(calculatedChecksum.toString(16).padStart(8, "0"), ", ") +
                "got 0x".concat(checksum.toString(16).padStart(8, "0"), " (data may be corrupted)"));
        }
        return { header: header, body: body, footer: footer };
    };
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
    ATPPacketCodec.prototype.calculateChecksum = function (data) {
        var crc = 0xffffffff;
        for (var i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (var j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    };
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
    ATPPacketCodec.prototype.getPacketSize = function (buffer) {
        if (buffer.length < 10) {
            throw new Error("Buffer too small to read packet size: ".concat(buffer.length, " bytes, need at least 10"));
        }
        var view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        var length = view.getUint32(8, false); // Body length is at offset 8
        return 10 + length + 4; // header + body + footer
    };
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
    ATPPacketCodec.prototype.validate = function (packet) {
        return __awaiter(this, void 0, void 0, function () {
            var ProtocolValidator, validator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./validation.js"); })];
                    case 1:
                        ProtocolValidator = (_a.sent()).ProtocolValidator;
                        validator = new ProtocolValidator();
                        return [2 /*return*/, validator.validateATPacket(packet)];
                }
            });
        });
    };
    return ATPPacketCodec;
}());
exports.ATPPacketCodec = ATPPacketCodec;
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
var ATPPacketStream = /** @class */ (function () {
    function ATPPacketStream() {
        this.codec = new ATPPacketCodec();
        this.buffer = new Uint8Array(0);
    }
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
    ATPPacketStream.prototype.feed = function (data) {
        var newBuffer = new Uint8Array(this.buffer.length + data.length);
        newBuffer.set(this.buffer);
        newBuffer.set(data, this.buffer.length);
        this.buffer = newBuffer;
    };
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
    ATPPacketStream.prototype.decode = function () {
        var packets = [];
        while (this.buffer.length >= 10) {
            // Minimum header size
            // Check if we have a complete packet
            try {
                var view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
                // Verify magic number before reading length
                var magic = view.getUint32(0, false);
                if (magic !== exports.ATP_MAGIC) {
                    // Invalid magic - clear buffer to prevent infinite loop
                    this.buffer = new Uint8Array(0);
                    throw new Error("Invalid magic number in stream: 0x".concat(magic.toString(16).padStart(8, "0"), ", ") +
                        "expected 0x".concat(exports.ATP_MAGIC.toString(16).padStart(8, "0"), " ('ATPT'). ") +
                        "Buffer cleared.");
                }
                var bodyLength = view.getUint32(8, false);
                var packetSize = 10 + bodyLength + 4;
                if (this.buffer.length < packetSize) {
                    // Not enough data yet - wait for more
                    break;
                }
                // Decode packet
                var packetData = this.buffer.slice(0, packetSize);
                var packet = this.codec.decode(packetData);
                packets.push(packet);
                // Remove packet from buffer
                this.buffer = this.buffer.slice(packetSize);
            }
            catch (e) {
                // If we can't decode, clear buffer to prevent infinite loop
                this.buffer = new Uint8Array(0);
                throw e;
            }
        }
        return packets;
    };
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
    ATPPacketStream.prototype.getBufferSize = function () {
        return this.buffer.length;
    };
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
    ATPPacketStream.prototype.clear = function () {
        this.buffer = new Uint8Array(0);
    };
    /**
     * Get buffered data without consuming it
     *
     * Useful for debugging or inspection.
     *
     * @returns Copy of current buffer
     */
    ATPPacketStream.prototype.getBuffer = function () {
        return new Uint8Array(this.buffer);
    };
    return ATPPacketStream;
}());
exports.ATPPacketStream = ATPPacketStream;
