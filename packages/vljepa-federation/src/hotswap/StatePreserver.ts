/**
 * StatePreserver - Preserve and restore component state during hot swaps
 * Handles various state types: forms, scroll, custom state, etc.
 */

import type { StateContainer, ModuleInfo } from "../types.js";

export class StatePreserver {
  private states: Map<string, StateContainer> = new Map();
  private serializers: Map<string, StateSerializer> = new Map();

  constructor() {
    this.registerDefaultSerializers();
  }

  /**
   * Register default state serializers
   */
  private registerDefaultSerializers(): void {
    // Form state serializer
    this.registerSerializer("form", new FormStateSerializer());

    // Scroll state serializer
    this.registerSerializer("scroll", new ScrollStateSerializer());

    // Input state serializer
    this.registerSerializer("input", new InputStateSerializer());

    // Custom data serializer
    this.registerSerializer("custom", new CustomDataSerializer());
  }

  /**
   * Register a state serializer
   */
  registerSerializer(type: string, serializer: StateSerializer): void {
    this.serializers.set(type, serializer);
  }

  /**
   * Capture state from module
   */
  capture(module: ModuleInfo): StateContainer | undefined {
    try {
      const container = this.findModuleContainer(module);
      if (!container) {
        return undefined;
      }

      const state: Record<string, any> = {};

      // Capture state using all serializers
      for (const [type, serializer] of this.serializers) {
        try {
          const serialized = serializer.capture(container);
          if (serialized) {
            state[type] = serialized;
          }
        } catch (error) {
          console.warn(`Failed to capture ${type} state:`, error);
        }
      }

      const stateContainer: StateContainer = {
        module: module.id,
        state,
        timestamp: Date.now(),
      };

      this.states.set(module.id, stateContainer);

      return stateContainer;
    } catch (error) {
      console.warn("Failed to capture state:", error);
      return undefined;
    }
  }

  /**
   * Restore state to module
   */
  restore(module: ModuleInfo): boolean {
    const container = this.states.get(module.id);
    if (!container) {
      return false;
    }

    try {
      const moduleElement = this.findModuleContainer(module);
      if (!moduleElement) {
        return false;
      }

      // Restore state using all serializers
      for (const [type, serializer] of this.serializers) {
        try {
          const state = container.state[type];
          if (state) {
            serializer.restore(moduleElement, state);
          }
        } catch (error) {
          console.warn(`Failed to restore ${type} state:`, error);
        }
      }

      return true;
    } catch (error) {
      console.warn("Failed to restore state:", error);
      return false;
    }
  }

  /**
   * Find module container element
   */
  private findModuleContainer(module: ModuleInfo): Element | null {
    return document.querySelector(`[data-module="${module.id}"]`);
  }

  /**
   * Get captured state
   */
  getState(moduleId: string): StateContainer | undefined {
    return this.states.get(moduleId);
  }

  /**
   * Clear captured state
   */
  clearState(moduleId: string): void {
    this.states.delete(moduleId);
  }

  /**
   * Clear all captured states
   */
  clearAllStates(): void {
    this.states.clear();
  }

  /**
   * Get all captured states
   */
  getAllStates(): StateContainer[] {
    return Array.from(this.states.values());
  }

  /**
   * Export state to JSON
   */
  exportState(moduleId: string): string | undefined {
    const state = this.states.get(moduleId);
    return state ? JSON.stringify(state) : undefined;
  }

  /**
   * Import state from JSON
   */
  importState(json: string): boolean {
    try {
      const state = JSON.parse(json) as StateContainer;
      this.states.set(state.module, state);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if state is expired
   */
  isStateExpired(moduleId: string, maxAge: number): boolean {
    const state = this.states.get(moduleId);
    if (!state) {
      return true;
    }

    return Date.now() - state.timestamp > maxAge;
  }

  /**
   * Clean up expired states
   */
  cleanupExpiredStates(maxAge: number): void {
    for (const [moduleId, state] of this.states) {
      if (Date.now() - state.timestamp > maxAge) {
        this.states.delete(moduleId);
      }
    }
  }
}

/**
 * State serializer interface
 */
export interface StateSerializer {
  capture(container: Element): any;
  restore(container: Element, state: any): void;
}

/**
 * Form state serializer
 */
export class FormStateSerializer implements StateSerializer {
  capture(container: Element): any {
    const forms = container.querySelectorAll("form");
    return Array.from(forms).map(form => ({
      action: form.action,
      method: form.method,
      fields: Array.from(form.elements)
        .map(el => {
          if (
            el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement
          ) {
            return {
              name: el.name,
              value: el.value,
              type: el.type,
              checked: el instanceof HTMLInputElement ? el.checked : undefined,
            };
          }
          if (el instanceof HTMLSelectElement) {
            return {
              name: el.name,
              value: el.value,
              selectedIndex: el.selectedIndex,
            };
          }
          return null;
        })
        .filter(Boolean),
    }));
  }

  restore(container: Element, state: any): void {
    for (const formData of state) {
      const form = container.querySelector(`form[action="${formData.action}"]`);
      if (!form) continue;

      for (const field of formData.fields) {
        const el = form.elements.namedItem(field.name);
        if (!el) continue;

        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.value = field.value;
          if (field.checked !== undefined) {
            (el as HTMLInputElement).checked = field.checked;
          }
        } else if (el instanceof HTMLSelectElement) {
          el.value = field.value;
          el.selectedIndex = field.selectedIndex;
        }
      }
    }
  }
}

/**
 * Scroll state serializer
 */
export class ScrollStateSerializer implements StateSerializer {
  capture(container: Element): any {
    return {
      scrollTop: container.scrollTop,
      scrollLeft: container.scrollLeft,
    };
  }

  restore(container: Element, state: any): void {
    container.scrollTop = state.scrollTop || 0;
    container.scrollLeft = state.scrollLeft || 0;
  }
}

/**
 * Input state serializer
 */
export class InputStateSerializer implements StateSerializer {
  capture(container: Element): any {
    const inputs = container.querySelectorAll("input, textarea, select");
    return Array.from(inputs)
      .map(el => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          return {
            name: el.name,
            value: el.value,
            checked: el instanceof HTMLInputElement ? el.checked : undefined,
          };
        }
        if (el instanceof HTMLSelectElement) {
          return {
            name: el.name,
            value: el.value,
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  restore(container: Element, state: any): void {
    for (const field of state) {
      const el = container.querySelector(`[name="${field.name}"]`);
      if (!el) continue;

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = field.value;
        if (field.checked !== undefined) {
          (el as HTMLInputElement).checked = field.checked;
        }
      } else if (el instanceof HTMLSelectElement) {
        el.value = field.value;
      }
    }
  }
}

/**
 * Custom data serializer
 */
export class CustomDataSerializer implements StateSerializer {
  capture(container: Element): any {
    const data: Record<string, string> = {};
    for (const attr of container.attributes) {
      if (attr.name.startsWith("data-state-")) {
        const key = attr.name.replace("data-state-", "");
        data[key] = attr.value;
      }
    }
    return data;
  }

  restore(container: Element, state: any): void {
    for (const [key, value] of Object.entries(state)) {
      container.setAttribute(`data-state-${key}`, String(value));
    }
  }
}
