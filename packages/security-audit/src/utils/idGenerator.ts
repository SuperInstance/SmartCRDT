/**
 * Utility functions for ID generation
 */

import type { VulnerabilityId } from "@lsi/protocol";
import type { SecurityRuleId } from "@lsi/protocol";

/**
 * Counter for unique IDs
 */
let vulnCounter = 0;

/**
 * Generate unique vulnerability ID
 */
export function createVulnerabilityId(): VulnerabilityId {
  vulnCounter++;
  const timestamp = Date.now().toString(36);
  const counter = vulnCounter.toString(36).padStart(4, "0");
  return `VULN-${timestamp}-${counter}` as VulnerabilityId;
}

/**
 * Reset counter (useful for testing)
 */
export function resetIdCounter(): void {
  vulnCounter = 0;
}

/**
 * Parse rule ID from string
 */
export function parseRuleId(id: string): SecurityRuleId {
  return id as SecurityRuleId;
}

/**
 * Generate scan ID
 */
export function generateScanId(): string {
  return `SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
