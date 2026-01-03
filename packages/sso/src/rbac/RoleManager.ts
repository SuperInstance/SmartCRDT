/**
 * Role-Based Access Control (RBAC) Manager
 *
 * Manages user roles, permissions, and access control.
 * Supports:
 * - Role definition and inheritance
 * - Permission checking
 * - Dynamic role assignment
 * - Attribute-based access control (ABAC) hybrid
 */

import {
  Role,
  Permission,
  SystemRole,
  SSOUser,
  SessionStatus,
} from "@lsi/protocol";

// ============================================================================
// ROLE STORE INTERFACE
// ============================================================================

export interface IRoleStore {
  /**
   * Get role by ID
   */
  getRole(roleId: string): Promise<Role | null>;

  /**
   * Get all roles
   */
  getAllRoles(): Promise<Role[]>;

  /**
   * Create role
   */
  createRole(role: Role): Promise<Role>;

  /**
   * Update role
   */
  updateRole(roleId: string, updates: Partial<Role>): Promise<Role>;

  /**
   * Delete role
   */
  deleteRole(roleId: string): Promise<void>;

  /**
   * Assign role to user
   */
  assignRoleToUser(userId: string, roleId: string): Promise<void>;

  /**
   * Revoke role from user
   */
  revokeRoleFromUser(userId: string, roleId: string): Promise<void>;

  /**
   * Get user roles
   */
  getUserRoles(userId: string): Promise<string[]>;
}

// ============================================================================
// RBAC MANAGER CLASS
// ============================================================================

export class RBACManager {
  private roleStore: IRoleStore;
  private systemRoles: Map<string, Role> = new Map();

  constructor(roleStore: IRoleStore) {
    this.roleStore = roleStore;
    this.initializeSystemRoles();
  }

  /**
   * Initialize system roles
   */
  private initializeSystemRoles(): void {
    const systemRoles: Role[] = [
      {
        id: SystemRole.ADMIN,
        name: SystemRole.ADMIN,
        displayName: "System Administrator",
        description: "Full system access",
        permissions: [
          { resource: "*", action: "*", effect: "allow" },
        ],
        isSystem: true,
      },
      {
        id: SystemRole.USER_MANAGER,
        name: SystemRole.USER_MANAGER,
        displayName: "User Manager",
        description: "Manage users and roles",
        permissions: [
          { resource: "users", action: "read", effect: "allow" },
          { resource: "users", action: "create", effect: "allow" },
          { resource: "users", action: "update", effect: "allow" },
          { resource: "users", action: "delete", effect: "allow" },
          { resource: "roles", action: "read", effect: "allow" },
          { resource: "roles", action: "update", effect: "allow" },
        ],
        isSystem: true,
      },
      {
        id: SystemRole.USER,
        name: SystemRole.USER,
        displayName: "User",
        description: "Regular user access",
        permissions: [
          { resource: "profile", action: "read", effect: "allow" },
          { resource: "profile", action: "update", effect: "allow" },
        ],
        isSystem: true,
      },
      {
        id: SystemRole.GUEST,
        name: SystemRole.GUEST,
        displayName: "Guest",
        description: "Limited guest access",
        permissions: [
          { resource: "public", action: "read", effect: "allow" },
        ],
        isSystem: true,
      },
      {
        id: SystemRole.SERVICE_ACCOUNT,
        name: SystemRole.SERVICE_ACCOUNT,
        displayName: "Service Account",
        description: "Machine-to-machine authentication",
        permissions: [
          { resource: "api", action: "access", effect: "allow" },
        ],
        isSystem: true,
      },
    ];

    for (const role of systemRoles) {
      this.systemRoles.set(role.id, role);
    }
  }

  /**
   * Check if user has permission
   */
  async checkPermission(
    user: SSOUser,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Get user roles
    const userRoles = await this.getUserEffectiveRoles(user);

    // Check permissions for each role
    for (const role of userRoles) {
      const hasPermission = this.roleHasPermission(role, resource, action);
      if (hasPermission === true) {
        return true; // Explicit allow
      }
      if (hasPermission === false) {
        return false; // Explicit deny
      }
    }

    // Default deny
    return false;
  }

  /**
   * Check if role has permission
   */
  private roleHasPermission(
    role: Role,
    resource: string,
    action: string
  ): boolean | null {
    for (const permission of role.permissions) {
      // Check if permission matches
      if (this.matchesPattern(permission.resource, resource) &&
          this.matchesPattern(permission.action, action)) {
        return permission.effect === "allow";
      }
    }

    // Check parent role
    if (role.parentRole) {
      const parentRole = this.systemRoles.get(role.parentRole);
      if (parentRole) {
        return this.roleHasPermission(parentRole, resource, action);
      }
    }

    return null; // No match
  }

  /**
   * Match resource/action against pattern
   */
  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern === "*") {
      return true;
    }

    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      return value.startsWith(prefix);
    }

    return pattern === value;
  }

  /**
   * Get user's effective roles (including inherited)
   */
  async getUserEffectiveRoles(user: SSOUser): Promise<Role[]> {
    const effectiveRoles: Role[] = [];

    for (const roleId of user.roles) {
      const role = await this.roleStore.getRole(roleId);
      if (role) {
        effectiveRoles.push(role);

        // Add parent roles
        let parentRole = role;
        while (parentRole.parentRole) {
          const parent = await this.roleStore.getRole(parentRole.parentRole);
          if (parent) {
            effectiveRoles.push(parent);
            parentRole = parent;
          } else {
            break;
          }
        }
      }
    }

    // Also check system roles
    for (const roleId of user.roles) {
      const systemRole = this.systemRoles.get(roleId);
      if (systemRole && !effectiveRoles.includes(systemRole)) {
        effectiveRoles.push(systemRole);

        // Add parent roles
        let parentRole = systemRole;
        while (parentRole.parentRole) {
          const parent = this.systemRoles.get(parentRole.parentRole);
          if (parent) {
            effectiveRoles.push(parent);
            parentRole = parent;
          } else {
            break;
          }
        }
      }
    }

    return effectiveRoles;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.roleStore.assignRoleToUser(userId, roleId);
  }

  /**
   * Revoke role from user
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    await this.roleStore.revokeRoleFromUser(userId, roleId);
  }

  /**
   * Create custom role
   */
  async createRole(role: Omit<Role, "id">): Promise<Role> {
    const roleId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newRole: Role = {
      ...role,
      id: roleId,
      isSystem: false,
    };

    return this.roleStore.createRole(newRole);
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    const existingRole = await this.roleStore.getRole(roleId);
    if (!existingRole) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (existingRole.isSystem) {
      throw new Error("Cannot modify system roles");
    }

    return this.roleStore.updateRole(roleId, updates);
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.roleStore.getRole(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (role.isSystem) {
      throw new Error("Cannot delete system roles");
    }

    await this.roleStore.deleteRole(roleId);
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    const customRoles = await this.roleStore.getAllRoles();
    return [...this.systemRoles.values(), ...customRoles];
  }

  /**
   * Get role
   */
  async getRole(roleId: string): Promise<Role | null> {
    // Check system roles first
    if (this.systemRoles.has(roleId)) {
      return this.systemRoles.get(roleId)!;
    }

    return this.roleStore.getRole(roleId);
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(user: SSOUser): Promise<Permission[]> {
    const roles = await this.getUserEffectiveRoles(user);
    const permissions: Permission[] = [];

    for (const role of roles) {
      permissions.push(...role.permissions);
    }

    return permissions;
  }
}

// ============================================================================
// IN-MEMORY ROLE STORE (FOR TESTING/DEMO)
// ============================================================================

export class InMemoryRoleStore implements IRoleStore {
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, Set<string>> = new Map();

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async getAllRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async createRole(role: Role): Promise<Role> {
    this.roles.set(role.id, role);
    return role;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const updatedRole = { ...role, ...updates };
    this.roles.set(roleId, updatedRole);

    return updatedRole;
  }

  async deleteRole(roleId: string): Promise<void> {
    this.roles.delete(roleId);

    // Remove role from all users
    for (const [userId, roles] of this.userRoles.entries()) {
      roles.delete(roleId);
    }
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }

    this.userRoles.get(userId)!.add(roleId);
  }

  async revokeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const roles = this.userRoles.get(userId);
    if (roles) {
      roles.delete(roleId);
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const roles = this.userRoles.get(userId);
    return roles ? Array.from(roles) : [];
  }
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create authorization middleware for Express/Fastify/etc.
 */
export function createAuthorizationMiddleware(
  rbacManager: RBACManager,
  resource: string,
  action: string
) {
  return async (
    req: any,
    res: any,
    next: (error?: Error) => void
  ) => {
    try {
      const user = req.user as SSOUser;

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const hasPermission = await rbacManager.checkPermission(
        user,
        resource,
        action
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: "Access denied",
          details: `User does not have permission to ${action} on ${resource}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        error: "Authorization check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
