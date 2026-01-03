/**
 * DiffEngine - Computes diffs between UI states
 */

import type {
  UIState,
  DiffConfig,
  DiffResult,
  Addition,
  Deletion,
  Modification,
  Move,
  DiffSummary,
  CodeDiff,
  DiffHunk,
  DiffLine,
} from "../types.js";

export class DiffEngine {
  private config: DiffConfig;

  constructor(config: Partial<DiffConfig> = {}) {
    this.config = {
      type: config.type ?? "structural",
      algorithm: config.algorithm ?? "myers",
      granularity: config.granularity ?? "medium",
    };
  }

  /**
   * Compute diff between two UI states
   */
  diff(before: UIState, after: UIState): DiffResult {
    const additions: Addition[] = [];
    const deletions: Deletion[] = [];
    const modifications: Modification[] = [];
    const moves: Move[] = [];

    // Component tree diff
    const componentDiff = this.diffComponents(
      before.components,
      after.components
    );
    additions.push(...componentDiff.additions);
    deletions.push(...componentDiff.deletions);
    modifications.push(...componentDiff.modifications);
    moves.push(...componentDiff.moves);

    // Styles diff
    const styleDiff = this.diffStyles(before.styles, after.styles);
    modifications.push(...styleDiff);

    // Layout diff
    const layoutDiff = this.diffLayout(before.layout, after.layout);
    modifications.push(...layoutDiff);

    // Behavior diff
    const behaviorDiff = this.diffBehavior(before.behavior, after.behavior);
    modifications.push(...behaviorDiff);

    const summary = this.computeSummary(
      additions,
      deletions,
      modifications,
      moves
    );

    return { additions, deletions, modifications, moves, summary };
  }

  /**
   * Compute code diff (unified format)
   */
  codeDiff(before: string, after: string): CodeDiff {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");

    const hunks = this.computeHunks(beforeLines, afterLines);
    const additions = hunks.reduce((sum, h) => sum + h.newLines, 0);
    const deletions = hunks.reduce((sum, h) => sum + h.oldLines, 0);

    const unified = this.formatUnifiedDiff(beforeLines, afterLines, hunks);

    return { unified, additions, deletions, hunks };
  }

  /**
   * Compute visual diff (image comparison)
   */
  async visualDiff(
    beforeImage: Buffer,
    afterImage: Buffer
  ): Promise<DiffResult> {
    // Simplified visual diff - in production would use image comparison
    const additions: Addition[] = [];
    const deletions: Deletion[] = [];
    const modifications: Modification[] = [];

    const beforeSize = beforeImage.length;
    const afterSize = afterImage.length;

    if (beforeSize !== afterSize) {
      modifications.push({
        path: "image",
        before: { size: beforeSize },
        after: { size: afterSize },
      });
    }

    const summary: DiffSummary = {
      totalAdditions: additions.length,
      totalDeletions: deletions.length,
      totalModifications: modifications.length,
      totalMoves: 0,
      severity: modifications.length > 0 ? "major" : "minor",
    };

    return { additions, deletions, modifications, moves: [], summary };
  }

  /**
   * Compute semantic diff
   */
  semanticDiff(before: UIState, after: UIState): DiffResult {
    const additions: Addition[] = [];
    const deletions: Deletion[] = [];
    const modifications: Modification[] = [];

    // Semantic changes based on component roles and intents
    const beforeSemantics = this.extractSemantics(before);
    const afterSemantics = this.extractSemantics(after);

    for (const [role, afterData] of Object.entries(afterSemantics)) {
      const beforeData = beforeSemantics[role];

      if (!beforeData) {
        additions.push({
          path: `semantic.${role}`,
          content: afterData,
        });
      } else if (JSON.stringify(beforeData) !== JSON.stringify(afterData)) {
        modifications.push({
          path: `semantic.${role}`,
          before: beforeData,
          after: afterData,
        });
      }
    }

    for (const role of Object.keys(beforeSemantics)) {
      if (!afterSemantics[role]) {
        deletions.push({
          path: `semantic.${role}`,
          content: beforeSemantics[role],
        });
      }
    }

    const summary: DiffSummary = {
      totalAdditions: additions.length,
      totalDeletions: deletions.length,
      totalModifications: modifications.length,
      totalMoves: 0,
      severity: this.determineSeverity(
        additions.length,
        deletions.length,
        modifications.length
      ),
    };

    return { additions, deletions, modifications, moves: [], summary };
  }

  /**
   * Compute structural diff (tree-based)
   */
  structuralDiff(before: UIState, after: UIState): DiffResult {
    return this.diff(before, after);
  }

  // Private methods

  private diffComponents(
    before: UIState["components"],
    after: UIState["components"]
  ): Pick<DiffResult, "additions" | "deletions" | "modifications" | "moves"> {
    const additions: Addition[] = [];
    const deletions: Deletion[] = [];
    const modifications: Modification[] = [];
    const moves: Move[] = [];

    const beforeMap = new Map(before.map(c => [c.id, c]));
    const afterMap = new Map(after.map(c => [c.id, c]));

    // Detect additions
    for (const [id, component] of afterMap) {
      if (!beforeMap.has(id)) {
        additions.push({
          path: `components.${id}`,
          content: component,
        });
      }
    }

    // Detect deletions
    for (const [id, component] of beforeMap) {
      if (!afterMap.has(id)) {
        deletions.push({
          path: `components.${id}`,
          content: component,
        });
      }
    }

    // Detect modifications
    for (const [id, afterComp] of afterMap) {
      const beforeComp = beforeMap.get(id);
      if (beforeComp) {
        const changes = this.compareComponents(beforeComp, afterComp);
        if (changes.length > 0) {
          modifications.push({
            path: `components.${id}`,
            before: beforeComp,
            after: afterComp,
          });
        }
      }
    }

    return { additions, deletions, modifications, moves };
  }

  private diffStyles(
    before: UIState["styles"],
    after: UIState["styles"]
  ): Modification[] {
    const modifications: Modification[] = [];

    for (const [key, afterValue] of Object.entries(after.css)) {
      const beforeValue = before.css[key];
      if (beforeValue !== afterValue) {
        modifications.push({
          path: `styles.css.${key}`,
          before: beforeValue,
          after: afterValue,
        });
      }
    }

    if (before.theme !== after.theme) {
      modifications.push({
        path: "styles.theme",
        before: before.theme,
        after: after.theme,
      });
    }

    return modifications;
  }

  private diffLayout(
    before: UIState["layout"],
    after: UIState["layout"]
  ): Modification[] {
    const modifications: Modification[] = [];

    if (before.type !== after.type) {
      modifications.push({
        path: "layout.type",
        before: before.type,
        after: after.type,
      });
    }

    const dimChanges = this.diffObject(
      before.dimensions,
      after.dimensions,
      "layout.dimensions"
    );
    modifications.push(...dimChanges);

    const posChanges = this.diffObject(
      before.position,
      after.position,
      "layout.position"
    );
    modifications.push(...posChanges);

    return modifications;
  }

  private diffBehavior(
    before: UIState["behavior"],
    after: UIState["behavior"]
  ): Modification[] {
    const modifications: Modification[] = [];

    // Event changes
    if (before.events.length !== after.events.length) {
      modifications.push({
        path: "behavior.events",
        before: before.events,
        after: after.events,
      });
    }

    // Action changes
    if (before.actions.length !== after.actions.length) {
      modifications.push({
        path: "behavior.actions",
        before: before.actions,
        after: after.actions,
      });
    }

    return modifications;
  }

  private compareComponents(
    before: UIState["components"][0],
    after: UIState["components"][0]
  ): string[] {
    const changes: string[] = [];

    if (before.type !== after.type) {
      changes.push("type");
    }

    if (JSON.stringify(before.props) !== JSON.stringify(after.props)) {
      changes.push("props");
    }

    if (JSON.stringify(before.styles) !== JSON.stringify(after.styles)) {
      changes.push("styles");
    }

    if (before.children.length !== after.children.length) {
      changes.push("children");
    }

    return changes;
  }

  private diffObject(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    path: string
  ): Modification[] {
    const modifications: Modification[] = [];

    for (const key of Object.keys(after)) {
      if (before[key] !== after[key]) {
        modifications.push({
          path: `${path}.${key}`,
          before: before[key],
          after: after[key],
        });
      }
    }

    return modifications;
  }

  private computeHunks(
    beforeLines: string[],
    afterLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let i = 0;
    let j = 0;

    while (i < beforeLines.length || j < afterLines.length) {
      if (
        i < beforeLines.length &&
        j < afterLines.length &&
        beforeLines[i] === afterLines[j]
      ) {
        i++;
        j++;
        continue;
      }

      const hunk = this.computeHunk(beforeLines, afterLines, i, j);
      if (hunk) {
        hunks.push(hunk);
        i = hunk.oldStart + hunk.oldLines;
        j = hunk.newStart + hunk.newLines;
      } else {
        break;
      }
    }

    return hunks;
  }

  private computeHunk(
    beforeLines: string[],
    afterLines: string[],
    startOld: number,
    startNew: number
  ): DiffHunk | null {
    const contextLines = 3;
    const lines: DiffLine[] = [];

    let oldEnd = startOld;
    let newEnd = startNew;

    // Collect context before
    const contextStartOld = Math.max(0, startOld - contextLines);
    const contextStartNew = Math.max(0, startNew - contextLines);

    for (let i = contextStartOld; i < startOld; i++) {
      lines.push({
        type: "context",
        content: beforeLines[i],
        lineNumber: i + 1,
      });
    }

    // Collect diff lines
    while (oldEnd < beforeLines.length || newEnd < afterLines.length) {
      const oldLine = oldEnd < beforeLines.length ? beforeLines[oldEnd] : null;
      const newLine = newEnd < afterLines.length ? afterLines[newEnd] : null;

      if (oldLine === newLine) {
        break;
      }

      if (oldLine !== null) {
        lines.push({
          type: "deletion",
          content: oldLine,
          lineNumber: oldEnd + 1,
        });
        oldEnd++;
      }

      if (newLine !== null) {
        lines.push({
          type: "addition",
          content: newLine,
          lineNumber: newEnd + 1,
        });
        newEnd++;
      }

      if (lines.length > 100) {
        break;
      }
    }

    // Collect context after
    const contextEndOld = Math.min(beforeLines.length, oldEnd + contextLines);
    const contextEndNew = Math.min(afterLines.length, newEnd + contextLines);

    for (let i = oldEnd; i < contextEndOld; i++) {
      lines.push({
        type: "context",
        content: beforeLines[i],
        lineNumber: i + 1,
      });
    }
    for (let i = newEnd; i < contextEndNew; i++) {
      lines.push({
        type: "context",
        content: afterLines[i],
        lineNumber: i + 1,
      });
    }

    if (lines.length === 0) {
      return null;
    }

    return {
      oldStart: contextStartOld + 1,
      oldLines: oldEnd - contextStartOld,
      newStart: contextStartNew + 1,
      newLines: newEnd - contextStartNew,
      lines,
    };
  }

  private formatUnifiedDiff(
    beforeLines: string[],
    afterLines: string[],
    hunks: DiffHunk[]
  ): string {
    const lines: string[] = [];

    for (const hunk of hunks) {
      lines.push(
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
      );

      for (const line of hunk.lines) {
        const prefix =
          line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
        lines.push(`${prefix}${line.content}`);
      }
    }

    return lines.join("\n");
  }

  private computeSummary(
    additions: Addition[],
    deletions: Deletion[],
    modifications: Modification[],
    moves: Move[]
  ): DiffSummary {
    const summary: DiffSummary = {
      totalAdditions: additions.length,
      totalDeletions: deletions.length,
      totalModifications: modifications.length,
      totalMoves: moves.length,
      severity: this.determineSeverity(
        additions.length,
        deletions.length,
        modifications.length
      ),
    };

    return summary;
  }

  private determineSeverity(
    additions: number,
    deletions: number,
    modifications: number
  ): "minor" | "major" | "breaking" {
    if (deletions > 0) {
      return "breaking";
    }
    if (additions > 5 || modifications > 10) {
      return "major";
    }
    return "minor";
  }

  private extractSemantics(state: UIState): Record<string, unknown> {
    const semantics: Record<string, unknown> = {};

    for (const component of state.components) {
      const role = component.type;
      if (!semantics[role]) {
        semantics[role] = [];
      }
      (semantics[role] as unknown[]).push({
        id: component.id,
        props: component.props,
      });
    }

    return semantics;
  }
}
