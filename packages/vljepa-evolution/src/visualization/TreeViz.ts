/**
 * TreeViz - Visualize ancestry trees
 */

import type { UIVersion, VersionTree } from "../types.js";

export class TreeViz {
  /**
   * Render version tree as ASCII art
   */
  renderASCII(tree: VersionTree): string {
    const lines: string[] = [];

    if (!tree.root) {
      return "No root version found";
    }

    lines.push("=== VERSION TREE ===\n");

    // Build tree structure
    const childrenMap = this.buildChildrenMap(tree);

    // Render tree starting from root
    this.renderNode(tree.root, tree, childrenMap, "", lines);

    return lines.join("\n");
  }

  /**
   * Render version tree as HTML
   */
  renderHTML(tree: VersionTree): string {
    const lines: string[] = [];

    lines.push('<div class="version-tree">');

    if (tree.root) {
      const childrenMap = this.buildChildrenMap(tree);
      this.renderNodeHTML(tree.root, tree, childrenMap, lines);
    }

    lines.push("</div>");

    return lines.join("\n");
  }

  /**
   * Generate Mermaid diagram
   */
  generateMermaid(tree: VersionTree): string {
    const lines: string[] = [];

    lines.push("gitGraph");
    lines.push('  commit id: "root"');

    // Track commits per branch
    const branchCommits = new Map<string, string[]>();

    for (const [id, version] of tree.nodes) {
      if (id === tree.root) continue;

      if (!branchCommits.has(version.branch)) {
        branchCommits.set(version.branch, []);
      }

      branchCommits.get(version.branch)!.push(id);
    }

    // Generate branch declarations and commits
    for (const [branchName, branchNameHead] of tree.branches) {
      if (branchName === "main") continue;

      lines.push(`  branch ${branchName}`);
      lines.push(`  checkout ${branchName}`);

      const commits = branchCommits.get(branchName) ?? [];
      for (const commitId of commits) {
        const version = tree.nodes.get(commitId);
        if (version) {
          lines.push(`  commit id: "${commitId.slice(0, 7)}"`);
        }
      }

      lines.push(`  checkout main`);
    }

    return lines.join("\n");
  }

  /**
   * Generate DOT graph (Graphviz)
   */
  generateDOT(tree: VersionTree): string {
    const lines: string[] = [];

    lines.push("digraph version_tree {");
    lines.push("  rankdir=TB;");
    lines.push("  node [shape=box, style=rounded];");

    // Add nodes
    for (const [id, version] of tree.nodes) {
      const label = `${version.version}\\n${version.author}\\n${new Date(version.timestamp).toISOString().slice(0, 10)}`;
      lines.push(`  "${id}" [label="${label}"];`);
    }

    // Add edges
    for (const [id, version] of tree.nodes) {
      if (version.parent) {
        lines.push(`  "${version.parent}" -> "${id}";`);
      }
    }

    // Highlight branches
    for (const [branchName, branchHead] of tree.branches) {
      lines.push(`  "${branchHead}" [color=blue, penwidth=2.0];`);
    }

    lines.push("}");

    return lines.join("\n");
  }

  /**
   * Generate D3.js tree data
   */
  generateD3Data(tree: VersionTree): D3TreeData {
    if (!tree.root) {
      return { name: "root", children: [] };
    }

    return this.buildD3Node(tree.root, tree);
  }

  /**
   * Generate branch diagram
   */
  generateBranchDiagram(tree: VersionTree): BranchDiagram {
    const branches: BranchInfo[] = [];

    for (const [branchName, branchHead] of tree.branches) {
      const version = tree.nodes.get(branchHead);
      if (!version) continue;

      // Get ancestry
      const ancestry = this.getAncestry(branchHead, tree);

      branches.push({
        name: branchName,
        head: branchHead,
        version: version.version,
        ancestry,
        isDefault: branchName === "main",
      });
    }

    return { branches };
  }

  /**
   * Generate commit graph
   */
  generateCommitGraph(tree: VersionTree): CommitGraph {
    const nodes: CommitNode[] = [];
    const edges: CommitEdge[] = [];

    for (const [id, version] of tree.nodes) {
      nodes.push({
        id,
        version: version.version,
        author: version.author,
        date: new Date(version.timestamp),
        branch: version.branch,
        message: version.message,
      });

      if (version.parent) {
        edges.push({
          from: version.parent,
          to: id,
          type: "parent",
        });
      }
    }

    // Add merge edges
    for (const merge of tree.merges) {
      edges.push({
        from: merge.sourceVersion,
        to: merge.resultVersion,
        type: "merge",
      });
    }

    return { nodes, edges };
  }

  // Private methods

  private buildChildrenMap(tree: VersionTree): Map<string, string[]> {
    const childrenMap = new Map<string, string[]>();

    for (const [id, version] of tree.nodes) {
      if (version.parent) {
        if (!childrenMap.has(version.parent)) {
          childrenMap.set(version.parent, []);
        }
        childrenMap.get(version.parent)!.push(id);
      }
    }

    return childrenMap;
  }

  private renderNode(
    nodeId: string,
    tree: VersionTree,
    childrenMap: Map<string, string[]>,
    prefix: string,
    lines: string[]
  ): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;

    const isHead = Array.from(tree.branches.values()).includes(nodeId);
    const marker = isHead ? "*" : "o";
    const branchTag = node.branch !== "main" ? ` [${node.branch}]` : "";

    lines.push(
      `${prefix}${marker} ${node.version}${branchTag} - ${node.message}`
    );

    const children = childrenMap.get(nodeId) ?? [];

    for (let i = 0; i < children.length; i++) {
      const isLast = i === children.length - 1;
      const childPrefix = prefix + (isLast ? "└─ " : "├─ ");
      const nextPrefix = prefix + (isLast ? "   " : "│  ");

      this.renderNode(children[i], tree, childrenMap, nextPrefix, lines);
    }
  }

  private renderNodeHTML(
    nodeId: string,
    tree: VersionTree,
    childrenMap: Map<string, string[]>,
    lines: string[]
  ): void {
    const node = tree.nodes.get(nodeId);
    if (!node) return;

    const isHead = Array.from(tree.branches.values()).includes(nodeId);
    const headClass = isHead ? " branch-head" : "";

    lines.push(`  <div class="version-node${headClass}" data-id="${nodeId}">`);
    lines.push(`    <div class="version-header">`);
    lines.push(
      `      <span class="version-number">${this.escapeHtml(node.version)}</span>`
    );
    lines.push(
      `      <span class="version-branch">${this.escapeHtml(node.branch)}</span>`
    );
    lines.push(`    </div>`);
    lines.push(
      `    <div class="version-message">${this.escapeHtml(node.message)}</div>`
    );
    lines.push(`    <div class="version-meta">`);
    lines.push(
      `      <span class="version-author">${this.escapeHtml(node.author)}</span>`
    );
    lines.push(
      `      <span class="version-date">${new Date(node.timestamp).toISOString()}</span>`
    );
    lines.push(`    </div>`);

    const children = childrenMap.get(nodeId) ?? [];
    if (children.length > 0) {
      lines.push('    <div class="version-children">');
      for (const childId of children) {
        this.renderNodeHTML(childId, tree, childrenMap, lines);
      }
      lines.push("    </div>");
    }

    lines.push("  </div>");
  }

  private buildD3Node(nodeId: string, tree: VersionTree): D3TreeNode {
    const node = tree.nodes.get(nodeId);
    if (!node) {
      return { name: "unknown", children: [] };
    }

    const childrenMap = this.buildChildrenMap(tree);
    const children = childrenMap.get(nodeId) ?? [];

    return {
      name: node.version,
      id: nodeId,
      branch: node.branch,
      author: node.author,
      date: new Date(node.timestamp),
      message: node.message,
      children: children.map(childId => this.buildD3Node(childId, tree)),
    };
  }

  private getAncestry(nodeId: string, tree: VersionTree): string[] {
    const ancestry: string[] = [];
    let current = tree.nodes.get(nodeId);

    while (current) {
      ancestry.unshift(current.id);
      current = current.parent ? tree.nodes.get(current.parent) : undefined;
    }

    return ancestry;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

export interface D3TreeData {
  name: string;
  id?: string;
  branch?: string;
  author?: string;
  date?: Date;
  message?: string;
  children: D3TreeData[];
}

export interface D3TreeNode extends D3TreeData {
  id: string;
  branch: string;
  author: string;
  date: Date;
  message: string;
}

export interface BranchDiagram {
  branches: BranchInfo[];
}

export interface BranchInfo {
  name: string;
  head: string;
  version: string;
  ancestry: string[];
  isDefault: boolean;
}

export interface CommitGraph {
  nodes: CommitNode[];
  edges: CommitEdge[];
}

export interface CommitNode {
  id: string;
  version: string;
  author: string;
  date: Date;
  branch: string;
  message: string;
}

export interface CommitEdge {
  from: string;
  to: string;
  type: "parent" | "merge";
}
