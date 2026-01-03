"use strict";
/**
 * AuditLogger - Privacy audit logging for compliance
 *
 * The Audit Logger records all privacy-relevant events for compliance and
 * auditing purposes. It provides query capabilities, export functionality,
 * and compliance report generation.
 *
 * Features:
 * - Immutable append-only event log
 * - Hash-based query/user anonymization for privacy
 * - Query filtering by multiple criteria
 * - Export to JSON and CSV formats
 * - Compliance report generation
 *
 * @packageDocumentation
 */
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
exports.AuditLogger = void 0;
var crypto_1 = require("crypto");
/**
 * AuditLogger - Privacy audit logging
 *
 * The Audit Logger maintains an append-only log of privacy-relevant events.
 * All queries and user IDs are hashed using SHA-256 for privacy before storage.
 *
 * The logger supports:
 * - Event filtering by multiple criteria
 * - Export to JSON/CSV for compliance reporting
 * - Compliance report generation with statistics
 * - Log rotation to prevent unbounded memory growth
 */
var AuditLogger = /** @class */ (function () {
    function AuditLogger(config) {
        if (config === void 0) { config = {}; }
        var _a, _b, _c, _d;
        this.events = [];
        this.eventCounter = 0;
        this.config = {
            maxEvents: (_a = config.maxEvents) !== null && _a !== void 0 ? _a : 10000,
            enableRotation: (_b = config.enableRotation) !== null && _b !== void 0 ? _b : true,
            enableHashing: (_c = config.enableHashing) !== null && _c !== void 0 ? _c : true,
            includeFullQuery: (_d = config.includeFullQuery) !== null && _d !== void 0 ? _d : false,
        };
    }
    /**
     * Log a privacy audit event
     *
     * Events are stored in append-only order. If rotation is enabled and
     * max events is reached, oldest events are removed.
     *
     * @param event - Event to log
     */
    AuditLogger.prototype.logEvent = function (event) {
        var timestamp = Date.now();
        var queryText = event.query || "";
        var queryHash = this.config.enableHashing
            ? this.sha256Hash(queryText)
            : queryText;
        var auditEvent = {
            timestamp: timestamp,
            eventType: event.eventType,
            queryHash: queryHash,
            queryLength: queryText.length,
            classification: event.classification,
            piiDetected: event.piiDetected,
            decision: event.decision,
            destination: event.destination,
            userIdHash: event.userIdHash,
            sessionId: event.sessionId,
            metadata: event.metadata || {},
        };
        this.events.push(auditEvent);
        this.eventCounter++;
        // Rotate if needed
        if (this.config.enableRotation &&
            this.events.length > this.config.maxEvents) {
            var removeCount = this.events.length - this.config.maxEvents;
            this.events.splice(0, removeCount);
        }
    };
    /**
     * Query events with optional filter
     *
     * @param filter - Optional filter criteria
     * @returns Array of matching events
     */
    AuditLogger.prototype.queryEvents = function (filter) {
        var results = __spreadArray([], this.events, true);
        if (filter) {
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
        }
        return results;
    };
    /**
     * Export events to JSON string
     *
     * @param filter - Optional filter to limit exported events
     * @returns JSON string of events
     */
    AuditLogger.prototype.exportEventsJSON = function (filter) {
        var events = this.queryEvents(filter);
        return JSON.stringify(events, null, 2);
    };
    /**
     * Export events to CSV string
     *
     * @param filter - Optional filter to limit exported events
     * @returns CSV string of events
     */
    AuditLogger.prototype.exportEventsCSV = function (filter) {
        var events = this.queryEvents(filter);
        if (events.length === 0) {
            return "";
        }
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
        var rows = events.map(function (e) {
            var _a, _b;
            return [
                e.timestamp,
                e.eventType,
                e.queryHash,
                e.queryLength,
                ((_a = e.classification) === null || _a === void 0 ? void 0 : _a.level) || "",
                ((_b = e.piiDetected) === null || _b === void 0 ? void 0 : _b.join(";")) || "",
                e.decision.action,
                e.destination,
                e.decision.matchedRules.join(";"),
                e.sessionId,
            ];
        });
        // Combine headers and rows
        var allRows = __spreadArray([headers], rows, true);
        // Convert to CSV
        return allRows
            .map(function (row) {
            return row
                .map(function (cell) {
                var cellStr = String(cell);
                // Escape quotes and wrap in quotes if contains comma
                return cellStr.includes(",") ||
                    cellStr.includes('"') ||
                    cellStr.includes("\n")
                    ? "\"".concat(cellStr.replace(/"/g, '""'), "\"")
                    : cellStr;
            })
                .join(",");
        })
            .join("\n");
    };
    /**
     * Generate compliance report
     *
     * Analyzes audit events within a time range and generates
     * a comprehensive compliance report.
     *
     * @param timeRange - Time range for report
     * @returns Compliance report
     */
    AuditLogger.prototype.generateComplianceReport = function (timeRange) {
        var events = this.queryEvents({
            timeRange: timeRange,
        });
        var totalQueries = events.length;
        var blockedQueries = events.filter(function (e) { return e.decision.action === "deny"; }).length;
        var redactedQueries = events.filter(function (e) { return e.decision.action === "redact"; }).length;
        var allowedQueries = events.filter(function (e) { return e.decision.action === "allow"; }).length;
        var piiIncidents = events.filter(function (e) { return e.piiDetected && e.piiDetected.length > 0; }).length;
        // Count PII types
        var piiTypeCounts = new Map();
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var event_1 = events_1[_i];
            if (event_1.piiDetected) {
                for (var _a = 0, _b = event_1.piiDetected; _a < _b.length; _a++) {
                    var piiType = _b[_a];
                    piiTypeCounts.set(piiType, (piiTypeCounts.get(piiType) || 0) + 1);
                }
            }
        }
        var topPIITypes = Array.from(piiTypeCounts.entries())
            .map(function (_a) {
            var type = _a[0], count = _a[1];
            return ({ type: type, count: count });
        })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 10);
        // Queries by destination
        var queriesByDestination = {
            local: events.filter(function (e) { return e.destination === "local"; }).length,
            cloud: events.filter(function (e) { return e.destination === "cloud"; }).length,
        };
        // Queries by classification
        var queriesByClassification = {};
        for (var _c = 0, events_2 = events; _c < events_2.length; _c++) {
            var event_2 = events_2[_c];
            if (event_2.classification) {
                var level = event_2.classification.level;
                queriesByClassification[level] =
                    (queriesByClassification[level] || 0) + 1;
            }
        }
        // Average confidence
        var confidenceValues = events
            .filter(function (e) { var _a; return ((_a = e.classification) === null || _a === void 0 ? void 0 : _a.confidence) !== undefined; })
            .map(function (e) { return e.classification.confidence; });
        var avgConfidence = confidenceValues.length > 0
            ? confidenceValues.reduce(function (sum, c) { return sum + c; }, 0) /
                confidenceValues.length
            : 0;
        // Top sessions
        var sessionCounts = new Map();
        for (var _d = 0, events_3 = events; _d < events_3.length; _d++) {
            var event_3 = events_3[_d];
            sessionCounts.set(event_3.sessionId, (sessionCounts.get(event_3.sessionId) || 0) + 1);
        }
        var topSessions = Array.from(sessionCounts.entries())
            .map(function (_a) {
            var sessionId = _a[0], count = _a[1];
            return ({ sessionId: sessionId, count: count });
        })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 10);
        return {
            generatedAt: Date.now(),
            timeRange: timeRange,
            totalQueries: totalQueries,
            blockedQueries: blockedQueries,
            redactedQueries: redactedQueries,
            allowedQueries: allowedQueries,
            piiIncidents: piiIncidents,
            topPIITypes: topPIITypes,
            queriesByDestination: queriesByDestination,
            queriesByClassification: queriesByClassification,
            avgConfidence: avgConfidence,
            topSessions: topSessions,
        };
    };
    /**
     * Get event count
     *
     * @returns Number of events stored
     */
    AuditLogger.prototype.getEventCount = function () {
        return this.events.length;
    };
    /**
     * Get total events logged (including rotated out)
     *
     * @returns Total number of events logged since creation
     */
    AuditLogger.prototype.getTotalEventsLogged = function () {
        return this.eventCounter;
    };
    /**
     * Clear all events
     */
    AuditLogger.prototype.clearEvents = function () {
        this.events = [];
    };
    /**
     * Get events by time range
     *
     * @param start - Start timestamp
     * @param end - End timestamp
     * @returns Events in time range
     */
    AuditLogger.prototype.getEventsByTimeRange = function (start, end) {
        return this.queryEvents({ timeRange: { start: start, end: end } });
    };
    /**
     * Get events by session ID
     *
     * @param sessionId - Session ID
     * @returns Events for session
     */
    AuditLogger.prototype.getEventsBySession = function (sessionId) {
        return this.queryEvents({ sessionId: sessionId });
    };
    /**
     * Get events by user ID hash
     *
     * @param userIdHash - Hashed user ID
     * @returns Events for user
     */
    AuditLogger.prototype.getEventsByUser = function (userIdHash) {
        return this.queryEvents({ userIdHash: userIdHash });
    };
    /**
     * Get recent events
     *
     * @param count - Number of recent events to return
     * @returns Most recent events
     */
    AuditLogger.prototype.getRecentEvents = function (count) {
        return this.queryEvents({ limit: count });
    };
    /**
     * Get statistics
     *
     * @returns Current statistics
     */
    AuditLogger.prototype.getStatistics = function () {
        var _a, _b;
        var eventsByType = {
            query_blocked: 0,
            query_redacted: 0,
            query_allowed: 0,
            pii_detected: 0,
            classification_change: 0,
            rule_modified: 0,
            firewall_evaluated: 0,
        };
        for (var _i = 0, _c = this.events; _i < _c.length; _i++) {
            var event_4 = _c[_i];
            eventsByType[event_4.eventType]++;
        }
        return {
            totalEvents: this.events.length,
            totalLogged: this.eventCounter,
            memoryUsage: this.events.length * 500, // Rough estimate in bytes
            oldestEvent: (_a = this.events[0]) === null || _a === void 0 ? void 0 : _a.timestamp,
            newestEvent: (_b = this.events[this.events.length - 1]) === null || _b === void 0 ? void 0 : _b.timestamp,
            eventsByType: eventsByType,
        };
    };
    /**
     * Hash a string using SHA-256
     *
     * @param text - Text to hash
     * @returns Hex-encoded hash
     */
    AuditLogger.prototype.sha256Hash = function (text) {
        return (0, crypto_1.createHash)("sha256").update(text).digest("hex");
    };
    /**
     * Hash a user ID for privacy
     *
     * @param userId - User ID to hash
     * @returns Hex-encoded hash
     */
    AuditLogger.prototype.hashUserId = function (userId) {
        return this.sha256Hash(userId);
    };
    /**
     * Export all events for backup
     *
     * @returns All events as JSON string
     */
    AuditLogger.prototype.exportAllEvents = function () {
        return this.exportEventsJSON();
    };
    /**
     * Import events from backup
     *
     * @param json - JSON string of events
     * @param append - Whether to append to existing events (default: true)
     */
    AuditLogger.prototype.importEvents = function (json, append) {
        if (append === void 0) { append = true; }
        var importedEvents = JSON.parse(json);
        if (!append) {
            this.events = [];
        }
        for (var _i = 0, importedEvents_1 = importedEvents; _i < importedEvents_1.length; _i++) {
            var event_5 = importedEvents_1[_i];
            this.events.push(event_5);
            this.eventCounter++;
        }
        // Apply rotation if needed
        if (this.config.enableRotation &&
            this.events.length > this.config.maxEvents) {
            var removeCount = this.events.length - this.config.maxEvents;
            this.events.splice(0, removeCount);
        }
    };
    return AuditLogger;
}());
exports.AuditLogger = AuditLogger;
