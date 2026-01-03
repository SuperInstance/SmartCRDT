/**
 * @lsi/security-audit - Security auditing and vulnerability scanning
 *
 * Comprehensive security scanning for the Aequor platform:
 * - Code vulnerability detection
 * - Dependency vulnerability checking
 * - Secret detection
 * - Security reporting (JSON, SARIF, Markdown, HTML, JUnit)
 * - Penetration testing tools
 * - Security hardening utilities
 */

// ========== Core Scanner ==========
export {
  VulnerabilityScanner,
  createVulnerabilityScanner,
} from "./scanners/VulnerabilityScanner.js";

// ========== Dependency Checker ==========
export {
  DependencyChecker,
  createDependencyChecker,
  type DependencyCheckerOptions,
} from "./scanners/DependencyChecker.js";

// ========== Security Rule Engine ==========
export {
  SecurityRuleEngine,
  createSecurityRuleEngine,
  type SecurityRuleEngineConfig,
  type SecurityRuleDefinition,
  type RulePattern,
} from "./rules/SecurityRuleEngine.js";

// ========== Report Generator ==========
export {
  SecurityReportGenerator,
  createSecurityReportGenerator,
} from "./reporters/SecurityReportGenerator.js";

// ========== Penetration Testing ==========
export {
  SQLInjectionTester,
  createSQLInjectionTester,
  type SQLInjectionTestResult,
  type SQLInjectionTestConfig,
  type SQLInjectionType,
} from "./pentest/SQLInjectionTester.js";

export {
  XSSTester,
  createXSSTester,
  type XSSTestResult,
  type XSSTestConfig,
  type XSSAttackType,
  type XSSContext,
} from "./pentest/XSSTester.js";

export {
  CSRFTester,
  createCSRFTester,
  type CSRFTestResult,
  type CSRFTestConfig,
  type CSRFVulnerabilityType,
} from "./pentest/CSRFTester.js";

export {
  AuthTester,
  createAuthTester,
  type AuthTestResult,
  type AuthTestConfig,
  type AuthVulnerabilityType,
  type PasswordStrengthResult,
} from "./pentest/AuthTester.js";

export {
  RateLimitTester,
  createRateLimitTester,
  type RateLimitTestResult,
  type RateLimitTestConfig,
  type RateLimitBypassTechnique,
} from "./pentest/RateLimitTester.js";

// ========== Security Hardening ==========
export {
  SecurityHeaders,
  createSecurityHeaders,
  type SecurityHeaderResult,
  type SecurityHeaderConfig,
  type SecurityHeaderType,
  type CSPPolicy,
  type CORSPolicy,
  type ReferrerPolicy,
} from "./hardening/SecurityHeaders.js";

export {
  InputValidator,
  createInputValidator,
  ValidationSchemas,
  type ValidationResult,
  type ValidationRule,
  type ValidationSchema,
} from "./hardening/InputValidation.js";

export {
  OutputEncoder,
  EncodingUtils,
  HTMLEncoder,
  URLEncoder,
  JSEncoder,
} from "./hardening/OutputEncoding.js";

export {
  CryptoHardening,
  createCryptoHardening,
  CryptoUtils,
  type CryptoValidationResult,
  type SymmetricAlgorithm,
  type HashAlgorithm,
  type KDFAlgorithm,
} from "./hardening/CryptoHardening.js";

// ========== Advanced Scanners ==========
export {
  DependencyScanner,
  createDependencyScanner,
  scanDependencies,
  type DependencyScanResult,
  type DependencyVulnerability,
  type OutdatedPackage,
  type LicenseInfo,
  type DependencyScannerConfig,
  type VulnerabilitySeverity,
} from "./scanner-v2/DependencyScanner.js";

export {
  CodeScanner,
  createCodeScanner,
  scanCode,
  type CodeScanFinding,
  type SecretPattern,
  type InsecureFunction,
  type CodeScannerConfig,
} from "./scanner-v2/CodeScanner.js";

// ========== Reports ==========
export {
  PentestReport,
  createPentestReport,
  generatePentestReport,
  type PentestReportData,
  type FindingWithCVSS,
  type TestSummary,
  type ReportFormat,
} from "./reports/PentestReport.js";

export {
  HardeningChecklistGenerator,
  createHardeningChecklist,
  generateChecklistMarkdown,
  type HardeningChecklist,
  type ChecklistItem,
  type ChecklistCategory,
  type ChecklistStatus,
} from "./reports/HardeningChecklist.js";

// ========== Utilities ==========
export {
  createVulnerabilityId,
  resetIdCounter,
  parseRuleId,
  generateScanId,
} from "./utils/idGenerator.js";

export {
  fileMatchesPatterns,
  getMatchingFiles,
  isBinaryFile,
  getFileLanguage,
} from "./utils/fileMatcher.js";
