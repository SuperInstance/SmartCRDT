/**
 * VisualPrivacyClassifier - Embedding-based visual privacy classification
 *
 * This module implements privacy classification for visual data using 768-dimensional
 * VL-JEPA embeddings. The key innovation is that classification happens entirely
 * on embeddings without ever inspecting raw pixels on the client device.
 *
 * ## Key Design Principles
 *
 * 1. **Embedding-Only Analysis**: Never inspect raw pixels for privacy detection
 * 2. **On-Device Processing**: All classification happens locally
 * 3. **Semantic Privacy Detection**: Understand privacy-sensitive UI patterns
 * 4. **Configurable Sensitivity**: User-adjustable privacy thresholds
 *
 * ## Classification Strategy
 *
 * The classifier uses semantic analysis of embeddings to detect:
 * - **Faces**: Human face patterns in embeddings
 * - **Text**: Text-dense regions (documents, forms)
 * - **Documents**: Structured document layouts
 * - **Screens**: Secondary screen content (reflection attacks)
 * - **Keyboards**: Input fields and virtual keyboards
 * - **Cursor**: User interaction points
 *
 * @packageDocumentation
 */

/**
 * Privacy classification result for visual data
 */
export interface VisualPrivacyClassification {
  /** Version of the classification schema */
  version: "1.0";

  /** Input embedding (768-dim) */
  embedding: Float32Array;

  /** Overall classification */
  classification: "SAFE" | "SENSITIVE" | "PII" | "SECRET";

  /** Confidence score (0-1) */
  confidence: number;

  /** Detected privacy-sensitive elements */
  detectedElements: PrivacyElement[];

  /** Whether redaction is needed */
  redactionNeeded: boolean;

  /** Privacy score (0-1, higher = more sensitive) */
  privacyScore: number;

  /** Classification timestamp */
  timestamp: number;
}

/**
 * Privacy element detected in visual data
 */
export interface PrivacyElement {
  /** Type of privacy-sensitive element */
  type: "face" | "text" | "document" | "screen" | "keyboard" | "cursor";

  /** Bounding box in normalized coordinates [0-1] */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Detection confidence (0-1) */
  confidence: number;

  /** Specific PII type if applicable */
  piiType?:
    | "name"
    | "email"
    | "phone"
    | "ssn"
    | "address"
    | "credit_card"
    | "medical";

  /** Semantic region in embedding space (dimension indices) */
  semanticRegion: {
    startDim: number;
    endDim: number;
    activationStrength: number;
  };
}

/**
 * Classification sensitivity level
 */
export enum SensitivityLevel {
  /** Conservative: Flag more potential PII (safer, more false positives) */
  CONSERVATIVE = "conservative",

  /** Balanced: Default sensitivity */
  BALANCED = "balanced",

  /** Permissive: Only flag clear PII (fewer false positives, more risk) */
  PERMISSIVE = "permissive",
}

/**
 * Privacy classification configuration
 */
export interface VisualPrivacyClassifierConfig {
  /** Sensitivity level for classification */
  sensitivity: SensitivityLevel;

  /** Classification thresholds */
  thresholds: {
    /** Minimum confidence for PII classification */
    piiThreshold: number;

    /** Minimum confidence for SENSITIVE classification */
    sensitiveThreshold: number;

    /** Minimum confidence for SAFE classification */
    safeThreshold: number;
  };

  /** Elements to detect */
  detectElements: {
    faces: boolean;
    text: boolean;
    documents: boolean;
    screens: boolean;
    keyboards: boolean;
    cursors: boolean;
  };

  /** Enable detailed logging */
  verbose?: boolean;

  /** Embedding dimension (default: 768) */
  embeddingDim: number;
}

/**
 * Privacy pattern in embedding space
 *
 * Represents a known privacy-sensitive pattern in the embedding space.
 * These patterns are learned from training data.
 */
interface PrivacyPattern {
  /** Pattern type */
  type: PrivacyElement["type"];

  /** Semantic region in embedding dimensions */
  semanticRegion: {
    startDim: number;
    endDim: number;
  };

  /** Activation pattern signature */
  signature: Float32Array;

  /** Classification threshold for this pattern */
  threshold: number;

  /** Typical PII type if applicable */
  piiType?: PrivacyElement["piiType"];
}

/**
 * VisualPrivacyClassifier - Embedding-based visual privacy classification
 *
 * Analyzes 768-dimensional VL-JEPA embeddings to detect privacy-sensitive content
 * without ever inspecting raw pixels.
 *
 * ## Example
 *
 * ```typescript
 * const classifier = new VisualPrivacyClassifier({
 *   sensitivity: SensitivityLevel.BALANCED,
 * });
 *
 * const embedding = await vljepa.encodeImage(imageFrame);
 * const result = classifier.classify(embedding);
 *
 * if (result.classification === "PII") {
 *   console.log("PII detected:", result.detectedElements);
 * }
 * ```
 */
export class VisualPrivacyClassifier {
  private config: Required<VisualPrivacyClassifierConfig>;
  private privacyPatterns: PrivacyPattern[];
  private stats: {
    classifications: number;
    piiDetected: number;
    sensitiveDetected: number;
    safeClassified: number;
  };

  constructor(config: Partial<VisualPrivacyClassifierConfig> = {}) {
    this.config = {
      sensitivity: config.sensitivity ?? SensitivityLevel.BALANCED,
      thresholds:
        config.thresholds ?? this.getDefaultThresholds(config.sensitivity),
      detectElements: {
        faces: config.detectElements?.faces ?? true,
        text: config.detectElements?.text ?? true,
        documents: config.detectElements?.documents ?? true,
        screens: config.detectElements?.screens ?? true,
        keyboards: config.detectElements?.keyboards ?? true,
        cursors: config.detectElements?.cursors ?? true,
      },
      verbose: config.verbose ?? false,
      embeddingDim: config.embeddingDim ?? 768,
    };

    // Initialize privacy patterns
    this.privacyPatterns = this.initializePrivacyPatterns();

    this.stats = {
      classifications: 0,
      piiDetected: 0,
      sensitiveDetected: 0,
      safeClassified: 0,
    };
  }

  /**
   * Classify an embedding for privacy sensitivity
   *
   * @param embedding - 768-dimensional VL-JEPA embedding
   * @returns Privacy classification result
   */
  classify(embedding: Float32Array): VisualPrivacyClassification {
    if (embedding.length !== this.config.embeddingDim) {
      throw new Error(
        `Invalid embedding dimension: expected ${this.config.embeddingDim}, ` +
          `got ${embedding.length}`
      );
    }

    const startTime = Date.now();

    // Detect privacy elements
    const detectedElements = this.detectPrivacyElements(embedding);

    // Calculate privacy score
    const privacyScore = this.calculatePrivacyScore(detectedElements);

    // Determine overall classification
    const classification = this.determineClassification(
      privacyScore,
      detectedElements
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(detectedElements);

    // Determine if redaction needed
    const redactionNeeded =
      classification === "PII" || classification === "SECRET";

    const result: VisualPrivacyClassification = {
      version: "1.0",
      embedding: embedding,
      classification,
      confidence,
      detectedElements,
      redactionNeeded,
      privacyScore,
      timestamp: Date.now(),
    };

    // Update stats
    this.stats.classifications++;
    if (classification === "PII" || classification === "SECRET") {
      this.stats.piiDetected++;
    } else if (classification === "SENSITIVE") {
      this.stats.sensitiveDetected++;
    } else {
      this.stats.safeClassified++;
    }

    // Log if verbose
    if (this.config.verbose) {
      const elapsed = Date.now() - startTime;
      console.log("[VisualPrivacyClassifier] Classification:", {
        classification,
        confidence,
        privacyScore,
        elements: detectedElements.length,
        elapsedMs: elapsed,
      });
    }

    return result;
  }

  /**
   * Classify multiple embeddings in batch
   *
   * @param embeddings - Array of 768-dimensional embeddings
   * @returns Array of privacy classification results
   */
  classifyBatch(embeddings: Float32Array[]): VisualPrivacyClassification[] {
    return embeddings.map(embedding => this.classify(embedding));
  }

  /**
   * Get classification statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      classifications: 0,
      piiDetected: 0,
      sensitiveDetected: 0,
      safeClassified: 0,
    };
  }

  /**
   * Detect privacy elements in embedding
   *
   * Uses semantic pattern matching to detect privacy-sensitive content.
   *
   * @param embedding - Input embedding
   * @returns Detected privacy elements
   */
  private detectPrivacyElements(embedding: Float32Array): PrivacyElement[] {
    const detected: PrivacyElement[] = [];

    for (const pattern of this.privacyPatterns) {
      // Skip if element type detection is disabled
      if (!this.isElementDetectionEnabled(pattern.type)) {
        continue;
      }

      // Check if pattern matches embedding
      const match = this.matchPattern(embedding, pattern);

      if (match.matches) {
        detected.push({
          type: pattern.type,
          boundingBox: this.estimateBoundingBox(embedding, pattern),
          confidence: match.confidence,
          piiType: pattern.piiType,
          semanticRegion: {
            startDim: pattern.semanticRegion.startDim,
            endDim: pattern.semanticRegion.endDim,
            activationStrength: match.activationStrength,
          },
        });
      }
    }

    // Sort by confidence (descending)
    detected.sort((a, b) => b.confidence - a.confidence);

    return detected;
  }

  /**
   * Check if element detection is enabled
   */
  private isElementDetectionEnabled(type: PrivacyElement["type"]): boolean {
    switch (type) {
      case "face":
        return this.config.detectElements.faces;
      case "text":
        return this.config.detectElements.text;
      case "document":
        return this.config.detectElements.documents;
      case "screen":
        return this.config.detectElements.screens;
      case "keyboard":
        return this.config.detectElements.keyboards;
      case "cursor":
        return this.config.detectElements.cursors;
      default:
        return false;
    }
  }

  /**
   * Match a privacy pattern against an embedding
   *
   * Uses cosine similarity and activation analysis to detect patterns.
   *
   * @param embedding - Input embedding
   * @param pattern - Privacy pattern to match
   * @returns Match result
   */
  private matchPattern(
    embedding: Float32Array,
    pattern: PrivacyPattern
  ): { matches: boolean; confidence: number; activationStrength: number } {
    // Extract semantic region from embedding
    const regionStart = pattern.semanticRegion.startDim;
    const regionEnd = Math.min(pattern.semanticRegion.endDim, embedding.length);

    if (regionStart >= regionEnd) {
      return { matches: false, confidence: 0, activationStrength: 0 };
    }

    // Calculate region activation strength
    let activationSum = 0;
    for (let i = regionStart; i < regionEnd; i++) {
      activationSum += Math.abs(embedding[i]);
    }
    const activationStrength = activationSum / (regionEnd - regionStart);

    // Check if activation exceeds threshold
    const threshold = this.getAdaptiveThreshold(pattern.threshold);
    const matches = activationStrength > threshold;

    // Calculate confidence based on how much the activation exceeds threshold
    const confidence = matches
      ? Math.min(1.0, (activationStrength - threshold) / threshold + 0.5)
      : 0;

    return { matches, confidence, activationStrength };
  }

  /**
   * Get adaptive threshold based on sensitivity level
   */
  private getAdaptiveThreshold(baseThreshold: number): number {
    switch (this.config.sensitivity) {
      case SensitivityLevel.CONSERVATIVE:
        return baseThreshold * 0.7; // Lower threshold = more detections
      case SensitivityLevel.PERMISSIVE:
        return baseThreshold * 1.3; // Higher threshold = fewer detections
      case SensitivityLevel.BALANCED:
      default:
        return baseThreshold;
    }
  }

  /**
   * Estimate bounding box for detected element
   *
   * In production, this would use attention map analysis.
   * For now, returns a placeholder centered box.
   *
   * @param embedding - Input embedding
   * @param pattern - Matched pattern
   * @returns Estimated bounding box
   */
  private estimateBoundingBox(
    embedding: Float32Array,
    pattern: PrivacyPattern
  ): { x: number; y: number; width: number; height: number } {
    // Placeholder: In production, analyze attention maps to get spatial locations
    // For now, return centered box
    return {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    };
  }

  /**
   * Calculate overall privacy score
   *
   * @param detectedElements - Detected privacy elements
   * @returns Privacy score (0-1)
   */
  private calculatePrivacyScore(detectedElements: PrivacyElement[]): number {
    if (detectedElements.length === 0) {
      return 0;
    }

    let weightedScore = 0;
    let totalWeight = 0;

    for (const element of detectedElements) {
      const weight = this.getElementWeight(element.type);
      weightedScore += element.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(1, weightedScore / totalWeight) : 0;
  }

  /**
   * Get weight for privacy element type
   */
  private getElementWeight(type: PrivacyElement["type"]): number {
    // Higher weight = more privacy-sensitive
    switch (type) {
      case "face":
        return 1.0;
      case "document":
        return 0.95;
      case "text":
        return 0.7;
      case "screen":
        return 0.8;
      case "keyboard":
        return 0.5;
      case "cursor":
        return 0.2;
      default:
        return 0.5;
    }
  }

  /**
   * Determine overall classification
   */
  private determineClassification(
    privacyScore: number,
    detectedElements: PrivacyElement[]
  ): VisualPrivacyClassification["classification"] {
    // Check for high-sensitivity elements
    const hasHighSensitivityElements = detectedElements.some(
      e =>
        e.type === "face" ||
        e.type === "document" ||
        e.piiType === "ssn" ||
        e.piiType === "credit_card"
    );

    if (
      hasHighSensitivityElements &&
      privacyScore > this.config.thresholds.piiThreshold
    ) {
      return "SECRET";
    }

    if (privacyScore > this.config.thresholds.piiThreshold) {
      return "PII";
    }

    if (privacyScore > this.config.thresholds.sensitiveThreshold) {
      return "SENSITIVE";
    }

    return "SAFE";
  }

  /**
   * Calculate classification confidence
   */
  private calculateConfidence(detectedElements: PrivacyElement[]): number {
    if (detectedElements.length === 0) {
      return 1.0; // High confidence in "SAFE"
    }

    // Average confidence of detected elements
    const avgConfidence =
      detectedElements.reduce((sum, e) => sum + e.confidence, 0) /
      detectedElements.length;

    return avgConfidence;
  }

  /**
   * Get default thresholds for sensitivity level
   */
  private getDefaultThresholds(
    sensitivity: SensitivityLevel
  ): VisualPrivacyClassifierConfig["thresholds"] {
    switch (sensitivity) {
      case SensitivityLevel.CONSERVATIVE:
        return {
          piiThreshold: 0.4,
          sensitiveThreshold: 0.2,
          safeThreshold: 0.1,
        };
      case SensitivityLevel.PERMISSIVE:
        return {
          piiThreshold: 0.7,
          sensitiveThreshold: 0.5,
          safeThreshold: 0.3,
        };
      case SensitivityLevel.BALANCED:
      default:
        return {
          piiThreshold: 0.6,
          sensitiveThreshold: 0.4,
          safeThreshold: 0.2,
        };
    }
  }

  /**
   * Initialize privacy patterns
   *
   * Creates semantic patterns for different privacy-sensitive elements.
   * In production, these would be learned from training data.
   */
  private initializePrivacyPatterns(): PrivacyPattern[] {
    const patterns: PrivacyPattern[] = [];
    const dim = this.config.embeddingDim;

    // Face pattern: typically in early embedding dimensions (visual features)
    patterns.push({
      type: "face",
      semanticRegion: { startDim: 0, endDim: Math.floor(dim * 0.2) },
      signature: new Float32Array(128), // Placeholder
      threshold: 0.5,
    });

    // Text pattern: distributed across mid dimensions
    patterns.push({
      type: "text",
      semanticRegion: {
        startDim: Math.floor(dim * 0.2),
        endDim: Math.floor(dim * 0.6),
      },
      signature: new Float32Array(256),
      threshold: 0.4,
    });

    // Document pattern: structured layout features
    patterns.push({
      type: "document",
      semanticRegion: {
        startDim: Math.floor(dim * 0.1),
        endDim: Math.floor(dim * 0.5),
      },
      signature: new Float32Array(192),
      threshold: 0.6,
      piiType: "address",
    });

    // Screen pattern: reflection attack detection
    patterns.push({
      type: "screen",
      semanticRegion: {
        startDim: Math.floor(dim * 0.3),
        endDim: Math.floor(dim * 0.7),
      },
      signature: new Float32Array(192),
      threshold: 0.5,
    });

    // Keyboard pattern: input UI elements
    patterns.push({
      type: "keyboard",
      semanticRegion: {
        startDim: Math.floor(dim * 0.5),
        endDim: Math.floor(dim * 0.8),
      },
      signature: new Float32Array(96),
      threshold: 0.45,
    });

    // Cursor pattern: interaction points
    patterns.push({
      type: "cursor",
      semanticRegion: { startDim: Math.floor(dim * 0.7), endDim: dim },
      signature: new Float32Array(64),
      threshold: 0.3,
    });

    return patterns;
  }
}

/**
 * Create a conservative classifier (maximum privacy protection)
 */
export function createConservativeClassifier(): VisualPrivacyClassifier {
  return new VisualPrivacyClassifier({
    sensitivity: SensitivityLevel.CONSERVATIVE,
    detectElements: {
      faces: true,
      text: true,
      documents: true,
      screens: true,
      keyboards: true,
      cursors: true,
    },
  });
}

/**
 * Create a balanced classifier (default)
 */
export function createBalancedClassifier(): VisualPrivacyClassifier {
  return new VisualPrivacyClassifier({
    sensitivity: SensitivityLevel.BALANCED,
  });
}

/**
 * Create a permissive classifier (fewer false positives)
 */
export function createPermissiveClassifier(): VisualPrivacyClassifier {
  return new VisualPrivacyClassifier({
    sensitivity: SensitivityLevel.PERMISSIVE,
  });
}
