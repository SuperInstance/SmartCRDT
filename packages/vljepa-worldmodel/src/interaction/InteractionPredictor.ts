/**
 * Interaction Predictor for VL-JEPA World Model
 * Predicts interactions between objects
 */

import type { WorldObject, Vector3 } from "../types.js";

export interface InteractionPrediction {
  type: string;
  participants: string[];
  probability: number;
  timeframe: number;
}

export class InteractionPredictor {
  /**
   * Predict potential interactions between objects
   */
  predictInteractions(objects: WorldObject[]): InteractionPrediction[] {
    const predictions: InteractionPrediction[] = [];

    // Check each pair of objects
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const objA = objects[i];
        const objB = objects[j];

        // Check if objects are close
        const distance = this.calculateDistance(objA.position, objB.position);

        if (distance < 2) {
          // Predict collision
          predictions.push({
            type: "collision",
            participants: [objA.id, objB.id],
            probability: 1 - distance / 2,
            timeframe: distance * 100, // Rough estimate in ms
          });
        }

        // Check if one object is above another
        if (objA.position.y > objB.position.y && distance < 1) {
          predictions.push({
            type: "fall_onto",
            participants: [objA.id, objB.id],
            probability: 0.8,
            timeframe: 500,
          });
        }
      }
    }

    // Check for objects about to fall
    for (const obj of objects) {
      if (obj.position.y > 0.5) {
        predictions.push({
          type: "fall",
          participants: [obj.id],
          probability: 0.9,
          timeframe: 1000,
        });
      }
    }

    return predictions;
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(posA: Vector3, posB: Vector3): number {
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Simulate interaction outcome
   */
  simulateInteraction(
    objects: WorldObject[],
    interaction: InteractionPrediction
  ): WorldObject[] {
    const newObjects = objects.map(obj => ({ ...obj }));

    switch (interaction.type) {
      case "collision":
        return this.simulateCollision(newObjects, interaction.participants);

      case "fall_onto":
        return this.simulateFall(newObjects, interaction.participants);

      case "fall":
        return this.simulateFall(newObjects, interaction.participants);
    }

    return newObjects;
  }

  /**
   * Simulate collision
   */
  private simulateCollision(
    objects: WorldObject[],
    participants: string[]
  ): WorldObject[] {
    const objA = objects.find(o => o.id === participants[0]);
    const objB = objects.find(o => o.id === participants[1]);

    if (!objA || !objB) return objects;

    // Simple elastic collision response
    const tempVel = { ...objA.position };
    objA.position = { ...objB.position };
    objB.position = tempVel;

    return objects;
  }

  /**
   * Simulate fall
   */
  private simulateFall(
    objects: WorldObject[],
    participants: string[]
  ): WorldObject[] {
    for (const id of participants) {
      const obj = objects.find(o => o.id === id);
      if (obj && obj.position.y > 0) {
        obj.position.y = Math.max(0, obj.position.y - 0.5);
      }
    }

    return objects;
  }
}
