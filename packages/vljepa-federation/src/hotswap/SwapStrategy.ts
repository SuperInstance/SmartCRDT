/**
 * SwapStrategy - Strategy pattern for module swapping
 * Different strategies for different swap scenarios
 */

import type { ModuleInfo, HotSwapResult, StateContainer } from "../types.js";

/**
 * Base swap strategy
 */
export abstract class SwapStrategy {
  abstract swap(
    oldModule: ModuleInfo,
    newModule: any,
    state?: StateContainer
  ): Promise<HotSwapResult>;

  protected createResult(
    oldModule: ModuleInfo,
    newModule: ModuleInfo,
    statePreserved: boolean,
    startTime: number
  ): HotSwapResult {
    return {
      success: true,
      oldModule,
      newModule,
      statePreserved,
      transitionTime: Date.now() - startTime,
    };
  }
}

/**
 * Immediate swap strategy
 * Swaps immediately without transition
 */
export class ImmediateSwapStrategy extends SwapStrategy {
  async swap(
    oldModule: ModuleInfo,
    newModule: any,
    state?: StateContainer
  ): Promise<HotSwapResult> {
    const startTime = Date.now();

    // Immediate replacement
    this.replaceModule(oldModule, newModule);

    return this.createResult(
      oldModule,
      {
        ...oldModule,
        version: newModule.version || "unknown",
        timestamp: Date.now(),
      },
      !!state,
      startTime
    );
  }

  private replaceModule(oldModule: ModuleInfo, newModule: any): void {
    const container = document.querySelector(`[data-module="${oldModule.id}"]`);
    if (container) {
      // Direct replacement
      (container as any).module = newModule;
    }
  }
}

/**
 * Graceful swap strategy
 * Swaps with smooth transition and cleanup
 */
export class GracefulSwapStrategy extends SwapStrategy {
  async swap(
    oldModule: ModuleInfo,
    newModule: any,
    state?: StateContainer
  ): Promise<HotSwapResult> {
    const startTime = Date.now();

    // Phase 1: Prepare new module
    await this.prepareNewModule(newModule);

    // Phase 2: Capture old state
    const capturedState = state || this.captureState(oldModule);

    // Phase 3: Transition
    await this.transition(oldModule, newModule);

    // Phase 4: Cleanup old module
    await this.cleanup(oldModule);

    return this.createResult(
      oldModule,
      {
        ...oldModule,
        version: newModule.version || "unknown",
        timestamp: Date.now(),
      },
      !!capturedState,
      startTime
    );
  }

  private async prepareNewModule(module: any): Promise<void> {
    // Allow module to initialize
    if (module.init) {
      await module.init();
    }
  }

  private captureState(module: ModuleInfo): StateContainer | undefined {
    const container = document.querySelector(`[data-module="${module.id}"]`);
    if (!container) {
      return undefined;
    }

    return {
      module: module.id,
      state: { scrollTop: container.scrollTop },
      timestamp: Date.now(),
    };
  }

  private async transition(
    oldModule: ModuleInfo,
    newModule: any
  ): Promise<void> {
    const container = document.querySelector(`[data-module="${oldModule.id}"]`);
    if (!container) {
      return;
    }

    // Fade out
    container.classList.add("module-exit");
    await this.delay(300);

    // Swap
    (container as any).module = newModule;

    // Fade in
    container.classList.remove("module-exit");
    container.classList.add("module-enter");
    await this.delay(300);
    container.classList.remove("module-enter");
  }

  private async cleanup(module: ModuleInfo): Promise<void> {
    const container = document.querySelector(`[data-module="${module.id}"]`);
    if (!container) {
      return;
    }

    // Remove event listeners, etc.
    container.querySelectorAll("*").forEach(el => {
      el.replaceWith(el.cloneNode(true));
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rollback swap strategy
 * Swaps with automatic rollback on error
 */
export class RollbackSwapStrategy extends SwapStrategy {
  private originalState: Map<string, any> = new Map();

  async swap(
    oldModule: ModuleInfo,
    newModule: any,
    state?: StateContainer
  ): Promise<HotSwapResult> {
    const startTime = Date.now();

    // Save original state
    this.saveOriginalState(oldModule);

    try {
      // Attempt swap
      await this.performSwap(oldModule, newModule);

      // Verify swap worked
      const verified = this.verifySwap(oldModule, newModule);

      if (!verified) {
        throw new Error("Swap verification failed");
      }

      return this.createResult(
        oldModule,
        {
          ...oldModule,
          version: newModule.version || "unknown",
          timestamp: Date.now(),
        },
        !!state,
        startTime
      );
    } catch (error) {
      // Rollback on error
      await this.rollback(oldModule);

      throw error;
    }
  }

  private saveOriginalState(module: ModuleInfo): void {
    const container = document.querySelector(`[data-module="${module.id}"]`);
    if (container) {
      this.originalState.set(module.id, container.cloneNode(true));
    }
  }

  private async performSwap(
    oldModule: ModuleInfo,
    newModule: any
  ): Promise<void> {
    const container = document.querySelector(`[data-module="${oldModule.id}"]`);
    if (container) {
      (container as any).module = newModule;
    }
  }

  private verifySwap(oldModule: ModuleInfo, newModule: any): boolean {
    const container = document.querySelector(`[data-module="${oldModule.id}"]`);
    if (!container) {
      return false;
    }

    // Verify module is loaded
    return (container as any).module === newModule;
  }

  private async rollback(module: ModuleInfo): Promise<void> {
    const container = document.querySelector(`[data-module="${module.id}"]`);
    const original = this.originalState.get(module.id);

    if (container && original) {
      container.replaceWith(original);
      this.originalState.delete(module.id);
    }
  }
}

/**
 * Strategy factory
 */
export class SwapStrategyFactory {
  static create(type: "immediate" | "graceful" | "rollback"): SwapStrategy {
    switch (type) {
      case "immediate":
        return new ImmediateSwapStrategy();
      case "graceful":
        return new GracefulSwapStrategy();
      case "rollback":
        return new RollbackSwapStrategy();
      default:
        return new ImmediateSwapStrategy();
    }
  }
}
