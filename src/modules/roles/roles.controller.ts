import * as roleAssignmentService from './role-assignment.service';
import * as rolesService from './roles.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';
import { createSystemLog } from '../logs/enhanced-log-migration.service';
import httpStatus from 'http-status';

export const getAllRoles = catchAsync(async (_: Request, res: Response) => {
  const roles = await rolesService.getAllRoles();
  res.send(roles);
});

export const getRole = catchAsync(async (req: Request, res: Response) => {
  const role = await rolesService.getRoleByName(req.params['roleName']!);
  if (!role) {
    res.status(httpStatus.NOT_FOUND).send({ message: 'Role not found' });
    return;
  }
  res.send(role);
});

export const createRole = catchAsync(async (req: Request, res: Response) => {
  const role = await rolesService.createRole(req.body);
  
  await createSystemLog({
    user: req.user,
    event: 'Role Created',
    ipAddress: req.ip,
    customMetadata: {
      action: 'role_create',
      category: 'system',
      priority: 'high',
      roleName: role.name,
    },
  });
  
  res.status(httpStatus.CREATED).send(role);
});

export const updateRole = catchAsync(async (req: Request, res: Response) => {
  const role = await rolesService.updateRole(req.params['roleName']!, req.body);
  
  await createSystemLog({
    user: req.user,
    event: 'Role Updated',
    ipAddress: req.ip,
    customMetadata: {
      action: 'role_update',
      category: 'system',
      priority: 'high',
      roleName: role.name,
      updatedPermissions: role.permissions,
      updatedFields: Object.keys(req.body),
    },
  });
  
  res.send(role);
});

export const getAllPermissions = catchAsync(async (_: Request, res: Response) => {
  const permissions = await rolesService.getAllPermissions();
  res.send(permissions);
});

// Role Assignment endpoints
export const assignRoleToUser = catchAsync(async (req: Request, res: Response) => {
  const { userId, roleId, notes } = req.body;
  
  await roleAssignmentService.validateAndAssignRole(req.user!, userId, roleId, notes);
  
  await createSystemLog({
    user: req.user,
    event: 'Role Assigned to User',
    ipAddress: req.ip,
    customMetadata: {
      action: 'role_assignment',
      category: 'system',
      priority: 'high',
      assignedUserId: userId,
      roleId,
    },
  });
  
  res.status(httpStatus.CREATED).send({ message: 'Role assigned successfully' });
});

export const removeRoleFromUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  
  await roleAssignmentService.validateAndRemoveRole(req.user!, userId);
  
  await createSystemLog({
    user: req.user,
    event: 'Role Removed from User',
    ipAddress: req.ip,
    customMetadata: {
      action: 'role_removal',
      category: 'system',
      priority: 'high',
      userId,
    },
  });
  
  res.send({ message: 'Role removed successfully' });
});

export const getUserRole = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params['userId'] || req.user?.id;
  const assignment = await rolesService.getUserRole(userId!);
  res.send(assignment);
});

export const getUserPermissions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params['userId'] || req.user?.id;
  const permissions = await rolesService.getUserPermissions(userId!);
  res.send(permissions);
});

export const getUsersByRole = catchAsync(async (req: Request, res: Response) => {
  const roleId = req.params['roleId'];
  const users = await rolesService.getUsersByRole(roleId!);
  res.send(users);
});

export const getUserRoleAssignments = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params['userId'];
  const assignments = await rolesService.getUserRoleAssignments(userId!);
  res.send(assignments);
});

export const getApisByPermission = catchAsync(async (req: Request, res: Response) => {
  const permission = req.params['permission'];
  if (!permission) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Permission parameter is required' });
    return;
  }
  const apis = await rolesService.getApisByPermission(permission);
  
  res.send({
    permission,
    count: apis.length,
    apis,
  });
});

export const removePermissionFromAllRoles = catchAsync(async (req: Request, res: Response) => {
  const { permission } = req.body;
  const result = await rolesService.removePermissionFromAllRoles(permission);
  
  await createSystemLog({
    user: req.user,
    event: 'Permission Removed from All Roles',
    ipAddress: req.ip,
    customMetadata: {
      action: 'permission_removal',
      category: 'system',
      priority: 'high',
      permission,
      removedFromRoles: result.roles,
      rolesCount: result.removedFrom,
    },
  });
  
  res.send({
    message: `Permission "${permission}" removed from ${result.removedFrom} role(s)`,
    ...result,
  });
});
