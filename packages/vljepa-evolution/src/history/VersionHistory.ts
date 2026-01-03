/**
 * VersionHistory - Manages version history with branching support
 */

import type {
  UIState,
  UIVersion,
  VersionTree,
  Merge,
  Conflict,
} from "../types.js";

export class VersionHistory {
  private tree: VersionTree;
  private currentBranch: string;

  constructor() {
    this.tree = {
      root: "",
      nodes: new Map(),
      branches: new Map(),
      merges: [],
    };
    this.currentBranch = "main";
  }

  /**
   * Initialize with root version
   */
  initialize(rootVersion: UIVersion): void {
    this.tree.root = rootVersion.id;
    this.tree.nodes.set(rootVersion.id, rootVersion);
    this.tree.branches.set("main", rootVersion.id);
  }

  /**
   * Add a new version
   */
  addVersion(version: UIVersion): void {
    const parent = this.tree.nodes.get(version.parent!);

    if (!parent && version.parent !== null) {
      throw new Error(`Parent version ${version.parent} not found`);
    }

    this.tree.nodes.set(version.id, version);

    // Update branch head
    if (this.tree.branches.has(version.branch)) {
      this.tree.branches.set(version.branch, version.id);
    } else {
      this.tree.branches.set(version.branch, version.id);
    }
  }

  /**
   * Get a version by ID
   */
  getVersion(id: string): UIVersion | undefined {
    return this.tree.nodes.get(id);
  }

  /**
   * Get current version for a branch
   */
  getBranchHead(branch: string): UIVersion | undefined {
    const headId = this.tree.branches.get(branch);
    if (!headId) {
      return undefined;
    }
    return this.tree.nodes.get(headId);
  }

  /**
   * Get current version
   */
  getCurrentVersion(): UIVersion | undefined {
    return this.getBranchHead(this.currentBranch);
  }

  /**
   * Create a new branch
   */
  createBranch(name: string, fromVersion: string): void {
    const version = this.tree.nodes.get(fromVersion);
    if (!version) {
      throw new Error(`Version ${fromVersion} not found`);
    }

    if (this.tree.branches.has(name)) {
      throw new Error(`Branch ${name} already exists`);
    }

    this.tree.branches.set(name, fromVersion);
  }

  /**
   * Switch to a branch
   */
  switchBranch(name: string): void {
    if (!this.tree.branches.has(name)) {
      throw new Error(`Branch ${name} does not exist`);
    }

    this.currentBranch = name;
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return this.currentBranch;
  }

  /**
   * Get all branches
   */
  getBranches(): string[] {
    return Array.from(this.tree.branches.keys());
  }

  /**
   * Delete a branch
   */
  deleteBranch(name: string): boolean {
    if (name === "main") {
      throw new Error("Cannot delete main branch");
    }

    if (name === this.currentBranch) {
      throw new Error("Cannot delete current branch");
    }

    return this.tree.branches.delete(name);
  }

  /**
   * Get version ancestry
   */
  getAncestry(versionId: string): UIVersion[] {
    const ancestry: UIVersion[] = [];
    let current = this.tree.nodes.get(versionId);

    while (current) {
      ancestry.unshift(current);
      current = current.parent
        ? this.tree.nodes.get(current.parent)
        : undefined;
    }

    return ancestry;
  }

  /**
   * Get version descendants
   */
  getDescendants(versionId: string): UIVersion[] {
    const descendants: UIVersion[] = [];

    for (const version of this.tree.nodes.values()) {
      if (version.parent === versionId) {
        descendants.push(version);
        descendants.push(...this.getDescendants(version.id));
      }
    }

    return descendants;
  }

  /**
   * Merge two branches
   */
  async merge(
    sourceBranch: string,
    targetBranch: string,
    resolveConflicts?: (conflicts: Conflict[]) => Record<string, unknown>
  ): Promise<Merge> {
    const sourceHead = this.getBranchHead(sourceBranch);
    const targetHead = this.getBranchHead(targetBranch);

    if (!sourceHead || !targetHead) {
      throw new Error("Source or target branch not found");
    }

    // Find common ancestor
    const ancestor = this.findCommonAncestor(sourceHead.id, targetHead.id);

    // Detect conflicts
    const conflicts = this.detectConflicts(
      ancestor?.id,
      sourceHead.id,
      targetHead.id
    );

    // Resolve conflicts if resolver provided
    const resolved = resolveConflicts ? resolveConflicts(conflicts) : {};

    // Create merge version
    const mergeVersion: UIVersion = {
      id: this.generateVersionId(),
      version: this.incrementVersion(targetHead.version),
      hash: this.generateHash(),
      parent: targetHead.id,
      branch: targetBranch,
      timestamp: Date.now(),
      author: "system",
      message: `Merge ${sourceBranch} into ${targetBranch}`,
      changes: [],
      state: targetHead.state,
    };

    this.addVersion(mergeVersion);

    const merge: Merge = {
      id: this.generateMergeId(),
      sourceBranch,
      targetBranch,
      sourceVersion: sourceHead.id,
      targetVersion: targetHead.id,
      resultVersion: mergeVersion.id,
      timestamp: Date.now(),
      conflicts,
      resolved: conflicts.length === 0 || resolveConflicts !== undefined,
    };

    this.tree.merges.push(merge);

    return merge;
  }

  /**
   * Get all merges
   */
  getMerges(): Merge[] {
    return this.tree.merges;
  }

  /**
   * Get merges for a branch
   */
  getMergesForBranch(branch: string): Merge[] {
    return this.tree.merges.filter(
      m => m.targetBranch === branch || m.sourceBranch === branch
    );
  }

  /**
   * Get version history between two versions
   */
  getHistoryBetween(fromVersion: string, toVersion: string): UIVersion[] {
    const from = this.tree.nodes.get(fromVersion);
    const to = this.tree.nodes.get(toVersion);

    if (!from || !to) {
      return [];
    }

    const toAncestry = new Set(this.getAncestry(toVersion).map(v => v.id));
    const fromAncestry = new Set(this.getAncestry(fromVersion).map(v => v.id));

    const history: UIVersion[] = [];

    for (const versionId of toAncestry) {
      if (!fromAncestry.has(versionId)) {
        const version = this.tree.nodes.get(versionId);
        if (version) {
          history.push(version);
        }
      }
    }

    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get version log
   */
  getLog(options: LogOptions = {}): UIVersion[] {
    let versions = Array.from(this.tree.nodes.values());

    // Filter by branch
    if (options.branch) {
      versions = versions.filter(v => v.branch === options.branch);
    }

    // Filter by author
    if (options.author) {
      versions = versions.filter(v => v.author === options.author);
    }

    // Filter by time range
    if (options.since) {
      versions = versions.filter(v => v.timestamp >= options.since!);
    }
    if (options.until) {
      versions = versions.filter(v => v.timestamp <= options.until!);
    }

    // Sort
    versions.sort((a, b) => {
      const order = options.order ?? "desc";
      return order === "asc"
        ? a.timestamp - b.timestamp
        : b.timestamp - a.timestamp;
    });

    // Limit
    if (options.limit) {
      versions = versions.slice(0, options.limit);
    }

    return versions;
  }

  /**
   * Export tree to JSON
   */
  exportTree(): string {
    const data = {
      root: this.tree.root,
      nodes: Array.from(this.tree.nodes.entries()),
      branches: Array.from(this.tree.branches.entries()),
      merges: this.tree.merges,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Import tree from JSON
   */
  importTree(json: string): void {
    const data = JSON.parse(json);

    this.tree.root = data.root;
    this.tree.nodes = new Map(data.nodes);
    this.tree.branches = new Map(data.branches);
    this.tree.merges = data.merges;
  }

  // Private methods

  private findCommonAncestor(
    version1: string,
    version2: string
  ): UIVersion | undefined {
    const ancestry1 = new Set(this.getAncestry(version1).map(v => v.id));

    for (const version of this.getAncestry(version2)) {
      if (ancestry1.has(version.id)) {
        return version;
      }
    }

    return undefined;
  }

  private detectConflicts(
    ancestorId: string | undefined,
    version1: string,
    version2: string
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    const v1 = this.tree.nodes.get(version1);
    const v2 = this.tree.nodes.get(version2);
    const ancestor = ancestorId ? this.tree.nodes.get(ancestorId) : undefined;

    if (!v1 || !v2) {
      return conflicts;
    }

    // Detect state conflicts
    const state1 = JSON.stringify(v1.state);
    const state2 = JSON.stringify(v2.state);

    if (state1 !== state2) {
      conflicts.push({
        path: "state",
        type: "content",
        ours: v1.state,
        theirs: v2.state,
        base: ancestor?.state,
      });
    }

    return conflicts;
  }

  private incrementVersion(version: string): string {
    const [major, minor, patch] = version.split(".").map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMergeId(): string {
    return `merge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateHash(): string {
    return Math.random().toString(36).substr(2, 40);
  }
}

export interface LogOptions {
  branch?: string;
  author?: string;
  since?: number;
  until?: number;
  order?: "asc" | "desc";
  limit?: number;
}
