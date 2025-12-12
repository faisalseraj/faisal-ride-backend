import { IRoleDoc, IUserRoleAssignmentDoc, NewCreatedRole, ROLE_ASSIGNMENT_RULES } from './role.interfaces';
import { IRoleResponse, IRoleUpdate } from './roles.interfaces';

import ApiError from '../errors/ApiError';
import Role from './role.model';
import User from '../user/user.model';
import UserRoleAssignment from './user-role-assignment.model';
import httpStatus from 'http-status';
import { refreshRoleCache } from './role-permissions-cache';

/**
 * Get all roles with their permissions from database
 */
export const getAllRoles = async (): Promise<IRoleResponse[]> => {
  const roles = await Role.find({ isActive: true }).sort({ name: 1 });
  return roles.map((role) => ({
    name: role.name,
    permissions: role.permissions,
    ...(role.description && { description: role.description }),
  }));
};

/**
 * Get a specific role by name from database
 */
export const getRoleByName = async (roleName: string): Promise<IRoleResponse | null> => {
  const role = await Role.findOne({ name: roleName.toLowerCase(), isActive: true });
  if (!role) {
    // Fallback to roles.ts if not found in database (for backward compatibility during migration)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rolesConfig = require('../../config/roles');
    const { roleRights, roles: roleNames } = rolesConfig;
    if (roleNames.includes(roleName)) {
      const permissions = roleRights.get(roleName) || [];
      return {
        name: roleName,
        permissions,
        description: getRoleDescription(roleName),
      };
    }
    throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
  }
  
  return {
    name: role.name,
    permissions: role.permissions,
    description: role.description || '',
  };
};

/**
 * Helper function to get role description (for fallback)
 */
const getRoleDescription = (roleName: string): string => {
  const descriptions: Record<string, string> = {
    admin: 'Administrator with full system access',
    superadmin: 'Super administrator with elevated privileges',
    'apartment-complex-owner': 'Owner of an apartment complex',
    'apartment-complex-manager': 'Manager of an apartment complex',
    'apartment-complex-employee': 'Employee of an apartment complex',
    'tow-company-owner': 'Owner of a tow company',
    'tow-company-manager': 'Manager of a tow company',
    'tow-company-employee': 'Employee of a tow company',
    'parking-spaces-provider-owner': 'Owner of a parking spaces provider',
    'parking-spaces-provider-manager': 'Manager of a parking spaces provider',
    'parking-spaces-provider-employee': 'Employee of a parking spaces provider',
    'tow-requester': 'User who can request tow services',
    renter: 'Renter of an apartment',
    customer: 'General customer',
  };
  
  return descriptions[roleName] || `Role: ${roleName}`;
};

/**
 * Get role by ID
 */
export const getRoleById = async (roleId: string): Promise<IRoleDoc | null> => {
  return Role.findById(roleId);
};

/**
 * Create a new role
 */
export const createRole = async (roleBody: NewCreatedRole): Promise<IRoleDoc> => {
  if (await Role.findOne({ name: roleBody.name.toLowerCase() })) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Role with this name already exists');
  }
  
  // Validate that manageRoles permission can only be in admin role
  if (roleBody.permissions?.includes('manageRoles') && roleBody.name.toLowerCase() !== 'admin') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'The "manageRoles" permission can only be assigned to the admin role'
    );
  }
  
  const role = await Role.create({ ...roleBody, name: roleBody.name.toLowerCase() });
  
  // Update cache with new role
  await refreshRoleCache(role.name);
  
  return role;
};

/**
 * Update role permissions in database
 */
export const updateRole = async (roleName: string, updateBody: IRoleUpdate): Promise<IRoleResponse> => {
  const role = await Role.findOne({ name: roleName.toLowerCase(), isActive: true });
  if (!role) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
  }
  
  // Validate that manageRoles permission can only be in admin role
  if (updateBody.permissions?.includes('manageRoles') && roleName.toLowerCase() !== 'admin') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'The "manageRoles" permission can only be assigned to the admin role'
    );
  }
  
  // If removing manageRoles from admin role, prevent it
  if (roleName.toLowerCase() === 'admin' && updateBody.permissions && !updateBody.permissions.includes('manageRoles')) {
    // Check if admin role currently has manageRoles
    if (role.permissions.includes('manageRoles')) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Cannot remove "manageRoles" permission from admin role'
      );
    }
  }
  
  // Prevent modifying system roles (safety measure)
  if (role.isSystemRole && updateBody.permissions) {
    console.warn(`System role ${roleName} permissions are being modified`);
  }
  
  Object.assign(role, updateBody);
  await role.save();
  
  // Invalidate and refresh cache for this role
  await refreshRoleCache(role.name);
  
  return {
    name: role.name,
    permissions: role.permissions,
    description: role.description,
  } as IRoleResponse;
};

/**
 * Get all available permissions across all roles
 */
export const getAllPermissions = async (): Promise<string[]> => {
  const roles = await Role.find({ isActive: true });
  const permissionSet = new Set<string>();
  
  roles.forEach((role) => {
    role.permissions.forEach((permission) => permissionSet.add(permission));
  });
  
  return Array.from(permissionSet).sort();
};

/**
 * Get user's assigned role
 */
export const getUserRole = async (userId: string): Promise<IUserRoleAssignmentDoc | null> => {
  return UserRoleAssignment.findOne({ userId, isActive: true }).populate('roleId');
};

/**
 * Get user's permissions based on assigned role
 */
export const getUserPermissions = async (userId: string): Promise<string[]> => {
  const assignment = await UserRoleAssignment.findOne({ userId, isActive: true }).populate('roleId');
  if (!assignment || !assignment.roleId) {
    // Fallback to userType-based permissions if no role assigned
    const user = await User.findById(userId);
    if (!user) return [];
    // You might want to keep a fallback to the old roles.ts system here temporarily
    return [];
  }
  
  const role = assignment.roleId as IRoleDoc;
  return role.permissions || [];
};

/**
 * Check if assigner can assign role to assignee
 */
export const canAssignRole = (assignerUserType: string, assigneeUserType: string): boolean => {
  const rule = ROLE_ASSIGNMENT_RULES.find((r) => r.assignerUserType === assignerUserType);
  if (!rule) return false;
  return rule.assignableUserTypes.includes(assigneeUserType as any);
};

/**
 * Assign role to user
 */
export const assignRoleToUser = async (
  userId: string,
  roleId: string,
  assignedBy: string,
  notes?: string
): Promise<IUserRoleAssignmentDoc> => {
  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Check if role exists
  const role = await Role.findById(roleId);
  if (!role || !role.isActive) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Role not found or inactive');
  }
  
  // Prevent assigning roles with manageRoles permission to non-admin users
  if (role.permissions.includes('manageRoles') && user.userType !== 'admin') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Roles with "manageRoles" permission can only be assigned to admin users'
    );
  }
  
  // Prevent assigning admin role (or any role with manageRoles) to non-admin users
  if (role.name === 'admin' && user.userType !== 'admin') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Admin role can only be assigned to users with admin userType'
    );
  }
  
  // Deactivate any existing active role assignment
  await UserRoleAssignment.updateMany(
    { userId, isActive: true },
    { isActive: false }
  );
  
  // Create new role assignment
  const assignment = await UserRoleAssignment.create({
    userId,
    roleId,
    assignedBy,
    isActive: true,
    notes,
  });
  
  return assignment;
};

/**
 * Remove role from user (deactivate assignment)
 */
export const removeRoleFromUser = async (userId: string, _: string): Promise<void> => {
  const assignment = await UserRoleAssignment.findOne({ userId, isActive: true });
  if (!assignment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No active role assignment found for user');
  }
  
  assignment.isActive = false;
  await assignment.save();
};

/**
 * Get all users with a specific role
 */
export const getUsersByRole = async (roleId: string): Promise<IUserRoleAssignmentDoc[]> => {
  return UserRoleAssignment.find({ roleId, isActive: true }).populate('userId').populate('roleId');
};

/**
 * Get all role assignments for a user
 */
export const getUserRoleAssignments = async (userId: string): Promise<IUserRoleAssignmentDoc[]> => {
  return UserRoleAssignment.find({ userId }).populate('roleId').populate('assignedBy').sort({ assignedAt: -1 });
};

/**
 * Get APIs using a specific permission
 */
export const getApisByPermission = async (permission: string): Promise<Array<{ method: string; path: string; fullPath: string; routeFile: string }>> => {
  // Dynamic import to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { findApisByPermission } = require('./permission-scanner.service');
  
  return findApisByPermission(permission);
};

/**
 * Remove a specific permission from all roles
 */
export const removePermissionFromAllRoles = async (permission: string): Promise<{ removedFrom: number; roles: string[] }> => {
  // Prevent removing manageRoles permission
  if (permission === 'manageRoles') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot remove "manageRoles" permission as it is a system-critical permission'
    );
  }

  // Find all active roles that have this permission
  const roles = await Role.find({ isActive: true, permissions: permission });
  
  if (roles.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, `Permission "${permission}" not found in any active role`);
  }

  // Remove the permission from all roles
  const roleNames: string[] = [];
  for (const role of roles) {
    role.permissions = role.permissions.filter((p) => p !== permission);
    await role.save();
    roleNames.push(role.name);
    // Invalidate cache for this role
    await refreshRoleCache(role.name);
  }

  return {
    removedFrom: roles.length,
    roles: roleNames,
  };
};
