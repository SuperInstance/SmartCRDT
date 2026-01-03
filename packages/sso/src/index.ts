/**
 * @lsi/sso - Enterprise SSO Integration
 *
 * Enterprise single sign-on integration for Aequor Cognitive Orchestration Platform.
 * Supporting SAML 2.0, OAuth 2.0/OIDC, JWT validation, and user provisioning.
 *
 * @example
 * ```typescript
 * import { SSOService, InMemoryUserStore, InMemoryRoleStore } from '@lsi/sso';
 *
 * const userStore = new InMemoryUserStore();
 * const roleStore = new InMemoryRoleStore();
 * const ssoService = new SSOService(userStore, roleStore, {
 *   baseUrl: 'https://yourapp.com',
 * });
 *
 * // Register SSO configuration
 * ssoService.registerSSOConfig({
 *   id: 'okta',
 *   protocol: SSOProtocol.OIDC,
 *   provider: IdentityProvider.OKTA,
 *   enabled: true,
 *   displayName: 'Okta SSO',
 *   organizationId: 'your-org',
 *   providerConfig: {
 *     type: SSOProtocol.OIDC,
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     authorizationEndpoint: 'https://your-org.okta.com/oauth2/v1/authorize',
 *     tokenEndpoint: 'https://your-org.okta.com/oauth2/v1/token',
 *     userInfoEndpoint: 'https://your-org.okta.com/oauth2/v1/userinfo',
 *     jwksEndpoint: 'https://your-org.okta.com/oauth2/v1/keys',
 *     redirectUri: 'https://yourapp.com/auth/callback',
 *     scopes: ['openid', 'profile', 'email'],
 *     attributeMapping: {},
 *   },
 * });
 *
 * // Initiate authentication
 * const authRequest = await ssoService.initiateAuth('okta', redirectUri);
 * ```
 */

// Main SSO service
export {
  SSOService,
  SSOServiceConfig,
} from "./SSOService.js";

// SAML 2.0
export {
  SAMLServiceProvider,
  SAMLMetadataParser,
} from "./saml/SAMLServiceProvider.js";

// OAuth 2.0 / OIDC
export {
  OAuthProvider,
  OIDCDiscovery,
} from "./oauth/OAuthProvider.js";

// JWT validation
export {
  JWTValidator,
  createJWTMiddleware,
} from "./jwt/JWTValidator.js";

// User provisioning
export {
  UserProvisioner,
  SCIMProvisioner,
  InMemoryUserStore,
  type IUserStore,
} from "./provisioning/UserProvisioner.js";

// RBAC
export {
  RBACManager,
  InMemoryRoleStore,
  createAuthorizationMiddleware,
  type IRoleStore,
} from "./rbac/RoleManager.js";

// Re-export protocol types
export {
  SSOProtocol,
  IdentityProvider,
  SSOConfig,
  ProviderConfig,
  SAMLProviderConfig,
  OAuthProviderConfig,
  LDAPProviderConfig,
  SSOUser,
  SSOSession,
  SessionStatus,
  SAMLAuthRequest,
  SAMLAuthResponse,
  SAMLAuthResult,
  SAMLAuthError,
  OAuthAuthRequest,
  OAuthAuthResponse,
  OAuthAuthResult,
  OAuthAuthError,
  JWTHeader,
  JWTPayload,
  JWTValidationOptions,
  JWTValidationResult,
  JWTValidationError,
  ProvisioningAction,
  UserProvisioningEvent,
  SCIMResourceType,
  SCIMUser,
  SystemRole,
  Permission,
  Role,
  ISSOService,
  SAMLConfigValidationResult,
  OAuthConfigValidationResult,
  IdPMetadataResponse,
  OIDCDiscoveryResponse,
} from "@lsi/protocol";
