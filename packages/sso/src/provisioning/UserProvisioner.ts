/**
 * User Provisioning Service
 *
 * Handles automatic user provisioning and synchronization from SSO providers.
 * Supports:
 * - Just-in-time (JIT) provisioning
 * - SCIM 2.0 protocol
 * - User attribute mapping
 * - Role and group synchronization
 * - User deactivation/deletion
 * - Audit logging
 */

import { randomUUID } from "uuid";
import {
  SSOUser,
  ProvisioningAction,
  UserProvisioningEvent,
  SCIMUser,
  IdentityProvider,
  SSOProtocol,
} from "@lsi/protocol";

// ============================================================================
// USER STORE INTERFACE
// ============================================================================

export interface IUserStore {
  /**
   * Get user by ID
   */
  getUser(userId: string): Promise<SSOUser | null>;

  /**
   * Get user by external ID (from IdP)
   */
  getUserByExternalId(
    provider: IdentityProvider,
    externalId: string
  ): Promise<SSOUser | null>;

  /**
   * Get user by email
   */
  getUserByEmail(email: string): Promise<SSOUser | null>;

  /**
   * Create user
   */
  createUser(user: SSOUser): Promise<SSOUser>;

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<SSOUser>): Promise<SSOUser>;

  /**
   * Deactivate user
   */
  deactivateUser(userId: string): Promise<void>;

  /**
   * Delete user
   */
  deleteUser(userId: string): Promise<void>;

  /**
   * List users
   */
  listUsers(filter?: {
    provider?: IdentityProvider;
    active?: boolean;
    role?: string;
  }): Promise<SSOUser[]>;
}

// ============================================================================
// USER PROVISIONER CLASS
// ============================================================================

export class UserProvisioner {
  private userStore: IUserStore;
  private auditLog: AuditLogEntry[] = [];

  constructor(userStore: IUserStore) {
    this.userStore = userStore;
  }

  /**
   * Provision user from SSO (JIT provisioning)
   */
  async provisionUser(
    ssoUser: SSOUser,
    action: ProvisioningAction = ProvisioningAction.CREATE
  ): Promise<SSOUser> {
    const existingUser = await this.findExistingUser(ssoUser);

    switch (action) {
      case ProvisioningAction.CREATE:
        if (existingUser) {
          // User already exists, update instead
          return this.updateUser(existingUser.id, ssoUser);
        }
        return this.createUser(ssoUser);

      case ProvisioningAction.UPDATE:
        if (!existingUser) {
          // User doesn't exist, create instead
          return this.createUser(ssoUser);
        }
        return this.updateUser(existingUser.id, ssoUser);

      case ProvisioningAction.DEACTIVATE:
        if (existingUser) {
          await this.deactivateUser(existingUser.id);
        }
        return existingUser || ssoUser;

      case ProvisioningAction.DELETE:
        if (existingUser) {
          await this.deleteUser(existingUser.id);
        }
        return ssoUser;

      default:
        throw new Error(`Invalid provisioning action: ${action}`);
    }
  }

  /**
   * Find existing user by external ID, email, or username
   */
  private async findExistingUser(
    ssoUser: SSOUser
  ): Promise<SSOUser | null> {
    // Try by external ID first (most reliable)
    if (ssoUser.attributes.externalId) {
      const user = await this.userStore.getUserByExternalId(
        ssoUser.provider,
        ssoUser.attributes.externalId as string
      );
      if (user) return user;
    }

    // Try by email
    if (ssoUser.email) {
      const user = await this.userStore.getUserByEmail(ssoUser.email);
      if (user) return user;
    }

    // Try by username
    if (ssoUser.username) {
      const users = await this.userStore.listUsers();
      const user = users.find((u) => u.username === ssoUser.username);
      if (user) return user;
    }

    return null;
  }

  /**
   * Create new user
   */
  private async createUser(ssoUser: SSOUser): Promise<SSOUser> {
    // Generate internal ID
    const user: SSOUser = {
      ...ssoUser,
      id: randomUUID(),
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    const createdUser = await this.userStore.createUser(user);

    // Log event
    this.logProvisioningEvent({
      eventId: randomUUID(),
      action: ProvisioningAction.CREATE,
      user: createdUser,
      source: ssoUser.provider,
      timestamp: new Date(),
      metadata: {
        method: "jit_provisioning",
      },
    });

    return createdUser;
  }

  /**
   * Update existing user
   */
  private async updateUser(
    userId: string,
    ssoUser: SSOUser
  ): Promise<SSOUser> {
    const updates: Partial<SSOUser> = {
      email: ssoUser.email,
      displayName: ssoUser.displayName,
      firstName: ssoUser.firstName,
      lastName: ssoUser.lastName,
      roles: ssoUser.roles,
      groups: ssoUser.groups,
      attributes: { ...ssoUser.attributes },
      lastLoginAt: new Date(),
    };

    const updatedUser = await this.userStore.updateUser(userId, updates);

    // Log event
    this.logProvisioningEvent({
      eventId: randomUUID(),
      action: ProvisioningAction.UPDATE,
      user: updatedUser,
      source: ssoUser.provider,
      timestamp: new Date(),
      metadata: {
        method: "jit_provisioning",
        updates: Object.keys(updates),
      },
    });

    return updatedUser;
  }

  /**
   * Deactivate user
   */
  private async deactivateUser(userId: string): Promise<void> {
    await this.userStore.deactivateUser(userId);

    // Log event
    this.logProvisioningEvent({
      eventId: randomUUID(),
      action: ProvisioningAction.DEACTIVATE,
      user: { id: userId } as any,
      source: IdentityProvider.GENERIC_OAUTH,
      timestamp: new Date(),
      metadata: {},
    });
  }

  /**
   * Delete user
   */
  private async deleteUser(userId: string): Promise<void> {
    await this.userStore.deleteUser(userId);

    // Log event
    this.logProvisioningEvent({
      eventId: randomUUID(),
      action: ProvisioningAction.DELETE,
      user: { id: userId } as any,
      source: IdentityProvider.GENERIC_OAUTH,
      timestamp: new Date(),
      metadata: {},
    });
  }

  /**
   * Log provisioning event
   */
  private logProvisioningEvent(event: UserProvisioningEvent): void {
    this.auditLog.push(event);

    // Keep only last 1000 events
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filter?: {
    provider?: IdentityProvider;
    action?: ProvisioningAction;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditLogEntry[] {
    let log = this.auditLog;

    if (filter) {
      if (filter.provider) {
        log = log.filter((e) => e.source === filter.provider);
      }
      if (filter.action) {
        log = log.filter((e) => e.action === filter.action);
      }
      if (filter.userId) {
        log = log.filter((e) => e.user.id === filter.userId);
      }
      if (filter.startDate) {
        log = log.filter((e) => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        log = log.filter((e) => e.timestamp <= filter.endDate!);
      }
    }

    return log;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

// ============================================================================
// SCIM 2.0 PROVISIONING
// ============================================================================

export class SCIMProvisioner {
  private userProvisioner: UserProvisioner;

  constructor(userProvisioner: UserProvisioner) {
    this.userProvisioner = userProvisioner;
  }

  /**
   * Handle SCIM user creation
   */
  async handleSCIMUserCreate(
    scimUser: SCIMUser,
    provider: IdentityProvider
  ): Promise<SSOUser> {
    const ssoUser = this.mapSCIMToSSOUser(scimUser, provider);
    return this.userProvisioner.provisionUser(ssoUser, ProvisioningAction.CREATE);
  }

  /**
   * Handle SCIM user update
   */
  async handleSCIMUserUpdate(
    scimUser: SCIMUser,
    provider: IdentityProvider
  ): Promise<SSOUser> {
    const ssoUser = this.mapSCIMToSSOUser(scimUser, provider);
    return this.userProvisioner.provisionUser(ssoUser, ProvisioningAction.UPDATE);
  }

  /**
   * Handle SCIM user deactivation
   */
  async handleSCIMUserDeactivate(
    scimUser: SCIMUser,
    provider: IdentityProvider
  ): Promise<void> {
    const ssoUser = this.mapSCIMToSSOUser(scimUser, provider);
    await this.userProvisioner.provisionUser(ssoUser, ProvisioningAction.DEACTIVATE);
  }

  /**
   * Handle SCIM user deletion
   */
  async handleSCIMUserDelete(
    scimUser: SCIMUser,
    provider: IdentityProvider
  ): Promise<void> {
    const ssoUser = this.mapSCIMToSSOUser(scimUser, provider);
    await this.userProvisioner.provisionUser(ssoUser, ProvisioningAction.DELETE);
  }

  /**
   * Map SCIM user to SSO user
   */
  private mapSCIMToSSOUser(
    scimUser: SCIMUser,
    provider: IdentityProvider
  ): SSOUser {
    const primaryEmail = scimUser.emails?.find((e) => e.primary) || scimUser.emails?.[0];

    return {
      id: scimUser.id,
      username: scimUser.userName,
      email: primaryEmail?.value || "",
      displayName: scimUser.displayName,
      firstName: scimUser.name?.givenName,
      lastName: scimUser.name?.familyName,
      roles: scimUser.roles?.map((r) => r.value) || [],
      groups: scimUser.groups?.map((g) => g.value) || [],
      attributes: {
        externalId: scimUser.externalId,
        phoneNumbers: scimUser.phoneNumbers,
        locale: scimUser.locale,
        timezone: scimUser.timezone,
        userType: scimUser.userType,
        title: scimUser.title,
        department: scimUser.department,
        manager: scimUser.manager,
        active: scimUser.active,
      },
      provider,
      protocol: SSOProtocol.OAUTH2, // SCIM typically used with OAuth
      createdAt: scimUser.meta?.created
        ? new Date(scimUser.meta.created)
        : new Date(),
      lastLoginAt: scimUser.meta?.lastModified
        ? new Date(scimUser.meta.lastModified)
        : new Date(),
    };
  }

  /**
   * Map SSO user to SCIM user
   */
  mapSSOUserToSCIM(ssoUser: SSOUser): SCIMUser {
    return {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: ssoUser.id,
      externalId: ssoUser.attributes.externalId as string,
      userName: ssoUser.username,
      displayName: ssoUser.displayName,
      name: {
        givenName: ssoUser.firstName,
        familyName: ssoUser.lastName,
      },
      emails: [
        {
          value: ssoUser.email,
          type: "work",
          primary: true,
        },
      ],
      groups: ssoUser.groups.map((g) => ({
        value: g,
        type: "direct",
      })),
      roles: ssoUser.roles.map((r) => ({
        value: r,
      })),
      active: true,
      locale: ssoUser.attributes.locale as string,
      timezone: ssoUser.attributes.timezone as string,
      meta: {
        resourceType: "User",
        created: ssoUser.createdAt.toISOString(),
        lastModified: ssoUser.lastLoginAt.toISOString(),
      },
    };
  }
}

// ============================================================================
// IN-MEMORY USER STORE (FOR TESTING/DEMO)
// ============================================================================

export class InMemoryUserStore implements IUserStore {
  private users: Map<string, SSOUser> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private externalIdIndex: Map<string, string> = new Map();

  async getUser(userId: string): Promise<SSOUser | null> {
    return this.users.get(userId) || null;
  }

  async getUserByExternalId(
    provider: IdentityProvider,
    externalId: string
  ): Promise<SSOUser | null> {
    const key = `${provider}:${externalId}`;
    const userId = this.externalIdIndex.get(key);
    if (userId) {
      return this.users.get(userId) || null;
    }
    return null;
  }

  async getUserByEmail(email: string): Promise<SSOUser | null> {
    const userId = this.emailIndex.get(email);
    if (userId) {
      return this.users.get(userId) || null;
    }
    return null;
  }

  async createUser(user: SSOUser): Promise<SSOUser> {
    this.users.set(user.id, user);

    if (user.email) {
      this.emailIndex.set(user.email, user.id);
    }

    const externalId = user.attributes.externalId as string;
    if (externalId) {
      this.externalIdIndex.set(`${user.provider}:${externalId}`, user.id);
    }

    return user;
  }

  async updateUser(
    userId: string,
    updates: Partial<SSOUser>
  ): Promise<SSOUser> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);

    return updatedUser;
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Mark as inactive
    this.users.set(userId, {
      ...user,
      attributes: { ...user.attributes, active: false },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    this.users.delete(userId);

    if (user.email) {
      this.emailIndex.delete(user.email);
    }

    const externalId = user.attributes.externalId as string;
    if (externalId) {
      this.externalIdIndex.delete(`${user.provider}:${externalId}`);
    }
  }

  async listUsers(filter?: {
    provider?: IdentityProvider;
    active?: boolean;
    role?: string;
  }): Promise<SSOUser[]> {
    let users = Array.from(this.users.values());

    if (filter) {
      if (filter.provider) {
        users = users.filter((u) => u.provider === filter.provider);
      }
      if (filter.active !== undefined) {
        users = users.filter(
          (u) => (u.attributes.active as boolean) === filter.active
        );
      }
      if (filter.role) {
        users = users.filter((u) => u.roles.includes(filter.role!));
      }
    }

    return users;
  }
}

// ============================================================================
// AUDIT LOG ENTRY
// ============================================================================

interface AuditLogEntry extends UserProvisioningEvent {}
