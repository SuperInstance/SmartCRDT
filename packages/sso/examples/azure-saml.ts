/**
 * Azure AD SAML Integration Example
 *
 * This example demonstrates how to integrate Azure AD SAML with Aequor SSO.
 */

import {
  SSOService,
  InMemoryUserStore,
  InMemoryRoleStore,
  SAMLServiceProvider,
  SAMLMetadataParser,
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
  sessionDuration: 24 * 60 * 60 * 1000,
  enableJITProvisioning: true,
  enableSessions: true,
});

// Register Azure AD SAML configuration
const azureSAMLConfig: SSOConfig = {
  id: "azure-ad-saml",
  protocol: SSOProtocol.SAML,
  provider: IdentityProvider.AZURE_AD,
  enabled: true,
  displayName: "Azure AD SAML SSO",
  providerConfig: {
    type: SSOProtocol.SAML,
    // Azure AD IdP details
    entityId: "https://sts.windows.net/your-tenant-id/",
    ssoUrl: "https://login.microsoftonline.com/your-tenant-id/saml2",
    sloUrl: "https://login.microsoftonline.com/your-tenant-id/saml2",
    // Azure AD X.509 certificate (from Azure AD metadata)
    idpCertificate: `-----BEGIN CERTIFICATE-----
MIIC8DCCAdigAwIBAgIQUF9v7K... (your Azure AD certificate)
-----END CERTIFICATE-----`,
    // Our Service Provider details
    spEntityId: "https://yourapp.com/saml/metadata",
    acsUrl: "https://yourapp.com/saml/acs",
    slsUrl: "https://yourapp.com/saml/sls",
    // SAML settings
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    signatureAlgorithm: "RSA-SHA256",
    digestAlgorithm: "SHA256",
    wantAssertionsEncrypted: false,
    // Map Azure AD claims to our user attributes
    attributeMapping: {
      email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      username: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      firstName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
      lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
      displayName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
      objectId: "http://schemas.microsoft.com/identity/claims/objectidentifier",
    },
    roleAttribute: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    groupsAttribute: "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
  },
};

ssoService.registerSSOConfig(azureSAMLConfig);

// Example: Fetch Azure AD metadata
async function fetchAzureADMetadata() {
  try {
    const metadataUrl =
      "https://login.microsoftonline.com/your-tenant-id/federationmetadata/2007-06/federationmetadata.xml";

    const metadata = await SAMLMetadataParser.fetchMetadata(metadataUrl);

    console.log("Azure AD Metadata:");
    console.log("  Entity ID:", metadata.entityId);
    console.log("  SSO URL:", metadata.ssoUrl);
    console.log("  SLO URL:", metadata.sloUrl);
    console.log("  Certificate:", metadata.certificate.substring(0, 50) + "...");

    return metadata;
  } catch (error) {
    console.error("Failed to fetch Azure AD metadata:", error);
    throw error;
  }
}

// Example: Initiate SAML authentication
async function initiateAzureSAMLLogin() {
  try {
    const authRequest = await ssoService.initiateAuth(
      "azure-ad-saml",
      "https://yourapp.com/saml/acs"
    );

    console.log("SAML Auth Request:");
    console.log("  SSO URL:", authRequest.idpUrl);
    console.log("  SAML Request:", authRequest.samlRequest.substring(0, 50) + "...");
    console.log("  Relay State:", authRequest.relayState);

    // In a real application, POST SAML request to IdP
    return authRequest;
  } catch (error) {
    console.error("Failed to initiate Azure SAML login:", error);
    throw error;
  }
}

// Example: Validate SAML response
async function validateSAMLResponse(samlResponse: string) {
  try {
    const authResult = await ssoService.handleAuthResponse({
      ssoConfigId: "azure-ad-saml",
      samlResponse,
    });

    if (authResult.success && authResult.user) {
      console.log("SAML Authentication successful!");
      console.log("User:", authResult.user.email);
      console.log("Name ID:", authResult.user.attributes.objectId);
      console.log("Roles:", authResult.user.roles);
      console.log("Groups:", authResult.user.groups);

      return authResult;
    } else {
      console.error("SAML Authentication failed:", authResult.error);
      throw authResult.error;
    }
  } catch (error) {
    console.error("Failed to validate SAML response:", error);
    throw error;
  }
}

// Example: Generate SAML logout request
async function initiateSAMLLogout(sessionId: string) {
  try {
    const samlProvider = new SAMLServiceProvider(azureSAMLConfig);
    const logoutRequest = samlProvider.generateLogoutRequest(sessionId);

    console.log("SAML Logout Request:");
    console.log("  SLO URL:", azureSAMLConfig.providerConfig.sloUrl);
    console.log("  Logout Request:", logoutRequest.substring(0, 50) + "...");

    return logoutRequest;
  } catch (error) {
    console.error("Failed to initiate SAML logout:", error);
    throw error;
  }
}

// Example: Validate Azure AD configuration
async function validateAzureConfig() {
  try {
    const samlProvider = new SAMLServiceProvider(azureSAMLConfig);
    const validation = samlProvider.validateConfig();

    console.log("Azure AD SAML Configuration Validation:");
    console.log("  Valid:", validation.valid);
    console.log("  Errors:", validation.errors);
    console.log("  Warnings:", validation.warnings);

    return validation;
  } catch (error) {
    console.error("Failed to validate Azure config:", error);
    throw error;
  }
}

// Export for use in Express.js (example)
export function setupAzureSAMLRoutes(app: any) {
  // Login route - initiate SAML SSO
  app.get("/auth/login/azure", async (req, res) => {
    try {
      const authRequest = await initiateAzureSAMLLogin();

      // Render SAML POST form
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting to Azure AD...</title>
        </head>
        <body onload="document.forms[0].submit()">
          <form method="post" action="${authRequest.idpUrl}">
            <input type="hidden" name="SAMLRequest" value="${authRequest.samlRequest}" />
            ${authRequest.relayState ? `<input type="hidden" name="RelayState" value="${authRequest.relayState}" />` : ""}
          </form>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate SAML login" });
    }
  });

  // SAML ACS (Assertion Consumer Service) endpoint
  app.post("/saml/acs", async (req, res) => {
    try {
      const { SAMLResponse, RelayState } = req.body;

      const authResult = await validateSAMLResponse(SAMLResponse);

      if (authResult.success && authResult.sessionId) {
        res.cookie("sessionId", authResult.sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
        });
        res.redirect("/dashboard");
      } else {
        res.redirect("/login?error=saml_failed");
      }
    } catch (error) {
      res.redirect("/login?error=acs_failed");
    }
  });

  // SAML SLS (Single Logout Service) endpoint
  app.post("/saml/sls", async (req, res) => {
    const { SAMLResponse } = req.body;

    // Process SAML logout response
    // ...

    res.clearCookie("sessionId");
    res.redirect("/login");
  });

  // SAML metadata endpoint (for Azure AD to discover our SP)
  app.get("/saml/metadata", (req, res) => {
    const config = azureSAMLConfig.providerConfig;
    const metadata = `
      <?xml version="1.0"?>
      <md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                          entityID="${config.spEntityId}">
        <md:SPSSODescriptor AuthnRequestsSigned="false"
                           WantAssertionsSigned="true"
                           protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
          <md:NameIDFormat>${config.nameIdFormat}</md:NameIDFormat>
          <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                       Location="${config.acsUrl}"
                                       index="1" />
          ${config.slsUrl ? `<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                                        Location="${config.slsUrl}" />` : ""}
        </md:SPSSODescriptor>
      </md:EntityDescriptor>
    `;

    res.set("Content-Type", "application/xml");
    res.send(metadata);
  });
}

// Run examples
async function main() {
  console.log("=== Azure AD SAML Integration Example ===\n");

  // Fetch and display metadata
  console.log("1. Fetching Azure AD metadata...");
  await fetchAzureADMetadata();

  // Validate configuration
  console.log("\n2. Validating Azure AD configuration...");
  await validateAzureConfig();

  // Initiate SAML login
  console.log("\n3. Initiating SAML authentication...");
  await initiateAzureSAMLLogin();

  console.log("\n4. User would authenticate at Azure AD...");
  console.log("   Then be redirected back with SAML response");

  // Validate SAML response (example)
  // await validateSAMLResponse(samlResponseString);

  // SAML logout
  // await initiateSAMLLogout(sessionId);
}

// Uncomment to run examples
// main().catch(console.error);
