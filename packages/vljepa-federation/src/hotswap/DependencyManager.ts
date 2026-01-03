/**
 * DependencyManager - Manage dependencies during hot swaps
 * Ensures dependent modules are updated correctly
 */

import type { ModuleInfo } from "../types.js";

export class DependencyManager {
  private dependencies: Map<string, Set<string>> = new Map();
  private dependents: Map<string, Set<string>> = new Map();
  private loadOrder: string[] = [];
  private versions: Map<string, string> = new Map();

  constructor() {
    // Initialize
  }

  /**
   * Register a dependency relationship
   */
  registerDependency(module: string, dependsOn: string): void {
    if (!this.dependencies.has(module)) {
      this.dependencies.set(module, new Set());
    }
    this.dependencies.get(module)!.add(dependsOn);

    if (!this.dependents.has(dependsOn)) {
      this.dependents.set(dependsOn, new Set());
    }
    this.dependents.get(dependsOn)!.add(module);
  }

  /**
   * Register multiple dependencies
   */
  registerDependencies(module: string, dependencies: string[]): void {
    for (const dep of dependencies) {
      this.registerDependency(module, dep);
    }
  }

  /**
   * Get dependencies for a module
   */
  getDependencies(module: string): string[] {
    return Array.from(this.dependencies.get(module) || []);
  }

  /**
   * Get dependents of a module
   */
  getDependents(module: string): string[] {
    return Array.from(this.dependents.get(module) || []);
  }

  /**
   * Check if module has dependencies
   */
  hasDependencies(module: string): boolean {
    const deps = this.dependencies.get(module);
    return deps ? deps.size > 0 : false;
  }

  /**
   * Check if module has dependents
   */
  hasDependents(module: string): boolean {
    const deps = this.dependents.get(module);
    return deps ? deps.size > 0 : false;
  }

  /**
   * Get load order (topological sort)
   */
  getLoadOrder(modules: string[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (module: string) => {
      if (visited.has(module)) {
        return;
      }
      if (visiting.has(module)) {
        throw new Error(`Circular dependency detected: ${module}`);
      }

      visiting.add(module);

      const deps = this.getDependencies(module);
      for (const dep of deps) {
        if (modules.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(module);
      visited.add(module);
      order.push(module);
    };

    for (const module of modules) {
      visit(module);
    }

    return order;
  }

  /**
   * Get unload order (reverse of load order)
   */
  getUnloadOrder(modules: string[]): string[] {
    return this.getLoadOrder(modules).reverse();
  }

  /**
   * Set module version
   */
  setVersion(module: string, version: string): void {
    this.versions.set(module, version);
  }

  /**
   * Get module version
   */
  getVersion(module: string): string | undefined {
    return this.versions.get(module);
  }

  /**
   * Check if versions are compatible
   */
  areVersionsCompatible(module1: string, module2: string): boolean {
    const v1 = this.versions.get(module1);
    const v2 = this.versions.get(module2);

    if (!v1 || !v2) {
      return true;
    }

    // Simple check: same major version
    const major1 = v1.split(".")[0];
    const major2 = v2.split(".")[0];

    return major1 === major2;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDeps(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];

    const detect = (module: string) => {
      if (path.includes(module)) {
        const cycleStart = path.indexOf(module);
        cycles.push([...path.slice(cycleStart), module]);
        return;
      }
      if (visited.has(module)) {
        return;
      }

      visited.add(module);
      path.push(module);

      const deps = this.getDependencies(module);
      for (const dep of deps) {
        detect(dep);
      }

      path.pop();
    };

    for (const module of this.dependencies.keys()) {
      detect(module);
    }

    return cycles;
  }

  /**
   * Get all modules
   */
  getAllModules(): string[] {
    const modules = new Set<string>();

    for (const [module, deps] of this.dependencies) {
      modules.add(module);
      for (const dep of deps) {
        modules.add(dep);
      }
    }

    return Array.from(modules);
  }

  /**
   * Clear dependencies for a module
   */
  clearDependencies(module: string): void {
    const deps = this.dependencies.get(module);
    if (deps) {
      for (const dep of deps) {
        const dependents = this.dependents.get(dep);
        if (dependents) {
          dependents.delete(module);
        }
      }
    }

    this.dependencies.delete(module);

    const dependents = this.dependents.get(module);
    if (dependents) {
      for (const dependent of dependents) {
        const deps = this.dependencies.get(dependent);
        if (deps) {
          deps.delete(module);
        }
      }
    }

    this.dependents.delete(module);
  }

  /**
   * Clear all dependencies
   */
  clearAll(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.loadOrder = [];
    this.versions.clear();
  }

  /**
   * Export dependency graph
   */
  exportGraph(): {
    nodes: string[];
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = this.getAllModules();
    const edges: Array<{ from: string; to: string }> = [];

    for (const [module, deps] of this.dependencies) {
      for (const dep of deps) {
        edges.push({ from: module, to: dep });
      }
    }

    return { nodes, edges };
  }

  /**
   * Visualize dependency graph (DOT format)
   */
  visualizeGraph(): string {
    const { nodes, edges } = this.exportGraph();

    let dot = "digraph Dependencies {\n";
    dot += "  rankdir=LR;\n";

    for (const node of nodes) {
      dot += `  "${node}";\n`;
    }

    for (const edge of edges) {
      dot += `  "${edge.from}" -> "${edge.to}";\n`;
    }

    dot += "}";
    return dot;
  }

  /**
   * Get dependency tree for a module
   */
  getDependencyTree(module: string, depth: number = 0): string {
    const indent = "  ".repeat(depth);
    const deps = this.getDependencies(module);
    const version = this.getVersion(module) || "unknown";

    let result = `${indent}${module} @ ${version}\n`;

    for (const dep of deps) {
      result += this.getDependencyTree(dep, depth + 1);
    }

    return result;
  }

  /**
   * Get dependent tree for a module
   */
  getDependentTree(module: string, depth: number = 0): string {
    const indent = "  ".repeat(depth);
    const dependents = this.getDependents(module);
    const version = this.getVersion(module) || "unknown";

    let result = `${indent}${module} @ ${version}\n`;

    for (const dependent of dependents) {
      result += this.getDependentTree(dependent, depth + 1);
    }

    return result;
  }

  /**
   * Check if module needs reload after dependency change
   */
  needsReload(module: string, changedDependency: string): boolean {
    const deps = this.getDependencies(module);
    return deps.includes(changedDependency);
  }

  /**
   * Get modules that need reload after a change
   */
  getModulesNeedingReload(changedModule: string): string[] {
    const result: string[] = [];
    const visited = new Set<string>();

    const collect = (module: string) => {
      if (visited.has(module)) {
        return;
      }

      visited.add(module);
      result.push(module);

      const dependents = this.getDependents(module);
      for (const dependent of dependents) {
        collect(dependent);
      }
    };

    collect(changedModule);
    return result;
  }
}
