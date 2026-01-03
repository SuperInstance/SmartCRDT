/**
 * Okta OIDC Integration Example
 *
 * This example demonstrates how to integrate Okta OIDC with Aequor SSO.
 */

import {
  SSOService,
  InMemoryUserStore,
  InMemoryRoleStore,
} from "../src/index.js";
import {
  SSOProtocol,
  IdentityProvider,
  SSOConfig,
} from "@lsi/protocol";

// Initialize SSO service
const userStore = new InMemoryUserStore();
const roleStore = new InMemoryRoleStore();
const ssoService = new SSOService(userStore, roleStore, {
  baseUrl: "https://yourapp.com",
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  enableJITProvisioning: true,
  enableSessions: true,
});

// Register Okta OIDC configuration
const oktaConfig: SSOConfig = {
  id: "okta-production",
  protocol: SSOProtocol.OIDC,
  provider: IdentityProvider.OKTA,
  enabled: true,
  displayName: "Okta SSO",
  organizationId: "your-org-id",
  providerConfig: {
    type: SSOProtocol.OIDC,
    clientId: "0oaxxxxxxxxxxxxx", // Your Okta client ID
    clientSecret: "your-client-secret", // Your Okta client secret
    authorizationEndpoint: "https://your-org.okta.com/oauth2/v1/authorize",
    tokenEndpoint: "https://your-org.okta.com/oauth2/v1/token",
    userInfoEndpoint: "https://your-org.okta.com/oauth2/v1/userinfo",
    jwksEndpoint: "https://your-org.okta.com/oauth2/v1/keys",
    issuer: "https://your-org.okta.com",
    redirectUri: "https://yourapp.com/auth/callback/okta",
    scopes: ["openid", "profile", "email"],
    attributeMapping: {
      // Map Okta claims to our user attributes
      email: "email",
      username: "email", // Use email as username
      firstName: "given_name",
      lastName: "family_name",
      displayName: "name",
    },
    roleClaim: "groups", // Okta uses groups for roles
    groupsClaim: "groups",
  },
};

ssoService.registerSSOConfig(oktaConfig);

// Example: Initiate authentication
async function initiateOktaLogin() {
  try {
    const authRequest = await ssoService.initiateAuth(
      "okta-production",
      "https://yourapp.com/auth/callback/okta"
    );

    console.log("Redirect user to:", authRequest.authorizationUrl);
    console.log("State:", authRequest.state);

    // In a real application, redirect user to authRequest.authorizationUrl
    return authRequest;
  } catch (error) {
    console.error("Failed to initiate Okta login:", error);
    throw error;
  }
}

// Example: Handle authentication callback
async function handleOktaCallback(code: string, state: string) {
  try {
    const authResult = await ssoService.handleAuthResponse({
      ssoConfigId: "okta-production",
      code,
      state,
    });

    if (authResult.success && authResult.user) {
      console.log("Authentication successful!");
      console.log("User:", authResult.user.email);
      console.log("Roles:", authResult.user.roles);
      console.log("Groups:", authResult.user.groups);
      console.log("Session ID:", authResult.sessionId);

      // Set session cookie
      // res.cookie('sessionId', authResult.sessionId, {
      //   httpOnly: true,
      //   secure: true,
      //   sameSite: 'strict',
      //   maxAge: 24 * 60 * 60 * 1000, // 24 hours
      // });

      return authResult;
    } else {
      console.error("Authentication failed:", authResult.error);
      throw authResult.error;
    }
  } catch (error) {
    console.error("Failed to handle Okta callback:", error);
    throw error;
  }
}

// Example: Check user permission
async function checkUserPermission(userId: string) {
  const canCreateUsers = await ssoService.checkPermission(
    userId,
    "users",
    "create"
  );

  if (canCreateUsers) {
    console.log("User can create users");
  } else {
    console.log("User cannot create users");
  }
}

// Example: Get audit log
function getProvisioningAuditLog() {
  const auditLog = ssoService.getAuditLog({
    provider: IdentityProvider.OKTA,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  });

  console.log("Provisioning events:");
  auditLog.forEach((event) => {
    console.log(`- ${event.action}: ${event.user.email} at ${event.timestamp}`);
  });
}

// Example: Revoke user session
async function revokeUserSession(sessionId: string) {
  const revoked = await ssoService.revokeSession(sessionId);

  if (revoked) {
    console.log("Session revoked successfully");
  } else {
    console.log("Session not found");
  }
}

// Export for use in Express.js (example)
export function setupOktaRoutes(app: any) {
  // Login route
  app.get("/auth/login/okta", async (req, res) => {
    try {
      const authRequest = await initiateOktaLogin();
      res.redirect(authRequest.authorizationUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate login" });
    }
  });

  // Callback route
  app.get("/auth/callback/okta", async (req, res) => {
    try {
      const { code, state } = req.query;
      const authResult = await handleOktaCallback(code, state);

      if (authResult.success && authResult.sessionId) {
        res.cookie("sessionId", authResult.sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
        });
        res.redirect("/dashboard");
      } else {
        res.redirect("/login?error=auth_failed");
      }
    } catch (error) {
      res.redirect("/login?error=callback_failed");
    }
  });

  // Logout route
  app.post("/auth/logout", async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
      await revokeUserSession(sessionId);
      res.clearCookie("sessionId");
    }
    res.redirect("/login");
  });
}

// Run examples
async function main() {
  console.log("=== Okta OIDC Integration Example ===\n");

  // Initiate login
  console.log("1. Initiating Okta login...");
  await initiateOktaLogin();

  // Note: In a real scenario, user would be redirected to Okta,
  // authenticate, and be redirected back with code and state
  console.log("\n2. User would authenticate at Okta...");
  console.log("   Then be redirected back with code and state");

  // Check permissions (after authentication)
  // await checkUserPermission(userId);

  // Get audit log
  console.log("\n3. Getting provisioning audit log...");
  getProvisioningAuditLog();
}

// Uncomment to run examples
// main().catch(console.error);
