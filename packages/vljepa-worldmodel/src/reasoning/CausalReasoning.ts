/**
 * Causal Reasoning for VL-JEPA World Model
 * Infers cause-effect relationships and supports interventions
 */

import type {
  CausalModel,
  CausalVariable,
  CausalRelationship,
  Intervention,
  CausalQuery,
  WorldState,
  Action,
} from "../types.js";

export class CausalReasoning {
  private model: CausalModel;
  private causalHistory: Map<string, number[]> = new Map();

  constructor() {
    this.model = {
      variables: [],
      relationships: [],
      interventions: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Add a causal variable
   */
  addVariable(variable: CausalVariable): void {
    const existing = this.model.variables.findIndex(v => v.id === variable.id);
    if (existing >= 0) {
      this.model.variables[existing] = variable;
    } else {
      this.model.variables.push(variable);
    }
  }

  /**
   * Add a causal relationship
   */
  addRelationship(relationship: CausalRelationship): void {
    // Check if relationship already exists
    const existing = this.model.relationships.findIndex(
      r => r.cause === relationship.cause && r.effect === relationship.effect
    );

    if (existing >= 0) {
      // Update existing relationship
      this.model.relationships[existing] = relationship;
    } else {
      this.model.relationships.push(relationship);
    }

    // Update variable relationships
    const causeVar = this.model.variables.find(
      v => v.id === relationship.cause
    );
    const effectVar = this.model.variables.find(
      v => v.id === relationship.effect
    );

    if (causeVar && !causeVar.children.includes(relationship.effect)) {
      causeVar.children.push(relationship.effect);
    }

    if (effectVar && !effectVar.parents.includes(relationship.cause)) {
      effectVar.parents.push(relationship.cause);
    }
  }

  /**
   * Record an intervention
   */
  recordIntervention(intervention: Intervention): void {
    this.model.interventions.push(intervention);

    // Track causal strength over time
    const key = `${intervention.action}->${intervention.expectedEffect}`;
    if (!this.causalHistory.has(key)) {
      this.causalHistory.set(key, []);
    }
    this.causalHistory.get(key)!.push(intervention.confidence);
  }

  /**
   * Learn causal relationships from observations
   */
  learnFromObservations(
    beforeState: WorldState,
    afterState: WorldState,
    action: Action | null
  ): void {
    // Find differences between states
    const changedVariables = this.findChangedVariables(beforeState, afterState);

    if (action) {
      // If there was an action, assume it caused the changes
      for (const variable of changedVariables) {
        this.addRelationship({
          id: `rel-${action.type}-${variable}`,
          cause: action.type,
          effect: variable,
          strength: 0.8, // Initial strength
          delay: 100, // Default 100ms delay
          type: "probabilistic",
        });
      }
    } else {
      // No action, look for correlations
      for (let i = 0; i < changedVariables.length; i++) {
        for (let j = i + 1; j < changedVariables.length; j++) {
          // Assume earlier change causes later change
          this.addRelationship({
            id: `rel-${changedVariables[i]}-${changedVariables[j]}`,
            cause: changedVariables[i],
            effect: changedVariables[j],
            strength: 0.5,
            delay: 100,
            type: "probabilistic",
          });
        }
      }
    }
  }

  /**
   * Find variables that changed between states
   */
  private findChangedVariables(
    before: WorldState,
    after: WorldState
  ): string[] {
    const changed: string[] = [];

    // Check objects
    const beforeIds = new Set(before.objects.map(o => o.id));
    const afterIds = new Set(after.objects.map(o => o.id));

    // Added objects
    for (const id of afterIds) {
      if (!beforeIds.has(id)) {
        changed.push(`added-${id}`);
      }
    }

    // Removed objects
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        changed.push(`removed-${id}`);
      }
    }

    // Modified objects
    for (const beforeObj of before.objects) {
      const afterObj = after.objects.find(o => o.id === beforeObj.id);
      if (afterObj) {
        if (this.objectsDifferent(beforeObj, afterObj)) {
          changed.push(`modified-${beforeObj.id}`);
        }
      }
    }

    return changed;
  }

  /**
   * Check if two objects are different
   */
  private objectsDifferent(a: any, b: any): boolean {
    return (
      a.position.x !== b.position.x ||
      a.position.y !== b.position.y ||
      a.position.z !== b.position.z
    );
  }

  /**
   * Predict effect of a cause
   */
  predictEffect(cause: string): Array<{ effect: string; probability: number }> {
    const predictions: Array<{ effect: string; probability: number }> = [];

    for (const relationship of this.model.relationships) {
      if (relationship.cause === cause) {
        predictions.push({
          effect: relationship.effect,
          probability: relationship.strength,
        });
      }
    }

    // Sort by probability
    predictions.sort((a, b) => b.probability - a.probability);

    return predictions;
  }

  /**
   * Attribute cause to effect
   */
  attributeCause(
    effect: string
  ): Array<{ cause: string; probability: number }> {
    const attributions: Array<{ cause: string; probability: number }> = [];

    for (const relationship of this.model.relationships) {
      if (relationship.effect === effect) {
        attributions.push({
          cause: relationship.cause,
          probability: relationship.strength,
        });
      }
    }

    // Sort by probability
    attributions.sort((a, b) => b.probability - a.probability);

    return attributions;
  }

  /**
   * Find all causes for a set of effects
   */
  findRootCauses(effects: string[]): string[] {
    const rootCauses: string[] = [];
    const visited = new Set<string>();

    const traverse = (effectId: string): void => {
      if (visited.has(effectId)) return;
      visited.add(effectId);

      // Find all causes
      const causes = this.model.relationships
        .filter(r => r.effect === effectId)
        .map(r => r.cause);

      if (causes.length === 0) {
        // No causes, this is a root
        rootCauses.push(effectId);
      } else {
        for (const cause of causes) {
          traverse(cause);
        }
      }
    };

    for (const effect of effects) {
      traverse(effect);
    }

    return [...new Set(rootCauses)];
  }

  /**
   * Find all effects of a cause
   */
  findAllEffects(cause: string): string[] {
    const effects: string[] = [];
    const visited = new Set<string>();

    const traverse = (causeId: string): void => {
      if (visited.has(causeId)) return;
      visited.add(causeId);

      // Find all effects
      const directEffects = this.model.relationships
        .filter(r => r.cause === causeId)
        .map(r => r.effect);

      for (const effect of directEffects) {
        effects.push(effect);
        traverse(effect);
      }
    };

    traverse(cause);
    return [...new Set(effects)];
  }

  /**
   * Get causal path between two variables
   */
  getCausalPath(from: string, to: string): string[] | null {
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]): string[] | null => {
      if (current === to) {
        return [...path, current];
      }

      if (visited.has(current)) return null;
      visited.add(current);

      const outgoing = this.model.relationships
        .filter(r => r.cause === current)
        .map(r => r.effect);

      for (const next of outgoing) {
        const result = dfs(next, [...path, current]);
        if (result) return result;
      }

      return null;
    };

    return dfs(from, []);
  }

  /**
   * Estimate effect delay
   */
  estimateDelay(cause: string, effect: string): number | null {
    const relationship = this.model.relationships.find(
      r => r.cause === cause && r.effect === effect
    );

    return relationship ? relationship.delay : null;
  }

  /**
   * Update relationship strength based on evidence
   */
  updateRelationshipStrength(
    cause: string,
    effect: string,
    observed: boolean,
    expected: boolean
  ): void {
    const relationship = this.model.relationships.find(
      r => r.cause === cause && r.effect === effect
    );

    if (!relationship) return;

    // Bayesian update
    const alpha = 1; // Pseudo-count for success
    const beta = 1; // Pseudo-count for failure

    const currentStrength = relationship.strength;

    if (observed === expected) {
      // Increase strength
      relationship.strength = Math.min(
        1,
        (currentStrength * alpha + 1) / (alpha + 1)
      );
    } else {
      // Decrease strength
      relationship.strength = Math.max(
        0,
        (currentStrength * beta) / (beta + 1)
      );
    }
  }

  /**
   * Get causal model
   */
  getModel(): CausalModel {
    return {
      variables: [...this.model.variables],
      relationships: [...this.model.relationships],
      interventions: [...this.model.interventions],
      timestamp: Date.now(),
    };
  }

  /**
   * Export causal graph in DOT format
   */
  exportCausalGraph(): string {
    let dot = "digraph CausalModel {\n";
    dot += "  rankdir=LR;\n";
    dot += "  node [shape=box];\n\n";

    // Add nodes
    for (const variable of this.model.variables) {
      dot += `  "${variable.id}" [label="${variable.name}"];\n`;
    }

    dot += "\n";

    // Add edges
    for (const relationship of this.model.relationships) {
      const label = `${(relationship.strength * 100).toFixed(0)}%`;
      dot += `  "${relationship.cause}" -> "${relationship.effect}" [label="${label}"];\n`;
    }

    dot += "}";

    return dot;
  }

  /**
   * Reset the model
   */
  reset(): void {
    this.model = {
      variables: [],
      relationships: [],
      interventions: [],
      timestamp: Date.now(),
    };
    this.causalHistory.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    variableCount: number;
    relationshipCount: number;
    interventionCount: number;
    avgRelationshipStrength: number;
  } {
    const avgStrength =
      this.model.relationships.length > 0
        ? this.model.relationships.reduce((sum, r) => sum + r.strength, 0) /
          this.model.relationships.length
        : 0;

    return {
      variableCount: this.model.variables.length,
      relationshipCount: this.model.relationships.length,
      interventionCount: this.model.interventions.length,
      avgRelationshipStrength: avgStrength,
    };
  }
}
