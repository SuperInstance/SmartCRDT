/**
 * Core types for VL-JEPA World Model
 * Handles physics, causality, spatial reasoning, and object permanence
 */

// ============================================================================
// Vector Math Types
// ============================================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================================
// Physics Types
// ============================================================================

export interface PhysicsConfig {
  gravity: number; // 9.8 m/s²
  friction: number; // 0-1
  restitution: number; // Bounciness (0-1)
  timeStep: number; // Seconds
  maxVelocity: number; // Max velocity magnitude
  damping: number; // Velocity damping
}

export interface PhysicsState {
  objects: PhysicalObject[];
  forces: Force[];
  constraints: Constraint[];
  timestamp: number;
  frame: number;
}

export interface PhysicalObject {
  id: string;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  rotation: Quaternion;
  angularVelocity: Vector3;
  mass: number;
  shape: "box" | "sphere" | "cylinder" | "mesh";
  size: Vector3;
  material: Material;
  isStatic: boolean;
  visible: boolean;
}

export interface Material {
  friction: number;
  restitution: number;
  density: number;
}

export interface Force {
  id: string;
  objectId: string;
  vector: Vector3;
  type: "gravity" | "applied" | "impulse" | "constraint";
  duration?: number;
}

export interface Constraint {
  id: string;
  type: "fixed" | "hinge" | "slider" | "spring";
  objectA: string;
  objectB?: string;
  position: Vector3;
  strength: number;
}

// ============================================================================
// Object Permanence Types
// ============================================================================

export interface PermanenceConfig {
  maxOcclusionTime: number; // How long to track
  predictionUncertainty: number; // Uncertainty growth
  memoryDecay: number; // Memory fade over time
  occlusionTolerance: number; // Pixels allowed
}

export interface ObjectTracking {
  objectId: string;
  visible: boolean;
  lastSeen: StateSnapshot;
  predictedPosition: Vector3;
  uncertainty: number;
  trajectory: Trajectory;
  occludedSince: number;
  reappearanceProb: number;
}

export interface StateSnapshot {
  timestamp: number;
  position: Vector3;
  velocity: Vector3;
  rotation: Quaternion;
  appearance: ObjectAppearance;
}

export interface ObjectAppearance {
  color: string;
  size: Vector3;
  shape: string;
  features: number[];
}

export interface Trajectory {
  positions: Vector3[];
  velocities: Vector3[];
  timestamps: number[];
}

// ============================================================================
// Causal Reasoning Types
// ============================================================================

export interface CausalModel {
  variables: CausalVariable[];
  relationships: CausalRelationship[];
  interventions: Intervention[];
  timestamp: number;
}

export interface CausalVariable {
  id: string;
  name: string;
  type: "binary" | "continuous" | "categorical";
  value: any;
  range?: [number, number];
  parents: string[];
  children: string[];
}

export interface CausalRelationship {
  id: string;
  cause: string;
  effect: string;
  strength: number; // 0-1
  delay: number; // Time delay (ms)
  type: "deterministic" | "probabilistic";
  mechanism?: string; // How cause produces effect
}

export interface Intervention {
  id: string;
  action: string;
  target: string;
  expectedEffect: string;
  confidence: number;
  timestamp: number;
}

export interface CausalQuery {
  type: "prediction" | "attribution" | "counterfactual";
  cause?: string;
  effect?: string;
  context: WorldState;
}

// ============================================================================
// Affordance Types
// ============================================================================

export interface Affordance {
  id: string;
  type: "click" | "type" | "scroll" | "drag" | "hover" | "swipe" | "pinch";
  element: UIElement;
  probability: number;
  evidence: AffordanceEvidence[];
}

export interface UIElement {
  id: string;
  bounds: BoundingBox;
  semantic: string;
  visual: VisualFeatures;
  context: ContextFeatures;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualFeatures {
  color: string;
  shape: string;
  size: number;
  text?: string;
  icon?: boolean;
  hasBorder: boolean;
  hasShadow: boolean;
}

export interface ContextFeatures {
  position: string; // "top", "bottom", "center", etc.
  neighbors: string[];
  parent: string;
  zIndex: number;
}

export interface AffordanceEvidence {
  type: string;
  confidence: number;
  source: "visual" | "semantic" | "contextual" | "temporal";
}

// ============================================================================
// Counterfactual Types
// ============================================================================

export interface Counterfactual {
  actual: WorldState;
  action: Action;
  counterfactualAction: Action;
  predictedOutcome: WorldState;
  difference: StateDelta;
  confidence: number;
}

export interface Action {
  type: string;
  target: string;
  parameters: Record<string, any>;
  timestamp: number;
}

export interface CounterfactualQuery {
  currentState: WorldState;
  action: Action;
  counterfactualAction: Action;
  horizon: number; // How far to simulate
  granularity: number; // Time steps
}

export interface StateDelta {
  added: string[];
  removed: string[];
  modified: Map<string, any>;
  unchanged: Set<string>;
}

// ============================================================================
// World State Types
// ============================================================================

export interface WorldState {
  objects: WorldObject[];
  relations: SpatialRelation[];
  events: Event[];
  timestamp: number;
  confidence: number;
}

export interface WorldObject {
  id: string;
  type: string;
  position: Vector3;
  rotation: Quaternion;
  properties: Record<string, any>;
  visible: boolean;
  occluded: boolean;
}

export interface SpatialRelation {
  id: string;
  subject: string;
  object: string;
  relation:
    | "above"
    | "below"
    | "left"
    | "right"
    | "front"
    | "behind"
    | "inside"
    | "on"
    | "near";
  confidence: number;
}

export interface Event {
  id: string;
  type: string;
  timestamp: number;
  participants: string[];
  properties: Record<string, any>;
}

// ============================================================================
// Temporal Types
// ============================================================================

export interface TemporalModel {
  currentState: WorldState;
  history: WorldState[];
  predictions: WorldState[];
  confidence: number;
}

export interface MotionPrediction {
  objectId: string;
  positions: Vector3[];
  velocities: Vector3[];
  timestamps: number[];
  confidence: number;
}

export interface EventPrediction {
  eventType: string;
  probability: number;
  participants: string[];
  timeframe: [number, number];
  conditions: string[];
}

// ============================================================================
// Renderer Types
// ============================================================================

export interface WorldRendererConfig {
  format: "json" | "graphviz" | "html" | "canvas";
  showPredictions: boolean;
  showCausality: boolean;
  showUncertainty: boolean;
  detailLevel: "minimal" | "standard" | "detailed";
}

export interface RenderedWorld {
  currentState: RenderedState;
  predictions: RenderedPrediction[];
  causalChains: RenderedChain[];
  metadata: RenderMetadata;
}

export interface RenderedState {
  objects: RenderedObject[];
  relations: RenderedRelation[];
  timestamp: number;
}

export interface RenderedObject {
  id: string;
  type: string;
  position: Vector3;
  properties: Record<string, any>;
  uncertainty?: number;
}

export interface RenderedRelation {
  subject: string;
  object: string;
  relation: string;
  confidence: number;
}

export interface RenderedPrediction {
  timestamp: number;
  state: RenderedState;
  probability: number;
}

export interface RenderedChain {
  cause: string;
  effect: string;
  path: string[];
  strength: number;
}

export interface RenderMetadata {
  version: string;
  timestamp: number;
  confidence: number;
  source: string;
}
