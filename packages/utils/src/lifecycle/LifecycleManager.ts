/**
 * LifecycleManager - Start/Stop lifecycle management
 *
 * Provides a standard way to manage the lifecycle of components with
 * initialization, starting, stopping, and disposal phases.
 *
 * @example
 * ```typescript
 * const lifecycle = new LifecycleManager({
 *   onInitialize: async () => { console.log('Initializing'); },
 *   onStart: async () => { console.log('Starting'); },
 *   onStop: async () => { console.log('Stopping'); },
 *   onDispose: async () => { console.log('Disposing'); }
 * });
 *
 * await lifecycle.initialize();
 * await lifecycle.start();
 * await lifecycle.stop();
 * await lifecycle.dispose();
 * ```
 */

// Simple EventEmitter implementation for portability
class EventEmitter {
  private events: Map<string | symbol, Set<Function>> = new Map();

  on(event: string | symbol, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(listener);
    return this;
  }

  off(event: string | symbol, listener: Function): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  once(event: string | symbol, listener: Function): this {
    const onceWrapper = (...args: unknown[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const listeners = this.events.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch {
          // Ignore errors in listeners
        }
      }
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
}

/**
 * Lifecycle state
 */
export type LifecycleState =
  | "uninitialized"
  | "initializing"
  | "initialized"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "disposing"
  | "disposed"
  | "error";

/**
 * Lifecycle event
 */
export type LifecycleEvent =
  | { state: "initializing"; timestamp: number }
  | { state: "initialized"; timestamp: number }
  | { state: "starting"; timestamp: number }
  | { state: "started"; timestamp: number }
  | { state: "stopping"; timestamp: number }
  | { state: "stopped"; timestamp: number }
  | { state: "disposing"; timestamp: number }
  | { state: "disposed"; timestamp: number }
  | { state: "error"; timestamp: number; error: Error }
  | { state: "uninitialized"; timestamp: number };

/**
 * Lifecycle hooks
 */
export interface LifecycleHooks {
  onInitialize?: () => Promise<void> | void;
  onStart?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onDispose?: () => Promise<void> | void;
  onError?: (error: Error) => void;
}

/**
 * Lifecycle manager options
 */
export interface LifecycleManagerOptions extends LifecycleHooks {
  /** Timeout for lifecycle operations in ms */
  timeout?: number;
  /** Enable automatic error recovery */
  autoRecovery?: boolean;
  /** Maximum retry attempts for failed operations */
  maxRetries?: number;
}

/**
 * Lifecycle manager
 */
export class LifecycleManager {
  private state: LifecycleState = "uninitialized";
  private eventEmitter: EventEmitter;
  private hooks: LifecycleHooks;
  private options: Required<
    Pick<LifecycleManagerOptions, "timeout" | "autoRecovery" | "maxRetries">
  >;
  private error?: Error;
  private retryCount = 0;

  constructor(
    hooks: LifecycleHooks = {},
    options: LifecycleManagerOptions = {}
  ) {
    this.hooks = hooks;
    this.options = {
      timeout: options.timeout ?? 30000,
      autoRecovery: options.autoRecovery ?? false,
      maxRetries: options.maxRetries ?? 3,
    };
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Get current state
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return (
      this.state === "initialized" ||
      this.state === "started" ||
      this.state === "stopping" ||
      this.state === "stopped"
    );
  }

  /**
   * Check if started
   */
  isStarted(): boolean {
    return this.state === "started";
  }

  /**
   * Check if stopped
   */
  isStopped(): boolean {
    return this.state === "stopped";
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.state === "disposed";
  }

  /**
   * Check if in error state
   */
  isError(): boolean {
    return this.state === "error";
  }

  /**
   * Get error if in error state
   */
  getError(): Error | undefined {
    return this.error;
  }

  /**
   * Initialize the lifecycle
   */
  async initialize(): Promise<void> {
    if (this.state !== "uninitialized" && this.state !== "error") {
      throw new Error(`Cannot initialize from state: ${this.state}`);
    }

    this.setState("initializing");

    try {
      await this.executeWithTimeout(async () => {
        if (this.hooks.onInitialize) {
          await this.hooks.onInitialize();
        }
      }, this.options.timeout);

      this.setState("initialized");
      this.retryCount = 0;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Start the lifecycle
   */
  async start(): Promise<void> {
    if (this.state !== "initialized" && this.state !== "stopped") {
      throw new Error(`Cannot start from state: ${this.state}`);
    }

    this.setState("starting");

    try {
      await this.executeWithTimeout(async () => {
        if (this.hooks.onStart) {
          await this.hooks.onStart();
        }
      }, this.options.timeout);

      this.setState("started");
      this.retryCount = 0;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Stop the lifecycle
   */
  async stop(): Promise<void> {
    if (this.state !== "started") {
      throw new Error(`Cannot stop from state: ${this.state}`);
    }

    this.setState("stopping");

    try {
      await this.executeWithTimeout(async () => {
        if (this.hooks.onStop) {
          await this.hooks.onStop();
        }
      }, this.options.timeout);

      this.setState("stopped");
      this.retryCount = 0;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Dispose the lifecycle
   */
  async dispose(): Promise<void> {
    if (this.state === "disposed" || this.state === "disposing") {
      return;
    }

    // Try to stop if started
    if (this.state === "started") {
      try {
        await this.stop();
      } catch {
        // Ignore stop errors when disposing
      }
    }

    this.setState("disposing");

    try {
      await this.executeWithTimeout(async () => {
        if (this.hooks.onDispose) {
          await this.hooks.onDispose();
        }
      }, this.options.timeout);

      this.setState("disposed");
      this.eventEmitter.removeAllListeners();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Restart the lifecycle
   */
  async restart(): Promise<void> {
    if (this.state === "started") {
      await this.stop();
    }
    await this.start();
  }

  /**
   * Reset to uninitialized state
   */
  async reset(): Promise<void> {
    if (this.state === "disposed") {
      throw new Error("Cannot reset from disposed state");
    }

    if (this.state === "started") {
      try {
        await this.stop();
      } catch {
        // Ignore stop errors
      }
    }

    this.state = "uninitialized";
    this.error = undefined;
    this.retryCount = 0;
  }

  /**
   * Recover from error state
   */
  async recover(): Promise<void> {
    if (!this.isError()) {
      throw new Error("Cannot recover from non-error state");
    }

    if (
      this.options.autoRecovery &&
      this.retryCount < this.options.maxRetries
    ) {
      this.retryCount++;
      await this.reset();
      await this.initialize();
      await this.start();
    } else {
      throw new Error("Auto-recovery exhausted or disabled");
    }
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (data: LifecycleEvent) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Unregister event listener
   */
  off(event: string, listener: (data: LifecycleEvent) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Register one-time event listener
   */
  once(event: string, listener: (data: LifecycleEvent) => void): void {
    this.eventEmitter.once(event, listener);
  }

  /**
   * Wait for a specific state
   */
  async waitForState(
    targetState: Exclude<LifecycleState, "uninitialized">,
    timeout = 30000
  ): Promise<void> {
    if (this.state === targetState) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off("stateChanged", onStateChange);
        reject(new Error(`Timeout waiting for state: ${targetState}`));
      }, timeout);

      const onStateChange = (event: LifecycleEvent) => {
        if (event.state === targetState) {
          clearTimeout(timer);
          this.off("stateChanged", onStateChange);
          resolve();
        }
      };

      this.on("stateChanged", onStateChange);
    });
  }

  /**
   * Get valid state transitions
   */
  private static readonly VALID_TRANSITIONS: Record<
    LifecycleState,
    LifecycleState[]
  > = {
    uninitialized: ["initializing", "error"],
    initializing: ["initialized", "error"],
    initialized: ["starting", "disposing", "error"],
    starting: ["started", "error"],
    started: ["stopping", "disposing", "error"],
    stopping: ["stopped", "error"],
    stopped: ["starting", "disposing", "error"],
    disposing: ["disposed", "error"],
    disposed: [],
    error: ["initializing", "disposing", "disposed"],
  };

  /**
   * Set state with validation
   */
  private setState(newState: LifecycleState): void {
    const validTransitions = LifecycleManager.VALID_TRANSITIONS[this.state];

    if (!validTransitions.includes(newState)) {
      throw new Error(`Invalid state transition: ${this.state} -> ${newState}`);
    }

    const oldState = this.state;
    this.state = newState;

    const event: LifecycleEvent = {
      state: newState,
      timestamp: Date.now(),
    } as LifecycleEvent;
    this.eventEmitter.emit("stateChanged", event);
    this.eventEmitter.emit(String(newState), event);
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    this.error = error;
    this.state = "error";

    const event: LifecycleEvent = {
      state: "error",
      timestamp: Date.now(),
      error,
    };
    this.eventEmitter.emit("stateChanged", event);
    this.eventEmitter.emit("error", event);

    if (this.hooks.onError) {
      this.hooks.onError(error);
    }

    // Try auto-recovery
    if (this.options.autoRecovery) {
      this.recover().catch(() => {
        // Ignore recovery errors
      });
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Create a lifecycle manager from hooks
   */
  static create(
    hooks: LifecycleHooks,
    options?: LifecycleManagerOptions
  ): LifecycleManager {
    return new LifecycleManager(hooks, options);
  }
}

/**
 * Mixin to add lifecycle management to any class
 */
export function withLifecycle<T extends new (...args: any[]) => any>(
  Base: T,
  hooks: LifecycleHooks
): T {
  return class extends Base {
    private _lifecycle = new LifecycleManager(hooks);

    constructor(...args: any[]) {
      super(...args);
    }

    async initialize(): Promise<void> {
      await this._lifecycle.initialize();
    }

    async start(): Promise<void> {
      await this._lifecycle.start();
    }

    async stop(): Promise<void> {
      await this._lifecycle.stop();
    }

    async dispose(): Promise<void> {
      await this._lifecycle.dispose();
    }

    get lifecycleState(): LifecycleState {
      return this._lifecycle.getState();
    }
  } as any;
}

/**
 * Convenience function to create a simple lifecycle
 */
export function createLifecycle(
  hooks?: LifecycleHooks,
  options?: LifecycleManagerOptions
): LifecycleManager {
  return new LifecycleManager(hooks, options);
}
