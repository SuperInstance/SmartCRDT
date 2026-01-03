/**
 * Main SSO Service
 *
 * Unified SSO service that coordinates SAML, OAuth, JWT validation,
 * user provisioning, and RBAC.
 */

import { randomUUID } from "uuid";
import {
  ISSOService,
  SSOConfig,
  SSOUser,
  SSOSession,
  SessionStatus,
  SAMLAuthRequest,
  SAMLAuthResponse,
  SAMLAuthResult,
  OAuthAuthRequest,
  OAuthAuthResponse,
  OAuthAuthResult,
  JWTValidationOptions,
  JWTValidationResult,
  ProvisioningAction,
  IdentityProvider,
  SSOProtocol,
  Permission,
} from "@lsi/protocol";

import { SAMLServiceProvider } from "./saml/SAMLServiceProvider.js";
import { OAuthProvider } from "./oauth/OAuthProvider.js";
import { JWTValidator } from "./jwt/JWTValidator.js";
import { UserProvisioner, IUserStore, SCIMProvisioner } from "./provisioning/UserProvisioner.js";
import { RBACManager, IRoleStore } from "./rbac/RoleManager.js";

// ============================================================================
// SSO SERVICE CONFIGURATION
// ============================================================================

export interface SSOServiceConfig {
  /**
   * Base URL for callbacks
   */
  baseUrl: string;

  /**
   * Session duration (ms, default: 24 hours)
   */
  sessionDuration?: number;

  /**
   * Whether to enable JIT provisioning
   */
  enableJITProvisioning?: boolean;

  /**
   * Whether to enable session management
   */
  enableSessions?: boolean;
}

// ============================================================================
// SSO SERVICE IMPLEMENTATION
// ============================================================================

export class SSOService implements ISSOService {
  private config: SSOServiceConfig;
  private configs: Map<string, SSOConfig> = new Map();
  private userStore: IUserStore;
  private roleStore: IRoleStore;
  private userProvisioner: UserProvisioner;
  private scimProvisioner: SCIMProvisioner;
  private rbacManager: RBACManager;
  private sessions: Map<string, SSOSession> = new Map();

  constructor(
    userStore: IUserStore,
    roleStore: IRoleStore,
    config: SSOServiceConfig
  ) {
    this.config = {
      sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
      enableJITProvisioning: true,
      enableSessions: true,
      ...config,
    };

    this.userStore = userStore;
    this.roleStore = roleStore;

    // Initialize services
    this.userProvisioner = new UserProvisioner(userStore);
    this.scimProvisioner = new SCIMProvisioner(this.userProvisioner);
    this.rbacManager = new RBACManager(roleStore);
  }

  /**
   * Register SSO configuration
   */
  registerSSOConfig(config: SSOConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Get SSO configuration
   */
  getSSOConfig(configId: string): SSOConfig | null {
    return this.configs.get(configId) || null;
  }

  /**
   * List all SSO configurations
   */
  listSSOConfigs(): SSOConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Remove SSO configuration
   */
  removeSSOConfig(configId: string): void {
    this.configs.delete(configId);
  }

  // ============================================================================
  // ISSOService IMPLEMENTATION
  // ============================================================================

  /**
   * Initiate SSO authentication
   */
  async initiateAuth(
    ssoConfigId: string,
    redirectUri: string
  ): Promise<SAMLAuthRequest | OAuthAuthRequest> {
    const config = this.getSSOConfig(ssoConfigId);
    if (!config) {
      throw new Error(`SSO configuration not found: ${ssoConfigId}`);
    }

    if (!config.enabled) {
      throw new Error(`SSO configuration is disabled: ${ssoConfigId}`);
    }

    switch (config.protocol) {
      case SSOProtocol.SAML: {
        const samlProvider = new SAMLServiceProvider(config);
        return samlProvider.generateAuthRequest();
      }

      case SSOProtocol.OAUTH2:
      case SSOProtocol.OIDC: {
        const oauthProvider = new OAuthProvider(config);
        return oauthProvider.generateAuthRequest(redirectUri);
      }

      default:
        throw new Error(`Unsupported protocol: ${config.protocol}`);
    }
  }

  /**
   * Handle authentication response from IdP
   */
  async handleAuthResponse(
    response: SAMLAuthResponse | OAuthAuthResponse
  ): Promise<SAMLAuthResult | OAuthAuthResult> {
    const config = this.getSSOConfig(response.ssoConfigId);
    if (!config) {
      throw new Error(`SSO configuration not found: ${response.ssoConfigId}`);
    }

    let authResult: SAMLAuthResult | OAuthAuthResult;

    switch (config.protocol) {
      case SSOProtocol.SAML: {
        const samlProvider = new SAMLServiceProvider(config);
        authResult = await samlProvider.validateAuthResponse(
          response as SAMLAuthResponse
        );
        break;
      }

      case SSOProtocol.OAUTH2:
      case SSOProtocol.OIDC: {
        const oauthProvider = new OAuthProvider(config);
        authResult = await oauthProvider.validateAuthResponse(
          response as OAuthAuthResponse,
          this.config.baseUrl + "/auth/callback"
        );
        break;
      }

      default:
        throw new Error(`Unsupported protocol: ${config.protocol}`);
    }

    if (authResult.success && authResult.user) {
      // Provision user
      const user = await this.provisionUser(
        authResult.user,
        ProvisioningAction.CREATE
      );

      // Create session
      if (this.config.enableSessions) {
        const session = await this.createSession(
          user.id,
          response.ssoConfigId,
          (authResult as any).accessToken,
          (authResult as any).idToken,
          (authResult as any).refreshToken,
          (authResult as any).expiresAt
        );

        // Attach session to result
        (authResult as any).sessionId = session.sessionId;
      }

      // Update user in result
      authResult.user = user;
    }

    return authResult;
  }

  /**
   * Validate JWT token
   */
  async validateJWT(
    token: string,
    options: JWTValidationOptions
  ): Promise<JWTValidationResult> {
    const validator = new JWTValidator(options);
    return validator.validate(token);
  }

  /**
   * Get user session
   */
  async getSession(sessionId: string): Promise<SSOSession | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt && session.expiresAt < new Date()) {
      session.status = SessionStatus.EXPIRED;
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.status = SessionStatus.REVOKED;
    this.sessions.set(sessionId, session);

    return true;
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string,
    ssoConfigId: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const config = this.getSSOConfig(ssoConfigId);
    if (!config) {
      throw new Error(`SSO configuration not found: ${ssoConfigId}`);
    }

    if (
      config.protocol !== SSOProtocol.OAUTH2 &&
      config.protocol !== SSOProtocol.OIDC
    ) {
      throw new Error("Token refresh is only supported for OAuth/OIDC");
    }

    const oauthProvider = new OAuthProvider(config);
    return oauthProvider.refreshToken(refreshToken);
  }

  /**
   * Provision user from IdP
   */
  async provisionUser(
    user: SSOUser,
    action: ProvisioningAction
  ): Promise<SSOUser> {
    if (this.config.enableJITProvisioning) {
      return this.userProvisioner.provisionUser(user, action);
    }

    // If JIT provisioning is disabled, just return the user as-is
    return user;
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<SSOUser | null> {
    return this.userStore.getUser(userId);
  }

  /**
   * Update user roles
   */
  async updateUserRoles(
    userId: string,
    roles: string[]
  ): Promise<SSOUser> {
    const user = await this.userStore.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return this.userStore.updateUser(userId, { roles });
  }

  /**
   * Check user permission
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await this.userStore.getUser(userId);
    if (!user) {
      return false;
    }

    return this.rbacManager.checkPermission(user, resource, action);
  }

  // ============================================================================
  // ADDITIONAL METHODS
  // ============================================================================

  /**
   * Create session
   */
  private async createSession(
    userId: string,
    ssoConfigId: string,
    accessToken?: string,
    idToken?: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<SSOSession> {
    const now = new Date();
    const sessionDuration = this.config.sessionDuration!;

    const session: SSOSession = {
      sessionId: randomUUID(),
      userId,
      ssoConfigId,
      accessToken,
      idToken,
      refreshToken,
      expiresAt: expiresAt || new Date(now.getTime() + sessionDuration),
      createdAt: now,
      lastActivityAt: now,
      status: SessionStatus.ACTIVE,
    };

    this.sessions.set(session.sessionId, session);

    // Clean up expired sessions
    this.cleanupSessions();

    return session;
  }

  /**
   * Clean up expired sessions
   */
  private cleanupSessions(): void {
    const now = new Date();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt && session.expiresAt < now) {
        session.status = SessionStatus.EXPIRED;
        this.sessions.set(sessionId, session);
      }
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SSOSession[]> {
    const sessions: SSOSession[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        session.status = SessionStatus.REVOKED;
        this.sessions.set(sessionId, session);
      }
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filter?: {
    provider?: IdentityProvider;
    action?: ProvisioningAction;
    userId?: string;
  }) {
    return this.userProvisioner.getAuditLog(filter);
  }

  /**
   * Get RBAC manager
   */
  getRBACManager(): RBACManager {
    return this.rbacManager;
  }

  /**
   * Get SCIM provisioner
   */
  getSCIMProvisioner(): SCIMProvisioner {
    return this.scimProvisioner;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export * from "./saml/SAMLServiceProvider.js";
export * from "./oauth/OAuthProvider.js";
export * from "./jwt/JWTValidator.js";
export * from "./provisioning/UserProvisioner.js";
export * from "./rbac/RoleManager.js";
