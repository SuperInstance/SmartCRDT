/**
 * AuditExporter - Multi-format audit log export functionality
 *
 * Provides export capabilities for privacy audit logs to multiple formats
 * including JSON, CSV, XML, PDF, and Parquet with optional compression,
 * splitting, and anonymization.
 *
 * @packageDocumentation
 */

import { createHash, randomBytes } from "crypto";
import { createGzip } from "zlib";
import { promises as fs } from "fs";
import { Readable } from "stream";
import { promisify } from "util";
import { pipeline } from "stream";
import type {
  PrivacyAuditEvent,
  FirewallDecision,
  PIIType,
  PrivacyLevel
} from "@lsi/protocol";
import type { AuditLogFilter } from "./AuditLogger";

const pipelineAsync = promisify(pipeline);

/**
 * Supported export formats
 */
export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
}

/**
 * Export format definitions
 */
export const EXPORT_FORMATS = {
  JSON: { name: "json", extension: ".json", mimeType: "application/json" },
  CSV: { name: "csv", extension: ".csv", mimeType: "text/csv" },
  XML: { name: "xml", extension: ".xml", mimeType: "application/xml" },
  PDF: { name: "pdf", extension: ".pdf", mimeType: "application/pdf" },
  PARQUET: {
    name: "parquet",
    extension: ".parquet",
    mimeType: "application/octet-stream",
  },
} as const;

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: keyof typeof EXPORT_FORMATS;
  /** Optional filter for exported events */
  filter?: AuditLogFilter;
  /** Aggregate by category */
  aggregate?: boolean;
  /** Further anonymize beyond hashing */
  anonymize?: boolean;
  /** Compress output with gzip */
  compress?: boolean;
  /** Split into multiple files */
  split?: boolean;
  /** Max file size before splitting (bytes) */
  splitSize?: number;
  /** Output directory (defaults to './exports') */
  outputDir?: string;
  /** Base filename (defaults to timestamp) */
  filename?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Paths to exported files */
  filePaths: string[];
  /** Number of records exported */
  recordCount: number;
  /** Total size in bytes */
  sizeBytes: number;
  /** Whether output was compressed */
  compressed: boolean;
  /** Export format used */
  format: string;
  /** Unix timestamp of export */
  exportedAt: number;
}

/**
 * Aggregated event data
 */
interface AggregatedData {
  classification: string;
  count: number;
  piiTypes: PIIType[];
  destinations: { local: number; cloud: number };
  avgQueryLength: number;
}

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
export class AuditExporter {
  private readonly defaultSplitSize = 10 * 1024 * 1024; // 10MB
  private readonly defaultOutputDir = "./exports";

  /**
   * Export audit events to specified format
   *
   * @param events - Events to export
   * @param options - Export options
   * @returns Export result with file paths and metadata
   */
  async export(
    events: PrivacyAuditEvent[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const outputDir = options.outputDir || this.defaultOutputDir;
    const baseFilename = options.filename || `audit_${startTime}`;

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Apply filter if provided
    let processedEvents = this.applyFilter(events, options.filter);

    // Process events based on options
    processedEvents = options.anonymize
      ? this.anonymize(processedEvents)
      : processedEvents;
    const recordCount = processedEvents.length;

    // Aggregate if requested
    if (options.aggregate && recordCount > 0) {
      processedEvents = this.aggregateEvents(processedEvents);
    }

    // Generate content based on format
    let content: string | Buffer;
    const format = EXPORT_FORMATS[options.format];

    switch (options.format) {
      case "JSON":
        content = this.exportToJSON(processedEvents, options);
        break;
      case "CSV":
        content = this.exportToCSV(processedEvents, options);
        break;
      case "XML":
        content = this.exportToXML(processedEvents, options);
        break;
      case "PDF":
        content = await this.exportToPDF(processedEvents, options);
        break;
      case "PARQUET":
        content = await this.exportToParquet(processedEvents, options);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Compress if requested
    let compressed = false;
    if (options.compress) {
      content = await this.compress(content);
      compressed = true;
    }

    // Split if requested or necessary
    const filePaths: string[] = [];
    const splitSize = options.splitSize || this.defaultSplitSize;

    if (options.split && content.length > splitSize) {
      const chunks = this.split(content.toString("utf-8"), splitSize);
      for (let i = 0; i < chunks.length; i++) {
        const filename = `${baseFilename}_${i + 1}${format.extension}${compressed ? ".gz" : ""}`;
        const filepath = `${outputDir}/${filename}`;
        await fs.writeFile(filepath, chunks[i]);
        filePaths.push(filepath);
      }
    } else {
      // Don't add extension if baseFilename already has it
      let finalFilename = baseFilename;
      if (!baseFilename.endsWith(format.extension)) {
        finalFilename = baseFilename + format.extension;
      }
      if (compressed && !finalFilename.endsWith(".gz")) {
        finalFilename += ".gz";
      }
      const filepath = `${outputDir}/${finalFilename}`;
      await fs.writeFile(filepath, content);
      filePaths.push(filepath);
    }

    // Calculate total size
    const totalSize = filePaths.reduce(async (sumPromise, path) => {
      const sum = await sumPromise;
      const stats = await fs.stat(path);
      return sum + stats.size;
    }, Promise.resolve(0));

    return {
      filePaths,
      recordCount,
      sizeBytes: await totalSize,
      compressed,
      format: format.name,
      exportedAt: startTime,
    };
  }

  /**
   * Export events to JSON format
   *
   * @param events - Events to export
   * @param options - Export options
   * @returns JSON string
   */
  private exportToJSON(
    events: PrivacyAuditEvent[],
    options: ExportOptions
  ): string {
    const metadata = {
      exportedAt: Date.now(),
      recordCount: events.length,
      aggregated: options.aggregate || false,
      anonymized: options.anonymize || false,
      format: "json",
    };

    return JSON.stringify(
      {
        metadata,
        events,
      },
      null,
      2
    );
  }

  /**
   * Export events to CSV format
   *
   * @param events - Events to export
   * @param options - Export options
   * @returns CSV string
   */
  private exportToCSV(
    events: PrivacyAuditEvent[],
    options: ExportOptions
  ): string {
    if (events.length === 0) {
      return "# No events to export\n";
    }

    // Add metadata header
    let csv = `# Exported at: ${new Date().toISOString()}\n`;
    csv += `# Record count: ${events.length}\n`;
    csv += `# Aggregated: ${options.aggregate || false}\n`;
    csv += `# Anonymized: ${options.anonymize || false}\n\n`;

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

    csv += headers.join(",") + "\n";

    // CSV rows
    for (const event of events) {
      const row = [
        event.timestamp,
        event.eventType,
        event.queryHash,
        event.queryLength,
        event.classification?.level || "",
        event.piiDetected?.join(";") || "",
        event.decision.action,
        event.destination,
        event.decision.matchedRules.join(";"),
        event.sessionId,
      ];

      csv +=
        row
          .map(cell => {
            const cellStr = String(cell);
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (
              cellStr.includes(",") ||
              cellStr.includes('"') ||
              cellStr.includes("\n")
            ) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",") + "\n";
    }

    return csv;
  }

  /**
   * Export events to XML format
   *
   * @param events - Events to export
   * @param options - Export options
   * @returns XML string
   */
  private exportToXML(
    events: PrivacyAuditEvent[],
    options: ExportOptions
  ): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += "<AuditExport>\n";

    // Metadata
    xml += "  <Metadata>\n";
    xml += `    <ExportedAt>${Date.now()}</ExportedAt>\n`;
    xml += `    <RecordCount>${events.length}</RecordCount>\n`;
    xml += `    <Aggregated>${options.aggregate || false}</Aggregated>\n`;
    xml += `    <Anonymized>${options.anonymize || false}</Anonymized>\n`;
    xml += "  </Metadata>\n";

    // Events
    xml += "  <Events>\n";
    for (const event of events) {
      xml += "    <Event>\n";
      xml += `      <Timestamp>${event.timestamp}</Timestamp>\n`;
      xml += `      <EventType>${this.escapeXML(event.eventType)}</EventType>\n`;
      xml += `      <QueryHash>${this.escapeXML(event.queryHash)}</QueryHash>\n`;
      xml += `      <QueryLength>${event.queryLength}</QueryLength>\n`;

      if (event.classification) {
        xml += "      <Classification>\n";
        xml += `        <Level>${this.escapeXML(event.classification.level)}</Level>\n`;
        xml += `        <Confidence>${event.classification.confidence}</Confidence>\n`;
        xml += "      </Classification>\n";
      }

      if (event.piiDetected && event.piiDetected.length > 0) {
        xml += "      <PIIDetected>\n";
        for (const pii of event.piiDetected) {
          xml += `        <Type>${this.escapeXML(pii)}</Type>\n`;
        }
        xml += "      </PIIDetected>\n";
      }

      xml += "      <Decision>\n";
      xml += `        <Action>${this.escapeXML(event.decision.action)}</Action>\n`;
      xml += `        <MatchedRules>${event.decision.matchedRules.length}</MatchedRules>\n`;
      xml += "      </Decision>\n";

      xml += `      <Destination>${this.escapeXML(event.destination)}</Destination>\n`;
      xml += `      <SessionId>${this.escapeXML(event.sessionId)}</SessionId>\n`;
      xml += "    </Event>\n";
    }
    xml += "  </Events>\n";

    xml += "</AuditExport>";
    return xml;
  }

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
  private async exportToPDF(
    events: PrivacyAuditEvent[],
    options: ExportOptions
  ): Promise<Buffer> {
    // For now, return a text-based PDF-like format
    // In production, use jsPDF or PDFKit for actual PDF generation

    let pdf = `Audit Log Export\n`;
    pdf += `=${"=".repeat(79)}\n\n`;
    pdf += `Exported At: ${new Date().toISOString()}\n`;
    pdf += `Record Count: ${events.length}\n`;
    pdf += `Aggregated: ${options.aggregate || false}\n`;
    pdf += `Anonymized: ${options.anonymize || false}\n\n`;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      pdf += `[${i + 1}] ${new Date(event.timestamp).toISOString()}\n`;
      pdf += `    Event Type: ${event.eventType}\n`;
      pdf += `    Query Hash: ${event.queryHash}\n`;
      pdf += `    Classification: ${event.classification?.level || "N/A"}\n`;
      pdf += `    PII Detected: ${event.piiDetected?.join(", ") || "None"}\n`;
      pdf += `    Action: ${event.decision.action}\n`;
      pdf += `    Destination: ${event.destination}\n`;
      pdf += `    Session: ${event.sessionId}\n\n`;
    }

    return Buffer.from(pdf, "utf-8");
  }

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
  private async exportToParquet(
    events: PrivacyAuditEvent[],
    _options: ExportOptions
  ): Promise<Buffer> {
    // For now, return JSON as a placeholder
    // In production, use parquet-wasm or similar for actual Parquet generation
    return Buffer.from(JSON.stringify(events), "utf-8");
  }

  /**
   * Compress data using gzip
   *
   * @param data - Data to compress
   * @returns Compressed buffer
   */
  private async compress(data: string | Buffer): Promise<Buffer> {
    const zlib = await import("zlib");
    const input = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    return zlib.gzipSync(input);
  }

  /**
   * Apply filter to events
   *
   * @param events - Events to filter
   * @param filter - Filter to apply
   * @returns Filtered events
   */
  private applyFilter(
    events: PrivacyAuditEvent[],
    filter?: AuditLogFilter
  ): PrivacyAuditEvent[] {
    if (!filter) {
      return events;
    }

    let results = [...events];

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

    return results;
  }

  /**
   * Split data into chunks
   *
   * @param data - Data to split
   * @param maxSize - Maximum chunk size in bytes
   * @returns Array of chunks
   */
  private split(data: string, maxSize: number): string[] {
    const chunks: string[] = [];
    let offset = 0;

    while (offset < data.length) {
      const end = Math.min(offset + maxSize, data.length);
      chunks.push(data.slice(offset, end));
      offset = end;
    }

    return chunks;
  }

  /**
   * Anonymize events beyond hashing
   *
   * Replaces query hashes with random values and adds additional
   * noise to metadata for enhanced privacy.
   *
   * @param events - Events to anonymize
   * @returns Anonymized events
   */
  private anonymize(events: PrivacyAuditEvent[]): PrivacyAuditEvent[] {
    return events.map(event => ({
      ...event,
      queryHash: randomBytes(32).toString("hex"),
      sessionId: randomBytes(16).toString("hex"),
      userIdHash: event.userIdHash
        ? randomBytes(32).toString("hex")
        : undefined,
      // Add noise to query length
      queryLength: Math.max(
        0,
        event.queryLength + Math.floor(Math.random() * 10) - 5
      ),
    }));
  }

  /**
   * Aggregate events by classification
   *
   * @param events - Events to aggregate
   * @returns Aggregated event-like objects
   */
  private aggregateEvents(events: PrivacyAuditEvent[]): PrivacyAuditEvent[] {
    const aggregated = new Map<string, AggregatedData>();

    for (const event of events) {
      const key = event.classification?.level || "UNKNOWN";

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          classification: key,
          count: 0,
          piiTypes: [],
          destinations: { local: 0, cloud: 0 },
          avgQueryLength: 0,
        });
      }

      const data = aggregated.get(key)!;
      data.count++;
      (data.destinations as any)[event.destination] = ((data.destinations as any)[event.destination] || 0) + 1;

      if (event.piiDetected) {
        for (const pii of event.piiDetected) {
          if (!data.piiTypes.includes(pii)) {
            data.piiTypes.push(pii);
          }
        }
      }

      // Update average query length
      data.avgQueryLength =
        (data.avgQueryLength * (data.count - 1) + event.queryLength) /
        data.count;
    }

    // Convert aggregated data back to event-like format
    return Array.from(aggregated.entries()).map(([key, data]) => ({
      timestamp: Date.now(),
      eventType: "query_allowed" as const,
      queryHash: `AGGREGATED_${key}`,
      queryLength: Math.round(data.avgQueryLength),
      classification: {
        level: data.classification as PrivacyLevel,
        confidence: 1.0,
        piiTypes: [],
        reason: "Aggregated event",
      },
      piiDetected: data.piiTypes,
      decision: {
        action: "allow" as const,
        matchedRules: [],
        confidence: 1.0,
      },
      destination:
        data.destinations.cloud > data.destinations.local ? "cloud" : "local",
      sessionId: "AGGREGATED",
      metadata: {
        count: data.count,
        localCount: data.destinations.local,
        cloudCount: data.destinations.cloud,
      },
    }));
  }

  /**
   * Escape special characters in XML
   *
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Export to file (convenience method)
   *
   * @param events - Events to export
   * @param filepath - Output file path
   * @param options - Export options
   * @returns Export result
   */
  async exportToFile(
    events: PrivacyAuditEvent[],
    filepath: string,
    options: Omit<ExportOptions, "outputDir" | "filename">
  ): Promise<ExportResult> {
    const parsedPath = filepath.match(/^(.*\/)([^/]+)$/);
    const outputDir = parsedPath ? parsedPath[1].slice(0, -1) : ".";
    const filename = parsedPath ? parsedPath[2] : undefined;

    return this.export(events, {
      ...options,
      outputDir,
      filename,
    });
  }
}
