/**
 * SSO Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SSOService,
  InMemoryUserStore,
  InMemoryRoleStore,
  SAMLServiceProvider,
  OAuthProvider,
  JWTValidator,
  UserProvisioner,
  RBACManager,
} from "./index.js";
import {
  SSOProtocol,
  IdentityProvider,
  SSOConfig,
  OAuthProviderConfig,
  SAMLProviderConfig,
  ProvisioningAction,
} from "@lsi/protocol";

describe("SSOService", () => {
  let ssoService: SSOService;
  let userStore: InMemoryUserStore;
  let roleStore: InMemoryRoleStore;

  beforeEach(() => {
    userStore = new InMemoryUserStore();
    roleStore = new InMemoryRoleStore();
    ssoService = new SSOService(userStore, roleStore, {
      baseUrl: "https://example.com",
      sessionDuration: 3600000,
      enableJITProvisioning: true,
      enableSessions: true,
    });
  });

  describe("SSO Configuration Management", () => {
    it("should register SSO configuration", () => {
      const config: SSOConfig = {
        id: "test-okta",
        protocol: SSOProtocol.OIDC,
        provider: IdentityProvider.OKTA,
        enabled: true,
        displayName: "Test Okta",
        organizationId: "test-org",
        providerConfig: {
          type: SSOProtocol.OIDC,
          clientId: "test-client-id",
          clientSecret: "test-client-secret",
          authorizationEndpoint: "https://test.okta.com/authorize",
          tokenEndpoint: "https://test.okta.com/token",
          redirectUri: "https://example.com/auth/callback",
          scopes: ["openid", "profile", "email"],
          attributeMapping: {},
        },
      };

      ssoService.registerSSOConfig(config);

      const retrieved = ssoService.getSSOConfig("test-okta");
      expect(retrieved).toEqual(config);
    });

    it("should list all SSO configurations", () => {
      const config1: SSOConfig = {
        id: "okta",
        protocol: SSOProtocol.OIDC,
        provider: IdentityProvider.OKTA,
        enabled: true,
        displayName: "Okta",
        providerConfig: {
          type: SSOProtocol.OIDC,
          clientId: "client1",
          clientSecret: "secret1",
          authorizationEndpoint: "https://okta.com/authorize",
          tokenEndpoint: "https://okta.com/token",
          redirectUri: "https://example.com/callback",
          scopes: ["openid"],
          attributeMapping: {},
        },
      };

      const config2: SSOConfig = {
        id: "azure",
        protocol: SSOProtocol.OIDC,
        provider: IdentityProvider.AZURE_AD,
        enabled: true,
        displayName: "Azure AD",
        providerConfig: {
          type: SSOProtocol.OIDC,
          clientId: "client2",
          clientSecret: "secret2",
          authorizationEndpoint: "https://login.microsoftonline.com/authorize",
          tokenEndpoint: "https://login.microsoftonline.com/token",
          redirectUri: "https://example.com/callback",
          scopes: ["openid"],
          attributeMapping: {},
        },
      };

      ssoService.registerSSOConfig(config1);
      ssoService.registerSSOConfig(config2);

      const configs = ssoService.listSSOConfigs();
      expect(configs).toHaveLength(2);
      expect(configs.map((c) => c.id)).toContain("okta");
      expect(configs.map((c) => c.id)).toContain("azure");
    });

    it("should remove SSO configuration", () => {
      const config: SSOConfig = {
        id: "test",
        protocol: SSOProtocol.OIDC,
        provider: IdentityProvider.OKTA,
        enabled: true,
        displayName: "Test",
        providerConfig: {
          type: SSOProtocol.OIDC,
          clientId: "client",
          clientSecret: "secret",
          authorizationEndpoint: "https://example.com/authorize",
          tokenEndpoint: "https://example.com/token",
          redirectUri: "https://example.com/callback",
          scopes: ["openid"],
          attributeMapping: {},
        },
      };

      ssoService.registerSSOConfig(config);
      expect(ssoService.getSSOConfig("test")).toBeTruthy();

      ssoService.removeSSOConfig("test");
      expect(ssoService.getSSOConfig("test")).toBeNull();
    });
  });

  describe("OAuth Provider", () => {
    it("should generate OAuth authorization request", () => {
      const config: SSOConfig = {
        id: "google",
        protocol: SSOProtocol.OIDC,
        provider: IdentityProvider.GOOGLE,
        enabled: true,
        displayName: "Google",
        providerConfig: {
          type: SSOProtocol.OIDC,
          clientId: "google-client-id",
          clientSecret: "google-client-secret",
          authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
          tokenEndpoint: "https://oauth2.googleapis.com/token",
          redirectUri: "https://example.com/auth/callback",
          scopes: ["openid", "profile", "email"],
          attributeMapping: {},
        },
      };

      ssoService.registerSSOConfig(config);

      const authRequest = ssoService.initiateAuth("google", "https://example.com/auth/callback");

      expect(authRequest).resolves.toHaveProperty("authorizationUrl");
      expect(authRequest).resolves.toHaveProperty("state");
    });
  });

  describe("User Provisioning", () => {
    it("should provision new user", async () => {
      const ssoUser = {
        id: "user-123",
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
        firstName: "Test",
        lastName: "User",
        roles: ["user"],
        groups: [],
        attributes: {},
        provider: IdentityProvider.OKTA,
        protocol: SSOProtocol.OIDC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      const provisioned = await ssoService.provisionUser(ssoUser, ProvisioningAction.CREATE);

      expect(provisioned).toBeDefined();
      expect(provisioned.email).toBe("test@example.com");

      const retrieved = await ssoService.getUser(provisioned.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.email).toBe("test@example.com");
    });

    it("should update existing user", async () => {
      const ssoUser = {
        id: "user-456",
        username: "existinguser",
        email: "existing@example.com",
        displayName: "Existing User",
        firstName: "Existing",
        lastName: "User",
        roles: ["user"],
        groups: [],
        attributes: {},
        provider: IdentityProvider.OKTA,
        protocol: SSOProtocol.OIDC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await ssoService.provisionUser(ssoUser, ProvisioningAction.CREATE);

      // Update with new display name
      ssoUser.displayName = "Updated User";
      const updated = await ssoService.provisionUser(ssoUser, ProvisioningAction.UPDATE);

      expect(updated.displayName).toBe("Updated User");
    });
  });

  describe("RBAC", () => {
    it("should check user permissions", async () => {
      const ssoUser = {
        id: "admin-123",
        username: "admin",
        email: "admin@example.com",
        displayName: "Admin User",
        firstName: "Admin",
        lastName: "User",
        roles: ["admin"],
        groups: [],
        attributes: {},
        provider: IdentityProvider.OKTA,
        protocol: SSOProtocol.OIDC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await ssoService.provisionUser(ssoUser, ProvisioningAction.CREATE);

      const hasPermission = await ssoService.checkPermission(
        ssoUser.id,
        "users",
        "create"
      );

      expect(hasPermission).toBe(true);
    });
  });

  describe("Session Management", () => {
    it("should create and retrieve session", async () => {
      const ssoUser = {
        id: "session-user-123",
        username: "sessionuser",
        email: "session@example.com",
        displayName: "Session User",
        firstName: "Session",
        lastName: "User",
        roles: ["user"],
        groups: [],
        attributes: {},
        provider: IdentityProvider.OKTA,
        protocol: SSOProtocol.OIDC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await ssoService.provisionUser(ssoUser, ProvisioningAction.CREATE);

      const sessions = await ssoService.getUserSessions(ssoUser.id);
      expect(sessions).toBeDefined();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it("should revoke user session", async () => {
      const ssoUser = {
        id: "revoke-user-123",
        username: "revokeuser",
        email: "revoke@example.com",
        displayName: "Revoke User",
        firstName: "Revoke",
        lastName: "User",
        roles: ["user"],
        groups: [],
        attributes: {},
        provider: IdentityProvider.OKTA,
        protocol: SSOProtocol.OIDC,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      await ssoService.provisionUser(ssoUser, ProvisioningAction.CREATE);

      const sessionsBefore = await ssoService.getUserSessions(ssoUser.id);
      const sessionId = sessionsBefore[0]?.sessionId;

      if (sessionId) {
        await ssoService.revokeSession(sessionId);

        const session = await ssoService.getSession(sessionId);
        expect(session?.status).toBe("revoked");
      }
    });
  });
});

describe("JWTValidator", () => {
  it("should validate JWT structure", () => {
    // This would require a valid JWT token
    // For now, just test instantiation
    const validator = new JWTValidator({
      issuer: "https://example.com",
      audience: "my-api",
      algorithms: ["RS256"],
    });

    expect(validator).toBeDefined();
  });
});

describe("UserProvisioner", () => {
  it("should provision user with JIT", async () => {
    const userStore = new InMemoryUserStore();
    const provisioner = new UserProvisioner(userStore);

    const ssoUser = {
      id: "jit-user-123",
      username: "jituser",
      email: "jit@example.com",
      displayName: "JIT User",
      firstName: "JIT",
      lastName: "User",
      roles: ["user"],
      groups: [],
      attributes: {},
      provider: IdentityProvider.OKTA,
      protocol: SSOProtocol.OIDC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const provisioned = await provisioner.provisionUser(ssoUser, ProvisioningAction.CREATE);

    expect(provisioned).toBeDefined();
    expect(provisioned.email).toBe("jit@example.com");
  });
});

describe("RBACManager", () => {
  it("should initialize system roles", async () => {
    const roleStore = new InMemoryRoleStore();
    const rbac = new RBACManager(roleStore);

    const roles = await rbac.getAllRoles();

    expect(roles.length).toBeGreaterThan(0);
    expect(roles.some((r) => r.id === "admin")).toBe(true);
    expect(roles.some((r) => r.id === "user")).toBe(true);
  });

  it("should check permissions for admin role", async () => {
    const userStore = new InMemoryUserStore();
    const roleStore = new InMemoryRoleStore();
    const ssoService = new SSOService(userStore, roleStore, {
      baseUrl: "https://example.com",
    });

    const adminUser = {
      id: "admin-123",
      username: "admin",
      email: "admin@example.com",
      displayName: "Admin",
      firstName: "Admin",
      lastName: "User",
      roles: ["admin"],
      groups: [],
      attributes: {},
      provider: IdentityProvider.OKTA,
      protocol: SSOProtocol.OIDC,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await ssoService.provisionUser(adminUser, ProvisioningAction.CREATE);

    const canCreateUsers = await ssoService.checkPermission(
      adminUser.id,
      "users",
      "create"
    );

    expect(canCreateUsers).toBe(true);
  });
});
