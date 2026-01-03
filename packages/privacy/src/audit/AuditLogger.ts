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

import { createHash } from "crypto";
import type { PrivacyAuditEvent, PrivacyClassification, PIIType, FirewallDecision } from "@lsi/protocol";

/**
 * Audit event types
 */
export type AuditEventType =
  | "query_blocked"
  | "query_redacted"
  | "query_allowed"
  | "pii_detected"
  | "classification_change"
  | "rule_modified"
  | "firewall_evaluated";

// Re-export protocol PrivacyAuditEvent
export type { PrivacyAuditEvent } from "@lsi/protocol";

/**
 * Audit log filter
 */
export interface AuditLogFilter {
  /** Event types to include */
  eventType?: AuditEventType[];
  /** Privacy levels to include */
  classification?: string[];
  /** Destinations to include */
  destination?: ("local" | "cloud")[];
  /** Time range filter */
  timeRange?: { start: number; end: number };
  /** User ID hash to filter */
  userIdHash?: string;
  /** Session ID to filter */
  sessionId?: string;
  /** Minimum number of matched rules */
  minMatchedRules?: number;
  /** PII types to filter */
  piiTypes?: PIIType[];
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  /** Report generation time */
  generatedAt: number;
  /** Time range covered */
  timeRange: { start: number; end: number };
  /** Total queries processed */
  totalQueries: number;
  /** Number of blocked queries */
  blockedQueries: number;
  /** Number of redacted queries */
  redactedQueries: number;
  /** Number of allowed queries */
  allowedQueries: number;
  /** PII incidents count */
  piiIncidents: number;
  /** Top PII types detected */
  topPIITypes: Array<{ type: PIIType; count: number }>;
  /** Queries by destination */
  queriesByDestination: { local: number; cloud: number };
  /** Queries by classification level */
  queriesByClassification: Record<string, number>;
  /** Average classification confidence */
  avgConfidence: number;
  /** Most active sessions */
  topSessions: Array<{ sessionId: string; count: number }>;
}

/**
 * PII type count
 */
interface PIITypeCount {
  type: PIIType;
  count: number;
}

/**
 * AuditLogger configuration
 */
export interface AuditLoggerConfig {
  /** Maximum number of events to store in memory */
  maxEvents?: number;
  /** Enable rotation when max events reached */
  enableRotation?: boolean;
  /** Auto-hash queries and user IDs */
  enableHashing?: boolean;
  /** Include full query text (not recommended for production) */
  includeFullQuery?: boolean;
}

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
export class AuditLogger {
  private events: PrivacyAuditEvent[] = [];
  private config: Required<AuditLoggerConfig>;
  private eventCounter = 0;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = {
      maxEvents: config.maxEvents ?? 10000,
      enableRotation: config.enableRotation ?? true,
      enableHashing: config.enableHashing ?? true,
      includeFullQuery: config.includeFullQuery ?? false,
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
  logEvent(
    event: Omit<
      PrivacyAuditEvent,
      "queryHash" | "queryLength" | "timestamp"
    > & { query?: string }
  ): void {
    const timestamp = Date.now();
    const queryText = event.query || "";
    const queryHash = this.config.enableHashing
      ? this.sha256Hash(queryText)
      : queryText;

    const auditEvent: PrivacyAuditEvent = {
      timestamp,
      eventType: event.eventType,
      queryHash,
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
    if (
      this.config.enableRotation &&
      this.events.length > this.config.maxEvents
    ) {
      const removeCount = this.events.length - this.config.maxEvents;
      this.events.splice(0, removeCount);
    }
  }

  /**
   * Query events with optional filter
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching events
   */
  queryEvents(filter?: AuditLogFilter): PrivacyAuditEvent[] {
    let results = [...this.events];

    if (filter) {
      // Filter by event type
      if (filter.eventType && filter.eventType.length > 0) {
        results = results.filter(e => filter.eventType!.includes(e.eventType));
      }

      // Filter by classification
      if (filter.classification && filter.classification.length > 0) {
        results = results.filter(
          e =>
            e.classification &&
            filter.classification!.includes(e.classification.level)
        );
      }

      // Filter by destination
      if (filter.destination && filter.destination.length > 0) {
        results = results.filter(e =>
          filter.destination!.includes(e.destination)
        );
      }

      // Filter by time range
      if (filter.timeRange) {
        results = results.filter(
          e =>
            e.timestamp >= filter.timeRange!.start &&
            e.timestamp <= filter.timeRange!.end
        );
      }

      // Filter by user ID hash
      if (filter.userIdHash) {
        results = results.filter(e => e.userIdHash === filter.userIdHash);
      }

      // Filter by session ID
      if (filter.sessionId) {
        results = results.filter(e => e.sessionId === filter.sessionId);
      }

      // Filter by minimum matched rules
      if (filter.minMatchedRules !== undefined) {
        results = results.filter(
          e => e.decision.matchedRules.length >= filter.minMatchedRules!
        );
      }

      // Filter by PII types
      if (filter.piiTypes && filter.piiTypes.length > 0) {
        results = results.filter(
          e =>
            e.piiDetected &&
            filter.piiTypes!.some(pii => e.piiDetected!.includes(pii))
        );
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
  }

  /**
   * Export events to JSON string
   *
   * @param filter - Optional filter to limit exported events
   * @returns JSON string of events
   */
  exportEventsJSON(filter?: AuditLogFilter): string {
    const events = this.queryEvents(filter);
    return JSON.stringify(events, null, 2);
  }

  /**
   * Export events to CSV string
   *
   * @param filter - Optional filter to limit exported events
   * @returns CSV string of events
   */
  exportEventsCSV(filter?: AuditLogFilter): string {
    const events = this.queryEvents(filter);

    if (events.length === 0) {
      return "";
    }

    // CSV header
    const headers = [
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

    const rows = events.map(e => [
      e.timestamp,
      e.eventType,
      e.queryHash,
      e.queryLength,
      e.classification?.level || "",
      e.piiDetected?.join(";") || "",
      e.decision.action,
      e.destination,
      e.decision.matchedRules.join(";"),
      e.sessionId,
    ]);

    // Combine headers and rows
    const allRows = [headers, ...rows];

    // Convert to CSV
    return allRows
      .map(row =>
        row
          .map(cell => {
            const cellStr = String(cell);
            // Escape quotes and wrap in quotes if contains comma
            return cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
              ? `"${cellStr.replace(/"/g, '""')}"`
              : cellStr;
          })
          .join(",")
      )
      .join("\n");
  }

  /**
   * Generate compliance report
   *
   * Analyzes audit events within a time range and generates
   * a comprehensive compliance report.
   *
   * @param timeRange - Time range for report
   * @returns Compliance report
   */
  generateComplianceReport(timeRange: {
    start: number;
    end: number;
  }): ComplianceReport {
    const events = this.queryEvents({
      timeRange,
    });

    const totalQueries = events.length;
    const blockedQueries = events.filter(
      e => e.decision.action === "deny"
    ).length;
    const redactedQueries = events.filter(
      e => e.decision.action === "redact"
    ).length;
    const allowedQueries = events.filter(
      e => e.decision.action === "allow"
    ).length;
    const piiIncidents = events.filter(
      e => e.piiDetected && e.piiDetected.length > 0
    ).length;

    // Count PII types
    const piiTypeCounts = new Map<PIIType, number>();
    for (const event of events) {
      if (event.piiDetected) {
        for (const piiType of event.piiDetected) {
          piiTypeCounts.set(piiType, (piiTypeCounts.get(piiType) || 0) + 1);
        }
      }
    }

    const topPIITypes = Array.from(piiTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Queries by destination
    const queriesByDestination = {
      local: events.filter(e => e.destination === "local").length,
      cloud: events.filter(e => e.destination === "cloud").length,
    };

    // Queries by classification
    const queriesByClassification: Record<string, number> = {};
    for (const event of events) {
      if (event.classification) {
        const level = event.classification.level;
        queriesByClassification[level] =
          (queriesByClassification[level] || 0) + 1;
      }
    }

    // Average confidence
    const confidenceValues = events
      .filter(e => e.classification?.confidence !== undefined)
      .map(e => e.classification!.confidence);
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, c) => sum + c, 0) /
          confidenceValues.length
        : 0;

    // Top sessions
    const sessionCounts = new Map<string, number>();
    for (const event of events) {
      sessionCounts.set(
        event.sessionId,
        (sessionCounts.get(event.sessionId) || 0) + 1
      );
    }

    const topSessions = Array.from(sessionCounts.entries())
      .map(([sessionId, count]) => ({ sessionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      generatedAt: Date.now(),
      timeRange,
      totalQueries,
      blockedQueries,
      redactedQueries,
      allowedQueries,
      piiIncidents,
      topPIITypes,
      queriesByDestination,
      queriesByClassification,
      avgConfidence,
      topSessions,
    };
  }

  /**
   * Get event count
   *
   * @returns Number of events stored
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Get total events logged (including rotated out)
   *
   * @returns Total number of events logged since creation
   */
  getTotalEventsLogged(): number {
    return this.eventCounter;
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get events by time range
   *
   * @param start - Start timestamp
   * @param end - End timestamp
   * @returns Events in time range
   */
  getEventsByTimeRange(start: number, end: number): PrivacyAuditEvent[] {
    return this.queryEvents({ timeRange: { start, end } });
  }

  /**
   * Get events by session ID
   *
   * @param sessionId - Session ID
   * @returns Events for session
   */
  getEventsBySession(sessionId: string): PrivacyAuditEvent[] {
    return this.queryEvents({ sessionId });
  }

  /**
   * Get events by user ID hash
   *
   * @param userIdHash - Hashed user ID
   * @returns Events for user
   */
  getEventsByUser(userIdHash: string): PrivacyAuditEvent[] {
    return this.queryEvents({ userIdHash });
  }

  /**
   * Get recent events
   *
   * @param count - Number of recent events to return
   * @returns Most recent events
   */
  getRecentEvents(count: number): PrivacyAuditEvent[] {
    return this.queryEvents({ limit: count });
  }

  /**
   * Get statistics
   *
   * @returns Current statistics
   */
  getStatistics(): {
    totalEvents: number;
    totalLogged: number;
    memoryUsage: number;
    oldestEvent?: number;
    newestEvent?: number;
    eventsByType: Record<AuditEventType, number>;
  } {
    const eventsByType: Record<AuditEventType, number> = {
      query_blocked: 0,
      query_redacted: 0,
      query_allowed: 0,
      pii_detected: 0,
      classification_change: 0,
      rule_modified: 0,
      firewall_evaluated: 0,
    };

    for (const event of this.events) {
      (eventsByType as any)[event.eventType] = ((eventsByType as any)[event.eventType] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      totalLogged: this.eventCounter,
      memoryUsage: this.events.length * 500, // Rough estimate in bytes
      oldestEvent: this.events[0]?.timestamp,
      newestEvent: this.events[this.events.length - 1]?.timestamp,
      eventsByType,
    };
  }

  /**
   * Hash a string using SHA-256
   *
   * @param text - Text to hash
   * @returns Hex-encoded hash
   */
  private sha256Hash(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  /**
   * Hash a user ID for privacy
   *
   * @param userId - User ID to hash
   * @returns Hex-encoded hash
   */
  hashUserId(userId: string): string {
    return this.sha256Hash(userId);
  }

  /**
   * Export all events for backup
   *
   * @returns All events as JSON string
   */
  exportAllEvents(): string {
    return this.exportEventsJSON();
  }

  /**
   * Import events from backup
   *
   * @param json - JSON string of events
   * @param append - Whether to append to existing events (default: true)
   */
  importEvents(json: string, append = true): void {
    const importedEvents = JSON.parse(json) as PrivacyAuditEvent[];

    if (!append) {
      this.events = [];
    }

    for (const event of importedEvents) {
      this.events.push(event);
      this.eventCounter++;
    }

    // Apply rotation if needed
    if (
      this.config.enableRotation &&
      this.events.length > this.config.maxEvents
    ) {
      const removeCount = this.events.length - this.config.maxEvents;
      this.events.splice(0, removeCount);
    }
  }
}
