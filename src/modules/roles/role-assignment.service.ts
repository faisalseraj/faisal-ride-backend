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
  
  // Additional checks for tow-company-owner
  if (assigner.userType === 'tow-company-owner') {
    // Check if assignee belongs to the same tow company or is a PSP
    if (assignee.userType?.includes('tow-company') && assignee.towCompanyId?.toString() !== assigner.id) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only assign roles to users in your own tow company'
      );
    }
    
    // For PSP users, check if they're associated with this tow company
    if (assignee.userType?.includes('parking-spaces-provider')) {
      // Allow assignment - tow company owners can manage PSP users
    }
  }
  
  // Additional checks for apartment-complex-owner
  if (assigner.userType === 'apartment-complex-owner') {
    // Check if assignee belongs to the same apartment complex
    const assignerComplex = assigner.apartmentComplex;
    const assigneeComplex = assignee.apartmentComplex;
    
    if (assignerComplex && assigneeComplex && assignerComplex.toString() !== assigneeComplex.toString()) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only assign roles to users in your own apartment complex'
      );
    }
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
  
  // Additional checks for tow-company-owner
  if (remover.userType === 'tow-company-owner') {
    if (assignee.userType?.includes('tow-company') && assignee.towCompanyId?.toString() !== remover.id) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only remove roles from users in your own tow company'
      );
    }
  }
  
  // Additional checks for apartment-complex-owner
  if (remover.userType === 'apartment-complex-owner') {
    const removerComplex = remover.apartmentComplex;
    const assigneeComplex = assignee.apartmentComplex;
    
    if (removerComplex && assigneeComplex && removerComplex.toString() !== assigneeComplex.toString()) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only remove roles from users in your own apartment complex'
      );
    }
  }
  
  // Remove the role
  await removeRoleFromUser(assigneeUserId, remover.id);
};

