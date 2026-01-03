/**
 * ChangeDetector - Detects changes in UI state
 */

import type {
  UIState,
  DetectedChange,
  ChangeDetectionConfig,
  ChangeType,
} from "../types.js";

export class ChangeDetector {
  private config: ChangeDetectionConfig;

  constructor(config: Partial<ChangeDetectionConfig> = {}) {
    this.config = {
      visual: config.visual ?? true,
      structural: config.structural ?? true,
      behavioral: config.behavioral ?? true,
      semantic: config.semantic ?? true,
      threshold: config.threshold ?? 0.3,
    };
  }

  /**
   * Detect all changes between two UI states
   */
  detectChanges(before: UIState, after: UIState): DetectedChange[] {
    const changes: DetectedChange[] = [];

    if (this.config.visual) {
      changes.push(...this.detectVisualChanges(before, after));
    }

    if (this.config.structural) {
      changes.push(...this.detectStructuralChanges(before, after));
    }

    if (this.config.behavioral) {
      changes.push(...this.detectBehavioralChanges(before, after));
    }

    if (this.config.semantic) {
      changes.push(...this.detectSemanticChanges(before, after));
    }

    return changes;
  }

  /**
   * Detect visual changes
   */
  detectVisualChanges(before: UIState, after: UIState): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Style changes
    const styleChanges = this.detectStyleChanges(before.styles, after.styles);
    changes.push(...styleChanges);

    // Layout changes
    const layoutChanges = this.detectLayoutChanges(before.layout, after.layout);
    changes.push(...layoutChanges);

    // Component visual changes
    const componentVisualChanges = this.detectComponentVisualChanges(
      before.components,
      after.components
    );
    changes.push(...componentVisualChanges);

    return changes;
  }

  /**
   * Detect structural changes
   */
  detectStructuralChanges(before: UIState, after: UIState): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Component tree changes
    const treeChanges = this.detectTreeChanges(
      before.components,
      after.components
    );
    changes.push(...treeChanges);

    // Hierarchy changes
    const hierarchyChanges = this.detectHierarchyChanges(
      before.components,
      after.components
    );
    changes.push(...hierarchyChanges);

    return changes;
  }

  /**
   * Detect behavioral changes
   */
  detectBehavioralChanges(before: UIState, after: UIState): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Event handler changes
    const eventChanges = this.detectEventChanges(
      before.behavior.events,
      after.behavior.events
    );
    changes.push(...eventChanges);

    // Action changes
    const actionChanges = this.detectActionChanges(
      before.behavior.actions,
      after.behavior.actions
    );
    changes.push(...actionChanges);

    // State machine changes
    if (before.behavior.stateMachine || after.behavior.stateMachine) {
      const smChanges = this.detectStateMachineChanges(
        before.behavior.stateMachine,
        after.behavior.stateMachine
      );
      changes.push(...smChanges);
    }

    return changes;
  }

  /**
   * Detect semantic changes
   */
  detectSemanticChanges(before: UIState, after: UIState): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Semantic role changes
    const roleChanges = this.detectSemanticRoleChanges(before, after);
    changes.push(...roleChanges);

    // Intent changes
    const intentChanges = this.detectIntentChanges(before, after);
    changes.push(...intentChanges);

    // Accessibility changes
    const a11yChanges = this.detectAccessibilityChanges(before, after);
    changes.push(...a11yChanges);

    return changes;
  }

  /**
   * Calculate change severity
   */
  calculateSeverity(changes: DetectedChange[]): "minor" | "major" | "breaking" {
    if (changes.some(c => c.severity === "breaking")) {
      return "breaking";
    }
    if (changes.some(c => c.severity === "major")) {
      return "major";
    }
    return "minor";
  }

  /**
   * Calculate change confidence
   */
  calculateConfidence(changes: DetectedChange[]): number {
    if (changes.length === 0) {
      return 0;
    }

    const avgConfidence =
      changes.reduce((sum, c) => sum + c.confidence, 0) / changes.length;

    return avgConfidence;
  }

  // Private detection methods

  private detectStyleChanges(
    before: UIState["styles"],
    after: UIState["styles"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Check CSS changes
    for (const key of Object.keys(after.css)) {
      if (before.css[key] !== after.css[key]) {
        changes.push({
          type: "visual",
          severity: "minor",
          description: `Style '${key}' changed`,
          confidence: 1.0,
          before: before.css[key],
          after: after.css[key],
        });
      }
    }

    // Check theme changes
    if (before.theme !== after.theme) {
      changes.push({
        type: "visual",
        severity: "major",
        description: `Theme changed from '${before.theme}' to '${after.theme}'`,
        confidence: 1.0,
        before: before.theme,
        after: after.theme,
      });
    }

    return changes;
  }

  private detectLayoutChanges(
    before: UIState["layout"],
    after: UIState["layout"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Check layout type changes
    if (before.type !== after.type) {
      changes.push({
        type: "visual",
        severity: "major",
        description: `Layout type changed from '${before.type}' to '${after.type}'`,
        confidence: 1.0,
        before: before.type,
        after: after.type,
      });
    }

    // Check dimension changes
    const dimChanges = this.detectChanges(
      before.dimensions,
      after.dimensions,
      "dimensions"
    );
    changes.push(...dimChanges);

    // Check position changes
    const posChanges = this.detectChanges(
      before.position,
      after.position,
      "position"
    );
    changes.push(...posChanges);

    return changes;
  }

  private detectComponentVisualChanges(
    before: UIState["components"],
    after: UIState["components"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const beforeMap = new Map(before.map(c => [c.id, c]));
    const afterMap = new Map(after.map(c => [c.id, c]));

    // Check for modified components
    for (const [id, afterComp] of afterMap) {
      const beforeComp = beforeMap.get(id);
      if (beforeComp) {
        // Check style changes
        const styleDiff = this.detectChanges(
          beforeComp.styles,
          afterComp.styles,
          `${id}.styles`
        );
        changes.push(
          ...styleDiff.map(c => ({ ...c, type: "visual" as ChangeType }))
        );

        // Check prop changes
        const propDiff = this.detectChanges(
          beforeComp.props,
          afterComp.props,
          `${id}.props`
        );
        changes.push(
          ...propDiff.map(c => ({ ...c, type: "visual" as ChangeType }))
        );
      }
    }

    return changes;
  }

  private detectTreeChanges(
    before: UIState["components"],
    after: UIState["components"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const beforeIds = new Set(before.map(c => c.id));
    const afterIds = new Set(after.map(c => c.id));

    // Detect additions
    for (const id of afterIds) {
      if (!beforeIds.has(id)) {
        const component = after.find(c => c.id === id)!;
        changes.push({
          type: "structural",
          severity: "major",
          description: `Component '${id}' added`,
          confidence: 1.0,
          before: undefined,
          after: component,
        });
      }
    }

    // Detect deletions
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        const component = before.find(c => c.id === id)!;
        changes.push({
          type: "structural",
          severity: "breaking",
          description: `Component '${id}' removed`,
          confidence: 1.0,
          before: component,
          after: undefined,
        });
      }
    }

    return changes;
  }

  private detectHierarchyChanges(
    before: UIState["components"],
    after: UIState["components"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const beforeParents = this.getParentMap(before);
    const afterParents = this.getParentMap(after);

    // Detect parent changes
    for (const [childId, beforeParent] of beforeParents) {
      const afterParent = afterParents.get(childId);
      if (beforeParent !== afterParent) {
        changes.push({
          type: "structural",
          severity: "major",
          description: `Component '${childId}' moved from '${beforeParent}' to '${afterParent}'`,
          confidence: 1.0,
          before: { parent: beforeParent },
          after: { parent: afterParent },
        });
      }
    }

    return changes;
  }

  private detectEventChanges(
    before: UIState["behavior"]["events"],
    after: UIState["behavior"]["events"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const beforeMap = new Map(before.map((e, i) => [`${e.event}_${i}`, e]));
    const afterMap = new Map(after.map((e, i) => [`${e.event}_${i}`, e]));

    // Check for removed events
    for (const [key, beforeEvent] of beforeMap) {
      if (!afterMap.has(key)) {
        changes.push({
          type: "behavioral",
          severity: "major",
          description: `Event '${beforeEvent.event}' removed`,
          confidence: 1.0,
          before: beforeEvent,
          after: undefined,
        });
      }
    }

    // Check for added events
    for (const [key, afterEvent] of afterMap) {
      if (!beforeMap.has(key)) {
        changes.push({
          type: "behavioral",
          severity: "major",
          description: `Event '${afterEvent.event}' added`,
          confidence: 1.0,
          before: undefined,
          after: afterEvent,
        });
      }
    }

    return changes;
  }

  private detectActionChanges(
    before: UIState["behavior"]["actions"],
    after: UIState["behavior"]["actions"]
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    const beforeMap = new Map(before.map((a, i) => [`${a.type}_${i}`, a]));
    const afterMap = new Map(after.map((a, i) => [`${a.type}_${i}`, a]));

    // Check for removed actions
    for (const [key, beforeAction] of beforeMap) {
      if (!afterMap.has(key)) {
        changes.push({
          type: "behavioral",
          severity: "major",
          description: `Action '${beforeAction.type}' removed`,
          confidence: 1.0,
          before: beforeAction,
          after: undefined,
        });
      }
    }

    // Check for added actions
    for (const [key, afterAction] of afterMap) {
      if (!beforeMap.has(key)) {
        changes.push({
          type: "behavioral",
          severity: "major",
          description: `Action '${afterAction.type}' added`,
          confidence: 1.0,
          before: undefined,
          after: afterAction,
        });
      }
    }

    return changes;
  }

  private detectStateMachineChanges(
    before: UIState["behavior"]["stateMachine"] | undefined,
    after: UIState["behavior"]["stateMachine"] | undefined
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    if (!before && after) {
      changes.push({
        type: "behavioral",
        severity: "major",
        description: "State machine added",
        confidence: 1.0,
        before: undefined,
        after: after,
      });
    } else if (before && !after) {
      changes.push({
        type: "behavioral",
        severity: "breaking",
        description: "State machine removed",
        confidence: 1.0,
        before: before,
        after: undefined,
      });
    } else if (before && after) {
      // Check for state changes
      const beforeStates = Object.keys(before.states);
      const afterStates = Object.keys(after.states);

      const addedStates = afterStates.filter(s => !beforeStates.includes(s));
      const removedStates = beforeStates.filter(s => !afterStates.includes(s));

      for (const state of addedStates) {
        changes.push({
          type: "behavioral",
          severity: "major",
          description: `State '${state}' added to state machine`,
          confidence: 1.0,
          before: undefined,
          after: after.states[state],
        });
      }

      for (const state of removedStates) {
        changes.push({
          type: "behavioral",
          severity: "breaking",
          description: `State '${state}' removed from state machine`,
          confidence: 1.0,
          before: before.states[state],
          after: undefined,
        });
      }
    }

    return changes;
  }

  private detectSemanticRoleChanges(
    before: UIState,
    after: UIState
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Simple heuristic: detect role changes based on component type changes
    const beforeRoles = new Set(before.components.map(c => c.type));
    const afterRoles = new Set(after.components.map(c => c.type));

    const addedRoles = [...afterRoles].filter(r => !beforeRoles.has(r));
    const removedRoles = [...beforeRoles].filter(r => !afterRoles.has(r));

    for (const role of addedRoles) {
      changes.push({
        type: "semantic",
        severity: "minor",
        description: `Semantic role '${role}' introduced`,
        confidence: 0.7,
        before: undefined,
        after: role,
      });
    }

    for (const role of removedRoles) {
      changes.push({
        type: "semantic",
        severity: "major",
        description: `Semantic role '${role}' removed`,
        confidence: 0.7,
        before: role,
        after: undefined,
      });
    }

    return changes;
  }

  private detectIntentChanges(
    before: UIState,
    after: UIState
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Detect interaction pattern changes based on events
    const beforePatterns = this.extractInteractionPatterns(
      before.behavior.events
    );
    const afterPatterns = this.extractInteractionPatterns(
      after.behavior.events
    );

    const addedPatterns = afterPatterns.filter(
      p => !beforePatterns.includes(p)
    );
    const removedPatterns = beforePatterns.filter(
      p => !afterPatterns.includes(p)
    );

    for (const pattern of addedPatterns) {
      changes.push({
        type: "semantic",
        severity: "minor",
        description: `Interaction pattern '${pattern}' added`,
        confidence: 0.6,
        before: undefined,
        after: pattern,
      });
    }

    for (const pattern of removedPatterns) {
      changes.push({
        type: "semantic",
        severity: "major",
        description: `Interaction pattern '${pattern}' removed`,
        confidence: 0.6,
        before: pattern,
        after: undefined,
      });
    }

    return changes;
  }

  private detectAccessibilityChanges(
    before: UIState,
    after: UIState
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    // Check for accessibility-related prop changes
    const a11yProps = ["aria-label", "role", "tabIndex", "alt"];

    for (const beforeComp of before.components) {
      const afterComp = after.components.find(c => c.id === beforeComp.id);
      if (!afterComp) continue;

      for (const prop of a11yProps) {
        if (beforeComp.props[prop] !== afterComp.props[prop]) {
          changes.push({
            type: "semantic",
            severity: "minor",
            description: `Accessibility prop '${prop}' changed for '${beforeComp.id}'`,
            confidence: 0.8,
            before: beforeComp.props[prop],
            after: afterComp.props[prop],
          });
        }
      }
    }

    return changes;
  }

  private detectChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    path: string
  ): DetectedChange[] {
    const changes: DetectedChange[] = [];

    for (const key of Object.keys(after)) {
      if (before[key] !== after[key]) {
        changes.push({
          type: "visual",
          severity: "minor",
          description: `Property '${path}.${key}' changed`,
          confidence: 1.0,
          before: before[key],
          after: after[key],
        });
      }
    }

    return changes;
  }

  private getParentMap(
    components: UIState["components"]
  ): Map<string, string | null> {
    const parentMap = new Map<string, string | null>();

    for (const component of components) {
      parentMap.set(component.id, null);

      for (const child of component.children) {
        parentMap.set(child.id, component.id);
      }
    }

    return parentMap;
  }

  private extractInteractionPatterns(
    events: UIState["behavior"]["events"]
  ): string[] {
    return events.map(e => e.event);
  }
}
