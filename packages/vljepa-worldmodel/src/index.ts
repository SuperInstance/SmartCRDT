/**
 * VL-JEPA World Model
 * Intuitive physics and object permanence for AI systems
 *
 * This package provides:
 * - Physics simulation (gravity, collision, friction)
 * - Object permanence through occlusion
 * - Causal reasoning (cause-effect relationships)
 * - Affordance detection (clickable, typeable, etc.)
 * - Counterfactual reasoning (what-if scenarios)
 * - World state rendering
 */

// Core types
export type * from "./types.js";

// Physics
export { PhysicsEngine } from "./physics/PhysicsEngine.js";
export { ObjectPermanence } from "./physics/ObjectPermanence.js";
export { DynamicsPredictor } from "./physics/DynamicsPredictor.js";

// Spatial reasoning
export { SpatialReasoner } from "./spatial/SpatialReasoning.js";
export { BoundingBoxTracker } from "./spatial/BoundingBoxTracker.js";
export { OcclusionHandler } from "./spatial/OcclusionHandler.js";

// Temporal reasoning
export { TemporalModel } from "./temporal/TemporalModel.js";

// Interaction
export { AffordanceDetector } from "./interaction/AffordanceDetector.js";
export { InteractionPredictor } from "./interaction/InteractionPredictor.js";

// World state
export { WorldStateManager } from "./world/WorldState.js";
export { WorldUpdater } from "./world/WorldUpdater.js";
export { WorldRenderer } from "./world/WorldRenderer.js";

// Reasoning
export { CausalReasoning } from "./reasoning/CausalReasoning.js";
export { CounterfactualReasoner } from "./reasoning/Counterfactual.js";
export { IntuitivePhysics } from "./reasoning/IntuitivePhysics.js";
