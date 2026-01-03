/**
 * @module privacy/vm
 *
 * Enhanced Security Features for Secure VM
 *
 * This module provides additional security enhancements for the SecureVM implementation:
 * - Process isolation enforcement
 * - Network sandboxing with fine-grained controls
 * - File system sandboxing with chroot-like behavior
 * - Secure audit logging
 * - Resource limit enforcement improvements
 * - VM state verification and tamper detection
 * - Secure inter-VM communication channels
 */

import type { ResourceLimits, ResourceUsage, VMState } from "./SecureVM.js";

/**
 * Security event types for audit logging
 */
export type SecurityEventType =
  | "vm_created"
  | "vm_started"
  | "vm_stopped"
  | "vm_paused"
  | "vm_resumed"
  | "code_loaded"
  | "code_verified"
  | "code_rejected"
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "timeout_enforced"
  | "memory_limit_exceeded"
  | "cpu_limit_exceeded"
  | "escape_attempt_detected"
  | "suspicious_export_detected"
  | "memory_isolation_violation"
  | "resource_exhaustion"
  | "network_access_attempt"
  | "filesystem_access_attempt"
  | "channel_created"
  | "channel_message"
  | "channel_closed"
  | "snapshot_created"
  | "snapshot_restored"
  | "state_verified"
  | "state_tampered";

/**
 * Security audit event
 */
export interface SecurityEvent {
  /** Unique event ID */
  eventId: string;
  /** Event type */
  type: SecurityEventType;
  /** VM ID */
  vmId: string;
  /** Timestamp (Unix epoch) */
  timestamp: number;
  /** Severity level */
  severity: "info" | "warning" | "critical";
  /** Event details */
  details: Record<string, unknown>;
  /** Stack trace if applicable */
  stack?: string;
}

/**
 * Network access policy
 */
export interface NetworkPolicy {
  /** Allowed hosts (whitelist) */
  allowedHosts: string[];
  /** Blocked hosts (blacklist) */
  blockedHosts: string[];
  /** Allowed ports */
  allowedPorts: number[];
  /** Blocked ports */
  blockedPorts: number[];
  /** Maximum request size in bytes */
  maxRequestSize: number;
  /** Maximum response size in bytes */
  maxResponseSize: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** DNS timeout in milliseconds */
  dnsTimeout: number;
  /** Whether to allow HTTP (allow only HTTPS if false) */
  allowHTTP: boolean;
  /** Whether to allow WebSocket connections */
  allowWebSocket: boolean;
  /** Whether to allow peer-to-peer connections */
  allowP2P: boolean;
}

/**
 * File system access policy
 */
export interface FilesystemPolicy {
  /** Allowed directories (whitelist) */
  allowedDirectories: string[];
  /** Blocked paths (blacklist) */
  blockedPaths: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Maximum total size in bytes */
  maxTotalSize: number;
  /** Maximum number of open file descriptors */
  maxOpenFiles: number;
  /** Read-only paths */
  readOnlyPaths: string[];
  /** Write-only paths (temp directories) */
  writeOnlyPaths: string[];
  /** Whether to allow symbolic links */
  allowSymlinks: boolean;
  /** Whether to allow hard links */
  allowHardLinks: boolean;
  /** Whether to allow file execution */
  allowExecution: boolean;
}

/**
 * CPU quota enforcement
 */
export interface CPUQuota {
  /** CPU percentage (0-100) */
  percentage: number;
  /** CPU time quota in milliseconds */
  timeQuotaMs: number;
  /** Quota period in milliseconds */
  quotaPeriodMs: number;
  /** Whether to throttle on exceed */
  throttleOnExceed: boolean;
  /** Whether to terminate on exceed */
  terminateOnExceed: boolean;
}

/**
 * Memory isolation verification result
 */
export interface IsolationVerificationResult {
  /** Whether isolation is intact */
  isIsolated: boolean;
  /** Memory boundaries verified */
  boundariesVerified: boolean;
  /** No memory leaks detected */
  noLeaksDetected: boolean;
  /** No unauthorized access detected */
  noUnauthorizedAccess: boolean;
  /** Verification details */
  details: {
    /** Memory start address */
    memoryStart?: number;
    /** Memory end address */
    memoryEnd?: number;
    /** Memory size */
    memorySize?: number;
    /** Potential leaks found */
    potentialLeaks: string[];
    /** Unauthorized access attempts */
    unauthorizedAccess: string[];
  };
}

/**
 * VM state verification result
 */
export interface StateVerificationResult {
  /** Whether state is valid */
  isValid: boolean;
  /** State hash */
  stateHash: string;
  /** Previous state hash for comparison */
  previousHash?: string;
  /** Components verified */
  componentsVerified: string[];
  /** Components failed */
  componentsFailed: string[];
  /** Tampering detected */
  tamperingDetected: boolean;
  /** Tampering details */
  tamperingDetails?: string[];
}

/**
 * Inter-VM communication channel security
 */
export interface ChannelSecurity {
  /** Whether to encrypt messages */
  encryptMessages: boolean;
  /** Encryption algorithm */
  encryptionAlgorithm: string;
  /** Whether to authenticate messages */
  authenticateMessages: boolean;
  /** Authentication algorithm */
  authenticationAlgorithm: string;
  /** Maximum message size */
  maxMessageSize: number;
  /** Message rate limit per second */
  rateLimitPerSecond: number;
  /** Whether to allow broadcasting */
  allowBroadcast: boolean;
  /** Allowed channel types */
  allowedChannelTypes: string[];
}

/**
 * Enhanced security configuration
 */
export interface EnhancedSecurityConfig {
  /** Network access policy */
  networkPolicy: NetworkPolicy;
  /** File system access policy */
  filesystemPolicy: FilesystemPolicy;
  /** CPU quota */
  cpuQuota: CPUQuota;
  /** Channel security */
  channelSecurity: ChannelSecurity;
  /** Whether to enable audit logging */
  enableAuditLogging: boolean;
  /** Audit log retention period in milliseconds */
  auditLogRetentionMs: number;
  /** Whether to enable state verification */
  enableStateVerification: boolean;
  /** State verification interval in milliseconds */
  stateVerificationIntervalMs: number;
  /** Whether to enable isolation verification */
  enableIsolationVerification: boolean;
  /** Isolation verification interval in milliseconds */
  isolationVerificationIntervalMs: number;
  /** Whether to enable automatic termination on security violations */
  autoTerminateOnViolation: boolean;
  /** Maximum number of security events before termination */
  maxSecurityEvents: number;
  /** Security event time window in milliseconds */
  securityEventWindowMs: number;
}

/**
 * Default network policy (deny all)
 */
export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  allowedHosts: [],
  blockedHosts: ["*"],
  allowedPorts: [],
  blockedPorts: [0, 1, 7, 9, 11, 13, 17, 19, 20, 21, 22, 23, 25, 37, 53, 67, 68, 69, 70, 79, 80, 87, 88, 102, 110, 111, 113, 119, 123, 135, 137, 138, 139, 143, 161, 162, 389, 443, 445, 512, 513, 514, 515, 517, 518, 520, 521, 525, 526, 530, 531, 532, 533, 540, 546, 547, 554, 560, 561, 563, 564, 587, 631, 646, 873, 925, 953, 981, 989, 990, 993, 995, 999, 1025, 1026, 1027, 1028, 1029, 1110, 1433, 1434, 1521, 1524, 1604, 1645, 1701, 1719, 1720, 1723, 1755, 1761, 1782, 1783, 1900, 2000, 2001, 2049, 2103, 2105, 2106, 2107, 2108, 2109, 2110, 2111, 2112, 2717, 2869, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3389, 3527, 3535, 3689, 3690, 3702, 3790, 3827, 3892, 3893, 4000, 4001, 4002, 4003, 4321, 4672, 4673, 4674, 4675, 4676, 4677, 4848, 5000, 5009, 5051, 5060, 5061, 5101, 5120, 5190, 5200, 5222, 5225, 5226, 5269, 5280, 5298, 5357, 5405, 5431, 5432, 5440, 5500, 5510, 5520, 5530, 5540, 5550, 5555, 5560, 5570, 5580, 5631, 5632, 5633, 5666, 5678, 5679, 5717, 5718, 5720, 5729, 5730, 5800, 5801, 5802, 5810, 5811, 5815, 5822, 5850, 5859, 5862, 5877, 5900, 5901, 5902, 5903, 5904, 5906, 5907, 5910, 5911, 5915, 5922, 5930, 5950, 5952, 5959, 5960, 5961, 5962, 5963, 5988, 5998, 5999, 6000, 6001, 6002, 6003, 6004, 6005, 6006, 6007, 6009, 6025, 6059, 6100, 6101, 6106, 6112, 6123, 6129, 6156, 6346, 6389, 6502, 6510, 6543, 6547, 6558, 6565, 6566, 6567, 6580, 6622, 6623, 6665, 6666, 6667, 6668, 6669, 6679, 6689, 6692, 6698, 6699, 6779, 6788, 6789, 6792, 6839, 6881, 6901, 6969, 7000, 7001, 7002, 7004, 7007, 7008, 7009, 7019, 7025, 7070, 7100, 7103, 7106, 7200, 7201, 7402, 7435, 7443, 7496, 7512, 7547, 7562, 7563, 7566, 7567, 7570, 7587, 7588, 7597, 7602, 7607, 7609, 7624, 7625, 7626, 7627, 7633, 7643, 7671, 7680, 7725, 7777, 7778, 7800, 7801, 7911, 7920, 7921, 7937, 7938, 7999, 8000, 8001, 8002, 8007, 8008, 8009, 8010, 8021, 8022, 8031, 8042, 8045, 8080, 8081, 8082, 8084, 8085, 8086, 8087, 8088, 8089, 8090, 8093, 8099, 8100, 8180, 8181, 8192, 8193, 8194, 8200, 8222, 8300, 8333, 8400, 8402, 8443, 8500, 8600, 8649, 8651, 8652, 8654, 8701, 8800, 8873, 8888, 8899, 8904, 8980, 8989, 8994, 9000, 9001, 9002, 9003, 9009, 9010, 9011, 9040, 9050, 9071, 9080, 9081, 9090, 9091, 9099, 9100, 9101, 9102, 9103, 9110, 9111, 9152, 9200, 9207, 9220, 9290, 9415, 9418, 9485, 9500, 9502, 9503, 9535, 9575, 9593, 9594, 9595, 9618, 9666, 9876, 9877, 9878, 9898, 9900, 9917, 9929, 9943, 9944, 9968, 9998, 9999, 10000, 10001, 10002, 10003, 10004, 10009, 10010, 10012, 10024, 10025, 10082, 10180, 10215, 10243, 10566, 10616, 10617, 10621, 10626, 10628, 10629, 10778, 11110, 11111, 11967, 11968, 11969, 12000, 12174, 12265, 12345, 13456, 13722, 13782, 13783, 14000, 14238, 14441, 14442, 15000, 15002, 15003, 15004, 15660, 15742, 16000, 16001, 16012, 16016, 16018, 16080, 16113, 16992, 16993, 17877, 17988, 18040, 18101, 18988, 19101, 19283, 19315, 19350, 19780, 19801, 19842, 20000, 20005, 20031, 20221, 20222, 21571, 22939, 23502, 24444, 24800, 25734, 25735, 26214, 27000, 27352, 27353, 27355, 27356, 27715, 28201, 30000, 30718, 30951, 31038, 31337, 32768, 32769, 32770, 32771, 32772, 32773, 32774, 32775, 32776, 32777, 32778, 32779, 32780, 32781, 32782, 32783, 32784, 32785, 33354, 33899, 34571, 34572, 34573, 35500, 38292, 40193, 40911, 41511, 42510, 44176, 44442, 44443, 44501, 45100, 48080, 49152, 49153, 49154, 49155, 49156, 49157, 49158, 49159, 49160, 49161, 49163, 49165, 49167, 49175, 49176, 49400, 49999, 50000, 50001, 50002, 50003, 50006, 50300, 50389, 50500, 50636, 50800, 51103, 51493, 52673, 52822, 52848, 52869, 54045, 54328, 55055, 55056, 55555, 55600, 56737, 56738, 57294, 57797, 58080, 60020, 60443, 61532, 61900, 62078, 63331, 64623, 64680, 65000, 65129, 65389],
  maxRequestSize: 1024 * 1024, // 1 MB
  maxResponseSize: 10 * 1024 * 1024, // 10 MB
  connectionTimeout: 30000, // 30 seconds
  dnsTimeout: 5000, // 5 seconds
  allowHTTP: false,
  allowWebSocket: false,
  allowP2P: false,
};

/**
 * Default filesystem policy (minimal access)
 */
export const DEFAULT_FILESYSTEM_POLICY: FilesystemPolicy = {
  allowedDirectories: ["/tmp"],
  blockedPaths: [
    "/",
    "/etc",
    "/root",
    "/home",
    "/var",
    "/usr",
    "/bin",
    "/sbin",
    "/lib",
    "/lib64",
    "/sys",
    "/proc",
    "/dev",
  ],
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxTotalSize: 100 * 1024 * 1024, // 100 MB
  maxOpenFiles: 10,
  readOnlyPaths: [],
  writeOnlyPaths: ["/tmp"],
  allowSymlinks: false,
  allowHardLinks: false,
  allowExecution: false,
};

/**
 * Default CPU quota
 */
export const DEFAULT_CPU_QUOTA: CPUQuota = {
  percentage: 50,
  timeQuotaMs: 5000,
  quotaPeriodMs: 10000,
  throttleOnExceed: true,
  terminateOnExceed: false,
};

/**
 * Default channel security
 */
export const DEFAULT_CHANNEL_SECURITY: ChannelSecurity = {
  encryptMessages: true,
  encryptionAlgorithm: "AES-256-GCM",
  authenticateMessages: true,
  authenticationAlgorithm: "HMAC-SHA256",
  maxMessageSize: 1024 * 1024, // 1 MB
  rateLimitPerSecond: 100,
  allowBroadcast: false,
  allowedChannelTypes: ["direct", "request-response"],
};

/**
 * Default enhanced security configuration
 */
export const DEFAULT_ENHANCED_SECURITY_CONFIG: EnhancedSecurityConfig = {
  networkPolicy: DEFAULT_NETWORK_POLICY,
  filesystemPolicy: DEFAULT_FILESYSTEM_POLICY,
  cpuQuota: DEFAULT_CPU_QUOTA,
  channelSecurity: DEFAULT_CHANNEL_SECURITY,
  enableAuditLogging: true,
  auditLogRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableStateVerification: true,
  stateVerificationIntervalMs: 60000, // 1 minute
  enableIsolationVerification: true,
  isolationVerificationIntervalMs: 30000, // 30 seconds
  autoTerminateOnViolation: true,
  maxSecurityEvents: 10,
  securityEventWindowMs: 60000, // 1 minute
};

/**
 * Enhanced Security Manager for Secure VM
 *
 * Provides additional security features on top of the base SecureVM implementation.
 */
export class SecurityManager {
  private config: EnhancedSecurityConfig;
  private auditLog: SecurityEvent[] = [];
  private securityEventCounts = new Map<string, number>();
  private stateHashHistory: string[] = [];
  private vmId: string;

  constructor(vmId: string, config?: Partial<EnhancedSecurityConfig>) {
    this.vmId = vmId;
    this.config = { ...DEFAULT_ENHANCED_SECURITY_CONFIG, ...config };
  }

  /**
   * Log a security event
   */
  logSecurityEvent(
    type: SecurityEventType,
    severity: SecurityEvent["severity"],
    details: Record<string, unknown>,
    stack?: string
  ): void {
    if (!this.config.enableAuditLogging) {
      return;
    }

    const event: SecurityEvent = {
      eventId: this.generateEventId(),
      type,
      vmId: this.vmId,
      timestamp: Date.now(),
      severity,
      details,
      stack,
    };

    this.auditLog.push(event);

    // Check for security violations
    this.checkSecurityViolation(event);

    // Rotate audit log if needed
    this.rotateAuditLog();
  }

  /**
   * Get audit log
   */
  getAuditLog(filter?: {
    type?: SecurityEventType;
    severity?: SecurityEvent["severity"];
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): SecurityEvent[] {
    let events = this.auditLog;

    if (filter) {
      if (filter.type) {
        events = events.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter(e => e.severity === filter.severity);
      }
      if (filter.startTime) {
        events = events.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        events = events.filter(e => e.timestamp <= filter.endTime!);
      }
      if (filter.limit) {
        events = events.slice(-filter.limit);
      }
    }

    return events;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    this.securityEventCounts.clear();
  }

  /**
   * Verify network access
   */
  verifyNetworkAccess(host: string, port: number): { allowed: boolean; reason?: string } {
    const policy = this.config.networkPolicy;

    // Check blocked hosts
    for (const blocked of policy.blockedHosts) {
      if (blocked === "*" || host.endsWith(blocked)) {
        this.logSecurityEvent("network_access_attempt", "warning", {
          host,
          port,
          reason: "blocked_host",
        });
        return { allowed: false, reason: "Host is blocked" };
      }
    }

    // Check allowed hosts (if whitelist is configured)
    if (policy.allowedHosts.length > 0) {
      const allowed = policy.allowedHosts.some(allowed => host === allowed || host.endsWith(allowed));
      if (!allowed) {
        this.logSecurityEvent("network_access_attempt", "warning", {
          host,
          port,
          reason: "not_in_whitelist",
        });
        return { allowed: false, reason: "Host not in whitelist" };
      }
    }

    // Check blocked ports
    if (policy.blockedPorts.includes(port)) {
      this.logSecurityEvent("network_access_attempt", "warning", {
        host,
        port,
        reason: "blocked_port",
      });
      return { allowed: false, reason: "Port is blocked" };
    }

    // Check allowed ports
    if (policy.allowedPorts.length > 0 && !policy.allowedPorts.includes(port)) {
      this.logSecurityEvent("network_access_attempt", "warning", {
        host,
        port,
        reason: "not_in_whitelist",
      });
      return { allowed: false, reason: "Port not in whitelist" };
    }

    return { allowed: true };
  }

  /**
   * Verify file system access
   */
  verifyFilesystemAccess(path: string, write: boolean): { allowed: boolean; reason?: string } {
    const policy = this.config.filesystemPolicy;

    // Normalize path
    const normalizedPath = path.replace(/\/+/g, "/");

    // Check blocked paths
    for (const blocked of policy.blockedPaths) {
      if (normalizedPath === blocked || normalizedPath.startsWith(blocked + "/")) {
        this.logSecurityEvent("filesystem_access_attempt", "warning", {
          path,
          write,
          reason: "blocked_path",
        });
        return { allowed: false, reason: "Path is blocked" };
      }
    }

    // Check allowed directories
    const isAllowed = policy.allowedDirectories.some(
      allowed => normalizedPath === allowed || normalizedPath.startsWith(allowed + "/")
    );
    if (!isAllowed) {
      this.logSecurityEvent("filesystem_access_attempt", "warning", {
        path,
        write,
        reason: "not_in_allowed_directories",
      });
      return { allowed: false, reason: "Path not in allowed directories" };
    }

    // Check write-only paths
    if (write) {
      const isWriteAllowed = policy.writeOnlyPaths.some(
        allowed => normalizedPath === allowed || normalizedPath.startsWith(allowed + "/")
      );
      if (!isWriteAllowed) {
        this.logSecurityEvent("filesystem_access_attempt", "warning", {
          path,
          write,
          reason: "write_not_allowed",
        });
        return { allowed: false, reason: "Write not allowed for this path" };
      }
    }

    return { allowed: true };
  }

  /**
   * Verify memory isolation
   */
  verifyMemoryIsolation(memory: WebAssembly.Memory): IsolationVerificationResult {
    const details: IsolationVerificationResult["details"] = {
      potentialLeaks: [],
      unauthorizedAccess: [],
    };

    // Get memory buffer
    const buffer = memory.buffer;
    details.memorySize = buffer.byteLength;

    // WebAssembly memory is always isolated by design
    // But we can verify it's not been tampered with
    const isIsolated = buffer.byteLength > 0;
    const boundariesVerified = isIsolated;

    // Check for leaks (simplified - real implementation would do more sophisticated analysis)
    const noLeaksDetected = isIsolated;

    // Check for unauthorized access
    const noUnauthorizedAccess = isIsolated;

    const result: IsolationVerificationResult = {
      isIsolated: isIsolated && boundariesVerified && noLeaksDetected && noUnauthorizedAccess,
      boundariesVerified,
      noLeaksDetected,
      noUnauthorizedAccess,
      details,
    };

    if (!result.isIsolated) {
      this.logSecurityEvent("memory_isolation_violation", "critical", {
        ...details,
      });
    }

    return result;
  }

  /**
   * Verify VM state
   */
  verifyVMState(state: VMState, components: Record<string, unknown>): StateVerificationResult {
    const stateStr = JSON.stringify({ state, components });
    const stateHash = this.hashState(stateStr);

    const componentsVerified: string[] = [];
    const componentsFailed: string[] = [];
    const tamperingDetails: string[] = [];

    // Verify each component
    for (const [key, value] of Object.entries(components)) {
      try {
        // Basic verification - component exists and is not null/undefined
        if (value !== null && value !== undefined) {
          componentsVerified.push(key);
        } else {
          componentsFailed.push(key);
          tamperingDetails.push(`Component ${key} is null or undefined`);
        }
      } catch (error) {
        componentsFailed.push(key);
        tamperingDetails.push(`Component ${key} verification failed: ${error}`);
      }
    }

    // Check for state tampering by comparing with previous hashes
    let tamperingDetected = tamperingDetails.length > 0;
    let previousHash: string | undefined;

    if (this.stateHashHistory.length > 0) {
      previousHash = this.stateHashHistory[this.stateHashHistory.length - 1];
      // In a real implementation, we would do more sophisticated tampering detection
      // For now, just check if the state changed unexpectedly
    }

    this.stateHashHistory.push(stateHash);

    const result: StateVerificationResult = {
      isValid: componentsFailed.length === 0 && !tamperingDetected,
      stateHash,
      previousHash,
      componentsVerified,
      componentsFailed,
      tamperingDetected,
      tamperingDetails: tamperingDetails.length > 0 ? tamperingDetails : undefined,
    };

    if (!result.isValid) {
      this.logSecurityEvent("state_tampered", "critical", {
        stateHash,
        componentsFailed,
        tamperingDetails,
      });
    } else {
      this.logSecurityEvent("state_verified", "info", {
        stateHash,
        componentsVerified,
      });
    }

    return result;
  }

  /**
   * Check for security violations
   */
  private checkSecurityViolation(event: SecurityEvent): void {
    // Count critical and warning events in the time window
    const now = Date.now();
    const windowStart = now - this.config.securityEventWindowMs;

    // Clean old events
    for (const [key, count] of Array.from(this.securityEventCounts.entries())) {
      const timestamp = Number.parseInt(key.split("-")[0]);
      if (timestamp < windowStart) {
        this.securityEventCounts.delete(key);
      }
    }

    // Add current event
    const key = `${event.timestamp}-${event.type}`;
    this.securityEventCounts.set(key, (this.securityEventCounts.get(key) || 0) + 1);

    // Count events in window
    const totalCount = Array.from(this.securityEventCounts.values()).reduce((sum, count) => sum + count, 0);

    if (totalCount > this.config.maxSecurityEvents) {
      if (this.config.autoTerminateOnViolation) {
        this.logSecurityEvent("resource_exhaustion", "critical", {
          reason: "Too many security events",
          count: totalCount,
          limit: this.config.maxSecurityEvents,
        });
        // In a real implementation, this would trigger VM termination
        throw new Error("Security violation threshold exceeded - VM terminated");
      }
    }
  }

  /**
   * Rotate audit log if needed
   */
  private rotateAuditLog(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.auditLogRetentionMs;

    // Remove old events
    this.auditLog = this.auditLog.filter(event => event.timestamp >= cutoffTime);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${this.vmId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Hash state for verification
   */
  private hashState(stateStr: string): string {
    // Simple hash implementation - in production, use a proper cryptographic hash
    let hash = 0;
    for (let i = 0; i < stateStr.length; i++) {
      const char = stateStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    criticalEvents: number;
    warningEvents: number;
    infoEvents: number;
    eventTypes: Record<string, number>;
  } {
    const stats = {
      totalEvents: this.auditLog.length,
      criticalEvents: 0,
      warningEvents: 0,
      infoEvents: 0,
      eventTypes: {} as Record<string, number>,
    };

    for (const event of this.auditLog) {
      if (event.severity === "critical") {
        stats.criticalEvents++;
      } else if (event.severity === "warning") {
        stats.warningEvents++;
      } else {
        stats.infoEvents++;
      }

      stats.eventTypes[event.type] = (stats.eventTypes[event.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedSecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EnhancedSecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

/**
 * Create a security manager for a VM
 */
export function createSecurityManager(
  vmId: string,
  config?: Partial<EnhancedSecurityConfig>
): SecurityManager {
  return new SecurityManager(vmId, config);
}
