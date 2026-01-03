/**
 * Causal Reasoning for VL-JEPA World Model
 * Handles cause-effect reasoning
 */

import type {
  CausalModel,
  CausalVariable,
  CausalRelationship,
  CausalQuery,
  WorldState,
  Action,
} from "../types.js";

export class CausalReasoner {
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
    const existing = this.model.relationships.findIndex(
      r => r.cause === relationship.cause && r.effect === relationship.effect
    );

    if (existing >= 0) {
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

    attributions.sort((a, b) => b.probability - a.probability);
    return attributions;
  }

  /**
   * Get model
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
   * Reset model
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
}
