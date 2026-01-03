/**
 * JWT Validation Middleware
 *
 * Validates JWT tokens from OAuth/OIDC providers.
 * Supports:
 * - RS256, RS384, RS512 signature verification
 * - HS256, HS384, HS512 symmetric key verification
 * - JWKS (JSON Web Key Set) public key discovery
 * - Claim validation (iss, aud, exp, nbf, iat)
 * - Clock skew tolerance
 * - Token age validation
 */

import {
  JWTHeader,
  JWTPayload,
  JWTValidationOptions,
  JWTValidationResult,
  JWTValidationError,
} from "@lsi/protocol";

// ============================================================================
// JWT VALIDATOR CLASS
// ============================================================================

export class JWTValidator {
  private options: JWTValidationOptions;
  private keyCache: Map<string, JsonWebKey> = new Map();

  constructor(options: JWTValidationOptions) {
    this.options = {
      clockSkew: 60,
      algorithms: ["RS256"],
      ...options,
    };
  }

  /**
   * Validate JWT token
   */
  async validate(token: string): Promise<JWTValidationResult> {
    try {
      // Parse JWT
      const { header, payload, signature } = this.parseJWT(token);

      // Validate signature
      const signatureValid = await this.verifySignature(
        header,
        payload,
        signature
      );
      if (!signatureValid) {
        return {
          valid: false,
          error: {
            code: "invalid_signature",
            message: "JWT signature verification failed",
          },
        };
      }

      // Validate algorithm
      if (
        this.options.algorithms &&
        !this.options.algorithms.includes(header.alg)
      ) {
        return {
          valid: false,
          error: {
            code: "invalid_algorithm",
            message: `Algorithm ${header.alg} is not allowed`,
          },
        };
      }

      // Validate claims
      const claimValidation = this.validateClaims(payload);
      if (!claimValidation.valid) {
        return {
          valid: false,
          error: claimValidation.error,
        };
      }

      return {
        valid: true,
        header,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: {
          code: "invalid_token",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Parse JWT into parts
   */
  private parseJWT(token: string): {
    header: JWTHeader;
    payload: JWTPayload;
    signature: string;
  } {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf-8")
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    const signature = parts[2];

    return { header, payload, signature };
  }

  /**
   * Verify JWT signature
   */
  private async verifySignature(
    header: JWTHeader,
    payload: JWTPayload,
    signature: string
  ): Promise<boolean> {
    const algorithm = header.alg;

    // RSA signatures (RS256, RS384, RS512)
    if (algorithm.startsWith("RS")) {
      return this.verifyRSASignature(header, payload, signature);
    }

    // HMAC signatures (HS256, HS384, HS512)
    if (algorithm.startsWith("HS")) {
      return this.verifyHMACSignature(header, payload, signature);
    }

    // ECDSA signatures (ES256, ES384, ES512)
    if (algorithm.startsWith("ES")) {
      return this.verifyECDSASignature(header, payload, signature);
    }

    throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  /**
   * Verify RSA signature
   */
  private async verifyRSASignature(
    header: JWTHeader,
    payload: JWTPayload,
    signature: string
  ): Promise<boolean> {
    const keyId = header.kid;

    // Get public key
    const publicKey = await this.getPublicKey(keyId);

    // Import key
    const algorithm = this.getAlgorithmName(header.alg);
    const key = await crypto.subtle.importKey(
      "spki",
      this.pemToBuffer(publicKey),
      { name: "RSASSA-PKCS1-v1_5", hash: algorithm },
      false,
      ["verify"]
    );

    // Verify signature
    const data = this.getSigningData(header, payload);
    const signatureBuffer = this.base64UrlToBuffer(signature);

    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signatureBuffer,
      data
    );
  }

  /**
   * Verify HMAC signature
   */
  private async verifyHMACSignature(
    header: JWTHeader,
    payload: JWTPayload,
    signature: string
  ): Promise<boolean> {
    if (!this.options.publicKeys || !this.options.publicKeys["secret"]) {
      throw new Error("HMAC secret key not provided");
    }

    const secret = this.options.publicKeys["secret"];
    const algorithm = this.getAlgorithmName(header.alg);

    const data = this.getSigningData(header, payload);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: algorithm },
      false,
      ["verify"]
    );

    const signatureBuffer = this.base64UrlToBuffer(signature);
    const expectedSignature = await crypto.subtle.sign("HMAC", key, data);

    return this.bufferEquals(signatureBuffer, expectedSignature);
  }

  /**
   * Verify ECDSA signature
   */
  private async verifyECDSASignature(
    header: JWTHeader,
    payload: JWTPayload,
    signature: string
  ): Promise<boolean> {
    const keyId = header.kid;
    const publicKey = await this.getPublicKey(keyId);

    const algorithm = this.getAlgorithmName(header.alg);
    const key = await crypto.subtle.importKey(
      "spki",
      this.pemToBuffer(publicKey),
      { name: "ECDSA", namedCurve: this.getCurveName(header.alg) },
      false,
      ["verify"]
    );

    const data = this.getSigningData(header, payload);
    const signatureBuffer = this.base64UrlToBuffer(signature);

    return await crypto.subtle.verify(
      "ECDSA",
      key,
      signatureBuffer,
      data
    );
  }

  /**
   * Get public key (from cache or JWKS endpoint)
   */
  private async getPublicKey(keyId?: string): Promise<string> {
    // Check static keys first
    if (this.options.publicKeys && keyId && this.options.publicKeys[keyId]) {
      return this.options.publicKeys[keyId];
    }

    // Check cache
    if (keyId && this.keyCache.has(keyId)) {
      const key = this.keyCache.get(keyId)!;
      return this.spkiToPEM(key);
    }

    // Fetch from JWKS endpoint
    if (this.options.jwksUrl) {
      const key = await this.fetchKeyFromJWKS(keyId);
      return this.spkiToPEM(key);
    }

    throw new Error("Public key not found");
  }

  /**
   * Fetch key from JWKS endpoint
   */
  private async fetchKeyFromJWKS(
    keyId?: string
  ): Promise<JsonWebKey> {
    const response = await fetch(this.options.jwksUrl!);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }

    const jwks = await response.json();
    const keys = jwks.keys as JsonWebKey[];

    // Find key by kid
    if (keyId) {
      const key = keys.find((k) => k.kid === keyId);
      if (key) {
        // Cache the key
        this.keyCache.set(keyId, key);
        return key;
      }
    }

    // Fallback to first key
    if (keys.length > 0) {
      return keys[0];
    }

    throw new Error("No keys found in JWKS");
  }

  /**
   * Validate JWT claims
   */
  private validateClaims(
    payload: JWTPayload
  ): { valid: boolean; error?: JWTValidationError } {
    const now = Math.floor(Date.now() / 1000);
    const clockSkew = this.options.clockSkew || 0;

    // Check expiration
    if (payload.exp && payload.exp + clockSkew < now) {
      return {
        valid: false,
        error: {
          code: "expired",
          message: "Token has expired",
        },
      };
    }

    // Check not before
    if (payload.nbf && payload.nbf - clockSkew > now) {
      return {
        valid: false,
        error: {
          code: "not_yet_valid",
          message: "Token is not yet valid",
        },
      };
    }

    // Check issuer
    if (this.options.issuer && payload.iss !== this.options.issuer) {
      return {
        valid: false,
        error: {
          code: "invalid_issuer",
          message: `Invalid issuer: ${payload.iss}`,
        },
      };
    }

    // Check audience
    if (this.options.audience) {
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : [payload.aud];
      const allowedAudiences = Array.isArray(this.options.audience)
        ? this.options.audience
        : [this.options.audience];

      const hasAudience = audiences.some((aud) =>
        allowedAudiences.includes(aud)
      );

      if (!hasAudience) {
        return {
          valid: false,
          error: {
            code: "invalid_audience",
            message: `Invalid audience: ${payload.aud}`,
          },
        };
      }
    }

    // Check required claims
    if (this.options.requiredClaims) {
      for (const claim of this.options.requiredClaims) {
        if (!(claim in payload)) {
          return {
            valid: false,
            error: {
              code: "missing_claim",
              message: `Missing required claim: ${claim}`,
            },
          };
        }
      }
    }

    // Check token age
    if (this.options.maxAge && payload.iat) {
      const age = now - payload.iat;
      if (age > this.options.maxAge) {
        return {
          valid: false,
          error: {
            code: "expired",
            message: `Token is too old: ${age}s`,
          },
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get signing data (header + payload)
   */
  private getSigningData(header: JWTHeader, payload: JWTPayload): ArrayBuffer {
    const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = this.base64UrlEncode(JSON.stringify(payload));
    const data = `${headerEncoded}.${payloadEncoded}`;
    return new TextEncoder().encode(data);
  }

  /**
   * Base64URL encode
   */
  private base64UrlEncode(data: string): string {
    const base64 = btoa(data);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  /**
   * Base64URL decode to buffer
   */
  private base64UrlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert PEM to buffer
   */
  private pemToBuffer(pem: string): ArrayBuffer {
    const base64 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/g, "")
      .replace(/-----END PUBLIC KEY-----/g, "")
      .replace(/\s/g, "");
    return this.base64UrlToBuffer(base64);
  }

  /**
   * Convert SPKI to PEM
   */
  private spkiToPEM(spki: JsonWebKey): string {
    // This is a simplified conversion
    // In production, use proper library like jose or node-jose
    return `-----BEGIN PUBLIC KEY-----
${spki.n}
-----END PUBLIC KEY-----`;
  }

  /**
   * Compare buffers
   */
  private bufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
    if (a.byteLength !== b.byteLength) return false;
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    for (let i = 0; i < a.byteLength; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }

  /**
   * Get Web Crypto algorithm name
   */
  private getAlgorithmName(alg: string): string {
    switch (alg) {
      case "RS256":
      case "HS256":
      case "ES256":
        return "SHA-256";
      case "RS384":
      case "HS384":
      case "ES384":
        return "SHA-384";
      case "RS512":
      case "HS512":
      case "ES512":
        return "SHA-512";
      default:
        throw new Error(`Unsupported algorithm: ${alg}`);
    }
  }

  /**
   * Get ECDSA curve name
   */
  private getCurveName(alg: string): string {
    switch (alg) {
      case "ES256":
        return "P-256";
      case "ES384":
        return "P-384";
      case "ES512":
        return "P-521";
      default:
        throw new Error(`Unsupported algorithm: ${alg}`);
    }
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }
}

// ============================================================================
// JWT MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create JWT validation middleware for Express/Fastify/etc.
 */
export function createJWTMiddleware(options: JWTValidationOptions) {
  const validator = new JWTValidator(options);

  return async (
    req: any,
    res: any,
    next: (error?: Error) => void
  ) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
      }

      const token = authHeader.substring(7);

      // Validate token
      const result = await validator.validate(token);

      if (!result.valid) {
        return res.status(401).json({
          error: "Invalid token",
          details: result.error,
        });
      }

      // Attach user to request
      req.user = result.payload;
      req.token = token;

      next();
    } catch (error) {
      res.status(401).json({
        error: "Authentication failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
