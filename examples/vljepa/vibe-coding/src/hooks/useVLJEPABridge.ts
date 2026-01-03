/**
 * useVLJEPABridge Hook
 *
 * React hook for integrating VL-JEPA bridge into vibe coding workflow.
 * Handles vision encoding, language encoding, and prediction.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  VLJEPABridge,
  VLJEPAPrediction,
  VLJEPAAction,
} from '@lsi/vljepa/src/protocol';
import type {
  Float32Array,
  createDefaultConfig,
  validateVLJEPAConfig,
} from '@lsi/vljepa';
import type { VisualState, ActionSequence } from '../types';

export interface UseVLJEPABridgeOptions {
  /** Whether to use WebGPU acceleration */
  useWebGPU?: boolean;
  /** Target inference latency in ms */
  targetLatency?: number;
  /** Whether to process on-device */
  onDevice?: boolean;
  /** Debug mode */
  debug?: boolean;
}

export interface UseVLJEPABridgeReturn {
  /** VL-JEPA bridge instance */
  bridge: VLJEPABridge | null;
  /** Whether bridge is ready */
  ready: boolean;
  /** Whether currently processing */
  processing: boolean;
  /** Last error */
  error: string | null;
  /** Encode visual input to embedding */
  encodeVision: (imageData: ImageData | HTMLCanvasElement) => Promise<Float32Array>;
  /** Encode text input to embedding */
  encodeLanguage: (text: string) => Promise<Float32Array>;
  /** Predict goal state from context and intent */
  predict: (
    context: Float32Array,
    intent: Float32Array
  ) => Promise<VLJEPAPrediction>;
  /** Create action sequence from prediction */
  createActionSequence: (
    prediction: VLJEPAPrediction,
    current: VisualState,
    goal: VisualState
  ) => ActionSequence;
  /** Health check */
  healthCheck: () => Promise<{
    healthy: boolean;
    device?: string;
    modelLoaded: boolean;
    error?: string;
  }>;
  /** Clear cache */
  clearCache: () => void;
}

/**
 * Hook for VL-JEPA bridge integration
 */
export function useVLJEPABridge(
  options: UseVLJEPABridgeOptions = {}
): UseVLJEPABridgeReturn {
  const {
    useWebGPU = true,
    targetLatency = 50,
    onDevice = true,
    debug = false,
  } = options;

  const [bridge, setBridge] = useState<VLJEPABridge | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializingRef = useRef(false);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize VL-JEPA bridge
  const initializeBridge = useCallback(async () => {
    if (initializingRef.current || bridge) return;

    initializingRef.current = true;
    setProcessing(true);
    setError(null);

    try {
      if (debug) console.log('[VL-JEPA] Initializing bridge...');

      // Import VL-JEPA modules dynamically
      const { createDefaultConfig, validateVLJEPAConfig } = await import('@lsi/vljepa');

      // Create default configuration
      const config = createDefaultConfig();

      // Configure for vibe coding use case
      config.global = {
        ...config.global,
        device: useWebGPU ? 'webgpu' : 'cpu',
        cache: {
          enabled: true,
          maxSize: 1000,
          ttl: 300000,
        },
      };

      // Validate configuration
      const validation = validateVLJEPAConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid VL-JEPA config: ${validation.errors.join(', ')}`);
      }

      if (debug) console.log('[VL-JEPA] Configuration validated');

      // For demo purposes, create mock bridge
      // In production, this would load actual VL-JEPA models
      const mockBridge: VLJEPABridge = {
        encodeVision: async (frame) => {
          // Mock implementation - returns 768-dim embedding
          const embedding = new Float32Array(768);
          for (let i = 0; i < 768; i++) {
            embedding[i] = Math.random() * 2 - 1;
          }
          return embedding;
        },

        encodeLanguage: async (text) => {
          // Mock implementation - returns 768-dim embedding based on text
          const embedding = new Float32Array(768);
          const hash = simpleHash(text);
          for (let i = 0; i < 768; i++) {
            embedding[i] = Math.sin(hash + i) * 0.5;
          }
          return embedding;
        },

        predict: async (context, intent) => {
          // Mock implementation - combines context and intent
          const combined = new Float32Array(768);
          for (let i = 0; i < 768; i++) {
            combined[i] = (context[i] + intent[i]) / 2;
          }

          // Generate mock actions
          const actions: VLJEPAAction[] = [
            {
              type: 'modify',
              target: '.button',
              params: { backgroundColor: '#3B82F6', padding: '16px' },
              confidence: 0.92,
              reasoning: 'Matches design system blue color',
              expectedOutcome: {
                visualChange: 'Button becomes blue with more padding',
                functionalChange: 'None',
              },
            },
            {
              type: 'modify',
              target: '.container',
              params: { display: 'flex', justifyContent: 'center' },
              confidence: 0.88,
              reasoning: 'Centers content horizontally',
            },
          ];

          return {
            version: '1.0',
            goalEmbedding: combined,
            confidence: 0.92,
            actions,
            semanticDistance: 0.35,
            metadata: {
              timestamp: Date.now(),
              processingTime: 42,
              xEncoderTime: 18,
              yEncoderTime: 12,
              predictorTime: 12,
              usedCache: false,
              device: useWebGPU ? 'webgpu' : 'cpu',
            },
          };
        },

        encodeVisionBatch: async (frames) => {
          return Promise.all(frames.map((f) => mockBridge.encodeVision(f)));
        },

        encodeLanguageBatch: async (texts) => {
          return Promise.all(texts.map((t) => mockBridge.encodeLanguage(t)));
        },

        getConfig: () => config,

        healthCheck: async () => ({
          healthy: true,
          device: useWebGPU ? 'webgpu' : 'cpu',
          modelLoaded: true,
        }),

        clearCache: () => {
          if (debug) console.log('[VL-JEPA] Cache cleared');
        },
      };

      setBridge(mockBridge);
      setReady(true);

      if (debug) console.log('[VL-JEPA] Bridge initialized successfully');

      // Start periodic health checks
      healthCheckIntervalRef.current = setInterval(async () => {
        const health = await mockBridge.healthCheck();
        if (!health.healthy) {
          setError(`VL-JEPA unhealthy: ${health.error}`);
        }
      }, 30000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to initialize VL-JEPA: ${message}`);
      console.error('[VL-JEPA] Initialization error:', err);
    } finally {
      setProcessing(false);
      initializingRef.current = false;
    }
  }, [useWebGPU, debug, bridge]);

  // Encode visual input
  const encodeVision = useCallback(async (
    imageData: ImageData | HTMLCanvasElement
  ): Promise<Float32Array> => {
    if (!bridge) {
      throw new Error('VL-JEPA bridge not initialized');
    }

    setProcessing(true);
    setError(null);

    try {
      const startTime = performance.now();
      const embedding = await bridge.encodeVision(imageData);
      const duration = performance.now() - startTime;

      if (debug) {
        console.log(`[VL-JEPA] Vision encoding: ${duration.toFixed(1)}ms`);
      }

      return embedding;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Vision encoding failed: ${message}`);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [bridge, debug]);

  // Encode language input
  const encodeLanguage = useCallback(async (
    text: string
  ): Promise<Float32Array> => {
    if (!bridge) {
      throw new Error('VL-JEPA bridge not initialized');
    }

    setProcessing(true);
    setError(null);

    try {
      const startTime = performance.now();
      const embedding = await bridge.encodeLanguage(text);
      const duration = performance.now() - startTime;

      if (debug) {
        console.log(`[VL-JEPA] Language encoding: ${duration.toFixed(1)}ms`);
      }

      return embedding;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Language encoding failed: ${message}`);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [bridge, debug]);

  // Predict goal state
  const predict = useCallback(async (
    context: Float32Array,
    intent: Float32Array
  ): Promise<VLJEPAPrediction> => {
    if (!bridge) {
      throw new Error('VL-JEPA bridge not initialized');
    }

    setProcessing(true);
    setError(null);

    try {
      const startTime = performance.now();
      const prediction = await bridge.predict(context, intent);
      const duration = performance.now() - startTime;

      if (debug) {
        console.log(`[VL-JEPA] Prediction: ${duration.toFixed(1)}ms`);
        console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
        console.log(`  Actions: ${prediction.actions.length}`);
      }

      return prediction;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Prediction failed: ${message}`);
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [bridge, debug]);

  // Create action sequence from prediction
  const createActionSequence = useCallback((
    prediction: VLJEPAPrediction,
    current: VisualState,
    goal: VisualState
  ): ActionSequence => {
    const actions = prediction.actions.map((action, index) => ({
      id: `action-${Date.now()}-${index}`,
      type: action.type,
      target: action.target,
      params: action.params,
      confidence: action.confidence,
      description: generateActionDescription(action),
      expectedOutcome: action.expectedOutcome?.visualChange,
      approved: false,
      status: 'pending' as const,
    }));

    return {
      id: `sequence-${Date.now()}`,
      actions,
      confidence: prediction.confidence,
      estimatedTime: actions.length * 200, // 200ms per action
      semanticDistance: prediction.semanticDistance || 0,
      createdAt: Date.now(),
      prediction,
    };
  }, []);

  // Health check
  const healthCheck = useCallback(async () => {
    if (!bridge) {
      return {
        healthy: false,
        modelLoaded: false,
        error: 'Bridge not initialized',
      };
    }
    return bridge.healthCheck();
  }, [bridge]);

  // Clear cache
  const clearCache = useCallback(() => {
    bridge?.clearCache();
  }, [bridge]);

  return {
    bridge,
    ready,
    processing,
    error,
    encodeVision,
    encodeLanguage,
    predict,
    createActionSequence,
    healthCheck,
    clearCache,
  };
}

// Helper function to generate action description
function generateActionDescription(action: VLJEPAAction): string {
  const typeMap: Record<VLJEPAAction['type'], string> = {
    modify: 'Modify',
    create: 'Create',
    delete: 'Delete',
    move: 'Move',
    resize: 'Resize',
    restyle: 'Restyle',
  };

  const paramStr = Object.entries(action.params)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');

  return `${typeMap[action.type]} "${action.target}" with ${paramStr}`;
}

// Simple hash function for mock embeddings
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
