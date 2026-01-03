/**
 * @module privacy/vm
 *
 * Secure VM for executing untrusted knowledge cartridges.
 * Provides WebAssembly-based sandboxing with resource limits and isolation.
 */

// Core interfaces and types
export {
  SecureVM,
  ResourceLimits,
  ResourceUsage,
  ExecutionRequest,
  ExecutionResult,
  VMError,
  VMState,
  VMSnapshot,
  VMMessage,
  VerificationResult,
  VMErrorCode,
  DEFAULT_RESOURCE_LIMITS,
  createVMError,
  canExecute,
  canChangeState,
} from "./SecureVM.js";

// WebAssembly sandbox implementation
export {
  WASMSandbox,
  WASMConfig,
  DEFAULT_WASM_CONFIG,
  ConsoleOutput,
  createWASMSandbox,
} from "./WASMSandbox.js";

// VM lifecycle manager
export {
  VMManager,
  SecureVMConfig,
  VMInfo,
  VMManagerStats,
  CreateVMOptions,
  getVMManager,
  resetVMManager,
} from "./VMManager.js";

// Code signing and verification
export {
  CodeSigner,
  Signature,
  KeyPair,
  SigningOptions,
  SignatureAlgorithm,
  getCodeSigner,
  resetCodeSigner,
} from "./CodeSigner.js";

// Resource monitoring
export {
  ResourceMonitor,
  ResourceExhaustion,
  ResourceUsageSnapshot,
  ResourceUsageReport,
  AggregateResourceUsage,
  MonitoringConfig,
  getResourceMonitor,
  resetResourceMonitor,
} from "./ResourceMonitor.js";

// Enhanced WASM sandbox
export {
  WASMSandboxEnhanced,
  EnhancedWASMConfig,
  DEFAULT_ENHANCED_CONFIG,
  VFSEntry,
  VirtualFSConfig,
  SandboxedNetworkConfig,
  NetworkRequest,
  NetworkResponse,
  CapabilityRequest,
  MessageHandler,
  createWASMSandboxEnhanced,
} from "./WASMSandboxEnhanced.js";

// Cartridge VM Bridge
export {
  CartridgeVMBridge,
  SandboxedCartridge,
  CartridgeResult,
  ResourceQuota,
  SandboxChannel,
  ChannelConfig,
  ChannelStats,
  CartridgeVMConfig,
  DEFAULT_CARTRIDGE_VM_CONFIG,
  getCartridgeVMBridge,
  resetCartridgeVMBridge,
} from "./CartridgeVMBridge.js";

// Sandboxed Cartridge Executor
export {
  SandboxedCartridgeExecutor,
  CartridgeRequest,
  CartridgeResponse,
  CartridgeExecutionError,
  RecoveryAction,
  CartridgeInfo,
  CartridgeInstanceState,
  ErrorResolution,
  RecoveryResult,
  ExecutorConfig,
  DEFAULT_EXECUTOR_CONFIG,
  getSandboxedCartridgeExecutor,
  resetSandboxedCartridgeExecutor,
} from "./SandboxedCartridgeExecutor.js";

// Security enhancements
export {
  SecurityManager,
  createSecurityManager,
  DEFAULT_ENHANCED_SECURITY_CONFIG,
  DEFAULT_NETWORK_POLICY,
  DEFAULT_FILESYSTEM_POLICY,
  DEFAULT_CPU_QUOTA,
  DEFAULT_CHANNEL_SECURITY,
  type SecurityEventType,
  type SecurityEvent,
  type NetworkPolicy,
  type FilesystemPolicy,
  type CPUQuota,
  type IsolationVerificationResult,
  type StateVerificationResult,
  type ChannelSecurity,
  type EnhancedSecurityConfig,
} from "./SecureVMEnhancements.js";
