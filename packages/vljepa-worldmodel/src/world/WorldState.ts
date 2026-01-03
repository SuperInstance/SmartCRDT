/**
 * World State for VL-JEPA World Model
 * Represents the current state of the world
 */

import type {
  WorldState,
  WorldObject,
  SpatialRelation,
  Event,
  Vector3,
  Quaternion,
} from "../types.js";

export class WorldStateManager {
  private state: WorldState;
  private history: WorldState[] = [];
  private maxHistory = 100;

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Create initial world state
   */
  private createInitialState(): WorldState {
    return {
      objects: [],
      relations: [],
      events: [],
      timestamp: Date.now(),
      confidence: 1.0,
    };
  }

  /**
   * Get current state
   */
  getState(): WorldState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  update(newState: Partial<WorldState>): void {
    if (newState.objects) {
      this.state.objects = newState.objects.map(o => ({ ...o }));
    }
    if (newState.relations) {
      this.state.relations = newState.relations.map(r => ({ ...r }));
    }
    if (newState.events) {
      this.state.events = [...newState.events];
    }
    if (newState.timestamp !== undefined) {
      this.state.timestamp = newState.timestamp;
    }
    if (newState.confidence !== undefined) {
      this.state.confidence = newState.confidence;
    }
  }

  /**
   * Add object
   */
  addObject(object: WorldObject): void {
    this.state.objects.push({ ...object });
  }

  /**
   * Update object
   */
  updateObject(id: string, updates: Partial<WorldObject>): boolean {
    const index = this.state.objects.findIndex(o => o.id === id);
    if (index >= 0) {
      this.state.objects[index] = {
        ...this.state.objects[index],
        ...updates,
      };
      return true;
    }
    return false;
  }

  /**
   * Remove object
   */
  removeObject(id: string): boolean {
    const index = this.state.objects.findIndex(o => o.id === id);
    if (index >= 0) {
      this.state.objects.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get object
   */
  getObject(id: string): WorldObject | undefined {
    return this.state.objects.find(o => o.id === id);
  }

  /**
   * Add relation
   */
  addRelation(relation: SpatialRelation): void {
    this.state.relations.push({ ...relation });
  }

  /**
   * Add event
   */
  addEvent(event: Event): void {
    this.state.events.push({ ...event });
  }

  /**
   * Save state to history
   */
  saveState(): void {
    this.history.push({ ...this.state });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Get state at time
   */
  getStateAtTime(timestamp: number): WorldState | null {
    const closest = this.history.find(
      s => Math.abs(s.timestamp - timestamp) < 100
    );
    return closest ? { ...closest } : null;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.history = [];
  }

  /**
   * Create world object
   */
  createObject(config: {
    id?: string;
    type?: string;
    position?: Partial<Vector3>;
    properties?: Record<string, any>;
  }): WorldObject {
    const id = config.id || `obj-${Date.now()}-${Math.random()}`;

    return {
      id,
      type: config.type || "object",
      position: {
        x: config.position?.x ?? 0,
        y: config.position?.y ?? 0,
        z: config.position?.z ?? 0,
      },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      properties: config.properties || {},
      visible: true,
      occluded: false,
    };
  }
}
