/**
 * Faisal Ride - Role Assignment Service
 * Simplified role assignment for carpooling application
 */

import { assignRoleToUser, canAssignRole, removeRoleFromUser } from './roles.service';

import ApiError from '../errors/ApiError';
import { IUserDoc } from '../user/user.interfaces';
import Role from './role.model';
import User from '../user/user.model';
import httpStatus from 'http-status';

/**
 * Validate and assign role to user with authorization checks
 */
export const validateAndAssignRole = async (
  assigner: IUserDoc,
  assigneeUserId: string,
  roleId: string,
  notes?: string
): Promise<void> => {
  // Get assignee user
  const assignee = await User.findById(assigneeUserId);
  if (!assignee) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User to assign role to not found');
  }
  
  // Check if assigner can assign role to this user type
  if (!canAssignRole(assigner.userType, assignee.userType)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `You do not have permission to assign roles to users of type: ${assignee.userType}`
    );
  }
  
  // Check if the role being assigned has manageRoles permission
  const role = await Role.findById(roleId);
  if (role && role.permissions.includes('manageRoles')) {
    // Only admins can assign roles with manageRoles permission
    if (assigner.userType !== 'admin') {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Only admins can assign roles with "manageRoles" permission'
      );
    }
    // Only admin users can receive roles with manageRoles permission
    if (assignee.userType !== 'admin') {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Roles with "manageRoles" permission can only be assigned to admin users'
      );
    }
  }
  
  // Assign the role
  await assignRoleToUser(assigneeUserId, roleId, assigner.id, notes);
};

/**
 * Validate and remove role from user with authorization checks
 */
export const validateAndRemoveRole = async (
  remover: IUserDoc,
  assigneeUserId: string
): Promise<void> => {
  // Get assignee user
  const assignee = await User.findById(assigneeUserId);
  if (!assignee) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Check if remover can remove role from this user type
  if (!canAssignRole(remover.userType, assignee.userType)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `You do not have permission to remove roles from users of type: ${assignee.userType}`
    );
  }
  
  // Remove the role
  await removeRoleFromUser(assigneeUserId, remover.id);
};
