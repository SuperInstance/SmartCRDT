"use strict";
/**
 * AuditExporter - Multi-format audit log export functionality
 *
 * Provides export capabilities for privacy audit logs to multiple formats
 * including JSON, CSV, XML, PDF, and Parquet with optional compression,
 * splitting, and anonymization.
 *
 * @packageDocumentation
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditExporter = exports.EXPORT_FORMATS = void 0;
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var util_1 = require("util");
var stream_1 = require("stream");
var pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
/**
 * Export format definitions
 */
exports.EXPORT_FORMATS = {
    JSON: { name: "json", extension: ".json", mimeType: "application/json" },
    CSV: { name: "csv", extension: ".csv", mimeType: "text/csv" },
    XML: { name: "xml", extension: ".xml", mimeType: "application/xml" },
    PDF: { name: "pdf", extension: ".pdf", mimeType: "application/pdf" },
    PARQUET: {
        name: "parquet",
        extension: ".parquet",
        mimeType: "application/octet-stream",
    },
};
/**
 * AuditExporter - Export audit logs to various formats
 *
 * Supports:
 * - Multiple export formats (JSON, CSV, XML, PDF, Parquet)
 * - Compression with gzip
 * - File splitting for large exports
 * - Additional anonymization beyond hashing
 * - Aggregation by category
 */
var AuditExporter = /** @class */ (function () {
    function AuditExporter() {
        this.defaultSplitSize = 10 * 1024 * 1024; // 10MB
        this.defaultOutputDir = "./exports";
    }
    /**
     * Export audit events to specified format
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns Export result with file paths and metadata
     */
    AuditExporter.prototype.export = function (events, options) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, outputDir, baseFilename, processedEvents, recordCount, content, format, _a, compressed, filePaths, splitSize, chunks, i, filename, filepath, finalFilename, filepath, totalSize;
            var _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        startTime = Date.now();
                        outputDir = options.outputDir || this.defaultOutputDir;
                        baseFilename = options.filename || "audit_".concat(startTime);
                        // Ensure output directory exists
                        return [4 /*yield*/, fs_1.promises.mkdir(outputDir, { recursive: true })];
                    case 1:
                        // Ensure output directory exists
                        _c.sent();
                        processedEvents = this.applyFilter(events, options.filter);
                        // Process events based on options
                        processedEvents = options.anonymize
                            ? this.anonymize(processedEvents)
                            : processedEvents;
                        recordCount = processedEvents.length;
                        // Aggregate if requested
                        if (options.aggregate && recordCount > 0) {
                            processedEvents = this.aggregateEvents(processedEvents);
                        }
                        format = exports.EXPORT_FORMATS[options.format];
                        _a = options.format;
                        switch (_a) {
                            case "JSON": return [3 /*break*/, 2];
                            case "CSV": return [3 /*break*/, 3];
                            case "XML": return [3 /*break*/, 4];
                            case "PDF": return [3 /*break*/, 5];
                            case "PARQUET": return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 9];
                    case 2:
                        content = this.exportToJSON(processedEvents, options);
                        return [3 /*break*/, 10];
                    case 3:
                        content = this.exportToCSV(processedEvents, options);
                        return [3 /*break*/, 10];
                    case 4:
                        content = this.exportToXML(processedEvents, options);
                        return [3 /*break*/, 10];
                    case 5: return [4 /*yield*/, this.exportToPDF(processedEvents, options)];
                    case 6:
                        content = _c.sent();
                        return [3 /*break*/, 10];
                    case 7: return [4 /*yield*/, this.exportToParquet(processedEvents, options)];
                    case 8:
                        content = _c.sent();
                        return [3 /*break*/, 10];
                    case 9: throw new Error("Unsupported export format: ".concat(options.format));
                    case 10:
                        compressed = false;
                        if (!options.compress) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.compress(content)];
                    case 11:
                        content = _c.sent();
                        compressed = true;
                        _c.label = 12;
                    case 12:
                        filePaths = [];
                        splitSize = options.splitSize || this.defaultSplitSize;
                        if (!(options.split && content.length > splitSize)) return [3 /*break*/, 17];
                        chunks = this.split(content.toString("utf-8"), splitSize);
                        i = 0;
                        _c.label = 13;
                    case 13:
                        if (!(i < chunks.length)) return [3 /*break*/, 16];
                        filename = "".concat(baseFilename, "_").concat(i + 1).concat(format.extension).concat(compressed ? ".gz" : "");
                        filepath = "".concat(outputDir, "/").concat(filename);
                        return [4 /*yield*/, fs_1.promises.writeFile(filepath, chunks[i])];
                    case 14:
                        _c.sent();
                        filePaths.push(filepath);
                        _c.label = 15;
                    case 15:
                        i++;
                        return [3 /*break*/, 13];
                    case 16: return [3 /*break*/, 19];
                    case 17:
                        finalFilename = baseFilename;
                        if (!baseFilename.endsWith(format.extension)) {
                            finalFilename = baseFilename + format.extension;
                        }
                        if (compressed && !finalFilename.endsWith(".gz")) {
                            finalFilename += ".gz";
                        }
                        filepath = "".concat(outputDir, "/").concat(finalFilename);
                        return [4 /*yield*/, fs_1.promises.writeFile(filepath, content)];
                    case 18:
                        _c.sent();
                        filePaths.push(filepath);
                        _c.label = 19;
                    case 19:
                        totalSize = filePaths.reduce(function (sumPromise, path) { return __awaiter(_this, void 0, void 0, function () {
                            var sum, stats;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, sumPromise];
                                    case 1:
                                        sum = _a.sent();
                                        return [4 /*yield*/, fs_1.promises.stat(path)];
                                    case 2:
                                        stats = _a.sent();
                                        return [2 /*return*/, sum + stats.size];
                                }
                            });
                        }); }, Promise.resolve(0));
                        _b = {
                            filePaths: filePaths,
                            recordCount: recordCount
                        };
                        return [4 /*yield*/, totalSize];
                    case 20: return [2 /*return*/, (_b.sizeBytes = _c.sent(),
                            _b.compressed = compressed,
                            _b.format = format.name,
                            _b.exportedAt = startTime,
                            _b)];
                }
            });
        });
    };
    /**
     * Export events to JSON format
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns JSON string
     */
    AuditExporter.prototype.exportToJSON = function (events, options) {
        var metadata = {
            exportedAt: Date.now(),
            recordCount: events.length,
            aggregated: options.aggregate || false,
            anonymized: options.anonymize || false,
            format: "json",
        };
        return JSON.stringify({
            metadata: metadata,
            events: events,
        }, null, 2);
    };
    /**
     * Export events to CSV format
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns CSV string
     */
    AuditExporter.prototype.exportToCSV = function (events, options) {
        var _a, _b;
        if (events.length === 0) {
            return "# No events to export\n";
        }
        // Add metadata header
        var csv = "# Exported at: ".concat(new Date().toISOString(), "\n");
        csv += "# Record count: ".concat(events.length, "\n");
        csv += "# Aggregated: ".concat(options.aggregate || false, "\n");
        csv += "# Anonymized: ".concat(options.anonymize || false, "\n\n");
        // CSV header
        var headers = [
            "timestamp",
            "eventType",
            "queryHash",
            "queryLength",
            "classification",
            "piiDetected",
            "action",
            "destination",
            "matchedRules",
            "sessionId",
        ];
        csv += headers.join(",") + "\n";
        // CSV rows
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var event_1 = events_1[_i];
            var row = [
                event_1.timestamp,
                event_1.eventType,
                event_1.queryHash,
                event_1.queryLength,
                ((_a = event_1.classification) === null || _a === void 0 ? void 0 : _a.level) || "",
                ((_b = event_1.piiDetected) === null || _b === void 0 ? void 0 : _b.join(";")) || "",
                event_1.decision.action,
                event_1.destination,
                event_1.decision.matchedRules.join(";"),
                event_1.sessionId,
            ];
            csv +=
                row
                    .map(function (cell) {
                    var cellStr = String(cell);
                    // Escape quotes and wrap in quotes if contains comma, quote, or newline
                    if (cellStr.includes(",") ||
                        cellStr.includes('"') ||
                        cellStr.includes("\n")) {
                        return "\"".concat(cellStr.replace(/"/g, '""'), "\"");
                    }
                    return cellStr;
                })
                    .join(",") + "\n";
        }
        return csv;
    };
    /**
     * Export events to XML format
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns XML string
     */
    AuditExporter.prototype.exportToXML = function (events, options) {
        var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += "<AuditExport>\n";
        // Metadata
        xml += "  <Metadata>\n";
        xml += "    <ExportedAt>".concat(Date.now(), "</ExportedAt>\n");
        xml += "    <RecordCount>".concat(events.length, "</RecordCount>\n");
        xml += "    <Aggregated>".concat(options.aggregate || false, "</Aggregated>\n");
        xml += "    <Anonymized>".concat(options.anonymize || false, "</Anonymized>\n");
        xml += "  </Metadata>\n";
        // Events
        xml += "  <Events>\n";
        for (var _i = 0, events_2 = events; _i < events_2.length; _i++) {
            var event_2 = events_2[_i];
            xml += "    <Event>\n";
            xml += "      <Timestamp>".concat(event_2.timestamp, "</Timestamp>\n");
            xml += "      <EventType>".concat(this.escapeXML(event_2.eventType), "</EventType>\n");
            xml += "      <QueryHash>".concat(this.escapeXML(event_2.queryHash), "</QueryHash>\n");
            xml += "      <QueryLength>".concat(event_2.queryLength, "</QueryLength>\n");
            if (event_2.classification) {
                xml += "      <Classification>\n";
                xml += "        <Level>".concat(this.escapeXML(event_2.classification.level), "</Level>\n");
                xml += "        <Confidence>".concat(event_2.classification.confidence, "</Confidence>\n");
                xml += "      </Classification>\n";
            }
            if (event_2.piiDetected && event_2.piiDetected.length > 0) {
                xml += "      <PIIDetected>\n";
                for (var _a = 0, _b = event_2.piiDetected; _a < _b.length; _a++) {
                    var pii = _b[_a];
                    xml += "        <Type>".concat(this.escapeXML(pii), "</Type>\n");
                }
                xml += "      </PIIDetected>\n";
            }
            xml += "      <Decision>\n";
            xml += "        <Action>".concat(this.escapeXML(event_2.decision.action), "</Action>\n");
            xml += "        <MatchedRules>".concat(event_2.decision.matchedRules.length, "</MatchedRules>\n");
            xml += "      </Decision>\n";
            xml += "      <Destination>".concat(this.escapeXML(event_2.destination), "</Destination>\n");
            xml += "      <SessionId>".concat(this.escapeXML(event_2.sessionId), "</SessionId>\n");
            xml += "    </Event>\n";
        }
        xml += "  </Events>\n";
        xml += "</AuditExport>";
        return xml;
    };
    /**
     * Export events to PDF format (placeholder for PDF library integration)
     *
     * Note: This is a simplified implementation. For production use,
     * integrate a library like jsPDF or PDFKit.
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns PDF buffer
     */
    AuditExporter.prototype.exportToPDF = function (events, options) {
        return __awaiter(this, void 0, void 0, function () {
            var pdf, i, event_3;
            var _a, _b;
            return __generator(this, function (_c) {
                pdf = "Audit Log Export\n";
                pdf += "=".concat("=".repeat(79), "\n\n");
                pdf += "Exported At: ".concat(new Date().toISOString(), "\n");
                pdf += "Record Count: ".concat(events.length, "\n");
                pdf += "Aggregated: ".concat(options.aggregate || false, "\n");
                pdf += "Anonymized: ".concat(options.anonymize || false, "\n\n");
                for (i = 0; i < events.length; i++) {
                    event_3 = events[i];
                    pdf += "[".concat(i + 1, "] ").concat(new Date(event_3.timestamp).toISOString(), "\n");
                    pdf += "    Event Type: ".concat(event_3.eventType, "\n");
                    pdf += "    Query Hash: ".concat(event_3.queryHash, "\n");
                    pdf += "    Classification: ".concat(((_a = event_3.classification) === null || _a === void 0 ? void 0 : _a.level) || "N/A", "\n");
                    pdf += "    PII Detected: ".concat(((_b = event_3.piiDetected) === null || _b === void 0 ? void 0 : _b.join(", ")) || "None", "\n");
                    pdf += "    Action: ".concat(event_3.decision.action, "\n");
                    pdf += "    Destination: ".concat(event_3.destination, "\n");
                    pdf += "    Session: ".concat(event_3.sessionId, "\n\n");
                }
                return [2 /*return*/, Buffer.from(pdf, "utf-8")];
            });
        });
    };
    /**
     * Export events to Parquet format (placeholder for Parquet library integration)
     *
     * Note: This is a simplified implementation. For production use,
     * integrate a library like parquet-wasm or apache-arrow.
     *
     * @param events - Events to export
     * @param options - Export options
     * @returns Parquet buffer
     */
    AuditExporter.prototype.exportToParquet = function (events, _options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // For now, return JSON as a placeholder
                // In production, use parquet-wasm or similar for actual Parquet generation
                return [2 /*return*/, Buffer.from(JSON.stringify(events), "utf-8")];
            });
        });
    };
    /**
     * Compress data using gzip
     *
     * @param data - Data to compress
     * @returns Compressed buffer
     */
    AuditExporter.prototype.compress = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var zlib, input;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("zlib"); })];
                    case 1:
                        zlib = _a.sent();
                        input = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
                        return [2 /*return*/, zlib.gzipSync(input)];
                }
            });
        });
    };
    /**
     * Apply filter to events
     *
     * @param events - Events to filter
     * @param filter - Filter to apply
     * @returns Filtered events
     */
    AuditExporter.prototype.applyFilter = function (events, filter) {
        if (!filter) {
            return events;
        }
        var results = __spreadArray([], events, true);
        // Filter by event type
        if (filter.eventType && filter.eventType.length > 0) {
            results = results.filter(function (e) { return filter.eventType.includes(e.eventType); });
        }
        // Filter by classification
        if (filter.classification && filter.classification.length > 0) {
            results = results.filter(function (e) {
                return e.classification &&
                    filter.classification.includes(e.classification.level);
            });
        }
        // Filter by destination
        if (filter.destination && filter.destination.length > 0) {
            results = results.filter(function (e) {
                return filter.destination.includes(e.destination);
            });
        }
        // Filter by time range
        if (filter.timeRange) {
            results = results.filter(function (e) {
                return e.timestamp >= filter.timeRange.start &&
                    e.timestamp <= filter.timeRange.end;
            });
        }
        // Filter by user ID hash
        if (filter.userIdHash) {
            results = results.filter(function (e) { return e.userIdHash === filter.userIdHash; });
        }
        // Filter by session ID
        if (filter.sessionId) {
            results = results.filter(function (e) { return e.sessionId === filter.sessionId; });
        }
        // Filter by minimum matched rules
        if (filter.minMatchedRules !== undefined) {
            results = results.filter(function (e) { return e.decision.matchedRules.length >= filter.minMatchedRules; });
        }
        // Filter by PII types
        if (filter.piiTypes && filter.piiTypes.length > 0) {
            results = results.filter(function (e) {
                return e.piiDetected &&
                    filter.piiTypes.some(function (pii) { return e.piiDetected.includes(pii); });
            });
        }
        // Apply pagination
        if (filter.offset !== undefined) {
            results = results.slice(filter.offset);
        }
        if (filter.limit !== undefined) {
            results = results.slice(0, filter.limit);
        }
        return results;
    };
    /**
     * Split data into chunks
     *
     * @param data - Data to split
     * @param maxSize - Maximum chunk size in bytes
     * @returns Array of chunks
     */
    AuditExporter.prototype.split = function (data, maxSize) {
        var chunks = [];
        var offset = 0;
        while (offset < data.length) {
            var end = Math.min(offset + maxSize, data.length);
            chunks.push(data.slice(offset, end));
            offset = end;
        }
        return chunks;
    };
    /**
     * Anonymize events beyond hashing
     *
     * Replaces query hashes with random values and adds additional
     * noise to metadata for enhanced privacy.
     *
     * @param events - Events to anonymize
     * @returns Anonymized events
     */
    AuditExporter.prototype.anonymize = function (events) {
        return events.map(function (event) { return (__assign(__assign({}, event), { queryHash: (0, crypto_1.randomBytes)(32).toString("hex"), sessionId: (0, crypto_1.randomBytes)(16).toString("hex"), userIdHash: event.userIdHash
                ? (0, crypto_1.randomBytes)(32).toString("hex")
                : undefined, 
            // Add noise to query length
            queryLength: Math.max(0, event.queryLength + Math.floor(Math.random() * 10) - 5) })); });
    };
    /**
     * Aggregate events by classification
     *
     * @param events - Events to aggregate
     * @returns Aggregated event-like objects
     */
    AuditExporter.prototype.aggregateEvents = function (events) {
        var _a;
        var aggregated = new Map();
        for (var _i = 0, events_3 = events; _i < events_3.length; _i++) {
            var event_4 = events_3[_i];
            var key = ((_a = event_4.classification) === null || _a === void 0 ? void 0 : _a.level) || "UNKNOWN";
            if (!aggregated.has(key)) {
                aggregated.set(key, {
                    classification: key,
                    count: 0,
                    piiTypes: [],
                    destinations: { local: 0, cloud: 0 },
                    avgQueryLength: 0,
                });
            }
            var data = aggregated.get(key);
            data.count++;
            data.destinations[event_4.destination]++;
            if (event_4.piiDetected) {
                for (var _b = 0, _c = event_4.piiDetected; _b < _c.length; _b++) {
                    var pii = _c[_b];
                    if (!data.piiTypes.includes(pii)) {
                        data.piiTypes.push(pii);
                    }
                }
            }
            // Update average query length
            data.avgQueryLength =
                (data.avgQueryLength * (data.count - 1) + event_4.queryLength) /
                    data.count;
        }
        // Convert aggregated data back to event-like format
        return Array.from(aggregated.entries()).map(function (_a) {
            var key = _a[0], data = _a[1];
            return ({
                timestamp: Date.now(),
                eventType: "query_allowed",
                queryHash: "AGGREGATED_".concat(key),
                queryLength: Math.round(data.avgQueryLength),
                classification: {
                    level: data.classification,
                    confidence: 1.0,
                    piiTypes: [],
                    reason: "Aggregated event",
                },
                piiDetected: data.piiTypes,
                decision: {
                    action: "allow",
                    matchedRules: [],
                    confidence: 1.0,
                },
                destination: data.destinations.cloud > data.destinations.local ? "cloud" : "local",
                sessionId: "AGGREGATED",
                metadata: {
                    count: data.count,
                    localCount: data.destinations.local,
                    cloudCount: data.destinations.cloud,
                },
            });
        });
    };
    /**
     * Escape special characters in XML
     *
     * @param text - Text to escape
     * @returns Escaped text
     */
    AuditExporter.prototype.escapeXML = function (text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    };
    /**
     * Export to file (convenience method)
     *
     * @param events - Events to export
     * @param filepath - Output file path
     * @param options - Export options
     * @returns Export result
     */
    AuditExporter.prototype.exportToFile = function (events, filepath, options) {
        return __awaiter(this, void 0, void 0, function () {
            var parsedPath, outputDir, filename;
            return __generator(this, function (_a) {
                parsedPath = filepath.match(/^(.*\/)([^/]+)$/);
                outputDir = parsedPath ? parsedPath[1].slice(0, -1) : ".";
                filename = parsedPath ? parsedPath[2] : undefined;
                return [2 /*return*/, this.export(events, __assign(__assign({}, options), { outputDir: outputDir, filename: filename }))];
            });
        });
    };
    return AuditExporter;
}());
exports.AuditExporter = AuditExporter;
