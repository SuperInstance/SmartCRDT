/**
 * @lsi/protocol - Security Audit Protocol Types
 *
 * Comprehensive security auditing and vulnerability scanning types for the Aequor platform.
 * Defines interfaces for security scanning, vulnerability detection, and reporting.
 */

import type { BrandedId } from "./common.js";

// ============================================================================
// SECURITY AUDIT TYPES
// ============================================================================

/**
 * Unique identifier for security vulnerabilities
 */
export type VulnerabilityId = BrandedId<string>;

/**
 * Unique identifier for security rules
 */
export type SecurityRuleId = BrandedId<string>;

/**
 * Severity levels for security vulnerabilities
 *
 * Ordered from most critical to least critical:
 * - CRITICAL: Immediate remediation required (e.g., remote code execution)
 * - HIGH: Priority remediation (e.g., SQL injection, XSS)
 * - MEDIUM: Important to fix (e.g., insecure configuration)
 * - LOW: Should be fixed (e.g., minor information disclosure)
 * - INFO: Informational (e.g., best practice violations)
 */
export enum SecuritySeverity {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  INFO = "info",
}

/**
 * OWASP Top 10 vulnerability categories
 * https://owasp.org/www-project-top-ten/
 */
export enum OWASPVulnerabilityCategory {
  BROKEN_ACCESS_CONTROL = "broken_access_control",
  CRYPTOGRAPHIC_FAILURES = "cryptographic_failures",
  INJECTION = "injection",
  INSECURE_DESIGN = "insecure_design",
  SECURITY_MISCONFIGURATION = "security_misconfiguration",
  VULNERABLE_AND_OUTDATED_COMPONENTS = "vulnerable_and_outdated_components",
  IDENTIFICATION_AND_AUTHENTICATION_FAILURES = "identification_and_authentication_failures",
  SOFTWARE_AND_DATA_INTEGRITY_FAILURES = "software_and_data_integrity_failures",
  SECURITY_LOGGING_AND_MONITORING_FAILURES = "security_logging_and_monitoring_failures",
  SERVER_SIDE_REQUEST_FORGERY = "server_side_request_forgery",
}

/**
 * Additional vulnerability categories beyond OWASP
 */
export enum CustomVulnerabilityCategory {
  // Code quality issues
  HARD_CODED_SECRET = "hard_coded_secret",
  WEAK_CRYPTOGRAPHY = "weak_cryptography",
  INSECURE_RANDOM = "insecure_random",

  // Data protection
  SENSITIVE_DATA_EXPOSURE = "sensitive_data_exposure",
  INSECURE_DATA_STORAGE = "insecure_data_storage",

  // Dependency issues
  VULNERABLE_DEPENDENCY = "vulnerable_dependency",
  OUTDATED_DEPENDENCY = "outdated_dependency",

  // Configuration issues
  INSECURE_CORS = "insecure_cors",
  MISSING_SECURITY_HEADERS = "missing_security_headers",
  DEBUG_ENABLED = "debug_enabled",

  // Authentication/Authorization
  WEAK_PASSWORD_POLICY = "weak_password_policy",
  MISSING_RATE_LIMITING = "missing_rate_limiting",
  INSECURE_SESSION_MANAGEMENT = "insecure_session_management",
}

/**
 * Combined vulnerability category type
 */
export type VulnerabilityCategory =
  | OWASPVulnerabilityCategory
  | CustomVulnerabilityCategory;

/**
 * Confidence level in vulnerability detection
 */
export enum DetectionConfidence {
  CERTAIN = "certain", // Definitely a vulnerability
  HIGH = "high", // Very likely a vulnerability
  MEDIUM = "medium", // Possibly a vulnerability
  LOW = "low", // Might be a vulnerability
}

/**
 * Source code location for vulnerability
 */
export interface CodeLocation {
  /** File path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Function/method name containing the vulnerability */
  function?: string;
  /** Code snippet at this location */
  snippet?: string;
}

/**
 * Security vulnerability finding
 */
export interface VulnerabilityFinding {
  /** Unique identifier */
  id: VulnerabilityId;
  /** Vulnerability category */
  category: VulnerabilityCategory;
  /** Severity level */
  severity: SecuritySeverity;
  /** Confidence in detection */
  confidence: DetectionConfidence;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Location in code */
  location: CodeLocation;
  /** CWE identifier (if applicable) */
  cweId?: string;
  /** CVSS score (0-10) */
  cvssScore?: number;
  /** Affected components */
  affectedComponents: string[];
  /** Remediation recommendations */
  remediation: Remediation;
  /** References to documentation */
  references: string[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Remediation guidance for vulnerabilities
 */
export interface Remediation {
  /** Short description of fix */
  summary: string;
  /** Detailed fix explanation */
  description: string;
  /** Code example of fix */
  codeExample?: string;
  /** Estimated effort (person-hours) */
  estimatedEffort?: number;
  /** Priority level */
  priority: "immediate" | "high" | "medium" | "low";
}

/**
 * Dependency vulnerability information
 */
export interface DependencyVulnerability {
  /** Package name */
  packageName: string;
  /** Current version */
  currentVersion: string;
  /** Vulnerable versions */
  vulnerableVersions: string[];
  /** Fixed versions */
  patchedVersions: string[];
  /** Severity */
  severity: SecuritySeverity;
  /** Vulnerability IDs (CVE, etc.) */
  ids: string[];
  /** Vulnerability description */
  description: string;
  /** Reference URLs */
  references: string[];
}

/**
 * Secret finding (hardcoded credentials, API keys, etc.)
 */
export interface SecretFinding {
  /** Secret type */
  type: SecretType;
  /** Confidence in detection */
  confidence: DetectionConfidence;
  /** Location */
  location: CodeLocation;
  /** Secret value (partially masked) */
  maskedValue: string;
  /** Description */
  description: string;
}

/**
 * Types of secrets that can be detected
 */
export enum SecretType {
  API_KEY = "api_key",
  AWS_ACCESS_KEY = "aws_access_key",
  AWS_SECRET_KEY = "aws_secret_key",
  DATABASE_URL = "database_url",
  ENCRYPTION_KEY = "encryption_key",
  JWT_SECRET = "jwt_secret",
  PASSWORD = "password",
  PRIVATE_KEY = "private_key",
  SSH_KEY = "ssh_key",
  TOKEN = "token",
  UUID = "uuid", // Potential JWT/session token
}

/**
 * Security configuration check result
 */
export interface ConfigCheck {
  /** Check name */
  name: string;
  /** Description */
  description: string;
  /** Passed */
  passed: boolean;
  /** Severity if failed */
  severity?: SecuritySeverity;
  /** Current value */
  currentValue?: unknown;
  /** Expected value */
  expectedValue?: unknown;
  /** Recommendations */
  recommendation?: string;
}

/**
 * Security scan scope
 */
export interface ScanScope {
  /** Directories to scan */
  directories: string[];
  /** File patterns to include (glob patterns) */
  include: string[];
  /** File patterns to exclude */
  exclude: string[];
  /** Maximum file size to scan (bytes) */
  maxFileSize: number;
  /** Scan dependencies */
  scanDependencies: boolean;
  /** Scan for secrets */
  scanSecrets: boolean;
  /** Scan configuration files */
  scanConfig: boolean;
}

/**
 * Security scan options
 */
export interface SecurityScanOptions {
  /** Scan scope */
  scope: ScanScope;
  /** Rules to enable (empty = all) */
  enabledRules: SecurityRuleId[];
  /** Rules to disable */
  disabledRules: SecurityRuleId[];
  /** Minimum severity to report */
  minSeverity: SecuritySeverity;
  /** Minimum confidence to report */
  minConfidence: DetectionConfidence;
  /** Fail build on vulnerabilities */
  failOnVulnerabilities: boolean;
  /** Maximum number of findings */
  maxFindings?: number;
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  /** Scan ID */
  scanId: string;
  /** Timestamp */
  timestamp: Date;
  /** Scan duration (ms) */
  duration: number;
  /** Files scanned */
  filesScanned: number;
  /** Files with issues */
  filesWithIssues: number;
  /** Vulnerabilities found */
  vulnerabilities: VulnerabilityFinding[];
  /** Dependency vulnerabilities */
  dependencyVulnerabilities: DependencyVulnerability[];
  /** Secrets found */
  secrets: SecretFinding[];
  /** Configuration checks */
  configChecks: ConfigCheck[];
  /** Summary statistics */
  summary: SecuritySummary;
  /** Success */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Security summary statistics
 */
export interface SecuritySummary {
  /** Total findings */
  total: number;
  /** Breakdown by severity */
  bySeverity: Record<SecuritySeverity, number>;
  /** Breakdown by category */
  byCategory: Record<VulnerabilityCategory, number>;
  /** Top affected files */
  topFiles: Array<{
    file: string;
    count: number;
  }>;
}

/**
 * Security rule definition
 */
export interface SecurityRule {
  /** Rule ID */
  id: SecurityRuleId;
  /** Rule name */
  name: string;
  /** Category */
  category: VulnerabilityCategory;
  /** Default severity */
  severity: SecuritySeverity;
  /** Description */
  description: string;
  /** Rule pattern (regex, AST, etc.) */
  pattern: unknown;
  /** Language/file type this applies to */
  languages: string[];
  /** Remediation guidance */
  remediation: Remediation;
  /** CWE ID */
  cweId?: string;
  /** OWASP reference */
  owaspRef?: string;
  /** Enabled by default */
  enabled: boolean;
}

/**
 * Security rule engine interface
 */
export interface SecurityRuleEngine {
  /** Load rules from configuration */
  loadRules(config: unknown): Promise<void>;
  /** Scan file for vulnerabilities */
  scanFile(filePath: string, content: string): Promise<VulnerabilityFinding[]>;
  /** Get all loaded rules */
  getRules(): SecurityRule[];
  /** Enable/disable rule */
  toggleRule(ruleId: SecurityRuleId, enabled: boolean): void;
}

/**
 * Vulnerability scanner interface
 */
export interface VulnerabilityScanner {
  /** Scan a directory */
  scanDirectory(
    directory: string,
    options: SecurityScanOptions
  ): Promise<SecurityScanResult>;
  /** Scan a single file */
  scanFile(filePath: string, options: SecurityScanOptions): Promise<VulnerabilityFinding[]>;
  /** Scan for dependencies */
  scanDependencies(
    packageLockPath: string
  ): Promise<DependencyVulnerability[]>;
  /** Scan for secrets */
  scanSecrets(directory: string): Promise<SecretFinding[]>;
  /** Scan configuration */
  scanConfig(directory: string): Promise<ConfigCheck[]>;
}

/**
 * Dependency checker interface
 */
export interface DependencyChecker {
  /** Check for known vulnerabilities */
  checkVulnerabilities(packagePath: string): Promise<DependencyVulnerability[]>;
  /** Check for outdated packages */
  checkOutdated(packagePath: string): Promise<DependencyVulnerability[]>;
  /** Run npm audit */
  runNpmAudit(options?: {
    production?: boolean;
    dev?: boolean;
    auditLevel?: "info" | "low" | "moderate" | "high" | "critical";
  }): Promise<DependencyVulnerability[]>;
}

/**
 * Security report format
 */
export enum SecurityReportFormat {
  JSON = "json",
  SARIF = "sarif", // Static Analysis Results Interchange Format
  MARKDOWN = "markdown",
  HTML = "html",
  JUNIT = "junit",
}

/**
 * Security report options
 */
export interface SecurityReportOptions {
  /** Output format */
  format: SecurityReportFormat;
  /** Include code snippets */
  includeSnippets: boolean;
  /** Group by severity */
  groupBySeverity: boolean;
  /** Group by category */
  groupByCategory: boolean;
  /** Include remediation */
  includeRemediation: boolean;
  /** Min severity to include */
  minSeverity: SecuritySeverity;
}

/**
 * Security report generator interface
 */
export interface SecurityReportGenerator {
  /** Generate report from scan results */
  generateReport(
    results: SecurityScanResult[],
    options: SecurityReportOptions
  ): Promise<string>;
  /** Write report to file */
  writeReport(
    results: SecurityScanResult[],
    outputPath: string,
    options: SecurityReportOptions
  ): Promise<void>;
  /** Generate SARIF format */
  generateSARIF(results: SecurityScanResult[]): Promise<object>;
  /** Generate summary metrics */
  generateSummary(results: SecurityScanResult[]): SecuritySummary;
}

/**
 * Security metrics for tracking over time
 */
export interface SecurityMetrics {
  /** Timestamp */
  timestamp: Date;
  /** Total vulnerabilities */
  totalVulnerabilities: number;
  /** Critical vulnerabilities */
  criticalCount: number;
  /** High vulnerabilities */
  highCount: number;
  /** Medium vulnerabilities */
  mediumCount: number;
  /** Low vulnerabilities */
  lowCount: number;
  /** Info vulnerabilities */
  infoCount: number;
  /** Vulnerabilities fixed since last scan */
  fixedCount: number;
  /** New vulnerabilities since last scan */
  newCount: number;
  /** Trend (improving, stable, degrading) */
  trend: "improving" | "stable" | "degrading";
}

/**
 * Security benchmark for comparison
 */
export interface SecurityBenchmark {
  /** Industry/organization name */
  name: string;
  /** Average vulnerabilities per project */
  avgVulnerabilities: number;
  /** Average critical vulnerabilities */
  avgCritical: number;
  /** Average high vulnerabilities */
  avgHigh: number;
  /** Average time to remediate (days) */
  avgRemediationTime: number;
}

/**
 * Security audit policy definition
 */
export interface SecurityAuditPolicy {
  /** Policy name */
  name: string;
  /** Description */
  description: string;
  /** Maximum allowed vulnerabilities by severity */
  maxAllowedVulnerabilities: Partial<Record<SecuritySeverity, number>>;
  /** Required scan frequency (days) */
  scanFrequency: number;
  /** Fail build on policy violation */
  failOnViolation: boolean;
  /** Exceptions */
  exceptions: SecurityPolicyException[];
}

/**
 * Policy exception
 */
export interface SecurityPolicyException {
  /** Vulnerability ID or pattern */
  vulnerability: string;
  /** Reason for exception */
  reason: string;
  /** Expiration date */
  expires?: Date;
  /** Approved by */
  approvedBy: string;
}

/**
 * Policy compliance result
 */
export interface PolicyComplianceResult {
  /** Policy name */
  policy: string;
  /** Compliant */
  compliant: boolean;
  /** Violations */
  violations: Array<{
    severity: SecuritySeverity;
    actual: number;
    allowed: number;
  }>;
  /** Exceptions applied */
  exceptions: number;
}
