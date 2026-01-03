/**
 * OllamaModelFingerprinter - Model fingerprinting utility
 *
 * Extracts structural information from Ollama model names and metadata
 * to create fingerprints for capability matching.
 *
 * @example
 * ```typescript
 * const fingerprinter = new OllamaModelFingerprinter();
 * const fingerprint = fingerprinter.fingerprint("llama3:8b-q4_k_m");
 * console.log(fingerprint);
 * // {
 * //   modelId: "llama3:8b-q4_k_m",
 * //   family: "llama3",
 * //   parameterSize: "8B",
 * //   quantizationLevel: "Q4_K_M",
 * //   ...
 * // }
 * ```
 */

import type {
  ModelFingerprint,
  ModelCapability,
  FingerprintMatch,
  OllamaModel,
  ModelIntentType,
} from "@lsi/protocol";

/**
 * Model family patterns
 */
const FAMILY_PATTERNS: Record<string, RegExp> = {
  llama: /^(llama|llama2|llama3|llama3\.1|llama3\.2)/i,
  mistral: /^mistral/i,
  mixtral: /^mixtral/i,
  qwen: /^qwen/i,
  gemma: /^gemma/i,
  phi: /^phi/i,
  nomic: /^nomic/i,
  mxbai: /^mxbai/i,
  "deepseek-coder": /^deepseek-coder/i,
  codellama: /^codellama/i,
  "tinyllama": /^tinyllama/i,
};

/**
 * Parameter size patterns
 */
const SIZE_PATTERNS: Record<string, RegExp> = {
  "70B": /70b/i,
  "40B": /40b/i,
  "34B": /34b/i,
  "32B": /32b/i,
  "27B": /27b/i,
  "13B": /13b/i,
  "12B": /12b/i,
  "9B": /9b/i,
  "8B": /8b/i,
  "7B": /7b/i,
  "6B": /6b/i,
  "5B": /5b/i,
  "4B": /4b/i,
  "3B": /3b/i,
  "2B": /2b/i,
  "1B": /1b/i,
  "0.5B": /0\.5b/i,
};

/**
 * Quantization level patterns
 */
const QUANT_PATTERNS: Record<string, RegExp> = {
  "Q8_0": /q8_0/i,
  "Q6_K": /q6_k/i,
  "Q5_K_M": /q5_k_m/i,
  "Q5_K_S": /q5_k_s/i,
  "Q5_0": /q5_0/i,
  "Q4_K_M": /q4_k_m/i,
  "Q4_K_S": /q4_k_s/i,
  "Q4_0": /q4_0/i,
  "Q3_K_M": /q3_k_m/i,
  "Q3_K_S": /q3_k_s/i,
  "Q3_K_L": /q3_k_l/i,
  "Q2_K": /q2_k/i,
  "F16": /f16/i,
};

/**
 * Intent heuristics by model name patterns
 */
const INTENT_HEURISTICS: Array<{
  pattern: RegExp;
  intents: ModelIntentType[];
  confidence: number;
}> = [
  { pattern: /embed/i, intents: ["embedding"], confidence: 0.95 },
  { pattern: /coder/i, intents: ["code-generation", "chat", "completion"], confidence: 0.9 },
  { pattern: /instruct/i, intents: ["chat", "completion"], confidence: 0.85 },
  { pattern: /chat/i, intents: ["chat"], confidence: 0.8 },
  { pattern: /base/i, intents: ["completion"], confidence: 0.7 },
];

/**
 * OllamaModelFingerprinter class
 */
export class OllamaModelFingerprinter {
  /**
   * Generate a fingerprint from an Ollama model
   *
   * @param model - Ollama model object or model name string
   * @returns Model fingerprint
   */
  fingerprint(model: OllamaModel | string): ModelFingerprint {
    const modelName = typeof model === "string" ? model : model.name;
    const metadata = typeof model === "object" ? model.details : undefined;

    // Extract family
    const family = this.extractFamily(modelName);

    // Extract parameter size
    const parameterSize = this.extractParameterSize(modelName);

    // Extract quantization level
    const quantizationLevel = this.extractQuantizationLevel(modelName);

    // Generate metadata hash
    const metadataHash = this.hashMetadata(metadata);

    // Generate fingerprint version
    const version = "1.0.0";

    return {
      modelId: modelName,
      family,
      parameterSize,
      quantizationLevel,
      metadataHash,
      version,
    };
  }

  /**
   * Match a fingerprint against known capabilities
   *
   * @param fingerprint - Model fingerprint
   * @param knownCapabilities - Map of known capabilities
   * @returns Match result with confidence
   */
  matchCapability(
    fingerprint: ModelFingerprint,
    knownCapabilities: Map<string, ModelCapability>
  ): FingerprintMatch {
    // Direct match
    const directMatch = knownCapabilities.get(fingerprint.modelId);
    if (directMatch) {
      return {
        matched: true,
        capability: directMatch,
        confidence: 1.0,
        reason: "Direct model ID match",
      };
    }

    // Family + size match
    for (const [modelId, capability] of knownCapabilities.entries()) {
      if (capability.family === fingerprint.family &&
          capability.parameterSize === fingerprint.parameterSize) {
        // Check if quantization is compatible
        const quantCompatible = !fingerprint.quantizationLevel ||
                               !capability.quantizationLevel ||
                               this.compareQuantization(
                                 fingerprint.quantizationLevel,
                                 capability.quantizationLevel
                               );

        if (quantCompatible) {
          return {
            matched: true,
            capability,
            confidence: 0.8,
            reason: "Family and parameter size match",
          };
        }
      }
    }

    // Family match only
    for (const [modelId, capability] of knownCapabilities.entries()) {
      if (capability.family === fingerprint.family) {
        return {
          matched: true,
          capability,
          confidence: 0.5,
          reason: "Family match only (different parameter size)",
        };
      }
    }

    // No match
    return {
      matched: false,
      confidence: 0.0,
      reason: "No matching capability found",
    };
  }

  /**
   * Extract supported intents from model name
   *
   * @param modelName - Model name
   * @returns Array of supported intents with confidence
   */
  extractIntents(modelName: string): ModelIntentType[] {
    const intents = new Set<ModelIntentType>();

    // Apply heuristics
    for (const heuristic of INTENT_HEURISTICS) {
      if (heuristic.pattern.test(modelName)) {
        for (const intent of heuristic.intents) {
          intents.add(intent);
        }
      }
    }

    // Default to chat if no specific intents detected
    if (intents.size === 0) {
      intents.add("chat");
      intents.add("completion");
    }

    return Array.from(intents);
  }

  /**
   * Estimate quality score from model characteristics
   *
   * @param fingerprint - Model fingerprint
   * @returns Estimated quality score (0-1)
   */
  estimateQuality(fingerprint: ModelFingerprint): number {
    let score = 0.5; // Base score

    // Boost for larger parameter sizes
    const sizeScore: Record<string, number> = {
      "70B": 0.25,
      "40B": 0.22,
      "34B": 0.20,
      "32B": 0.19,
      "27B": 0.18,
      "13B": 0.15,
      "12B": 0.14,
      "9B": 0.12,
      "8B": 0.10,
      "7B": 0.10,
      "6B": 0.08,
      "5B": 0.07,
      "4B": 0.06,
      "3B": 0.05,
      "2B": 0.03,
      "1B": 0.02,
      "0.5B": 0.01,
    };

    score += sizeScore[fingerprint.parameterSize] || 0;

    // Adjust for quantization (lower quant = better quality)
    if (fingerprint.quantizationLevel) {
      const quantScore: Record<string, number> = {
        "F16": 0.10,
        "Q8_0": 0.08,
        "Q6_K": 0.06,
        "Q5_K_M": 0.05,
        "Q5_K_S": 0.04,
        "Q5_0": 0.04,
        "Q4_K_M": 0.02,
        "Q4_K_S": 0.01,
        "Q4_0": 0.01,
        "Q3_K_M": -0.02,
        "Q3_K_S": -0.03,
        "Q3_K_L": -0.02,
        "Q2_K": -0.05,
      };
      score += quantScore[fingerprint.quantizationLevel] || 0;
    }

    // Adjust for model family (some families are better)
    const familyScore: Record<string, number> = {
      "llama3.2": 0.15,
      "llama3.1": 0.12,
      "llama3": 0.10,
      "mixtral": 0.12,
      "mistral": 0.08,
      "qwen": 0.08,
      "gemma": 0.07,
      "deepseek-coder": 0.10,
      "codellama": 0.06,
      "phi": 0.02,
      "tinyllama": 0.0,
    };

    score += familyScore[fingerprint.family] || 0;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Estimate context length from model family and size
   *
   * @param fingerprint - Model fingerprint
   * @returns Estimated context length
   */
  estimateContextLength(fingerprint: ModelFingerprint): number {
    // Known context lengths by family
    const knownLengths: Record<string, number> = {
      "llama3.2": 128000,
      "llama3.1": 128000,
      "llama3": 8192,
      "llama2": 4096,
      "mixtral": 32768,
      "mistral": 32768,
      "qwen": 32768,
      "qwen2": 32768,
      "gemma": 8192,
      "gemma2": 8192,
      "phi": 2048,
      "phi3": 128000,
      "deepseek-coder": 16384,
      "codellama": 16384,
    };

    // Check for exact match
    if (knownLengths[fingerprint.family]) {
      return knownLengths[fingerprint.family];
    }

    // Default based on parameter size (larger models = longer context)
    const defaults: Record<string, number> = {
      "70B": 32768,
      "40B": 32768,
      "34B": 32768,
      "32B": 16384,
      "27B": 16384,
      "13B": 16384,
      "12B": 16384,
      "9B": 8192,
      "8B": 8192,
      "7B": 8192,
      "6B": 8192,
      "5B": 4096,
      "4B": 4096,
      "3B": 4096,
      "2B": 2048,
      "1B": 2048,
      "0.5B": 2048,
    };

    return defaults[fingerprint.parameterSize] || 4096;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Extract model family from name
   */
  private extractFamily(modelName: string): string {
    for (const [family, pattern] of Object.entries(FAMILY_PATTERNS)) {
      if (pattern.test(modelName)) {
        return family;
      }
    }
    return "unknown";
  }

  /**
   * Extract parameter size from name
   */
  private extractParameterSize(modelName: string): string {
    for (const [size, pattern] of Object.entries(SIZE_PATTERNS)) {
      if (pattern.test(modelName)) {
        return size;
      }
    }
    return "unknown";
  }

  /**
   * Extract quantization level from name
   */
  private extractQuantizationLevel(modelName: string): string | undefined {
    for (const [quant, pattern] of Object.entries(QUANT_PATTERNS)) {
      if (pattern.test(modelName)) {
        return quant;
      }
    }
    return undefined;
  }

  /**
   * Hash model metadata
   */
  private hashMetadata(metadata?: Record<string, unknown>): string {
    if (!metadata) {
      return "no-metadata";
    }

    const str = JSON.stringify(metadata, Object.keys(metadata).sort());
    return this.simpleHash(str);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Compare two quantization levels
   *
   * Returns true if they're within 1 quantization step
   */
  private compareQuantization(quant1: string, quant2: string): boolean {
    const quantOrder = [
      "F16",
      "Q8_0",
      "Q6_K",
      "Q5_K_M",
      "Q5_K_S",
      "Q5_0",
      "Q4_K_M",
      "Q4_K_S",
      "Q4_0",
      "Q3_K_M",
      "Q3_K_S",
      "Q3_K_L",
      "Q2_K",
    ];

    const idx1 = quantOrder.indexOf(quant1);
    const idx2 = quantOrder.indexOf(quant2);

    if (idx1 === -1 || idx2 === -1) {
      return true; // Unknown quantization, assume compatible
    }

    return Math.abs(idx1 - idx2) <= 1;
  }
}

/**
 * Create an OllamaModelFingerprinter
 *
 * @returns Configured fingerprinter instance
 */
export function createOllamaModelFingerprinter(): OllamaModelFingerprinter {
  return new OllamaModelFingerprinter();
}

/**
 * Default singleton instance
 */
export const defaultFingerprinter = new OllamaModelFingerprinter();
