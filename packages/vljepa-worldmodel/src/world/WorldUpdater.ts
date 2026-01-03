/**
 * World Updater for VL-JEPA World Model
 * Updates world state based on observations
 */

import type { WorldState, WorldObject, Vector3 } from "../types.js";
import { WorldStateManager } from "./WorldState.js";

export class WorldUpdater {
  private manager: WorldStateManager;

  constructor(manager?: WorldStateManager) {
    this.manager = manager || new WorldStateManager();
  }

  /**
   * Update world state from observation
   */
  updateFromObservation(observation: {
    objects: Array<{
      id?: string;
      position?: Vector3;
      visible?: boolean;
    }>;
  }): void {
    const state = this.manager.getState();

    // Update or add objects
    for (const obs of observation.objects) {
      if (obs.id) {
        const existing = state.objects.find(o => o.id === obs.id);

        if (existing) {
          // Update existing
          if (obs.position) {
            this.manager.updateObject(obs.id, { position: obs.position });
          }
          if (obs.visible !== undefined) {
            this.manager.updateObject(obs.id, { visible: obs.visible });
          }
        } else if (obs.visible !== false) {
          // Add new object
          this.manager.addObject({
            id: obs.id,
            type: "object",
            position: obs.position || { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            properties: {},
            visible: true,
            occluded: false,
          });
        }
      }
    }

    // Mark unseen objects as potentially occluded
    const observedIds = new Set(
      observation.objects.map(o => o.id).filter(Boolean)
    );
    for (const obj of state.objects) {
      if (!observedIds.has(obj.id) && obj.visible) {
        this.manager.updateObject(obj.id, { occluded: true });
      }
    }
  }

  /**
   * Update object position
   */
  updatePosition(objectId: string, position: Vector3): boolean {
    return this.manager.updateObject(objectId, { position });
  }

  /**
   * Mark object as occluded
   */
  markOccluded(objectId: string): boolean {
    return this.manager.updateObject(objectId, {
      occluded: true,
      visible: false,
    });
  }

  /**
   * Mark object as visible
   */
  markVisible(objectId: string): boolean {
    return this.manager.updateObject(objectId, {
      occluded: false,
      visible: true,
    });
  }

  /**
   * Get manager
   */
  getManager(): WorldStateManager {
    return this.manager;
  }
}
