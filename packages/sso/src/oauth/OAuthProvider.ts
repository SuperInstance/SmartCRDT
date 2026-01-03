/**
 * OAuth 2.0 / OIDC Provider Implementation
 *
 * Implements OAuth 2.0 and OpenID Connect authentication flows.
 * Supports multiple providers:
 * - Auth0
 * - Okta
 * - Azure AD
 * - Google Workspace
 * - Generic OAuth 2.0/OIDC providers
 */

import { randomUUID } from "uuid";
import {
  SSOConfig,
  OAuthProviderConfig,
  OAuthAuthRequest,
  OAuthAuthResponse,
  OAuthAuthResult,
  OAuthAuthError,
  SSOUser,
  IdentityProvider,
  SSOProtocol,
  OAuthConfigValidationResult,
  OIDCDiscoveryResponse,
} from "@lsi/protocol";

// ============================================================================
// PROVIDER-SPECIFIC CONFIGURATIONS
// ============================================================================

interface ProviderEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksEndpoint?: string;
  issuer?: string;
}

const PROVIDER_ENDPOINTS: Record<IdentityProvider, ProviderEndpoints> = {
  [IdentityProvider.OKTA]: {
    authorizationEndpoint: "/oauth2/v1/authorize",
    tokenEndpoint: "/oauth2/v1/token",
    userInfoEndpoint: "/oauth2/v1/userinfo",
    jwksEndpoint: "/oauth2/v1/keys",
    issuer: "",
  },
  [IdentityProvider.AUTH0]: {
    authorizationEndpoint: "/authorize",
    tokenEndpoint: "/oauth/token",
    userInfoEndpoint: "/userinfo",
    jwksEndpoint: "/.well-known/jwks.json",
    issuer: "",
  },
  [IdentityProvider.AZURE_AD]: {
    authorizationEndpoint: "/oauth2/v2.0/authorize",
    tokenEndpoint: "/oauth2/v2.0/token",
    userInfoEndpoint: "/openid/userinfo",
    jwksEndpoint: "/discovery/v2.0/keys",
    issuer: "",
  },
  [IdentityProvider.GOOGLE]: {
    authorizationEndpoint: "/o/oauth2/v2/auth",
    tokenEndpoint: "/token",
    userInfoEndpoint: "/oauth2/v3/userinfo",
    jwksEndpoint: "",
    issuer: "https://accounts.google.com",
  },
  [IdentityProvider.ONELOGIN]: {
    authorizationEndpoint: "/oauth2/auth",
    tokenEndpoint: "/oauth2/token",
    userInfoEndpoint: "/oidc/2/me",
    jwksEndpoint: "/oidc/2/keys",
    issuer: "",
  },
  [IdentityProvider.PING]: {
    authorizationEndpoint: "/as/authorization.oauth2",
    tokenEndpoint: "/as/token.oauth2",
    userInfoEndpoint: "/idp/userinfo.openid",
    jwksEndpoint: "/pf/JWKS",
    issuer: "",
  },
  [IdentityProvider.SHIBBOLETH]: {
    authorizationEndpoint: "/idp/profile/oidc/authorize",
    tokenEndpoint: "/idp/profile/oidc/token",
    userInfoEndpoint: "/idp/profile/oidc/userinfo",
    jwksEndpoint: "/idp/profile/oidc/jwks",
    issuer: "",
  },
  [IdentityProvider.GENERIC_SAML]: {
    authorizationEndpoint: "",
    tokenEndpoint: "",
    userInfoEndpoint: "",
    jwksEndpoint: "",
    issuer: "",
  },
  [IdentityProvider.GENERIC_OAUTH]: {
    authorizationEndpoint: "",
    tokenEndpoint: "",
    userInfoEndpoint: "",
    jwksEndpoint: "",
    issuer: "",
  },
};

// ============================================================================
// OAUTH PROVIDER CLASS
// ============================================================================

export class OAuthProvider {
  private config: SSOConfig;
  private endpoints: ProviderEndpoints;

  constructor(config: SSOConfig) {
    if (
      config.protocol !== SSOProtocol.OAUTH2 &&
      config.protocol !== SSOProtocol.OIDC
    ) {
      throw new Error("Invalid protocol for OAuth provider");
    }
    this.config = config;
    this.endpoints = this.resolveEndpoints();
  }

  /**
   * Resolve provider endpoints (from config or defaults)
   */
  private resolveEndpoints(): ProviderEndpoints {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    // If endpoints are explicitly configured, use them
    if (
      providerConfig.authorizationEndpoint &&
      providerConfig.tokenEndpoint
    ) {
      return {
        authorizationEndpoint: providerConfig.authorizationEndpoint,
        tokenEndpoint: providerConfig.tokenEndpoint,
        userInfoEndpoint: providerConfig.userInfoEndpoint,
        jwksEndpoint: providerConfig.jwksEndpoint,
        issuer: providerConfig.issuer,
      };
    }

    // Otherwise, use provider defaults
    const defaults = PROVIDER_ENDPOINTS[this.config.provider];
    const baseUrl = this.extractBaseUrl();

    return {
      authorizationEndpoint: baseUrl + defaults.authorizationEndpoint,
      tokenEndpoint: baseUrl + defaults.tokenEndpoint,
      userInfoEndpoint: defaults.userInfoEndpoint
        ? baseUrl + defaults.userInfoEndpoint
        : undefined,
      jwksEndpoint: defaults.jwksEndpoint
        ? baseUrl + defaults.jwksEndpoint
        : undefined,
      issuer: defaults.issuer || baseUrl,
    };
  }

  /**
   * Extract base URL from provider config
   */
  private extractBaseUrl(): string {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    // Try to derive from token endpoint
    if (providerConfig.tokenEndpoint) {
      const url = new URL(providerConfig.tokenEndpoint);
      return `${url.protocol}//${url.host}`;
    }

    // Provider-specific base URLs
    switch (this.config.provider) {
      case IdentityProvider.OKTA:
        return `https://${this.config.organizationId}.okta.com`;
      case IdentityProvider.AUTH0:
        return `https://${this.config.organizationId}.auth0.com`;
      case IdentityProvider.AZURE_AD:
        return `https://login.microsoftonline.com/${this.config.organizationId}`;
      case IdentityProvider.GOOGLE:
        return "https://accounts.google.com";
      default:
        return "";
    }
  }

  /**
   * Generate OAuth authorization request
   */
  generateAuthRequest(redirectUri: string, state?: string): OAuthAuthRequest {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;
    const authState = state || randomUUID();
    const codeVerifier = providerConfig.usePKCE
      ? this.generateCodeVerifier()
      : undefined;
    const codeChallenge = codeVerifier
      ? this.generateCodeChallenge(codeVerifier)
      : undefined;

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: providerConfig.responseType || "code",
      client_id: providerConfig.clientId,
      redirect_uri: redirectUri,
      scope: providerConfig.scopes.join(" "),
      state: authState,
    });

    if (codeChallenge) {
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", "S256");
    }

    const authorizationUrl = `${this.endpoints.authorizationEndpoint}?${params.toString()}`;

    return {
      ssoConfigId: this.config.id,
      authorizationUrl,
      state: authState,
      codeVerifier,
      timestamp: new Date(),
    };
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate PKCE code challenge
   */
  private async generateCodeChallenge(
    codeVerifier: string
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64URLEncode(new Uint8Array(digest));
  }

  /**
   * Base64 URL encode
   */
  private base64URLEncode(buffer: Uint8Array): string {
    let str = "";
    for (const byte of buffer) {
      str += String.fromCharCode(byte);
    }
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    const params = new URLSearchParams({
      grant_type: providerConfig.grantType || "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
    });

    if (codeVerifier) {
      params.append("code_verifier", codeVerifier);
    }

    const response = await fetch(this.endpoints.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Token exchange failed: ${error.error || "Unknown error"}`
      );
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    };
  }

  /**
   * Validate OAuth authorization response
   */
  async validateAuthResponse(
    response: OAuthAuthResponse,
    redirectUri: string
  ): Promise<OAuthAuthResult> {
    try {
      // Check for error response
      if ("error" in response) {
        return {
          success: false,
          error: response as unknown as OAuthAuthError,
        };
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        response.code,
        redirectUri,
        response.codeVerifier
      );

      // Get user info
      const user = await this.getUserInfo(
        tokens.accessToken,
        tokens.idToken
      );

      return {
        success: true,
        user,
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "server_error",
          description: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Get user information from UserInfo endpoint or ID token
   */
  private async getUserInfo(
    accessToken: string,
    idToken?: string
  ): Promise<SSOUser> {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    // Try UserInfo endpoint first
    if (this.endpoints.userInfoEndpoint) {
      try {
        const response = await fetch(this.endpoints.userInfoEndpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const userInfo = await response.json();
          return this.mapUserFromClaims(userInfo);
        }
      } catch (error) {
        console.warn("Failed to fetch UserInfo, falling back to ID token");
      }
    }

    // Fallback to ID token
    if (idToken) {
      const claims = this.parseJWT(idToken);
      return this.mapUserFromClaims(claims.payload as any);
    }

    throw new Error("Failed to get user information");
  }

  /**
   * Map user from claims
   */
  private mapUserFromClaims(claims: any): SSOUser {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;
    const attributeMapping = providerConfig.attributeMapping || {};

    const user: SSOUser = {
      id: claims.sub || randomUUID(),
      username:
        claims[attributeMapping.username || "username"] ||
        claims[attributeMapping.email || "email"] ||
        claims.sub,
      email: claims[attributeMapping.email || "email"] || "",
      displayName:
        claims[attributeMapping.displayName || "name"] || claims.name,
      firstName:
        claims[attributeMapping.firstName || "given_name"] ||
        claims.given_name,
      lastName:
        claims[attributeMapping.lastName || "family_name"] ||
        claims.family_name,
      roles: this.extractRoles(claims, providerConfig),
      groups: this.extractGroups(claims, providerConfig),
      attributes: claims,
      provider: this.config.provider,
      protocol: this.config.protocol,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    return user;
  }

  /**
   * Extract roles from claims
   */
  private extractRoles(
    claims: any,
    providerConfig: OAuthProviderConfig
  ): string[] {
    const roleClaim = providerConfig.roleClaim || "roles";

    if (Array.isArray(claims[roleClaim])) {
      return claims[roleClaim];
    } else if (typeof claims[roleClaim] === "string") {
      return claims[roleClaim].split(",").map((r: string) => r.trim());
    }

    return [];
  }

  /**
   * Extract groups from claims
   */
  private extractGroups(
    claims: any,
    providerConfig: OAuthProviderConfig
  ): string[] {
    const groupsClaim = providerConfig.groupsClaim || "groups";

    if (Array.isArray(claims[groupsClaim])) {
      return claims[groupsClaim];
    } else if (typeof claims[groupsClaim] === "string") {
      return claims[groupsClaim].split(",").map((g: string) => g.trim());
    }

    return [];
  }

  /**
   * Parse JWT (without verification)
   */
  private parseJWT(token: string): {
    header: any;
    payload: any;
    signature: string;
  } {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const header = JSON.parse(
      Buffer.from(parts[0], "base64").toString("utf-8")
    );
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );
    const signature = parts[2];

    return { header, payload, signature };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    idToken?: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
    });

    const response = await fetch(this.endpoints.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Token refresh failed: ${error.error || "Unknown error"}`
      );
    }

    const tokens = await response.json();
    return {
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token || refreshToken,
      expiresIn: tokens.expires_in,
    };
  }

  /**
   * Validate OAuth configuration
   */
  async validateConfig(): Promise<OAuthConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const providerConfig = this.config.providerConfig as OAuthProviderConfig;

    // Required fields
    if (!providerConfig.clientId) {
      errors.push("Client ID is required");
    }
    if (!providerConfig.clientSecret) {
      errors.push("Client secret is required");
    }
    if (!providerConfig.redirectUri) {
      errors.push("Redirect URI is required");
    }
    if (providerConfig.scopes.length === 0) {
      errors.push("At least one scope is required");
    }

    // Validate endpoints
    if (!this.endpoints.authorizationEndpoint) {
      errors.push("Authorization endpoint is required");
    }
    if (!this.endpoints.tokenEndpoint) {
      errors.push("Token endpoint is required");
    }

    // Test connection
    let canConnect = false;
    try {
      const response = await fetch(this.endpoints.tokenEndpoint, {
        method: "OPTIONS",
      });
      canConnect = response.ok || response.status === 405; // 405 Method Not Allowed is OK
    } catch (error) {
      warnings.push("Cannot connect to token endpoint");
    }

    // Warnings
    if (!providerConfig.userInfoEndpoint && this.config.protocol === SSOProtocol.OIDC) {
      warnings.push("UserInfo endpoint not provided - will rely on ID token only");
    }
    if (!providerConfig.roleAttribute) {
      warnings.push("Role claim not mapped - users will have no roles");
    }
    if (!providerConfig.groupsAttribute) {
      warnings.push("Groups claim not mapped - users will have no groups");
    }

    return {
      valid: errors.length === 0,
      canConnect,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// OIDC DISCOVERY
// ============================================================================

export class OIDCDiscovery {
  /**
   * Perform OIDC discovery
   */
  static async discover(issuerUrl: string): Promise<OIDCDiscoveryResponse> {
    const discoveryUrl = `${issuerUrl}/.well-known/openid-configuration`;

    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Auto-configure provider from discovery
   */
  static async autoConfigure(
    issuerUrl: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    scopes: string[]
  ): Promise<OAuthProviderConfig> {
    const discovery = await this.discover(issuerUrl);

    return {
      type: SSOProtocol.OIDC,
      clientId,
      clientSecret,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      userInfoEndpoint: discovery.userinfo_endpoint,
      jwksEndpoint: discovery.jwks_uri,
      issuer: discovery.issuer,
      redirectUri,
      scopes,
      attributeMapping: {},
    };
  }
}
