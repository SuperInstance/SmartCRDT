/**
 * BranchManager - Manage state branches
 *
 * Creates and manages parallel branches of state history
 * for experimentation and alternative paths.
 */

import type {
  Branch,
  StateSnapshot,
  MultiModalState,
  StateHistory as StateHistoryType,
} from "../types.js";

/**
 * Branch manager
 */
export class BranchManager {
  private history: StateHistoryType;
  private nextBranchId: number = 1;

  constructor(history: StateHistoryType) {
    this.history = history;
  }

  /**
   * Create new branch
   */
  createBranch(
    name: string,
    parentId: string | null = null,
    initialState?: MultiModalState
  ): Branch | null {
    // Check if branch name already exists
    if (this.history.branches.some(b => b.name === name)) {
      return null;
    }

    const branch: Branch = {
      id: `branch_${this.nextBranchId++}`,
      name,
      parent: parentId,
      snapshots: [],
      created: Date.now(),
      modified: Date.now(),
      active: false,
    };

    // Initialize with current state if provided
    if (initialState) {
      const snapshot: StateSnapshot = {
        state: initialState,
        timestamp: Date.now(),
        author: "system",
        description: "Initial state",
        id: `snapshot_${Date.now()}`,
      };
      branch.snapshots.push(snapshot);
    }

    this.history.branches.push(branch);
    return branch;
  }

  /**
   * Get branch by ID
   */
  getBranch(branchId: string): Branch | undefined {
    return this.history.branches.find(b => b.id === branchId);
  }

  /**
   * Get branch by name
   */
  getBranchByName(name: string): Branch | undefined {
    return this.history.branches.find(b => b.name === name);
  }

  /**
   * Switch to branch
   */
  switchBranch(branchId: string): MultiModalState | null {
    const branch = this.getBranch(branchId);
    if (!branch) {
      return null;
    }

    // Save current state to current branch
    const currentBranch = this.getBranch(this.history.currentBranch);
    if (currentBranch && currentBranch.id !== branchId) {
      currentBranch.active = false;
      currentBranch.modified = Date.now();
    }

    // Get latest state from target branch
    const latestSnapshot = branch.snapshots[branch.snapshots.length - 1];
    if (!latestSnapshot) {
      return null;
    }

    // Update current branch
    this.history.currentBranch = branchId;
    branch.active = true;
    branch.modified = Date.now();

    // Set current state
    this.history.current = latestSnapshot.state;

    return latestSnapshot.state;
  }

  /**
   * Delete branch
   */
  deleteBranch(branchId: string): boolean {
    const index = this.history.branches.findIndex(b => b.id === branchId);
    if (index < 0) {
      return false;
    }

    const branch = this.history.branches[index];

    // Cannot delete active branch
    if (branch.active) {
      return false;
    }

    // Cannot delete main branch
    if (branch.name === "main") {
      return false;
    }

    this.history.branches.splice(index, 1);
    return true;
  }

  /**
   * Merge branch into current branch
   */
  mergeBranch(sourceBranchId: string): boolean {
    const sourceBranch = this.getBranch(sourceBranchId);
    if (!sourceBranch) {
      return false;
    }

    const currentBranch = this.getBranch(this.history.currentBranch);
    if (!currentBranch) {
      return false;
    }

    // Add all snapshots from source to current
    for (const snapshot of sourceBranch.snapshots) {
      const newSnapshot: StateSnapshot = {
        ...snapshot,
        description: `Merged from ${sourceBranch.name}: ${snapshot.description}`,
        id: `merged_${snapshot.id}`,
      };
      currentBranch.snapshots.push(newSnapshot);
    }

    currentBranch.modified = Date.now();
    return true;
  }

  /**
   * Add snapshot to branch
   */
  addSnapshotToBranch(branchId: string, snapshot: StateSnapshot): boolean {
    const branch = this.getBranch(branchId);
    if (!branch) {
      return false;
    }

    branch.snapshots.push(snapshot);
    branch.modified = Date.now();
    return true;
  }

  /**
   * Get branch history
   */
  getBranchHistory(branchId: string): StateSnapshot[] {
    const branch = this.getBranch(branchId);
    return branch ? [...branch.snapshots] : [];
  }

  /**
   * Get all branches
   */
  getAllBranches(): Branch[] {
    return [...this.history.branches];
  }

  /**
   * Get active branch
   */
  getActiveBranch(): Branch | undefined {
    return this.history.branches.find(b => b.active);
  }

  /**
   * Rename branch
   */
  renameBranch(branchId: string, newName: string): boolean {
    const branch = this.getBranch(branchId);
    if (!branch) {
      return false;
    }

    // Check if name already exists
    if (
      this.history.branches.some(b => b.name === newName && b.id !== branchId)
    ) {
      return false;
    }

    branch.name = newName;
    branch.modified = Date.now();
    return true;
  }

  /**
   * Get branch tree structure
   */
  getBranchTree(): Array<{
    branch: Branch;
    children: Branch[];
    depth: number;
  }> {
    const tree: Array<{
      branch: Branch;
      children: Branch[];
      depth: number;
    }> = [];

    const visited = new Set<string>();

    const buildTree = (branchId: string | null, depth: number): void => {
      if (branchId !== null && visited.has(branchId)) {
        return;
      }

      if (branchId !== null) {
        visited.add(branchId);
      }

      // Find branches with this parent
      const children = this.history.branches.filter(b => b.parent === branchId);

      for (const child of children) {
        tree.push({
          branch: child,
          children: [],
          depth,
        });
        buildTree(child.id, depth + 1);
      }
    };

    // Start with root branches (no parent)
    buildTree(null, 0);

    return tree;
  }

  /**
   * Compare two branches
   */
  compareBranches(
    branchId1: string,
    branchId2: string
  ): {
    diverged: boolean;
    commonAncestor: StateSnapshot | null;
    differences: string[];
  } {
    const branch1 = this.getBranch(branchId1);
    const branch2 = this.getBranch(branchId2);

    if (!branch1 || !branch2) {
      return {
        diverged: false,
        commonAncestor: null,
        differences: [],
      };
    }

    // Find common ancestor
    let commonAncestor: StateSnapshot | null = null;

    // This is simplified - real implementation would traverse up the tree
    for (const snap1 of branch1.snapshots) {
      for (const snap2 of branch2.snapshots) {
        if (snap1.id === snap2.id) {
          commonAncestor = snap1;
          break;
        }
      }
      if (commonAncestor) break;
    }

    const differences: string[] = [];

    if (!commonAncestor) {
      differences.push("No common ancestor found");
    }

    // Compare snapshot counts
    if (branch1.snapshots.length !== branch2.snapshots.length) {
      differences.push(
        `Different snapshot counts: ${branch1.snapshots.length} vs ${branch2.snapshots.length}`
      );
    }

    // Compare latest states
    const latest1 = branch1.snapshots[branch1.snapshots.length - 1];
    const latest2 = branch2.snapshots[branch2.snapshots.length - 1];

    if (latest1 && latest2) {
      if (latest1.state.version !== latest2.state.version) {
        differences.push(
          `Different versions: ${latest1.state.version} vs ${latest2.state.version}`
        );
      }

      if (latest1.state.confidence !== latest2.state.confidence) {
        differences.push(
          `Different confidence: ${latest1.state.confidence} vs ${latest2.state.confidence}`
        );
      }
    }

    return {
      diverged: commonAncestor === null,
      commonAncestor,
      differences,
    };
  }

  /**
   * Get branch statistics
   */
  getBranchStatistics(branchId: string): {
    snapshotCount: number;
    oldestSnapshot: StateSnapshot | null;
    newestSnapshot: StateSnapshot | null;
    totalChanges: number;
  } | null {
    const branch = this.getBranch(branchId);
    if (!branch) {
      return null;
    }

    const snapshots = branch.snapshots;

    return {
      snapshotCount: snapshots.length,
      oldestSnapshot: snapshots[0] || null,
      newestSnapshot: snapshots[snapshots.length - 1] || null,
      totalChanges: snapshots.length - 1, // First is initial state
    };
  }

  /**
   * Export branch as JSON
   */
  exportBranch(branchId: string): object | null {
    const branch = this.getBranch(branchId);
    if (!branch) {
      return null;
    }

    return {
      id: branch.id,
      name: branch.name,
      parent: branch.parent,
      created: branch.created,
      modified: branch.modified,
      active: branch.active,
      snapshots: branch.snapshots.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        author: s.author,
        description: s.description,
        stateId: s.state.id,
        stateVersion: s.state.version,
      })),
    };
  }
}
