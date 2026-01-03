/**
 * Shared type definitions for @lsi/security-audit
 */

export type SecuritySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type CodeLocation = {
  file: string;
  line?: number;
  column?: number;
  function?: string;
  snippet?: string;
  parameter?: string;
};

export enum DetectionConfidence {
  CERTAIN = "certain",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}
