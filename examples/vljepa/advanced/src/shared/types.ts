/**
 * VL-JEPA Advanced Examples - Shared Types
 */

export interface VLJEPAPrediction {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  reasoning: string;
}

export interface VLJEPAExample {
  id: string;
  name: string;
  description: string;
  category: 'ui' | 'vision' | 'interaction' | 'accessibility' | 'prediction';
  features: string[];
}

export interface ExampleState {
  isLoading: boolean;
  predictions: VLJEPAPrediction[];
  metrics: ExampleMetrics;
  currentStep: number;
  totalSteps: number;
}

export interface ExampleMetrics {
  accuracy: number;
  latency: number;
  confidence: number;
  throughput: number;
  memoryUsage: number;
}

export interface CodeChange {
  type: 'add' | 'remove' | 'modify';
  path: string;
  content: string;
  reason: string;
}

export interface UIElement {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: UIElement[];
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'typography' | 'elevation' | 'radius';
  description?: string;
}

export interface AccessibilityIssue {
  id: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  category: string;
  description: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  element: string;
  suggestion: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  ui: UIElement;
  metrics: {
    conversionRate: number;
    engagement: number;
    satisfaction: number;
  };
}

export interface VideoInteraction {
  timestamp: number;
  type: 'click' | 'scroll' | 'hover' | 'input' | 'drag';
  element: string;
  position: { x: number; y: number };
  duration?: number;
  value?: any;
}

export interface PredictiveAction {
  action: string;
  probability: number;
  timestamp: number;
  executed: boolean;
}
