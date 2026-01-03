/**
 * BranchManager - Manage branch operations
 */

import type { UIVersion } from "../types.js";

export interface Branch {
  name: string;
  head: string;
  createdAt: number;
  updatedAt: number;
  parent: string | null;
  metadata: BranchMetadata;
}

export interface BranchMetadata {
  description?: string;
  author?: string;
  tags?: string[];
  protected: boolean;
}

export class BranchManager {
  private branches: Map<string, Branch>;
  private defaultBranch: string;

  constructor(defaultBranch: string = "main") {
    this.branches = new Map();
    this.defaultBranch = defaultBranch;
  }

  /**
   * Create a new branch
   */
  create(
    name: string,
    fromBranchOrVersion: string,
    metadata: Partial<BranchMetadata> = {}
  ): Branch {
    if (this.branches.has(name)) {
      throw new Error(`Branch ${name} already exists`);
    }

    const parent = this.branches.has(fromBranchOrVersion)
      ? this.branches.get(fromBranchOrVersion)!.head
      : fromBranchOrVersion;

    const branch: Branch = {
      name,
      head: parent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parent,
      metadata: {
        author: metadata.author ?? "unknown",
        description: metadata.description,
        tags: metadata.tags ?? [],
        protected: metadata.protected ?? false,
      },
    };

    this.branches.set(name, branch);

    return branch;
  }

  /**
   * Delete a branch
   */
  delete(name: string): boolean {
    const branch = this.branches.get(name);

    if (!branch) {
      return false;
    }

    if (branch.metadata.protected) {
      throw new Error(`Cannot delete protected branch ${name}`);
    }

    if (name === this.defaultBranch) {
      throw new Error(`Cannot delete default branch ${this.defaultBranch}`);
    }

    return this.branches.delete(name);
  }

  /**
   * Rename a branch
   */
  rename(oldName: string, newName: string): Branch {
    if (!this.branches.has(oldName)) {
      throw new Error(`Branch ${oldName} does not exist`);
    }

    if (this.branches.has(newName)) {
      throw new Error(`Branch ${newName} already exists`);
    }

    const branch = this.branches.get(oldName)!;
    this.branches.delete(oldName);

    const renamed: Branch = {
      ...branch,
      name: newName,
      updatedAt: Date.now(),
    };

    this.branches.set(newName, renamed);

    if (this.defaultBranch === oldName) {
      this.defaultBranch = newName;
    }

    return renamed;
  }

  /**
   * Get a branch
   */
  get(name: string): Branch | undefined {
    return this.branches.get(name);
  }

  /**
   * Get all branches
   */
  getAll(): Branch[] {
    return Array.from(this.branches.values());
  }

  /**
   * Get default branch
   */
  getDefault(): Branch | undefined {
    return this.branches.get(this.defaultBranch);
  }

  /**
   * Set default branch
   */
  setDefault(name: string): void {
    if (!this.branches.has(name)) {
      throw new Error(`Branch ${name} does not exist`);
    }

    this.defaultBranch = name;
  }

  /**
   * Update branch head
   */
  updateHead(name: string, newHead: string): void {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch ${name} does not exist`);
    }

    branch.head = newHead;
    branch.updatedAt = Date.now();
  }

  /**
   * Get branch ancestry
   */
  getAncestry(name: string): string[] {
    const ancestry: string[] = [];
    let current = this.branches.get(name);

    while (current) {
      ancestry.unshift(current.name);

      if (current.parent) {
        // Find branch that has this parent as head
        current = Array.from(this.branches.values()).find(
          b => b.head === current!.parent
        );
      } else {
        break;
      }
    }

    return ancestry;
  }

  /**
   * Get branch descendants
   */
  getDescendants(name: string): Branch[] {
    const branch = this.branches.get(name);
    if (!branch) {
      return [];
    }

    return Array.from(this.branches.values()).filter(b => {
      // Check if this branch is in the ancestry of b
      const ancestry = this.getAncestry(b.name);
      return ancestry.includes(name) && b.name !== name;
    });
  }

  /**
   * Compare two branches
   */
  compare(branch1: string, branch2: string): BranchComparison {
    const b1 = this.branches.get(branch1);
    const b2 = this.branches.get(branch2);

    if (!b1 || !b2) {
      throw new Error("One or both branches not found");
    }

    const ancestry1 = new Set(this.getAncestry(branch1));
    const ancestry2 = new Set(this.getAncestry(branch2));

    const commonAncestors = ancestry1.intersection(ancestry2);
    const uniqueTo1 = ancestry1.difference(ancestry2);
    const uniqueTo2 = ancestry2.difference(ancestry1);

    const divergedAt = this.findDivergencePoint(branch1, branch2);

    return {
      branch1,
      branch2,
      commonAncestors: Array.from(commonAncestors),
      uniqueTo1: Array.from(uniqueTo1),
      uniqueTo2: Array.from(uniqueTo2),
      divergedAt,
      ahead: uniqueTo1.size,
      behind: uniqueTo2.size,
    };
  }

  /**
   * Find divergence point between two branches
   */
  findDivergencePoint(branch1: string, branch2: string): string | undefined {
    const ancestry1 = this.getAncestry(branch1);
    const ancestry2 = this.getAncestry(branch2);

    // Find last common ancestor
    let lastCommon: string | undefined;

    for (let i = 0; i < Math.min(ancestry1.length, ancestry2.length); i++) {
      if (ancestry1[i] === ancestry2[i]) {
        lastCommon = ancestry1[i];
      } else {
        break;
      }
    }

    return lastCommon;
  }

  /**
   * List branches matching a pattern
   */
  list(pattern?: string, options: ListOptions = {}): Branch[] {
    let branches = Array.from(this.branches.values());

    // Filter by pattern
    if (pattern) {
      const regex = new RegExp(pattern);
      branches = branches.filter(b => regex.test(b.name));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      branches = branches.filter(b =>
        options.tags!.some(tag => b.metadata.tags?.includes(tag))
      );
    }

    // Filter by author
    if (options.author) {
      branches = branches.filter(b => b.metadata.author === options.author);
    }

    // Sort
    branches.sort((a, b) => {
      const sort = options.sort ?? "name";
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "created":
          return b.createdAt - a.createdAt;
        case "updated":
          return b.updatedAt - a.updatedAt;
        default:
          return 0;
      }
    });

    return branches;
  }

  /**
   * Tag a branch
   */
  addTag(name: string, tag: string): void {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch ${name} does not exist`);
    }

    if (!branch.metadata.tags) {
      branch.metadata.tags = [];
    }

    if (!branch.metadata.tags.includes(tag)) {
      branch.metadata.tags.push(tag);
    }
  }

  /**
   * Remove tag from branch
   */
  removeTag(name: string, tag: string): void {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch ${name} does not exist`);
    }

    if (branch.metadata.tags) {
      branch.metadata.tags = branch.metadata.tags.filter(t => t !== tag);
    }
  }

  /**
   * Protect a branch
   */
  protect(name: string): void {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch ${name} does not exist`);
    }

    branch.metadata.protected = true;
  }

  /**
   * Unprotect a branch
   */
  unprotect(name: string): void {
    const branch = this.branches.get(name);
    if (!branch) {
      throw new Error(`Branch ${name} does not exist`);
    }

    branch.metadata.protected = false;
  }

  /**
   * Get branch statistics
   */
  getStatistics(): BranchStatistics {
    const branches = Array.from(this.branches.values());

    return {
      totalBranches: branches.length,
      protectedBranches: branches.filter(b => b.metadata.protected).length,
      defaultBranch: this.defaultBranch,
      oldestBranch: branches.sort((a, b) => a.createdAt - b.createdAt)[0]?.name,
      newestBranch: branches.sort((a, b) => b.createdAt - a.createdAt)[0]?.name,
      branchesByAuthor: this.groupByAuthor(branches),
    };
  }

  /**
   * Export branches to JSON
   */
  export(): string {
    return JSON.stringify(Array.from(this.branches.entries()), null, 2);
  }

  /**
   * Import branches from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json);
    this.branches = new Map(data);
  }

  // Private methods

  private groupByAuthor(branches: Branch[]): Record<string, number> {
    return branches.reduce(
      (acc, branch) => {
        const author = branch.metadata.author ?? "unknown";
        acc[author] = (acc[author] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }
}

export interface ListOptions {
  tags?: string[];
  author?: string;
  sort?: "name" | "created" | "updated";
}

export interface BranchComparison {
  branch1: string;
  branch2: string;
  commonAncestors: string[];
  uniqueTo1: string[];
  uniqueTo2: string[];
  divergedAt?: string;
  ahead: number;
  behind: number;
}

export interface BranchStatistics {
  totalBranches: number;
  protectedBranches: number;
  defaultBranch: string;
  oldestBranch?: string;
  newestBranch?: string;
  branchesByAuthor: Record<string, number>;
}
