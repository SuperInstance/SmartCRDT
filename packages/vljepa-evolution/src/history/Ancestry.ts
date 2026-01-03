/**
 * Ancestry - Track UI component ancestry
 */

import type { UIState, UIVersion } from "../types.js";

export interface AncestryNode {
  id: string;
  componentId: string;
  version: string;
  parent: string | null;
  children: string[];
  metadata: AncestryMetadata;
}

export interface AncestryMetadata {
  createdAt: number;
  author: string;
  branch: string;
  tags: string[];
}

export class Ancestry {
  private nodes: Map<string, AncestryNode>;
  private componentIndex: Map<string, Set<string>>; // componentId -> nodeIds

  constructor() {
    this.nodes = new Map();
    this.componentIndex = new Map();
  }

  /**
   * Register a component version
   */
  register(
    componentId: string,
    version: string,
    parentComponentId: string | null,
    metadata: Partial<AncestryMetadata> = {}
  ): AncestryNode {
    const node: AncestryNode = {
      id: this.generateNodeId(),
      componentId,
      version,
      parent: parentComponentId,
      children: [],
      metadata: {
        createdAt: Date.now(),
        author: metadata.author ?? "unknown",
        branch: metadata.branch ?? "main",
        tags: metadata.tags ?? [],
      },
    };

    this.nodes.set(node.id, node);

    // Index by component
    if (!this.componentIndex.has(componentId)) {
      this.componentIndex.set(componentId, new Set());
    }
    this.componentIndex.get(componentId)!.add(node.id);

    // Link to parent
    if (parentComponentId) {
      const parentNode = this.findLatestVersion(parentComponentId);
      if (parentNode) {
        parentNode.children.push(node.id);
      }
    }

    return node;
  }

  /**
   * Get ancestry for a component
   */
  getAncestry(componentId: string): AncestryNode[] {
    const nodes: AncestryNode[] = [];
    let current = this.findLatestVersion(componentId);

    while (current) {
      nodes.unshift(current);
      current = current.parent
        ? this.findLatestVersion(current.parent)
        : undefined;
    }

    return nodes;
  }

  /**
   * Get descendants for a component
   */
  getDescendants(componentId: string): AncestryNode[] {
    const descendants: AncestryNode[] = [];
    const root = this.findLatestVersion(componentId);

    if (!root) {
      return descendants;
    }

    const queue = [root];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);

      if (node !== root) {
        descendants.push(node);
      }

      for (const childId of node.children) {
        const child = this.nodes.get(childId);
        if (child) {
          queue.push(child);
        }
      }
    }

    return descendants;
  }

  /**
   * Find common ancestor between two components
   */
  findCommonAncestor(
    componentId1: string,
    componentId2: string
  ): AncestryNode | undefined {
    const ancestry1 = new Set(
      this.getAncestry(componentId1).map(n => n.componentId)
    );

    for (const node of this.getAncestry(componentId2)) {
      if (ancestry1.has(node.componentId)) {
        return node;
      }
    }

    return undefined;
  }

  /**
   * Get all versions of a component
   */
  getAllVersions(componentId: string): AncestryNode[] {
    const nodeIds = this.componentIndex.get(componentId);
    if (!nodeIds) {
      return [];
    }

    return Array.from(nodeIds)
      .map(id => this.nodes.get(id)!)
      .filter(n => n !== undefined)
      .sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
  }

  /**
   * Find latest version of a component
   */
  findLatestVersion(componentId: string): AncestryNode | undefined {
    const versions = this.getAllVersions(componentId);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  /**
   * Find version at a specific time
   */
  findVersionAtTime(
    componentId: string,
    timestamp: number
  ): AncestryNode | undefined {
    const versions = this.getAllVersions(componentId);

    for (let i = versions.length - 1; i >= 0; i--) {
      if (versions[i].metadata.createdAt <= timestamp) {
        return versions[i];
      }
    }

    return undefined;
  }

  /**
   * Get component family tree
   */
  getFamilyTree(componentId: string): FamilyTree {
    const root = this.findLatestVersion(componentId);
    if (!root) {
      return { root: null, nodes: [] };
    }

    const nodes: AncestryNode[] = [];
    const queue = [root];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);

      nodes.push(node);

      for (const childId of node.children) {
        const child = this.nodes.get(childId);
        if (child && !visited.has(child.id)) {
          queue.push(child);
        }
      }

      if (node.parent) {
        const parent = this.findLatestVersion(node.parent);
        if (parent && !visited.has(parent.id)) {
          queue.push(parent);
        }
      }
    }

    return { root, nodes };
  }

  /**
   * Track component migration
   */
  trackMigration(
    oldComponentId: string,
    newComponentId: string,
    version: string,
    metadata?: Partial<AncestryMetadata>
  ): AncestryNode {
    return this.register(newComponentId, version, oldComponentId, {
      ...metadata,
      tags: [...(metadata?.tags ?? []), "migrated"],
    });
  }

  /**
   * Get migration path
   */
  getMigrationPath(componentId: string): AncestryNode[] {
    const path: AncestryNode[] = [];
    let current = this.findLatestVersion(componentId);

    while (current) {
      path.unshift(current);

      // Only follow if tagged as migrated
      const isMigrated = current.metadata.tags.includes("migrated");
      if (!isMigrated || !current.parent) {
        break;
      }

      current = this.findLatestVersion(current.parent);
    }

    return path;
  }

  /**
   * Get statistics
   */
  getStatistics(): AncestryStatistics {
    const components = new Set<string>();
    let totalNodes = 0;
    let maxDepth = 0;

    for (const node of this.nodes.values()) {
      components.add(node.componentId);
      totalNodes++;

      const depth = this.getAncestry(node.componentId).length;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }

    return {
      totalComponents: components.size,
      totalNodes,
      maxDepth,
      averageDepth: this.calculateAverageDepth(),
    };
  }

  /**
   * Clear all ancestry data
   */
  clear(): void {
    this.nodes.clear();
    this.componentIndex.clear();
  }

  /**
   * Export ancestry to JSON
   */
  export(): string {
    const data = {
      nodes: Array.from(this.nodes.entries()),
      componentIndex: Array.from(this.componentIndex.entries()).map(
        ([k, v]) => [k, Array.from(v)]
      ),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import ancestry from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json);

    this.nodes = new Map(data.nodes);
    this.componentIndex = new Map(
      data.componentIndex.map(([k, v]: [string, string[]]) => [k, new Set(v)])
    );
  }

  // Private methods

  private calculateAverageDepth(): number {
    const components = Array.from(this.componentIndex.keys());
    if (components.length === 0) {
      return 0;
    }

    let totalDepth = 0;
    for (const componentId of components) {
      totalDepth += this.getAncestry(componentId).length;
    }

    return totalDepth / components.length;
  }

  private generateNodeId(): string {
    return `anc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface FamilyTree {
  root: AncestryNode | null;
  nodes: AncestryNode[];
}

export interface AncestryStatistics {
  totalComponents: number;
  totalNodes: number;
  maxDepth: number;
  averageDepth: number;
}
