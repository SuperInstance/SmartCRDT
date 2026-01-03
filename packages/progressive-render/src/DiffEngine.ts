/**
 * @lsi/progressive-render - Diff Engine
 *
 * Calculates minimal UI updates using diffing algorithm
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type { A2UIComponent, A2UILayout } from "@lsi/protocol";

import type {
  UIUpdate,
  UpdateData,
  DiffResult,
  DiffOptions,
  PatchType,
  VirtualNode,
  ReconciliationResult,
} from "./types.js";

// Local types for internal use
interface InternalDiffResult {
  changes: NodeChange[];
  similarity: number;
}

// ============================================================================
// DIFF ENGINE
// ============================================================================

/**
 * DiffEngine - Calculates minimal UI updates
 *
 * Implements a simplified virtual DOM diffing algorithm for:
 * - Detecting added, removed, replaced components
 * - Detecting moved/reordered components
 * - Detecting property updates
 * - Batch generation of minimal patches
 */
export class DiffEngine {
  private options: DiffOptions;

  constructor(options?: Partial<DiffOptions>) {
    this.options = {
      batch: true,
      max_batch_size: 50,
      compute_moves: true,
      move_threshold: 10,
      similarity_threshold: 0.8,
      ...options,
    };
  }

  // ========================================================================
  // MAIN DIFF METHODS
  // ========================================================================

  /**
   * Calculate diff between two component trees
   *
   * @param oldTree - Old component tree
   * @param newTree - New component tree
   * @returns Diff result with updates
   */
  diff(oldTree: A2UIComponent[], newTree: A2UIComponent[]): DiffResult {
    const startTime = Date.now();

    const updates: UIUpdate[] = [];
    let additions = 0;
    let removals = 0;
    let replacements = 0;
    let moves = 0;
    let propertyUpdates = 0;

    // Create virtual nodes for diffing
    const oldVirtual = this.createVirtualForest(oldTree);
    const newVirtual = this.createVirtualForest(newTree);

    // Calculate diff
    const diffResult = this.diffForest(oldVirtual, newVirtual);

    // Convert diff results to UI updates
    for (const change of diffResult.changes) {
      const update = this.changeToUpdate(change);
      updates.push(update);

      switch (update.patch_type) {
        case "add":
          additions++;
          break;
        case "remove":
          removals++;
          break;
        case "replace":
          replacements++;
          break;
        case "move":
          moves++;
          break;
        case "update":
          propertyUpdates++;
          break;
      }
    }

    const computeTime = Date.now() - startTime;

    return {
      updates,
      additions,
      removals,
      replacements,
      moves,
      updates: propertyUpdates,
      total_changes: updates.length,
      similarity: diffResult.similarity,
      compute_time: computeTime,
    };
  }

  /**
   * Calculate diff between two layouts
   *
   * @param oldLayout - Old layout
   * @param newLayout - New layout
   * @returns UI update for layout change
   */
  diffLayout(oldLayout: A2UILayout, newLayout: A2UILayout): UIUpdate {
    return {
      update_id: `layout-diff-${Date.now()}`,
      component_id: "layout",
      patch_type: "replace",
      data: {
        type: "replace",
        element: { type: "layout", id: "layout", layout: newLayout } as any,
      },
      metadata: {
        timestamp: new Date(),
        source: "diff",
        priority: 100,
        batched: false,
      },
    };
  }

  /**
   * Reconcile virtual DOM with real DOM
   *
   * @param oldTree - Current component tree
   * @param newTree - New component tree
   * @returns Reconciliation result
   */
  reconcile(
    oldTree: A2UIComponent[],
    newTree: A2UIComponent[]
  ): ReconciliationResult {
    const startTime = Date.now();

    const diffResult = this.diff(oldTree, newTree);

    const toUnmount: string[] = [];
    const toMount: A2UIComponent[] = [];

    for (const update of diffResult.updates) {
      switch (update.patch_type) {
        case "remove":
          if (update.data.type === "remove") {
            toUnmount.push(update.data.element_id);
          }
          break;

        case "add":
          if (update.data.type === "add") {
            toMount.push(update.data.element);
          }
          break;

        case "replace":
          if (update.data.type === "replace") {
            toUnmount.push(update.component_id);
            toMount.push(update.data.element);
          }
          break;
      }
    }

    const time = Date.now() - startTime;

    return {
      updates: diffResult.updates,
      unmount: toUnmount,
      mount: toMount,
      success: true,
      time,
    };
  }

  // ========================================================================
  // VIRTUAL NODE METHODS
  // ========================================================================

  /**
   * Create virtual forest from component array
   *
   * @param components - Component array
   * @returns Array of virtual nodes
   */
  private createVirtualForest(components: A2UIComponent[]): VirtualNode[] {
    return components.map(c => this.createVirtualNode(c));
  }

  /**
   * Create virtual node from component
   *
   * @param component - A2UI component
   * @param version - Node version
   * @returns Virtual node
   */
  private createVirtualNode(
    component: A2UIComponent,
    version: number = 0
  ): VirtualNode {
    return {
      type: component.type,
      key: component.id,
      props: component.props || {},
      children:
        component.children?.map(c => this.createVirtualNode(c, version)) || [],
      version,
    };
  }

  // ========================================================================
  // DIFF ALGORITHMS
  // ========================================================================

  /**
   * Diff two virtual forests
   *
   * @param oldForest - Old virtual forest
   * @param newForest - New virtual forest
   * @returns Diff result
   */
  private diffForest(
    oldForest: VirtualNode[],
    newForest: VirtualNode[]
  ): InternalDiffResult {
    const changes: NodeChange[] = [];
    const oldKeys = new Set(oldForest.map(n => n.key));
    const newKeys = new Set(newForest.map(n => n.key));

    // Detect removals
    for (const oldNode of oldForest) {
      if (!newKeys.has(oldNode.key)) {
        changes.push({ type: "remove", key: oldNode.key, node: oldNode });
      }
    }

    // Detect additions
    for (const newNode of newForest) {
      if (!oldKeys.has(newNode.key)) {
        changes.push({ type: "add", key: newNode.key, node: newNode });
      }
    }

    // Detect updates and moves
    for (const newNode of newForest) {
      const oldNode = oldForest.find((n: VirtualNode) => n.key === newNode.key);
      if (oldNode) {
        const nodeDiff = this.diffNode(oldNode, newNode);
        if (nodeDiff.changed) {
          changes.push({
            type: "update",
            key: newNode.key,
            node: newNode,
            propChanges: nodeDiff.propChanges,
          });
        }

        // Check for move (position change)
        const oldIndex = oldForest.indexOf(oldNode);
        const newIndex = newForest.indexOf(newNode);
        if (
          this.options.compute_moves &&
          Math.abs(oldIndex - newIndex) > this.options.move_threshold
        ) {
          changes.push({
            type: "move",
            key: newNode.key,
            node: newNode,
            from: oldIndex,
            to: newIndex,
          });
        }
      }
    }

    // Calculate similarity
    const totalNodes = Math.max(oldForest.length, newForest.length);
    const similarity =
      totalNodes > 0
        ? 1 -
          changes.filter(c => c.type === "remove" || c.type === "add").length /
            totalNodes
        : 1;

    return { changes, similarity };
  }

  /**
   * Diff two virtual nodes
   *
   * @param oldNode - Old virtual node
   * @param newNode - New virtual node
   * @returns Node diff result
   */
  private diffNode(oldNode: VirtualNode, newNode: VirtualNode): NodeDiffResult {
    const propChanges: PropChange[] = [];
    let changed = false;

    // Check type change
    if (oldNode.type !== newNode.type) {
      return { changed: true, propChanges: [], typeChanged: true };
    }

    // Check props
    const allProps = new Set([
      ...Object.keys(oldNode.props),
      ...Object.keys(newNode.props),
    ]);

    for (const prop of allProps) {
      const oldValue = oldNode.props[prop];
      const newValue = newNode.props[prop];

      if (!this.deepEqual(oldValue, newValue)) {
        propChanges.push({ prop, oldValue, newValue });
        changed = true;
      }
    }

    // Check children
    if (oldNode.children.length !== newNode.children.length) {
      changed = true;
    } else {
      const childDiff = this.diffForest(oldNode.children, newNode.children);
      if (childDiff.changes.length > 0) {
        changed = true;
      }
    }

    return { changed, propChanges, typeChanged: false };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Convert node change to UI update
   *
   * @param change - Node change
   * @returns UI update
   */
  private changeToUpdate(change: NodeChange): UIUpdate {
    const baseUpdate = {
      update_id: `update-${change.key}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      component_id: change.key,
      metadata: {
        timestamp: new Date(),
        source: "diff" as const,
        priority: this.calculateUpdatePriority(change),
        batched: this.options.batch,
      },
    };

    switch (change.type) {
      case "add":
        return {
          ...baseUpdate,
          patch_type: "add",
          data: {
            type: "add",
            element: this.virtualToComponent(change.node),
          },
        };

      case "remove":
        return {
          ...baseUpdate,
          patch_type: "remove",
          data: {
            type: "remove",
            element_id: change.key,
          },
        };

      case "update":
        if (change.propChanges && change.propChanges.length > 0) {
          // Use first prop change
          const propChange = change.propChanges[0];
          return {
            ...baseUpdate,
            patch_type: "update",
            data: {
              type: "update",
              prop: propChange.prop,
              value: propChange.newValue,
            },
            path: `props.${propChange.prop}`,
            old_value: propChange.oldValue,
            new_value: propChange.newValue,
          };
        }
      // Fall through to replace if no prop changes

      case "move":
        return {
          ...baseUpdate,
          patch_type: "move",
          data: {
            type: "move",
            element_id: change.key,
            new_position: change.to!,
            new_parent: undefined,
          },
        };

      default:
        return {
          ...baseUpdate,
          patch_type: "replace",
          data: {
            type: "replace",
            element: this.virtualToComponent(change.node),
          },
        };
    }
  }

  /**
   * Convert virtual node to A2UI component
   *
   * @param node - Virtual node
   * @returns A2UI component
   */
  private virtualToComponent(node: VirtualNode): A2UIComponent {
    return {
      type: node.type,
      id: node.key,
      props: node.props,
      children: node.children.map(c => this.virtualToComponent(c)),
    };
  }

  /**
   * Calculate update priority based on change type
   *
   * @param change - Node change
   * @returns Priority score (0-100)
   */
  private calculateUpdatePriority(change: NodeChange): number {
    switch (change.type) {
      case "add":
        return 60;
      case "remove":
        return 40;
      case "update":
        return 80;
      case "move":
        return 50;
      default:
        return 50;
    }
  }

  /**
   * Deep equality check
   *
   * @param a - First value
   * @param b - Second value
   * @returns Whether values are deeply equal
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, i) => this.deepEqual(item, b[i]));
    }

    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a as Record<string, unknown>);
      const keysB = Object.keys(b as Record<string, unknown>);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (
          !this.deepEqual(
            (a as Record<string, unknown>)[key],
            (b as Record<string, unknown>)[key]
          )
        ) {
          return false;
        }
      }

      return true;
    }

    return false;
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Node change type
 */
type NodeChangeType = "add" | "remove" | "update" | "move";

/**
 * Node change
 */
interface NodeChange {
  type: NodeChangeType;
  key: string;
  node: VirtualNode;
  propChanges?: PropChange[];
  from?: number;
  to?: number;
}

/**
 * Property change
 */
interface PropChange {
  prop: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Node diff result
 */
interface NodeDiffResult {
  changed: boolean;
  propChanges: PropChange[];
  typeChanged: boolean;
}

/**
 * Forest diff result
 */
interface ForestDiffResult {
  changes: NodeChange[];
  similarity: number;
}
