/**
 * @lsi/manager - Component Lifecycle Management
 *
 * Manages the complete lifecycle of Aequor components:
 * - Pull components from remote registry
 * - Install components locally
 * - Run components as processes
 * - Update components to new versions
 * - Remove components and cleanup
 *
 * Inspired by Docker container management and Ollama model management.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';
import YAML from 'yaml';
import axios from 'axios';
import tar from 'archiver';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Component lifecycle states
 */
export type ComponentStatus =
  | 'remote'        // Available in registry only
  | 'pulling'       // Downloading metadata
  | 'downloading'   // Downloading files
  | 'downloaded'    // Files downloaded, ready to install
  | 'installing'    // Installing component
  | 'installed'     // Installed and ready to use
  | 'running'       // Currently running
  | 'updating'      // Updating to new version
  | 'removing'      // Removing component
  | 'failed';       // Operation failed

/**
 * Component state information
 */
export interface ComponentState {
  /** Component name */
  name: string;
  /** Component version */
  version: string;
  /** Current status */
  status: ComponentStatus;
  /** Installation path */
  path: string;
  /** Size in bytes */
  size_bytes: number;
  /** Installation timestamp */
  installed_at: Date;
  /** Last usage timestamp */
  last_used: Date;
  /** SHA256 checksum */
  checksum: string;
  /** Dependencies */
  dependencies: string[];
  /** Error message if failed */
  error?: string;
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  /** Component name */
  name: string;
  /** Target version */
  version: string;
  /** Bytes downloaded */
  downloaded_bytes: number;
  /** Total bytes */
  total_bytes: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Download speed in bytes/sec */
  speed: number;
  /** Estimated remaining time in seconds */
  eta: number;
  /** Current status message */
  status: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Component name */
  name: string;
  /** Whether verification passed */
  valid: boolean;
  /** Issues found */
  issues: string[];
  /** Checksum verification result */
  checksum_valid: boolean;
  /** Dependencies verification result */
  dependencies_valid: boolean;
  /** Configuration verification result */
  configuration_valid: boolean;
}

/**
 * Repair result
 */
export interface RepairResult {
  /** Component name */
  name: string;
  /** Whether repair was successful */
  success: boolean;
  /** Actions taken */
  actions: string[];
  /** Issues fixed */
  issues_fixed: string[];
  /** Remaining issues */
  remaining_issues: string[];
}

/**
 * Clean options
 */
export interface CleanOptions {
  /** Remove components older than this date */
  older_than?: Date;
  /** Keep these components (never remove) */
  keep?: string[];
  /** Maximum cache size in bytes */
  max_cache_size?: number;
  /** Dry run (don't actually delete) */
  dry_run?: boolean;
}

/**
 * Component manifest from registry
 */
export interface ComponentManifest {
  name: string;
  version: string;
  description: string;
  type: string;
  language: string;
  dependencies: Record<string, string>;
  checksum: string;
  size_bytes: number;
  download_url: string;
  config?: Record<string, unknown>;
}

/**
 * Aequor configuration
 */
export interface AequorConfig {
  registry_url: string;
  cache_path: string;
  components_path: string;
  config_path: string;
  max_cache_size: number;
  auto_update: boolean;
  hardware_profile: 'low' | 'medium' | 'high';
  concurrent_downloads: number;
  timeout: number;
}

/**
 * Component info (detailed metadata)
 */
export interface ComponentInfo {
  manifest: ComponentManifest;
  state: ComponentState;
  versions: string[];
  latest_version: string;
  update_available: boolean;
}

/**
 * Component event types
 */
export type ComponentEventType =
  | 'stateChange'
  | 'progress'
  | 'error'
  | 'downloadComplete'
  | 'installComplete'
  | 'updateComplete'
  | 'removeComplete';

/**
 * Component event
 */
export interface ComponentEvent {
  type: ComponentEventType;
  component: string;
  version?: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Event listener callback
 */
export type EventListener = (event: ComponentEvent) => void;

// ============================================================================
// COMPONENT STATE DATABASE
// ============================================================================

/**
 * Manages persistent state database for components
 */
class ComponentStateDatabase {
  private dbPath: string;
  private state: Map<string, ComponentState>;

  constructor(cachePath: string) {
    this.dbPath = path.join(cachePath, 'config', 'state.yaml');
    this.state = new Map();
  }

  /**
   * Load state database from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.dbPath, 'utf8');
      const data = YAML.parse(content) as { components: Record<string, unknown> };

      for (const [name, componentData] of Object.entries(data.components || {})) {
        const comp = componentData as Record<string, unknown>;
        const versions = comp.versions as Record<string, ComponentState>;

        for (const [version, state] of Object.entries(versions)) {
          this.state.set(`${name}@${version}`, state);
        }
      }
    } catch (error) {
      // File doesn't exist yet, start with empty state
      this.state.clear();
    }
  }

  /**
   * Save state database to disk
   */
  async save(): Promise<void> {
    const components: Record<string, unknown> = {};

    for (const [key, state] of this.state.entries()) {
      const [name, version] = key.split('@');
      if (!components[name]) {
        components[name] = {
          versions: {},
          current_version: version,
          state: state.status,
        };
      }
      (components[name] as Record<string, unknown>).versions[version] = state;
    }

    const content = YAML.stringify({ version: '1.0', components });
    await fs.ensureDir(path.dirname(this.dbPath));
    await fs.writeFile(this.dbPath, content, 'utf8');
  }

  /**
   * Get component state
   */
  get(name: string, version: string): ComponentState | undefined {
    return this.state.get(`${name}@${version}`);
  }

  /**
   * Set component state
   */
  set(name: string, version: string, state: ComponentState): void {
    this.state.set(`${name}@${version}`, state);
  }

  /**
   * Delete component state
   */
  delete(name: string, version: string): void {
    this.state.delete(`${name}@${version}`);
  }

  /**
   * List all components
   */
  list(): ComponentState[] {
    return Array.from(this.state.values());
  }

  /**
   * Check if component exists
   */
  has(name: string, version: string): boolean {
    return this.state.has(`${name}@${version}`);
  }
}

// ============================================================================
// COMPONENT LOCK MANAGER
// ============================================================================

/**
 * Manages file-based locks for concurrent operations
 */
class ComponentLockManager {
  private locksPath: string;
  private locks: Map<string, fs.FileHandle>;

  constructor(cachePath: string) {
    this.locksPath = path.join(cachePath, 'locks');
    this.locks = new Map();
  }

  /**
   * Acquire lock for component
   */
  async acquire(name: string, timeout: number = 10000): Promise<boolean> {
    await fs.ensureDir(this.locksPath);
    const lockPath = path.join(this.locksPath, `${name}.lock`);

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const handle = await fs.open(lockPath, 'wx');
        this.locks.set(name, handle);
        return true;
      } catch (error) {
        // Lock exists, check if stale
        try {
          const stats = await fs.stat(lockPath);
          const age = Date.now() - stats.mtimeMs;
          if (age > 60000) { // 1 minute stale threshold
            await fs.unlink(lockPath); // Remove stale lock
            continue;
          }
        } catch {
          // File doesn't exist, retry
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return false;
  }

  /**
   * Release lock for component
   */
  async release(name: string): Promise<void> {
    const handle = this.locks.get(name);
    if (handle) {
      await handle.close();
      this.locks.delete(name);
    }
    const lockPath = path.join(this.locksPath, `${name}.lock`);
    try {
      await fs.unlink(lockPath);
    } catch {
      // Lock already removed
    }
  }

  /**
   * Check if component is locked
   */
  async isLocked(name: string): Promise<boolean> {
    const lockPath = path.join(this.locksPath, `${name}.lock`);
    try {
      await fs.access(lockPath);
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// COMPONENT MANAGER
// ============================================================================

/**
 * Manages component lifecycle operations
 */
export class ComponentManager {
  private config: AequorConfig;
  private db: ComponentStateDatabase;
  private lockManager: ComponentLockManager;
  private eventListeners: Map<ComponentEventType, EventListener[]>;
  private runningProcesses: Map<string, ChildProcess>;

  constructor(config: AequorConfig) {
    this.config = config;
    this.db = new ComponentStateDatabase(config.cache_path);
    this.lockManager = new ComponentLockManager(config.cache_path);
    this.eventListeners = new Map();
    this.runningProcesses = new Map();
  }

  /**
   * Initialize component manager
   */
  async initialize(): Promise<void> {
    await this.db.load();
    await fs.ensureDir(this.config.cache_path);
    await fs.ensureDir(this.config.components_path);
    await fs.ensureDir(this.config.config_path);
    await fs.ensureDir(path.join(this.config.cache_path, 'downloads'));
    await fs.ensureDir(path.join(this.config.cache_path, 'archives'));
    await fs.ensureDir(path.join(this.config.cache_path, 'temp'));
  }

  // ============================================================================
  // LIFECYCLE OPERATIONS
  // ============================================================================

  /**
   * Pull component from remote registry
   */
  async pull(name: string, version?: string): Promise<ComponentState> {
    // Acquire lock
    const locked = await this.lockManager.acquire(name);
    if (!locked) {
      throw new Error(`Failed to acquire lock for ${name}`);
    }

    try {
      this.emit('stateChange', {
        type: 'stateChange',
        component: name,
        data: { status: 'pulling' },
        timestamp: new Date(),
      });

      // Fetch component metadata from registry
      const manifest = await this.fetchManifest(name, version);

      // Check if already installed
      const existing = this.db.get(name, manifest.version);
      if (existing && existing.status === 'installed') {
        await this.lockManager.release(name);
        return existing;
      }

      // Download component files
      this.emit('stateChange', {
        type: 'stateChange',
        component: name,
        version: manifest.version,
        data: { status: 'downloading' },
        timestamp: new Date(),
      });

      const archivePath = await this.downloadComponent(manifest);

      // Verify checksum
      const valid = await this.verifyChecksum(archivePath, manifest.checksum);
      if (!valid) {
        throw new Error(`Checksum mismatch for ${name}@${manifest.version}`);
      }

      // Extract component
      const componentPath = await this.extractComponent(manifest, archivePath);

      // Create component state
      const state: ComponentState = {
        name,
        version: manifest.version,
        status: 'downloaded',
        path: componentPath,
        size_bytes: manifest.size_bytes,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: manifest.checksum,
        dependencies: Object.keys(manifest.dependencies),
      };

      this.db.set(name, manifest.version, state);
      await this.db.save();

      // Install component
      await this.install(name, manifest.version);

      await this.lockManager.release(name);

      return this.db.get(name, manifest.version)!;
    } catch (error) {
      await this.lockManager.release(name);
      this.emit('error', {
        type: 'error',
        component: name,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Install downloaded component
   */
  async install(name: string, version: string): Promise<void> {
    const locked = await this.lockManager.acquire(name);
    if (!locked) {
      throw new Error(`Failed to acquire lock for ${name}`);
    }

    try {
      const state = this.db.get(name, version);
      if (!state) {
        throw new Error(`Component ${name}@${version} not found in database`);
      }

      this.emit('stateChange', {
        type: 'stateChange',
        component: name,
        version,
        data: { status: 'installing' },
        timestamp: new Date(),
      });

      // Check dependencies
      await this.installDependencies(state.dependencies);

      // Configure component
      await this.configureComponent(name, version);

      // Update state
      state.status = 'installed';
      this.db.set(name, version, state);
      await this.db.save();

      // Create .installed marker
      const markerPath = path.join(state.path, '.installed');
      await fs.writeFile(markerPath, new Date().toISOString());

      this.emit('installComplete', {
        type: 'installComplete',
        component: name,
        version,
        data: { state },
        timestamp: new Date(),
      });

      await this.lockManager.release(name);
    } catch (error) {
      await this.lockManager.release(name);
      this.emit('error', {
        type: 'error',
        component: name,
        version,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Run component as process
   */
  async run(name: string, args: string[] = []): Promise<ChildProcess> {
    const state = await this.getLatestState(name);
    if (!state) {
      throw new Error(`Component ${name} not found`);
    }

    if (state.status !== 'installed') {
      throw new Error(`Component ${name} is not installed`);
    }

    // Update last_used
    state.last_used = new Date();
    this.db.set(name, state.version, state);
    await this.db.save();

    // Determine entry point
    const entryPoint = path.join(state.path, 'dist', 'index.js');
    if (!await fs.pathExists(entryPoint)) {
      throw new Error(`Entry point not found for ${name}`);
    }

    // Spawn process
    const childProcess = spawn('node', [entryPoint, ...args], {
      stdio: 'inherit',
      env: { ...process.env, AEQUOR_COMPONENT: name, AEQUOR_VERSION: state.version },
    });

    // Track process
    const processId = uuidv4();
    this.runningProcesses.set(processId, childProcess);

    // Update state
    state.status = 'running';
    this.db.set(name, state.version, state);
    await this.db.save();

    // Handle process exit
    childProcess.on('exit', (code) => {
      state.status = 'installed';
      this.db.set(name, state.version, state);
      this.db.save();
      this.runningProcesses.delete(processId);
    });

    return childProcess;
  }

  /**
   * Update component to latest or specific version
   */
  async update(name: string, version?: string): Promise<ComponentState> {
    const locked = await this.lockManager.acquire(name);
    if (!locked) {
      throw new Error(`Failed to acquire lock for ${name}`);
    }

    try {
      const currentState = await this.getLatestState(name);
      if (!currentState) {
        throw new Error(`Component ${name} not installed`);
      }

      this.emit('stateChange', {
        type: 'stateChange',
        component: name,
        data: { status: 'updating' },
        timestamp: new Date(),
      });

      // Stop running instances
      if (currentState.status === 'running') {
        await this.stop(name);
      }

      // Fetch new version
      const manifest = await this.fetchManifest(name, version);
      if (semver.lte(manifest.version, currentState.version)) {
        await this.lockManager.release(name);
        return currentState;
      }

      // Download and install new version
      const archivePath = await this.downloadComponent(manifest);
      const valid = await this.verifyChecksum(archivePath, manifest.checksum);
      if (!valid) {
        throw new Error(`Checksum mismatch for ${name}@${manifest.version}`);
      }

      const componentPath = await this.extractComponent(manifest, archivePath);

      // Install new version
      const newState: ComponentState = {
        name,
        version: manifest.version,
        status: 'installed',
        path: componentPath,
        size_bytes: manifest.size_bytes,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: manifest.checksum,
        dependencies: Object.keys(manifest.dependencies),
      };

      this.db.set(name, manifest.version, newState);
      await this.db.save();

      // Install new version
      await this.install(name, manifest.version);

      // Remove old version (optional)
      // await this.remove(name, currentState.version);

      this.emit('updateComplete', {
        type: 'updateComplete',
        component: name,
        version: manifest.version,
        data: { oldVersion: currentState.version, newState },
        timestamp: new Date(),
      });

      await this.lockManager.release(name);

      return newState;
    } catch (error) {
      await this.lockManager.release(name);
      this.emit('error', {
        type: 'error',
        component: name,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * Remove component
   */
  async remove(name: string, version?: string): Promise<void> {
    const locked = await this.lockManager.acquire(name);
    if (!locked) {
      throw new Error(`Failed to acquire lock for ${name}`);
    }

    try {
      const targetVersion = version || (await this.getLatestState(name))?.version;
      if (!targetVersion) {
        throw new Error(`Component ${name} not found`);
      }

      const state = this.db.get(name, targetVersion);
      if (!state) {
        throw new Error(`Component ${name}@${targetVersion} not found`);
      }

      this.emit('stateChange', {
        type: 'stateChange',
        component: name,
        version: targetVersion,
        data: { status: 'removing' },
        timestamp: new Date(),
      });

      // Stop running instances
      if (state.status === 'running') {
        await this.stop(name);
      }

      // Check for dependent components
      const dependents = await this.findDependents(name);
      if (dependents.length > 0) {
        throw new Error(
          `Cannot remove ${name}: depended on by ${dependents.join(', ')}`
        );
      }

      // Remove component files
      await fs.remove(state.path);

      // Remove from database
      this.db.delete(name, targetVersion);
      await this.db.save();

      this.emit('removeComplete', {
        type: 'removeComplete',
        component: name,
        version: targetVersion,
        data: { state },
        timestamp: new Date(),
      });

      await this.lockManager.release(name);
    } catch (error) {
      await this.lockManager.release(name);
      this.emit('error', {
        type: 'error',
        component: name,
        version,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * List all installed components
   */
  async list(): Promise<ComponentState[]> {
    const states = this.db.list();
    return states.filter(s => s.status === 'installed' || s.status === 'running');
  }

  /**
   * Get component status
   */
  async status(name: string): Promise<ComponentState> {
    const state = await this.getLatestState(name);
    if (!state) {
      throw new Error(`Component ${name} not found`);
    }
    return state;
  }

  /**
   * Get detailed component info
   */
  async info(name: string, version?: string): Promise<ComponentInfo> {
    const targetVersion = version || (await this.getLatestState(name))?.version;
    if (!targetVersion) {
      throw new Error(`Component ${name} not found`);
    }

    const state = this.db.get(name, targetVersion);
    if (!state) {
      throw new Error(`Component ${name}@${targetVersion} not found`);
    }

    const manifest = await this.fetchManifest(name);
    const versions = await this.listVersions(name);
    const latestVersion = versions[versions.length - 1];
    const updateAvailable = semver.gt(latestVersion, targetVersion);

    return {
      manifest,
      state,
      versions,
      latest_version: latestVersion,
      update_available: updateAvailable,
    };
  }

  // ============================================================================
  // MAINTENANCE OPERATIONS
  // ============================================================================

  /**
   * Clean unused components
   */
  async clean(options: CleanOptions = {}): Promise<ComponentState[]> {
    const states = this.db.list();
    const toRemove: ComponentState[] = [];

    for (const state of states) {
      // Skip if in keep list
      if (options.keep?.includes(state.name)) {
        continue;
      }

      // Check age
      if (options.older_than) {
        if (state.last_used < options.older_than) {
          toRemove.push(state);
        }
      }
    }

    // Remove components
    if (!options.dry_run) {
      for (const state of toRemove) {
        await this.remove(state.name, state.version);
      }
    }

    return toRemove;
  }

  /**
   * Verify component integrity
   */
  async verify(name: string): Promise<VerificationResult> {
    const state = await this.getLatestState(name);
    if (!state) {
      throw new Error(`Component ${name} not found`);
    }

    const issues: string[] = [];

    // Verify checksum
    const checksumValid = await this.verifyChecksum(state.path, state.checksum);
    if (!checksumValid) {
      issues.push(`Checksum mismatch for ${name}`);
    }

    // Verify dependencies
    const dependenciesValid = await this.verifyDependencies(state.dependencies);
    if (!dependenciesValid) {
      issues.push(`Missing or invalid dependencies for ${name}`);
    }

    // Verify configuration
    const configPath = path.join(state.path, 'config.yaml');
    const configurationValid = await fs.pathExists(configPath);
    if (!configurationValid) {
      issues.push(`Configuration file missing for ${name}`);
    }

    return {
      name,
      valid: issues.length === 0,
      issues,
      checksum_valid: checksumValid,
      dependencies_valid: dependenciesValid,
      configuration_valid: configurationValid,
    };
  }

  /**
   * Repair component
   */
  async repair(name: string): Promise<RepairResult> {
    const state = await this.getLatestState(name);
    if (!state) {
      throw new Error(`Component ${name} not found`);
    }

    const actions: string[] = [];
    const issuesFixed: string[] = [];
    const remainingIssues: string[] = [];

    // Verify component
    const verification = await this.verify(name);

    if (!verification.checksum_valid) {
      actions.push('Re-downloading component files');
      try {
        await this.pull(name, state.version);
        issuesFixed.push('Checksum mismatch fixed');
      } catch (error) {
        remainingIssues.push('Failed to re-download component');
      }
    }

    if (!verification.dependencies_valid) {
      actions.push('Installing missing dependencies');
      try {
        await this.installDependencies(state.dependencies);
        issuesFixed.push('Dependencies fixed');
      } catch (error) {
        remainingIssues.push('Failed to install dependencies');
      }
    }

    if (!verification.configuration_valid) {
      actions.push('Restoring configuration');
      try {
        await this.configureComponent(name, state.version);
        issuesFixed.push('Configuration restored');
      } catch (error) {
        remainingIssues.push('Failed to restore configuration');
      }
    }

    return {
      name,
      success: remainingIssues.length === 0,
      actions,
      issues_fixed: issuesFixed,
      remaining_issues: remainingIssues,
    };
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Register event listener
   */
  on(event: ComponentEventType, callback: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: ComponentEventType, data: ComponentEvent): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener:`, error);
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Fetch component manifest from registry
   */
  private async fetchManifest(name: string, version?: string): Promise<ComponentManifest> {
    const url = version
      ? `${this.config.registry_url}/components/${name}/${version}/manifest.yaml`
      : `${this.config.registry_url}/components/${name}/manifest.yaml`;

    const response = await axios.get(url, { timeout: this.config.timeout });
    return response.data as ComponentManifest;
  }

  /**
   * Download component files
   */
  private async downloadComponent(manifest: ComponentManifest): Promise<string> {
    const filename = `${manifest.name}-${manifest.version}.tar.gz`;
    const downloadPath = path.join(this.config.cache_path, 'downloads', filename);
    const archivePath = path.join(this.config.cache_path, 'archives', filename);

    await fs.ensureDir(path.dirname(downloadPath));
    await fs.ensureDir(path.dirname(archivePath));

    // Download with progress tracking
    const writer = fs.createWriteStream(downloadPath);
    const response = await axios({
      method: 'GET',
      url: manifest.download_url,
      responseType: 'stream',
      timeout: this.config.timeout,
    });

    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedLength = 0;

    response.data.on('data', (chunk: Buffer) => {
      downloadedLength += chunk.length;
      const progress = totalLength > 0 ? (downloadedLength / totalLength) * 100 : 0;

      this.emit('progress', {
        type: 'progress',
        component: manifest.name,
        version: manifest.version,
        data: {
          name: manifest.name,
          version: manifest.version,
          downloaded_bytes: downloadedLength,
          total_bytes: totalLength,
          progress,
          speed: 0,
          eta: 0,
          status: 'Downloading',
        },
        timestamp: new Date(),
      });
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Move to archives
    await fs.move(downloadPath, archivePath);

    return archivePath;
  }

  /**
   * Verify file checksum
   */
  private async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
    const content = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return hash === expectedChecksum.replace('sha256:', '');
  }

  /**
   * Extract component archive
   */
  private async extractComponent(manifest: ComponentManifest, archivePath: string): Promise<string> {
    const componentPath = path.join(this.config.components_path, manifest.name, manifest.version);
    const tempPath = path.join(this.config.cache_path, 'temp', manifest.name);

    await fs.ensureDir(tempPath);
    await fs.remove(componentPath);

    // Extract archive
    await new Promise<void>((resolve, reject) => {
      const tar = require('tar');
      tar.x({
        file: archivePath,
        cwd: tempPath,
      }).then(() => resolve()).catch(reject);
    });

    // Move to final location
    await fs.move(tempPath, componentPath);

    return componentPath;
  }

  /**
   * Install component dependencies
   */
  private async installDependencies(dependencies: string[]): Promise<void> {
    for (const dep of dependencies) {
      const depState = await this.getLatestState(dep);
      if (!depState || depState.status !== 'installed') {
        await this.pull(dep);
      }
    }
  }

  /**
   * Configure component
   */
  private async configureComponent(name: string, version: string): Promise<void> {
    const state = this.db.get(name, version);
    if (!state) {
      throw new Error(`Component ${name}@${version} not found`);
    }

    const configPath = path.join(state.path, 'config.yaml');
    if (!await fs.pathExists(configPath)) {
      // Create default config
      const defaultConfig = {
        component: name,
        version,
        installed_at: state.installed_at,
        cache_path: this.config.cache_path,
      };
      await fs.writeFile(configPath, YAML.stringify(defaultConfig));
    }
  }

  /**
   * Get latest state for component
   */
  private async getLatestState(name: string): Promise<ComponentState | undefined> {
    const states = this.db.list().filter(s => s.name === name);
    if (states.length === 0) {
      return undefined;
    }
    // Sort by version (descending) and return latest
    return states.sort((a, b) => semver.compare(b.version, a.version))[0];
  }

  /**
   * List available versions for component
   */
  private async listVersions(name: string): Promise<string[]> {
    const url = `${this.config.registry_url}/components/${name}/versions`;
    const response = await axios.get(url, { timeout: this.config.timeout });
    return response.data.versions as string[];
  }

  /**
   * Find components that depend on given component
   */
  private async findDependents(name: string): Promise<string[]> {
    const states = this.db.list();
    const dependents: string[] = [];

    for (const state of states) {
      if (state.dependencies.includes(name)) {
        dependents.push(state.name);
      }
    }

    return dependents;
  }

  /**
   * Verify dependencies are installed
   */
  private async verifyDependencies(dependencies: string[]): Promise<boolean> {
    for (const dep of dependencies) {
      const state = await this.getLatestState(dep);
      if (!state || state.status !== 'installed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Stop running component
   */
  private async stop(name: string): Promise<void> {
    const state = await this.getLatestState(name);
    if (!state) {
      throw new Error(`Component ${name} not found`);
    }

    // Find and kill running processes
    for (const [pid, process] of this.runningProcesses.entries()) {
      if (process.spawnargs.includes(name)) {
        process.kill();
        this.runningProcesses.delete(pid);
      }
    }

    state.status = 'installed';
    this.db.set(name, state.version, state);
    await this.db.save();
  }
}
