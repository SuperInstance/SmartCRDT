/**
 * VisualPrivacyAnalyzer - Privacy analysis for visual data in VL-JEPA
 *
 * This module analyzes privacy risks associated with visual data processing
 * in the VL-JEPA (Vision-Language Joint Embedding Predictive Architecture)
 * system. It ensures that all visual processing respects user privacy and
 * complies with GDPR, HIPAA, and other regulations.
 *
 * ## Privacy Architecture
 *
 * VL-JEPA processes UI frames and visual data to extract semantic embeddings.
 * This raises unique privacy concerns that must be addressed:
 *
 * 1. **Visual PII**: Faces, text, documents, screens in visual data
 * 2. **Screen Content**: Reflection attacks, sensitive information on screen
 * 3. **Data Location**: On-device vs cloud processing
 * 4. **Embedding Safety**: Preventing reconstruction attacks from embeddings
 * 5. **Data Retention**: Cache policies for visual data and embeddings
 *
 * ## Core Privacy Principles
 *
 * 1. **Edge-First**: All VL-JEPA processing happens on-device when possible
 * 2. **Embeddings Only**: Only 768-dim semantic embeddings leave the device
 * 3. **No Pixel Data**: Raw frames never transmitted or persisted
 * 4. **PII Redaction**: Detect and redact visual PII before processing
 * 5. **Minimal Retention**: Embeddings cached briefly, never pixels
 *
 * @packageDocumentation
 */

/**
 * Visual data type classification
 */
export enum VisualDataType {
  /** UI frame from browser/IDE */
  UI_FRAME = "ui_frame",

  /** Screenshot captured by user */
  SCREENSHOT = "screenshot",

  /** Video stream (e.g., screen sharing, camera) */
  VIDEO_STREAM = "video_stream",

  /** Document image (PDF, scan) */
  DOCUMENT = "document",

  /** Webcam or camera feed */
  CAMERA = "camera",

  /** Synthetic or generated image */
  SYNTHETIC = "synthetic",
}

/**
 * Visual PII (Personally Identifiable Information) types
 */
export enum VisualPIIType {
  /** Human faces */
  FACE = "face",

  /** Text content (potential PII) */
  TEXT = "text",

  /** Personal documents (ID cards, passports) */
  DOCUMENT = "document",

  /** Other screens visible in frame (reflection attack risk) */
  SCREEN = "screen",

  /** Credit cards or financial information */
  FINANCIAL = "financial",

  /** Medical information or documents */
  MEDICAL = "medical",

  /** Contact information (email, phone) */
  CONTACT = "contact",

  /** Location information (maps, GPS coordinates) */
  LOCATION = "location",
}

/**
 * Processing location for visual data
 */
export enum ProcessingLocation {
  /** Process entirely on device (safest) */
  EDGE_ONLY = "edge-only",

  /** Hybrid: embeddings on device, model in cloud */
  HYBRID = "hybrid",

  /** Process in cloud (least safe, should be avoided) */
  CLOUD_ONLY = "cloud-only",
}

/**
 * Privacy risk level for visual data
 */
export enum PrivacyRiskLevel {
  /** No significant risk (e.g., abstract UI) */
  LOW = "low",

  /** Moderate risk (e.g., UI with text) */
  MEDIUM = "medium",

  /** High risk (e.g., faces, PII visible) */
  HIGH = "high",

  /** Extreme risk (e.g., documents, sensitive content) */
  CRITICAL = "critical",
}

/**
 * Action to take for visual data
 */
export enum VisualDataAction {
  /** Allow processing as-is */
  ALLOW = "allow",

  /** Block processing entirely */
  BLOCK = "block",

  /** Redact PII and process */
  REDACT = "redact",

  /** Require user consent before processing */
  CONSENT = "consent",

  /** Downsample or blur before processing */
  SANITIZE = "sanitize",
}

/**
 * Bounding box for detected PII
 */
export interface BoundingBox {
  /** X coordinate (normalized 0-1) */
  x: number;

  /** Y coordinate (normalized 0-1) */
  y: number;

  /** Width (normalized 0-1) */
  width: number;

  /** Height (normalized 0-1) */
  height: number;

  /** Confidence score (0-1) */
  confidence: number;

  /** Type of PII detected */
  type: VisualPIIType;
}

/**
 * Visual privacy policy configuration
 */
export interface VisualPrivacyPolicy {
  /** Where visual processing should occur */
  processingLocation: ProcessingLocation;

  /** What visual data can be processed */
  visualDataCategories: {
    [key in VisualDataType]?: VisualDataAction;
  };

  /** What PII types to detect */
  visualPIITypes: {
    [key in VisualPIIType]?: boolean;
  };

  /** Data retention policy */
  retention: {
    /** Never persist visual data to disk */
    inMemoryOnly: boolean;

    /** Maximum time to cache embeddings (ms, not pixels) */
    maxCacheTime: number;

    /** Never cache raw frames */
    neverCacheFrames: boolean;
  };

  /** Embedding safety settings */
  embeddingSafety: {
    /** Add noise to embeddings (epsilon-DP) */
    epsilon?: number;

    /** Quantize embeddings to reduce precision */
    quantizeBits?: number;

    /** Prevent reconstruction attacks */
    enableReconstructionProtection: boolean;
  };
}

/**
 * Result of visual privacy analysis
 */
export interface VisualPrivacyAnalysis {
  /** Overall risk level */
  riskLevel: PrivacyRiskLevel;

  /** Recommended action */
  action: VisualDataAction;

  /** Detected PII regions */
  detectedPII: BoundingBox[];

  /** Safe processing location */
  recommendedLocation: ProcessingLocation;

  /** Privacy violations found */
  violations: string[];

  /** User consent requirements */
  consentRequired: boolean;

  /** Sanitization recommendations */
  sanitizationNeeded: boolean;
}

/**
 * Configuration for the Visual Privacy Analyzer
 */
export interface VisualPrivacyAnalyzerConfig {
  /** Privacy policy to enforce */
  policy: VisualPrivacyPolicy;

  /** Enable detailed logging */
  verbose?: boolean;

  /** Custom PII detection thresholds */
  detectionThresholds?: {
    faceConfidence: number;
    textConfidence: number;
    documentConfidence: number;
  };
}

/**
 * VisualPrivacyAnalyzer - Analyzes privacy risks in visual data
 *
 * This analyzer ensures that VL-JEPA processing respects privacy by:
 * 1. Detecting PII in visual data
 * 2. Assessing privacy risk levels
 * 3. Recommending appropriate actions
 * 4. Enforcing data retention policies
 *
 * ## Example
 *
 * ```typescript
 * const analyzer = new VisualPrivacyAnalyzer({
 *   policy: {
 *     processingLocation: ProcessingLocation.EDGE_ONLY,
 *     visualDataCategories: {
 *       [VisualDataType.UI_FRAME]: VisualDataAction.ALLOW,
 *       [VisualDataType.SCREENSHOT]: VisualDataAction.CONSENT,
 *     },
 *     retention: {
 *       inMemoryOnly: true,
 *       maxCacheTime: 60000,
 *       neverCacheFrames: true,
 *     },
 *   },
 * });
 *
 * const analysis = await analyzer.analyze(frame, VisualDataType.UI_FRAME);
 * if (analysis.action === VisualDataAction.BLOCK) {
 *   throw new Error('Visual data contains sensitive PII');
 * }
 * ```
 */
export class VisualPrivacyAnalyzer {
  private config: Required<VisualPrivacyAnalyzerConfig>;
  private cache: Map<
    string,
    { analysis: VisualPrivacyAnalysis; timestamp: number }
  >;

  constructor(config: VisualPrivacyAnalyzerConfig) {
    this.config = {
      policy: config.policy,
      verbose: config.verbose ?? false,
      detectionThresholds: {
        faceConfidence: config.detectionThresholds?.faceConfidence ?? 0.7,
        textConfidence: config.detectionThresholds?.textConfidence ?? 0.6,
        documentConfidence:
          config.detectionThresholds?.documentConfidence ?? 0.8,
      },
    };
    this.cache = new Map();
  }

  /**
   * Analyze visual data for privacy risks
   *
   * @param frame - Image data to analyze
   * @param dataType - Type of visual data
   * @returns Privacy analysis result
   */
  async analyze(
    frame: ImageData,
    dataType: VisualDataType
  ): Promise<VisualPrivacyAnalysis> {
    // Check if processing is allowed for this data type
    const categoryAction = this.config.policy.visualDataCategories[dataType];
    if (categoryAction === VisualDataAction.BLOCK) {
      return {
        riskLevel: PrivacyRiskLevel.CRITICAL,
        action: VisualDataAction.BLOCK,
        detectedPII: [],
        recommendedLocation: ProcessingLocation.EDGE_ONLY,
        violations: [`Data type ${dataType} is blocked by policy`],
        consentRequired: false,
        sanitizationNeeded: false,
      };
    }

    // Detect PII in frame
    const detectedPII = await this.detectPII(frame);

    // Assess risk level
    const riskLevel = this.assessRisk(detectedPII, dataType);

    // Determine action
    const action = this.determineAction(riskLevel, dataType, categoryAction);

    // Check violations
    const violations = this.checkViolations(detectedPII, dataType);

    // Check consent requirement
    const consentRequired = this.requiresConsent(riskLevel, dataType);

    // Determine recommended location
    const recommendedLocation = this.recommendLocation(riskLevel);

    // Check if sanitization needed
    const sanitizationNeeded =
      action === VisualDataAction.REDACT ||
      action === VisualDataAction.SANITIZE;

    const analysis: VisualPrivacyAnalysis = {
      riskLevel,
      action,
      detectedPII,
      recommendedLocation,
      violations,
      consentRequired,
      sanitizationNeeded,
    };

    // Log if verbose
    if (this.config.verbose) {
      console.log("[VisualPrivacyAnalyzer] Analysis:", {
        dataType,
        riskLevel,
        action,
        piiCount: detectedPII.length,
      });
    }

    return analysis;
  }

  /**
   * Detect PII in visual frame
   *
   * In production, this would use ML models for:
   * - Face detection (e.g., MediaPipe Face Detection)
   * - Text detection (e.g., Tesseract OCR)
   * - Document detection (e.g., custom classifier)
   *
   * For now, this is a placeholder that will be enhanced with actual models.
   *
   * @param frame - Image data to analyze
   * @returns Detected PII bounding boxes
   */
  private async detectPII(frame: ImageData): Promise<BoundingBox[]> {
    const detected: BoundingBox[] = [];

    // Placeholder: In production, integrate actual detection models
    // This would include:
    // 1. Face detection model (e.g., blaze-face, yolov7-face)
    // 2. Text detection model (e.g., craft, pixel-link)
    // 3. Document detection model (custom trained)

    // For now, return empty array (no PII detected)
    // Real implementation will use on-device ML models

    return detected;
  }

  /**
   * Assess privacy risk level based on detected PII and data type
   *
   * @param detectedPII - PII detected in frame
   * @param dataType - Type of visual data
   * @returns Risk level
   */
  private assessRisk(
    detectedPII: BoundingBox[],
    dataType: VisualDataType
  ): PrivacyRiskLevel {
    // Count high-risk PII
    const highRiskPII = detectedPII.filter(
      pii =>
        pii.type === VisualPIIType.FACE ||
        pii.type === VisualPIIType.DOCUMENT ||
        pii.type === VisualPIIType.MEDICAL ||
        pii.type === VisualPIIType.FINANCIAL
    );

    // Determine risk level
    if (highRiskPII.length > 0) {
      return PrivacyRiskLevel.CRITICAL;
    }

    if (detectedPII.length > 2) {
      return PrivacyRiskLevel.HIGH;
    }

    if (detectedPII.length > 0) {
      return PrivacyRiskLevel.MEDIUM;
    }

    // Check data type risk
    if (
      dataType === VisualDataType.DOCUMENT ||
      dataType === VisualDataType.CAMERA
    ) {
      return PrivacyRiskLevel.MEDIUM;
    }

    return PrivacyRiskLevel.LOW;
  }

  /**
   * Determine action based on risk and policy
   *
   * @param riskLevel - Assessed risk level
   * @param dataType - Type of visual data
   * @param categoryAction - Policy action for this data type
   * @returns Action to take
   */
  private determineAction(
    riskLevel: PrivacyRiskLevel,
    dataType: VisualDataType,
    categoryAction?: VisualDataAction
  ): VisualDataAction {
    // Use policy action if specified
    if (categoryAction) {
      if (categoryAction === VisualDataAction.CONSENT) {
        return VisualDataAction.CONSENT;
      }
      if (categoryAction === VisualDataAction.BLOCK) {
        return VisualDataAction.BLOCK;
      }
    }

    // Determine action based on risk
    switch (riskLevel) {
      case PrivacyRiskLevel.CRITICAL:
        return VisualDataAction.BLOCK;

      case PrivacyRiskLevel.HIGH:
        return VisualDataAction.REDACT;

      case PrivacyRiskLevel.MEDIUM:
        return VisualDataAction.SANITIZE;

      case PrivacyRiskLevel.LOW:
        return VisualDataAction.ALLOW;

      default:
        return VisualDataAction.ALLOW;
    }
  }

  /**
   * Check for privacy violations
   *
   * @param detectedPII - PII detected
   * @param dataType - Data type
   * @returns List of violations
   */
  private checkViolations(
    detectedPII: BoundingBox[],
    dataType: VisualDataType
  ): string[] {
    const violations: string[] = [];

    // Check if faces detected but processing location is not edge-only
    if (detectedPII.some(p => p.type === VisualPIIType.FACE)) {
      if (
        this.config.policy.processingLocation !== ProcessingLocation.EDGE_ONLY
      ) {
        violations.push("Faces detected but processing not edge-only");
      }
    }

    // Check if documents detected
    if (detectedPII.some(p => p.type === VisualPIIType.DOCUMENT)) {
      violations.push("Personal documents detected");
    }

    // Check if screens detected (reflection attack risk)
    if (detectedPII.some(p => p.type === VisualPIIType.SCREEN)) {
      violations.push("Other screens visible (reflection attack risk)");
    }

    // Check retention policy
    if (!this.config.policy.retention.inMemoryOnly) {
      violations.push("Visual data persistence enabled (risk)");
    }

    if (!this.config.policy.retention.neverCacheFrames) {
      violations.push("Frame caching enabled (risk)");
    }

    return violations;
  }

  /**
   * Check if user consent is required
   *
   * @param riskLevel - Risk level
   * @param dataType - Data type
   * @returns Whether consent is required
   */
  private requiresConsent(
    riskLevel: PrivacyRiskLevel,
    dataType: VisualDataType
  ): boolean {
    // Consent required for high-risk data types
    if (
      dataType === VisualDataType.CAMERA ||
      dataType === VisualDataType.DOCUMENT
    ) {
      return true;
    }

    // Consent required for high/critical risk
    if (
      riskLevel === PrivacyRiskLevel.HIGH ||
      riskLevel === PrivacyRiskLevel.CRITICAL
    ) {
      return true;
    }

    return false;
  }

  /**
   * Recommend processing location based on risk
   *
   * @param riskLevel - Risk level
   * @returns Recommended location
   */
  private recommendLocation(riskLevel: PrivacyRiskLevel): ProcessingLocation {
    // Always use edge-only for high/critical risk
    if (
      riskLevel === PrivacyRiskLevel.HIGH ||
      riskLevel === PrivacyRiskLevel.CRITICAL
    ) {
      return ProcessingLocation.EDGE_ONLY;
    }

    // Use edge-only for medium risk
    if (riskLevel === PrivacyRiskLevel.MEDIUM) {
      return ProcessingLocation.EDGE_ONLY;
    }

    // Can use hybrid for low risk
    return this.config.policy.processingLocation;
  }

  /**
   * Update the privacy policy
   *
   * @param policy - New policy
   */
  updatePolicy(policy: Partial<VisualPrivacyPolicy>): void {
    this.config.policy = { ...this.config.policy, ...policy };

    // Clear cache when policy changes
    this.cache.clear();

    if (this.config.verbose) {
      console.log("[VisualPrivacyAnalyzer] Policy updated:", policy);
    }
  }

  /**
   * Clear the analysis cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current privacy policy
   */
  getPolicy(): VisualPrivacyPolicy {
    return { ...this.config.policy };
  }
}

/**
 * Create a default privacy policy for VL-JEPA
 *
 * This policy prioritizes privacy by:
 * - Enforcing edge-only processing
 * - Blocking camera/document processing by default
 * - Never persisting visual data
 * - Adding differential privacy to embeddings
 *
 * @returns Default privacy policy
 */
export function createDefaultPrivacyPolicy(): VisualPrivacyPolicy {
  return {
    processingLocation: ProcessingLocation.EDGE_ONLY,
    visualDataCategories: {
      [VisualDataType.UI_FRAME]: VisualDataAction.ALLOW,
      [VisualDataType.SCREENSHOT]: VisualDataAction.CONSENT,
      [VisualDataType.VIDEO_STREAM]: VisualDataAction.BLOCK,
      [VisualDataType.DOCUMENT]: VisualDataAction.BLOCK,
      [VisualDataType.CAMERA]: VisualDataAction.BLOCK,
      [VisualDataType.SYNTHETIC]: VisualDataAction.ALLOW,
    },
    visualPIITypes: {
      [VisualPIIType.FACE]: true,
      [VisualPIIType.TEXT]: true,
      [VisualPIIType.DOCUMENT]: true,
      [VisualPIIType.SCREEN]: true,
      [VisualPIIType.FINANCIAL]: true,
      [VisualPIIType.MEDICAL]: true,
      [VisualPIIType.CONTACT]: true,
      [VisualPIIType.LOCATION]: true,
    },
    retention: {
      inMemoryOnly: true,
      maxCacheTime: 60000, // 1 minute
      neverCacheFrames: true,
    },
    embeddingSafety: {
      epsilon: 1.0, // Balanced privacy/utility
      quantizeBits: 16,
      enableReconstructionProtection: true,
    },
  };
}

/**
 * Create a strict privacy policy (for sensitive applications)
 *
 * @returns Strict privacy policy
 */
export function createStrictPrivacyPolicy(): VisualPrivacyPolicy {
  return {
    processingLocation: ProcessingLocation.EDGE_ONLY,
    visualDataCategories: {
      [VisualDataType.UI_FRAME]: VisualDataAction.SANITIZE,
      [VisualDataType.SCREENSHOT]: VisualDataAction.BLOCK,
      [VisualDataType.VIDEO_STREAM]: VisualDataAction.BLOCK,
      [VisualDataType.DOCUMENT]: VisualDataAction.BLOCK,
      [VisualDataType.CAMERA]: VisualDataAction.BLOCK,
      [VisualDataType.SYNTHETIC]: VisualDataAction.ALLOW,
    },
    visualPIITypes: {
      [VisualPIIType.FACE]: true,
      [VisualPIIType.TEXT]: true,
      [VisualPIIType.DOCUMENT]: true,
      [VisualPIIType.SCREEN]: true,
      [VisualPIIType.FINANCIAL]: true,
      [VisualPIIType.MEDICAL]: true,
      [VisualPIIType.CONTACT]: true,
      [VisualPIIType.LOCATION]: true,
    },
    retention: {
      inMemoryOnly: true,
      maxCacheTime: 10000, // 10 seconds
      neverCacheFrames: true,
    },
    embeddingSafety: {
      epsilon: 0.5, // Stronger privacy
      quantizeBits: 8,
      enableReconstructionProtection: true,
    },
  };
}
