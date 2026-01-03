/**
 * @lsi/protocol - SSO (Single Sign-On) Protocol Types
 *
 * Enterprise SSO integration types for Aequor Cognitive Orchestration Platform
 * Supporting SAML 2.0, OAuth 2.0/OIDC, JWT validation, and user provisioning
 */

// ============================================================================
// SSO PROVIDER TYPES
// ============================================================================

/**
 * Supported SSO protocol types
 */
export enum SSOProtocol {
  /** SAML 2.0 - Security Assertion Markup Language */
  SAML = "saml",
  /** OAuth 2.0 - Authorization Framework */
  OAUTH2 = "oauth2",
  /** OpenID Connect - Authentication layer on OAuth 2.0 */
  OIDC = "oidc",
  /** LDAP - Lightweight Directory Access Protocol */
  LDAP = "ldap",
}

/**
 * Supported identity providers
 */
export enum IdentityProvider {
  /** Okta SSO/OIDC */
  OKTA = "okta",
  /** Auth0 universal authentication */
  AUTH0 = "auth0",
  /** Microsoft Azure Active Directory */
  AZURE_AD = "azure_ad",
  /** Google Workspace / Google Cloud Identity */
  GOOGLE = "google",
  /** OneLogin */
  ONELOGIN = "onelogin",
  /** Ping Identity */
  PING = "ping",
  /** Shibboleth */
  SHIBBOLETH = "shibboleth",
  /** Generic SAML 2.0 provider */
  GENERIC_SAML = "generic_saml",
  /** Generic OAuth 2.0 provider */
  GENERIC_OAUTH = "generic_oauth",
}

/**
 * SSO configuration for a specific provider
 */
export interface SSOConfig {
  /** Unique identifier for this SSO configuration */
  id: string;
  /** Protocol type */
  protocol: SSOProtocol;
  /** Identity provider */
  provider: IdentityProvider;
  /** Whether this SSO config is enabled */
  enabled: boolean;
  /** Display name for this SSO integration */
  displayName: string;
  /** Organization/tenant ID (for multi-tenant providers) */
  organizationId?: string;
  /** Additional provider-specific configuration */
  providerConfig: ProviderConfig;
}

/**
 * Provider-specific configuration
 */
export type ProviderConfig =
  | SAMLProviderConfig
  | OAuthProviderConfig
  | LDAPProviderConfig;

/**
 * SAML provider configuration
 */
export interface SAMLProviderConfig {
  /** SAML-specific settings */
  type: SSOProtocol.SAML;
  /** IdP Entity ID (issuer) */
  entityId: string;
  /** IdP SSO URL (login endpoint) */
  ssoUrl: string;
  /** IdP SLO URL (logout endpoint) */
  sloUrl?: string;
  /** IdP X.509 certificate (for signature verification) */
  idpCertificate: string;
  /** SP Entity ID (our service provider) */
  spEntityId: string;
  /** SP Assertion Consumer Service (ACS) URL */
  acsUrl: string;
  /** SP Single Logout Service (SLS) URL */
  slsUrl?: string;
  /** Name ID format (default: urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified) */
  nameIdFormat?: string;
  /** Signature algorithm (default: RSA-SHA256) */
  signatureAlgorithm?: "RSA-SHA1" | "RSA-SHA256" | "RSA-SHA512";
  /** Digest algorithm (default: SHA256) */
  digestAlgorithm?: "SHA1" | "SHA256" | "SHA512";
  /** Whether to encrypt assertions */
  wantAssertionsEncrypted?: boolean;
  /** Our SP private key (for decryption) */
  spPrivateKey?: string;
  /** Our SP certificate (for encryption) */
  spCertificate?: string;
  /** Attribute mapping (IdP attributes -> our user attributes) */
  attributeMapping: Record<string, string>;
  /** Role attribute name */
  roleAttribute?: string;
  /** Groups attribute name */
  groupsAttribute?: string;
}

/**
 * OAuth/OIDC provider configuration
 */
export interface OAuthProviderConfig {
  /** OAuth-specific settings */
  type: SSOProtocol.OAUTH2 | SSOProtocol.OIDC;
  /** Client ID from provider */
  clientId: string;
  /** Client secret from provider */
  clientSecret: string;
  /** Authorization endpoint URL */
  authorizationEndpoint: string;
  /** Token endpoint URL */
  tokenEndpoint: string;
  /** UserInfo endpoint URL (OIDC) */
  userInfoEndpoint?: string;
  /** JWKS endpoint URL (for JWT verification) */
  jwksEndpoint?: string;
  /** Issuer URL (OIDC discovery) */
  issuer?: string;
  /** Redirect/callback URL after authentication */
  redirectUri: string;
  /** Scopes to request */
  scopes: string[];
  /** Response type (default: code) */
  responseType?: "code" | "token" | "id_token";
  /** Grant type (default: authorization_code) */
  grantType?: "authorization_code" | "client_credentials" | "implicit";
  /** Token endpoint authentication method */
  tokenEndpointAuth?: "client_secret_post" | "client_secret_basic" | "none";
  /** Whether to use PKCE (Proof Key for Code Exchange) */
  usePKCE?: boolean;
  /** Attribute mapping (provider claims -> our user attributes) */
  attributeMapping: Record<string, string>;
  /** Role claim name */
  roleClaim?: string;
  /** Groups claim name */
  groupsClaim?: string;
}

/**
 * LDAP provider configuration
 */
export interface LDAPProviderConfig {
  /** LDAP-specific settings */
  type: SSOProtocol.LDAP;
  /** LDAP server URL */
  url: string;
  /** LDAP port (default: 389 for LDAP, 636 for LDAPS) */
  port?: number;
  /** Whether to use LDAPS (LDAP over SSL) */
  useSSL?: boolean;
  /** Whether to use StartTLS */
  useStartTLS?: boolean;
  /** Bind DN for authentication */
  bindDN?: string;
  /** Bind credentials */
  bindCredentials?: string;
  /** Search base DN */
  searchBase: string;
  /** Search filter (e.g., '(uid={{username}})') */
  searchFilter: string;
  /** User attributes to retrieve */
  attributes?: string[];
  /** Admin group DN (for role-based access) */
  adminGroupDN?: string;
  /** Group search base */
  groupSearchBase?: string;
  /** Group search filter */
  groupSearchFilter?: string;
  /** Connection timeout (ms) */
  timeout?: number;
}

// ============================================================================
// USER AND SESSION TYPES
// ============================================================================

/**
 * User information from SSO
 */
export interface SSOUser {
  /** Unique user identifier */
  id: string;
  /** Username */
  username: string;
  /** Email address */
  email: string;
  /** Display name */
  displayName?: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** User roles */
  roles: string[];
  /** User groups */
  groups: string[];
  /** Additional attributes */
  attributes: Record<string, unknown>;
  /** Identity provider used */
  provider: IdentityProvider;
  /** SSO protocol used */
  protocol: SSOProtocol;
  /** When this user was created */
  createdAt: Date;
  /** Last login time */
  lastLoginAt: Date;
}

/**
 * Session information
 */
export interface SSOSession {
  /** Unique session identifier */
  sessionId: string;
  /** User ID */
  userId: string;
  /** SSO configuration ID used */
  ssoConfigId: string;
  /** Access token (OAuth/OIDC) */
  accessToken?: string;
  /** ID token (OIDC) */
  idToken?: string;
  /** Refresh token (if available) */
  refreshToken?: string;
  /** Token expiration time */
  expiresAt?: Date;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
  /** Session status */
  status: SessionStatus;
}

/**
 * Session status
 */
export enum SessionStatus {
  /** Session is active */
  ACTIVE = "active",
  /** Session has been revoked */
  REVOKED = "revoked",
  /** Session has expired */
  EXPIRED = "expired",
}

// ============================================================================
// AUTHENTICATION FLOW TYPES
// ============================================================================

/**
 * SAML authentication request
 */
export interface SAMLAuthRequest {
  /** SSO configuration ID */
  ssoConfigId: string;
  /** SAML auth request XML (base64 encoded) */
  samlRequest: string;
  /** Relay state (optional state parameter) */
  relayState?: string;
  /** IdP SSO URL to redirect to */
  idpUrl: string;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * SAML authentication response (after IdP redirect)
 */
export interface SAMLAuthResponse {
  /** SSO configuration ID */
  ssoConfigId: string;
  /** SAML response XML (base64 encoded) */
  samlResponse: string;
  /** Relay state (if provided) */
  relayState?: string;
  /** Authentication result (after validation) */
  result?: SAMLAuthResult;
}

/**
 * SAML authentication result
 */
export interface SAMLAuthResult {
  /** Success status */
  success: boolean;
  /** Authenticated user */
  user?: SSOUser;
  /** Error if failed */
  error?: SAMLAuthError;
}

/**
 * SAML authentication error
 */
export interface SAMLAuthError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Detailed error description */
  details?: string;
}

/**
 * OAuth authorization request
 */
export interface OAuthAuthRequest {
  /** SSO configuration ID */
  ssoConfigId: string;
  /** Authorization URL to redirect to */
  authorizationUrl: string;
  /** State parameter (CSRF protection) */
  state: string;
  /** Code verifier (PKCE) */
  codeVerifier?: string;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * OAuth authorization response (after provider redirect)
 */
export interface OAuthAuthResponse {
  /** SSO configuration ID */
  ssoConfigId: string;
  /** Authorization code */
  code: string;
  /** State parameter */
  state: string;
  /** Authentication result (after token exchange) */
  result?: OAuthAuthResult;
}

/**
 * OAuth authentication result
 */
export interface OAuthAuthResult {
  /** Success status */
  success: boolean;
  /** Authenticated user */
  user?: SSOUser;
  /** Access token */
  accessToken?: string;
  /** ID token (OIDC) */
  idToken?: string;
  /** Refresh token */
  refreshToken?: string;
  /** Token expiration time */
  expiresAt?: Date;
  /** Error if failed */
  error?: OAuthAuthError;
}

/**
 * OAuth authentication error
 */
export interface OAuthAuthError {
  /** Error code (RFC 6749) */
  code:
    | "invalid_request"
    | "unauthorized_client"
    | "access_denied"
    | "unsupported_response_type"
    | "invalid_scope"
    | "server_error"
    | "temporarily_unavailable";
  /** Error description */
  description?: string;
  /** Error URI */
  uri?: string;
}

// ============================================================================
// JWT VALIDATION TYPES
// ============================================================================

/**
 * JWT header
 */
export interface JWTHeader {
  /** Algorithm (e.g., RS256) */
  alg: string;
  /** Key type */
  typ?: string;
  /** Content type */
  cty?: string;
  /** Key ID (for key lookup) */
  kid?: string;
}

/**
 * JWT payload (claims)
 */
export interface JWTPayload {
  /** Issuer */
  iss: string;
  /** Subject (user ID) */
  sub: string;
  /** Audience */
  aud: string | string[];
  /** Expiration time */
  exp: number;
  /** Not before */
  nbf?: number;
  /** Issued at */
  iat: number;
  /** JWT ID */
  jti?: string;
  /** Additional claims */
  [key: string]: unknown;
}

/**
 * Validation options for JWT
 */
export interface JWTValidationOptions {
  /** Expected issuer */
  issuer: string;
  /** Expected audience */
  audience: string | string[];
  /** Clock skew tolerance (seconds, default: 60) */
  clockSkew?: number;
  /** Maximum token age (seconds, optional) */
  maxAge?: number;
  /** Required claims */
  requiredClaims?: string[];
  /** JWKS endpoint URL */
  jwksUrl?: string;
  /** Trusted public keys (map from kid to PEM) */
  publicKeys?: Record<string, string>;
  /** Allowed algorithms */
  algorithms?: string[];
}

/**
 * JWT validation result
 */
export interface JWTValidationResult {
  /** Validation success */
  valid: boolean;
  /** Decoded header */
  header?: JWTHeader;
  /** Decoded payload */
  payload?: JWTPayload;
  /** Error if validation failed */
  error?: JWTValidationError;
}

/**
 * JWT validation error
 */
export interface JWTValidationError {
  /** Error code */
  code:
    | "invalid_token"
    | "expired"
    | "not_yet_valid"
    | "invalid_signature"
    | "invalid_issuer"
    | "invalid_audience"
    | "missing_claim"
    | "invalid_algorithm";
  /** Error message */
  message: string;
}

// ============================================================================
// USER PROVISIONING TYPES
// ============================================================================

/**
 * Provisioning action
 */
export enum ProvisioningAction {
  /** Create new user */
  CREATE = "create",
  /** Update existing user */
  UPDATE = "update",
  /** Deactivate user */
  DEACTIVATE = "deactivate",
  /** Delete user */
  DELETE = "delete",
}

/**
 * User provisioning event
 */
export interface UserProvisioningEvent {
  /** Event ID */
  eventId: string;
  /** Provisioning action */
  action: ProvisioningAction;
  /** User affected */
  user: SSOUser;
  /** Source of the event */
  source: IdentityProvider;
  /** Event timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * SCIM (System for Cross-domain Identity Management) resource types
 */
export enum SCIMResourceType {
  /** User resource */
  USER = "User",
  /** Group resource */
  GROUP = "Group",
  /** Service provider config */
  SERVICE_PROVIDER_CONFIG = "ServiceProviderConfig",
  /** Resource type */
  RESOURCE_TYPE = "ResourceType",
  /** Schema */
  SCHEMA = "Schema",
}

/**
 * SCIM user resource
 */
export interface SCIMUser {
  /** Resource URI */
  schemas: string[];
  /** Unique identifier */
  id: string;
  /** External ID (from IdP) */
  externalId?: string;
  /** Username */
  userName: string;
  /** Display name */
  displayName?: string;
  /** Name components */
  name?: {
    givenName?: string;
    familyName?: string;
    middleName?: string;
    honorificPrefix?: string;
    honorificSuffix?: string;
  };
  /** Email addresses */
  emails?: Array<{
    value: string;
    type?: "work" | "home" | "other";
    primary?: boolean;
  }>;
  /** Phone numbers */
  phoneNumbers?: Array<{
    value: string;
    type?: "work" | "mobile" | "home" | "other";
    primary?: boolean;
  }>;
  /** User groups */
  groups?: Array<{
    value: string;
    display?: string;
    type?: "direct" | "indirect";
  }>;
  /** Roles */
  roles?: Array<{
    value: string;
    display?: string;
  }>;
  /** Active status */
  active?: boolean;
  /** Locale/language */
  locale?: string;
  /** Timezone */
  timezone?: string;
  /** User type */
  userType?: string;
  /** Title */
  title?: string;
  /** Department */
  department?: string;
  /** Manager */
  manager?: {
    value: string;
    displayName?: string;
  };
  /** Meta information */
  meta?: {
    resourceType: SCIMResourceType;
    location?: string;
    created?: string;
    lastModified?: string;
    version?: string;
  };
}

// ============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================================================

/**
 * System roles
 */
export enum SystemRole {
  /** System administrator */
  ADMIN = "admin",
  /** User manager */
  USER_MANAGER = "user_manager",
  /** Regular user */
  USER = "user",
  /** Guest (limited access) */
  GUEST = "guest",
  /** Service account */
  SERVICE_ACCOUNT = "service_account",
}

/**
 * Permission
 */
export interface Permission {
  /** Resource type */
  resource: string;
  /** Action */
  action: string;
  /** Effect */
  effect: "allow" | "deny";
}

/**
 * Role definition
 */
export interface Role {
  /** Role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Display name */
  displayName: string;
  /** Description */
  description?: string;
  /** Role permissions */
  permissions: Permission[];
  /** Is system role */
  isSystem?: boolean;
  /** Parent role (for inheritance) */
  parentRole?: string;
}

// ============================================================================
// SSO SERVICE INTERFACE
// ============================================================================

/**
 * SSO service interface
 * Main interface for all SSO operations
 */
export interface ISSOService {
  /**
   * Initialize SSO authentication request
   * @param ssoConfigId - SSO configuration ID
   * @param redirectUri - URI to redirect after authentication
   * @returns Authentication request (SAML or OAuth)
   */
  initiateAuth(
    ssoConfigId: string,
    redirectUri: string
  ): Promise<SAMLAuthRequest | OAuthAuthRequest>;

  /**
   * Handle authentication response from IdP
   * @param response - Authentication response from IdP
   * @returns Authenticated user or error
   */
  handleAuthResponse(
    response: SAMLAuthResponse | OAuthAuthResponse
  ): Promise<SAMLAuthResult | OAuthAuthResult>;

  /**
   * Validate JWT token
   * @param token - JWT token string
   * @param options - Validation options
   * @returns Validation result
   */
  validateJWT(
    token: string,
    options: JWTValidationOptions
  ): Promise<JWTValidationResult>;

  /**
   * Get user session
   * @param sessionId - Session ID
   * @returns Session information
   */
  getSession(sessionId: string): Promise<SSOSession | null>;

  /**
   * Revoke session
   * @param sessionId - Session ID
   * @returns Success status
   */
  revokeSession(sessionId: string): Promise<boolean>;

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   * @param ssoConfigId - SSO configuration ID
   * @returns New token pair
   */
  refreshToken(
    refreshToken: string,
    ssoConfigId: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>;

  /**
   * Provision user from IdP
   * @param user - User from IdP
   * @param action - Provisioning action
   * @returns Provisioned user
   */
  provisionUser(
    user: SSOUser,
    action: ProvisioningAction
  ): Promise<SSOUser>;

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User information
   */
  getUser(userId: string): Promise<SSOUser | null>;

  /**
   * Update user roles
   * @param userId - User ID
   * @param roles - New roles
   * @returns Updated user
   */
  updateUserRoles(userId: string, roles: string[]): Promise<SSOUser>;

  /**
   * Check user permission
   * @param userId - User ID
   * @param resource - Resource to check
   * @param action - Action to check
   * @returns Permission status
   */
  checkPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean>;
}

// ============================================================================
// SSO CONFIGURATION VALIDATION
// ============================================================================

/**
 * SAML configuration validation result
 */
export interface SAMLConfigValidationResult {
  /** Valid status */
  valid: boolean;
  /** Errors found */
  errors: string[];
  /** Warnings found */
  warnings: string[];
}

/**
 * OAuth configuration validation result
 */
export interface OAuthConfigValidationResult {
  /** Valid status */
  valid: boolean;
  /** Can connect to provider */
  canConnect?: boolean;
  /** Errors found */
  errors: string[];
  /** Warnings found */
  warnings: string[];
}

/**
 * Metadata URL response (for IdP metadata)
 */
export interface IdPMetadataResponse {
  /** Entity ID */
  entityId: string;
  /** SSO URL */
  ssoUrl: string;
  /** SLO URL */
  sloUrl?: string;
  /** X.509 certificate */
  certificate: string;
  /** Supported name ID formats */
  nameIdFormats?: string[];
}

/**
 * OIDC discovery response
 */
export interface OIDCDiscoveryResponse {
  /** Issuer URL */
  issuer: string;
  /** Authorization endpoint */
  authorization_endpoint: string;
  /** Token endpoint */
  token_endpoint: string;
  /** JWKS endpoint */
  jwks_uri: string;
  /** UserInfo endpoint */
  userinfo_endpoint?: string;
  /** Registration endpoint */
  registration_endpoint?: string;
  /** Supported scopes */
  scopes_supported?: string[];
  /** Supported response types */
  response_types_supported?: string[];
  /** Supported grant types */
  grant_types_supported?: string[];
  /** Supported token endpoint auth methods */
  token_endpoint_auth_methods_supported?: string[];
  /** Supported algorithms */
  id_token_signing_alg_values_supported?: string[];
}
