/**
 * DiffRenderer - Render diffs in various formats
 */

import type {
  DiffResult,
  DiffVizConfig,
  RenderedDiff,
  HighlightedChange,
} from "../types.js";

export class DiffRenderer {
  private config: DiffVizConfig;

  constructor(config: Partial<DiffVizConfig> = {}) {
    this.config = {
      format: config.format ?? "side_by_side",
      highlightColor: config.highlightColor ?? "#ffff00",
      showContext: config.showContext ?? true,
      animation: config.animation ?? false,
    };
  }

  /**
   * Render a diff result
   */
  render(diff: DiffResult, options: Partial<DiffVizConfig> = {}): RenderedDiff {
    const config = { ...this.config, ...options };

    const changes: HighlightedChange[] = this.highlightChanges(diff, config);

    const rendered: RenderedDiff = {
      format: config.format,
      before: this.extractBeforeState(diff),
      after: this.extractAfterState(diff),
      changes,
      summary: diff.summary,
    };

    return rendered;
  }

  /**
   * Render side-by-side diff
   */
  renderSideBySide(diff: DiffResult): string {
    const lines: string[] = [];

    lines.push("=== BEFORE ===");
    lines.push("Additions:");
    for (const addition of diff.additions) {
      lines.push(`  + ${addition.path}`);
    }

    lines.push("\n=== AFTER ===");
    lines.push("Deletions:");
    for (const deletion of diff.deletions) {
      lines.push(`  - ${deletion.path}`);
    }

    lines.push("\n=== MODIFICATIONS ===");
    for (const mod of diff.modifications) {
      lines.push(`  ~ ${mod.path}`);
      lines.push(`    Before: ${JSON.stringify(mod.before)}`);
      lines.push(`    After: ${JSON.stringify(mod.after)}`);
    }

    return lines.join("\n");
  }

  /**
   * Render unified diff
   */
  renderUnified(diff: DiffResult): string {
    const lines: string[] = [];

    lines.push("--- BEFORE");
    lines.push("+++ AFTER");

    for (const addition of diff.additions) {
      lines.push(`+ ${addition.path}: ${JSON.stringify(addition.content)}`);
    }

    for (const deletion of diff.deletions) {
      lines.push(`- ${deletion.path}: ${JSON.stringify(deletion.content)}`);
    }

    for (const mod of diff.modifications) {
      lines.push(`~ ${mod.path}`);
      lines.push(`  - ${JSON.stringify(mod.before)}`);
      lines.push(`  + ${JSON.stringify(mod.after)}`);
    }

    return lines.join("\n");
  }

  /**
   * Render overlay diff
   */
  renderOverlay(diff: DiffResult): string {
    const lines: string[] = [];

    lines.push("=== DIFF OVERLAY ===\n");

    for (const addition of diff.additions) {
      lines.push(`[ADD] ${addition.path}`);
      lines.push(`      Content: ${JSON.stringify(addition.content)}`);
    }

    for (const deletion of diff.deletions) {
      lines.push(`[DELETE] ${deletion.path}`);
      lines.push(`         Content: ${JSON.stringify(deletion.content)}`);
    }

    for (const mod of diff.modifications) {
      lines.push(`[MODIFY] ${mod.path}`);
      lines.push(`         Before: ${JSON.stringify(mod.before)}`);
      lines.push(`         After: ${JSON.stringify(mod.after)}`);
    }

    return lines.join("\n");
  }

  /**
   * Render animated diff
   */
  renderAnimated(diff: DiffResult): AnimatedDiff {
    const frames: AnimationFrame[] = [];

    // Frame 1: Initial state
    frames.push({
      frame: 0,
      type: "initial",
      content: this.extractBeforeState(diff),
    });

    // Frame 2: Show deletions
    if (diff.deletions.length > 0) {
      frames.push({
        frame: 1,
        type: "deletion",
        content: diff.deletions,
        message: `Removing ${diff.deletions.length} item(s)`,
      });
    }

    // Frame 3: Show additions
    if (diff.additions.length > 0) {
      frames.push({
        frame: 2,
        type: "addition",
        content: diff.additions,
        message: `Adding ${diff.additions.length} item(s)`,
      });
    }

    // Frame 4: Show modifications
    if (diff.modifications.length > 0) {
      frames.push({
        frame: 3,
        type: "modification",
        content: diff.modifications,
        message: `Modifying ${diff.modifications.length} item(s)`,
      });
    }

    // Frame 5: Final state
    frames.push({
      frame: 4,
      type: "final",
      content: this.extractAfterState(diff),
    });

    return { frames, duration: this.calculateDuration(frames) };
  }

  /**
   * Generate HTML diff
   */
  renderHTML(diff: DiffResult): string {
    const lines: string[] = [];

    lines.push('<div class="diff-container">');

    // Additions
    for (const addition of diff.additions) {
      lines.push(`<div class="diff-addition">`);
      lines.push(
        `  <span class="diff-path">${this.escapeHtml(addition.path)}</span>`
      );
      lines.push(
        `  <span class="diff-content">${this.escapeHtml(JSON.stringify(addition.content))}</span>`
      );
      lines.push(`</div>`);
    }

    // Deletions
    for (const deletion of diff.deletions) {
      lines.push(`<div class="diff-deletion">`);
      lines.push(
        `  <span class="diff-path">${this.escapeHtml(deletion.path)}</span>`
      );
      lines.push(
        `  <span class="diff-content">${this.escapeHtml(JSON.stringify(deletion.content))}</span>`
      );
      lines.push(`</div>`);
    }

    // Modifications
    for (const mod of diff.modifications) {
      lines.push(`<div class="diff-modification">`);
      lines.push(
        `  <span class="diff-path">${this.escapeHtml(mod.path)}</span>`
      );
      lines.push(
        `  <span class="diff-before">${this.escapeHtml(JSON.stringify(mod.before))}</span>`
      );
      lines.push(
        `  <span class="diff-after">${this.escapeHtml(JSON.stringify(mod.after))}</span>`
      );
      lines.push(`</div>`);
    }

    lines.push("</div>");

    return lines.join("\n");
  }

  /**
   * Generate JSON diff
   */
  renderJSON(diff: DiffResult): string {
    return JSON.stringify(diff, null, 2);
  }

  /**
   * Render diff summary
   */
  renderSummary(diff: DiffResult): string {
    const lines: string[] = [];

    lines.push("=== DIFF SUMMARY ===");
    lines.push(`Additions: ${diff.summary.totalAdditions}`);
    lines.push(`Deletions: ${diff.summary.totalDeletions}`);
    lines.push(`Modifications: ${diff.summary.totalModifications}`);
    lines.push(`Moves: ${diff.summary.totalMoves}`);
    lines.push(`Severity: ${diff.summary.severity}`);

    return lines.join("\n");
  }

  // Private methods

  private highlightChanges(
    diff: DiffResult,
    config: DiffVizConfig
  ): HighlightedChange[] {
    const highlighted: HighlightedChange[] = [];

    for (const addition of diff.additions) {
      highlighted.push({
        type: "addition",
        path: addition.path,
        before: undefined,
        after: addition.content,
        className: "diff-addition",
      });
    }

    for (const deletion of diff.deletions) {
      highlighted.push({
        type: "deletion",
        path: deletion.path,
        before: deletion.content,
        after: undefined,
        className: "diff-deletion",
      });
    }

    for (const mod of diff.modifications) {
      highlighted.push({
        type: "modification",
        path: mod.path,
        before: mod.before,
        after: mod.after,
        className: "diff-modification",
      });
    }

    for (const move of diff.moves) {
      highlighted.push({
        type: "move",
        path: `${move.from} -> ${move.to}`,
        before: move.from,
        after: move.to,
        className: "diff-move",
      });
    }

    return highlighted;
  }

  private extractBeforeState(diff: DiffResult): unknown {
    const state: Record<string, unknown> = {};

    for (const deletion of diff.deletions) {
      state[deletion.path] = deletion.content;
    }

    for (const mod of diff.modifications) {
      state[mod.path] = mod.before;
    }

    return state;
  }

  private extractAfterState(diff: DiffResult): unknown {
    const state: Record<string, unknown> = {};

    for (const addition of diff.additions) {
      state[addition.path] = addition.content;
    }

    for (const mod of diff.modifications) {
      state[mod.path] = mod.after;
    }

    return state;
  }

  private calculateDuration(frames: AnimationFrame[]): number {
    // Assume 500ms per frame
    return frames.length * 500;
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

export interface AnimationFrame {
  frame: number;
  type: "initial" | "deletion" | "addition" | "modification" | "final";
  content: unknown;
  message?: string;
}

export interface AnimatedDiff {
  frames: AnimationFrame[];
  duration: number;
}
