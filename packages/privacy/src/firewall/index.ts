/**
 * @lsi/privacy/firewall - Privacy Firewall for Aequor
 *
 * This module provides the Privacy Firewall, a middleware layer that
 * filters requests based on privacy classification and acts as a gatekeeper
 * between the IntentionPlane and external models.
 *
 * Features:
 * - Rule-based privacy enforcement with priority evaluation
 * - Default security-first rules (SOVEREIGN blocked from cloud, SENSITIVE redacted)
 * - Custom rule addition/removal at runtime
 * - Support for multiple action types (allow, deny, redact, redirect)
 *
 * @packageDocumentation
 */

// Main export
export { PrivacyFirewall } from "./PrivacyFirewall.js";

// Type exports
export type {
  FirewallCondition,
  FirewallAction,
  FirewallRule,
  FirewallDecision,
  FirewallContext,
  PrivacyFirewallConfig,
} from "./PrivacyFirewall.js";
