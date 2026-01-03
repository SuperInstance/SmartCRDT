/**
 * Physics Engine for VL-JEPA World Model
 * Simulates gravity, collision, friction, and inertia
 */

import type {
  PhysicsConfig,
  PhysicsState,
  PhysicalObject,
  Force,
  Constraint,
  Vector3,
  Material,
} from "../types.js";

export class PhysicsEngine {
  private config: PhysicsConfig;
  private state: PhysicsState;
  private frame: number = 0;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = {
      gravity: 9.8,
      friction: 0.3,
      restitution: 0.7,
      timeStep: 0.016, // 60 FPS
      maxVelocity: 100,
      damping: 0.99,
      ...config,
    };

    this.state = {
      objects: [],
      forces: [],
      constraints: [],
      timestamp: Date.now(),
      frame: 0,
    };
  }

  /**
   * Add an object to the simulation
   */
  addObject(object: PhysicalObject): void {
    this.state.objects.push(object);
  }

  /**
   * Remove an object from the simulation
   */
  removeObject(objectId: string): boolean {
    const index = this.state.objects.findIndex(o => o.id === objectId);
    if (index >= 0) {
      this.state.objects.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get an object by ID
   */
  getObject(objectId: string): PhysicalObject | undefined {
    return this.state.objects.find(o => o.id === objectId);
  }

  /**
   * Apply a force to an object
   */
  applyForce(force: Force): void {
    this.state.forces.push(force);
  }

  /**
   * Add a constraint between objects
   */
  addConstraint(constraint: Constraint): void {
    this.state.constraints.push(constraint);
  }

  /**
   * Step the physics simulation forward
   */
  step(dt?: number): PhysicsState {
    const deltaTime = dt || this.config.timeStep;

    // Apply forces
    this.applyForces(deltaTime);

    // Update velocities and positions
    this.updateKinematics(deltaTime);

    // Handle collisions
    this.handleCollisions();

    // Apply constraints
    this.applyConstraints();

    // Update timestamp and frame
    this.state.timestamp += deltaTime * 1000;
    this.frame++;

    return this.getState();
  }

  /**
   * Apply all forces to objects
   */
  private applyForces(dt: number): void {
    for (const object of this.state.objects) {
      if (object.isStatic) continue;

      // Apply gravity
      if (!object.isStatic) {
        object.acceleration.y -= this.config.gravity;
      }

      // Apply applied forces
      const objectForces = this.state.forces.filter(
        f => f.objectId === object.id
      );

      for (const force of objectForces) {
        const ax = force.vector.x / object.mass;
        const ay = force.vector.y / object.mass;
        const az = force.vector.z / object.mass;

        object.acceleration.x += ax;
        object.acceleration.y += ay;
        object.acceleration.z += az;

        // Remove temporary forces
        if (force.duration && force.duration <= dt) {
          const index = this.state.forces.indexOf(force);
          if (index >= 0) {
            this.state.forces.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * Update velocities and positions (symplectic Euler integration)
   */
  private updateKinematics(dt: number): void {
    for (const object of this.state.objects) {
      if (object.isStatic) continue;

      // Update velocity
      object.velocity.x += object.acceleration.x * dt;
      object.velocity.y += object.acceleration.y * dt;
      object.velocity.z += object.acceleration.z * dt;

      // Apply damping
      object.velocity.x *= this.config.damping;
      object.velocity.y *= this.config.damping;
      object.velocity.z *= this.config.damping;

      // Clamp velocity
      const speed = Math.sqrt(
        object.velocity.x ** 2 + object.velocity.y ** 2 + object.velocity.z ** 2
      );

      if (speed > this.config.maxVelocity) {
        const scale = this.config.maxVelocity / speed;
        object.velocity.x *= scale;
        object.velocity.y *= scale;
        object.velocity.z *= scale;
      }

      // Update position
      object.position.x += object.velocity.x * dt;
      object.position.y += object.velocity.y * dt;
      object.position.z += object.velocity.z * dt;

      // Reset acceleration
      object.acceleration = { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Handle collisions between objects
   */
  private handleCollisions(): void {
    // Ground collision (y = 0)
    for (const object of this.state.objects) {
      if (object.isStatic) continue;

      const halfHeight = object.size.y / 2;

      if (object.position.y - halfHeight < 0) {
        object.position.y = halfHeight;

        // Bounce with restitution
        object.velocity.y = -object.velocity.y * this.config.restitution;

        // Apply friction
        object.velocity.x *= 1 - this.config.friction;
        object.velocity.z *= 1 - this.config.friction;

        // Stop if velocity is very small
        if (Math.abs(object.velocity.y) < 0.1) {
          object.velocity.y = 0;
        }
      }
    }

    // Object-object collisions
    for (let i = 0; i < this.state.objects.length; i++) {
      for (let j = i + 1; j < this.state.objects.length; j++) {
        const a = this.state.objects[i];
        const b = this.state.objects[j];

        if (a.isStatic && b.isStatic) continue;

        this.resolveCollision(a, b);
      }
    }
  }

  /**
   * Resolve collision between two objects
   */
  private resolveCollision(a: PhysicalObject, b: PhysicalObject): void {
    // Simple sphere collision
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dz = b.position.z - a.position.z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const radiusA = Math.max(a.size.x, a.size.y, a.size.z) / 2;
    const radiusB = Math.max(b.size.x, b.size.y, b.size.z) / 2;

    if (distance < radiusA + radiusB) {
      // Collision detected
      const normal = {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance,
      };

      // Separate objects
      const overlap = radiusA + radiusB - distance;
      const totalMass = a.mass + b.mass;

      if (!a.isStatic) {
        a.position.x -= normal.x * overlap * (b.mass / totalMass);
        a.position.y -= normal.y * overlap * (b.mass / totalMass);
        a.position.z -= normal.z * overlap * (b.mass / totalMass);
      }

      if (!b.isStatic) {
        b.position.x += normal.x * overlap * (a.mass / totalMass);
        b.position.y += normal.y * overlap * (a.mass / totalMass);
        b.position.z += normal.z * overlap * (a.mass / totalMass);
      }

      // Calculate relative velocity
      const rvx = b.velocity.x - a.velocity.x;
      const rvy = b.velocity.y - a.velocity.y;
      const rvz = b.velocity.z - a.velocity.z;

      const relVel = rvx * normal.x + rvy * normal.y + rvz * normal.z;

      // Do not resolve if velocities are separating
      if (relVel > 0) return;

      // Calculate impulse
      const e = Math.min(a.material.restitution, b.material.restitution);
      const j = (-(1 + e) * relVel) / (1 / a.mass + 1 / b.mass);

      const impulse = {
        x: j * normal.x,
        y: j * normal.y,
        z: j * normal.z,
      };

      // Apply impulse
      if (!a.isStatic) {
        a.velocity.x -= impulse.x / a.mass;
        a.velocity.y -= impulse.y / a.mass;
        a.velocity.z -= impulse.z / a.mass;
      }

      if (!b.isStatic) {
        b.velocity.x += impulse.x / b.mass;
        b.velocity.y += impulse.y / b.mass;
        b.velocity.z += impulse.z / b.mass;
      }
    }
  }

  /**
   * Apply constraints
   */
  private applyConstraints(): void {
    for (const constraint of this.state.constraints) {
      const objectA = this.getObject(constraint.objectA);
      if (!objectA) continue;

      switch (constraint.type) {
        case "fixed":
          // Fix object at position
          objectA.position = { ...constraint.position };
          objectA.velocity = { x: 0, y: 0, z: 0 };
          break;

        case "spring":
          if (constraint.objectB) {
            const objectB = this.getObject(constraint.objectB);
            if (objectB) {
              this.applySpringForce(objectA, objectB, constraint);
            }
          }
          break;

        // Hinge and slider would require more complex implementation
      }
    }
  }

  /**
   * Apply spring force between two objects
   */
  private applySpringForce(
    a: PhysicalObject,
    b: PhysicalObject,
    constraint: Constraint
  ): void {
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dz = b.position.z - a.position.z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const restLength = 1.0; // Default rest length

    if (distance > 0) {
      const force = constraint.strength * (distance - restLength);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      const fz = (dz / distance) * force;

      if (!a.isStatic) {
        a.velocity.x += (fx / a.mass) * this.config.timeStep;
        a.velocity.y += (fy / a.mass) * this.config.timeStep;
        a.velocity.z += (fz / a.mass) * this.config.timeStep;
      }

      if (!b.isStatic) {
        b.velocity.x -= (fx / b.mass) * this.config.timeStep;
        b.velocity.y -= (fy / b.mass) * this.config.timeStep;
        b.velocity.z -= (fz / b.mass) * this.config.timeStep;
      }
    }
  }

  /**
   * Get current physics state
   */
  getState(): PhysicsState {
    return {
      objects: [...this.state.objects],
      forces: [...this.state.forces],
      constraints: [...this.state.constraints],
      timestamp: this.state.timestamp,
      frame: this.frame,
    };
  }

  /**
   * Reset the simulation
   */
  reset(): void {
    this.state = {
      objects: [],
      forces: [],
      constraints: [],
      timestamp: Date.now(),
      frame: 0,
    };
    this.frame = 0;
  }

  /**
   * Create a default physical object
   */
  createObject(config: {
    id?: string;
    position?: Partial<Vector3>;
    mass?: number;
    shape?: PhysicalObject["shape"];
    size?: Partial<Vector3>;
    isStatic?: boolean;
  }): PhysicalObject {
    const id = config.id || `object-${Date.now()}-${Math.random()}`;

    return {
      id,
      position: {
        x: config.position?.x ?? 0,
        y: config.position?.y ?? 5,
        z: config.position?.z ?? 0,
      },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      mass: config.mass ?? 1.0,
      shape: config.shape ?? "box",
      size: {
        x: config.size?.x ?? 1,
        y: config.size?.y ?? 1,
        z: config.size?.z ?? 1,
      },
      material: {
        friction: this.config.friction,
        restitution: this.config.restitution,
        density: 1.0,
      },
      isStatic: config.isStatic ?? false,
      visible: true,
    };
  }

  /**
   * Predict future state without modifying current state
   */
  predict(steps: number): PhysicsState[] {
    const originalState = this.getState();
    const predictions: PhysicsState[] = [];

    for (let i = 0; i < steps; i++) {
      const state = this.step();
      predictions.push(state);
    }

    // Restore original state
    this.state = originalState;
    this.frame = originalState.frame;

    return predictions;
  }
}
