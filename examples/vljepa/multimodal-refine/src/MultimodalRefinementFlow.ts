/**
 * Multi-Modal UI Refinement Example
 *
 * Demonstrates UI refinement using multiple input modalities:
 * - Text (natural language descriptions)
 * - Voice (spoken commands)
 * - Gesture (mouse/touch gestures)
 * - Visual (reference images)
 *
 * VL-JEPA fuses all modalities to understand user intent.
 */

import { useState, useCallback, useRef } from 'react';

export type ModalityType = 'text' | 'voice' | 'gesture' | 'visual';

export interface MultimodalInput {
  id: string;
  type: ModalityType;
  data: unknown;
  timestamp: number;
  confidence: number;
}

export interface RefinementRequest {
  id: string;
  inputs: MultimodalInput[];
  fusedIntent: Float32Array | null;
  generatedActions: any[];
  status: 'pending' | 'processing' | 'complete' | 'error';
}

/**
 * Multi-Modal Refinement Flow Hook
 *
 * Handles UI refinement using multiple input modalities.
 */
export function useMultimodalRefinementFlow() {
  const [requests, setRequests] = useState<RefinementRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<RefinementRequest | null>(null);
  const processingRef = useRef(false);

  /**
   * Add input to active request
   */
  const addInput = useCallback(async (input: MultimodalInput) => {
    let request = activeRequest;

    // Create new request if none active
    if (!request) {
      request = {
        id: `req-${Date.now()}`,
        inputs: [],
        fusedIntent: null,
        generatedActions: [],
        status: 'pending',
      };
    }

    // Add input
    request.inputs.push(input);

    // If we have multiple modalities, fuse them
    if (request.inputs.length >= 2) {
      request.status = 'processing';
      setActiveRequest(request);

      // Fuse modalities and generate actions
      await processMultimodalRequest(request);
    } else {
      setActiveRequest(request);
    }

    return request;
  }, [activeRequest]);

  /**
   * Process multimodal request
   */
  const processMultimodalRequest = useCallback(async (request: RefinementRequest) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      console.log('[Multimodal] Processing request with', request.inputs.length, 'modalities');

      // Step 1: Encode each modality
      const embeddings = await Promise.all(
        request.inputs.map(async (input) => {
          switch (input.type) {
            case 'text':
              return await encodeTextInput(input.data as string);
            case 'voice':
              return await encodeVoiceInput(input.data as string);
            case 'gesture':
              return await encodeGestureInput(input.data as any);
            case 'visual':
              return await encodeVisualInput(input.data as ImageData);
            default:
              return new Float32Array(768);
          }
        })
      );

      // Step 2: Fuse embeddings (weighted average based on confidence)
      const fusedEmbedding = fuseEmbeddings(
        embeddings,
        request.inputs.map((i) => i.confidence)
      );

      request.fusedIntent = fusedEmbedding;

      // Step 3: Generate actions from fused intent
      request.generatedActions = await generateActionsFromIntent(fusedEmbedding);

      request.status = 'complete';
      setActiveRequest({ ...request });

      // Add to history
      setRequests((prev) => [...prev, { ...request }]);
    } catch (error) {
      console.error('[Multimodal] Processing error:', error);
      request.status = 'error';
      setActiveRequest({ ...request });
    } finally {
      processingRef.current = false;
    }
  }, []);

  /**
   * Clear active request
   */
  const clearRequest = useCallback(() => {
    setActiveRequest(null);
  }, []);

  /**
   * Get request history
   */
  const getHistory = useCallback(() => {
    return requests;
  }, [requests]);

  return {
    activeRequest,
    requests,
    addInput,
    clearRequest,
    getHistory,
    isProcessing: processingRef.current,
  };
}

/**
 * Encode text input to embedding
 */
async function encodeTextInput(text: string): Promise<Float32Array> {
  // Mock implementation - would use VL-JEPA Y-Encoder
  const embedding = new Float32Array(768);
  const hash = simpleHash(text);
  for (let i = 0; i < 768; i++) {
    embedding[i] = Math.sin(hash + i) * 0.5;
  }
  return embedding;
}

/**
 * Encode voice input to embedding
 */
async function encodeVoiceInput(transcript: string): Promise<Float32Array> {
  // Voice is just transcribed text, so same as text encoding
  return encodeTextInput(transcript);
}

/**
 * Encode gesture input to embedding
 */
async function encodeGestureInput(gesture: {
  type: string;
  direction?: string;
  magnitude?: number;
}): Promise<Float32Array> {
  // Encode gesture as embedding
  const embedding = new Float32Array(768);
  const gestureKey = `${gesture.type}:${gesture.direction || ''}:${gesture.magnitude || 0}`;
  const hash = simpleHash(gestureKey);
  for (let i = 0; i < 768; i++) {
    embedding[i] = Math.cos(hash + i) * 0.5;
  }
  return embedding;
}

/**
 * Encode visual input to embedding
 */
async function encodeVisualInput(imageData: ImageData): Promise<Float32Array> {
  // Mock implementation - would use VL-JEPA X-Encoder
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = Math.random() * 2 - 1;
  }
  return embedding;
}

/**
 * Fuse multiple embeddings with weights
 */
function fuseEmbeddings(
  embeddings: Float32Array[],
  weights: number[]
): Float32Array {
  const fused = new Float32Array(768);

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Weighted average
  for (let i = 0; i < 768; i++) {
    fused[i] = embeddings.reduce((sum, emb, idx) => {
      return sum + emb[i] * normalizedWeights[idx];
    }, 0);
  }

  return fused;
}

/**
 * Generate actions from fused intent
 */
async function generateActionsFromIntent(intent: Float32Array): Promise<any[]> {
  // Mock implementation - would use VL-JEPA Predictor
  return [
    {
      type: 'modify',
      target: '.container',
      params: { padding: '24px' },
      confidence: 0.88,
    },
    {
      type: 'modify',
      target: '.button',
      params: { borderRadius: '8px' },
      confidence: 0.85,
    },
  ];
}

/**
 * Simple hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Multi-Modal Input Handler
 *
 * Handles different input types and converts to multimodal inputs.
 */
export class MultimodalInputHandler {
  /**
   * Handle text input
   */
  static handleTextInput(text: string): MultimodalInput {
    return {
      id: `input-text-${Date.now()}`,
      type: 'text',
      data: text,
      timestamp: Date.now(),
      confidence: 0.95, // Text is usually high confidence
    };
  }

  /**
   * Handle voice input
   */
  static handleVoiceInput(transcript: string, confidence: number): MultimodalInput {
    return {
      id: `input-voice-${Date.now()}`,
      type: 'voice',
      data: transcript,
      timestamp: Date.now(),
      confidence: confidence * 0.9, // Slightly lower due to transcription errors
    };
  }

  /**
   * Handle gesture input
   */
  static handleGestureInput(gesture: {
    type: string;
    direction?: string;
    magnitude?: number;
  }): MultimodalInput {
    return {
      id: `input-gesture-${Date.now()}`,
      type: 'gesture',
      data: gesture,
      timestamp: Date.now(),
      confidence: 0.7, // Gestures are ambiguous
    };
  }

  /**
   * Handle visual input
   */
  static handleVisualInput(imageData: ImageData): MultimodalInput {
    return {
      id: `input-visual-${Date.now()}`,
      type: 'visual',
      data: imageData,
      timestamp: Date.now(),
      confidence: 0.85, // Visual is high confidence
    };
  }
}

/**
 * Refinement Orchestrator
 *
 * Orchestrates the multi-modal refinement process.
 */
export class RefinementOrchestrator {
  private vljepa: any;
  private coagents: any;

  constructor(vljepa: any, coagents: any) {
    this.vljepa = vljepa;
    this.coagents = coagents;
  }

  /**
   * Process refinement request with all modalities
   */
  async processRefinement(request: RefinementRequest): Promise<{
    actions: any[];
    confidence: number;
    reasoning: string;
  }> {
    // Group inputs by modality
    const byType = new Map<ModalityType, MultimodalInput[]>();
    for (const input of request.inputs) {
      if (!byType.has(input.type)) {
        byType.set(input.type, []);
      }
      byType.get(input.type)!.push(input);
    }

    // Encode each modality group
    const embeddings = new Map<ModalityType, Float32Array[]>();
    for (const [type, inputs] of byType) {
      const groupEmbeddings = await Promise.all(
        inputs.map(async (input) => {
          switch (input.type) {
            case 'text':
              return await encodeTextInput(input.data as string);
            case 'voice':
              return await encodeVoiceInput(input.data as string);
            case 'gesture':
              return await encodeGestureInput(input.data as any);
            case 'visual':
              return await encodeVisualInput(input.data as ImageData);
          }
        })
      );
      embeddings.set(type, groupEmbeddings);
    }

    // Fuse across modalities
    const allEmbeddings = Array.from(embeddings.values()).flat();
    const allConfidences = request.inputs.map((i) => i.confidence);
    const fusedIntent = fuseEmbeddings(allEmbeddings, allConfidences);

    // Generate actions
    const actions = await generateActionsFromIntent(fusedIntent);

    // Calculate overall confidence
    const avgConfidence = request.inputs.reduce((sum, i) => sum + i.confidence, 0) / request.inputs.length;

    // Generate reasoning
    const modalitiesUsed = Array.from(byType.keys()).join(', ');
    const reasoning = `Based on ${modalitiesUsed} input(s) with ${avgConfidence.toFixed(0)}% average confidence`;

    return {
      actions,
      confidence: avgConfidence,
      reasoning,
    };
  }

  /**
   * Get suggested next inputs based on current state
   */
  getSuggestedInputs(currentInputs: MultimodalInput[]): ModalityType[] {
    const suggestions: ModalityType[] = [];
    const hasTypes = new Set(currentInputs.map((i) => i.type));

    // Suggest complementary modalities
    if (!hasTypes.has('visual') && (hasTypes.has('text') || hasTypes.has('voice'))) {
      suggestions.push('visual');
    }

    if (!hasTypes.has('text') && hasTypes.has('voice')) {
      suggestions.push('text');
    }

    if (!hasTypes.has('gesture') && hasTypes.has('visual')) {
      suggestions.push('gesture');
    }

    return suggestions;
  }
}
