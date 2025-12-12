import * as roleAssignmentService from './role-assignment.service';
import * as rolesService from './roles.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import { logService } from '../logs';

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
  
  await logService.logAdmin(req.user as any, 'Role Created', {
    metadata: {
      action: 'role_create',
      roleName: role.name,
      ipAddress: req.ip,
    },
  });
  
  res.status(httpStatus.CREATED).send(role);
});

export const updateRole = catchAsync(async (req: Request, res: Response) => {
  const role = await rolesService.updateRole(req.params['roleName']!, req.body);
  
  await logService.logAdmin(req.user as any, 'Role Updated', {
    metadata: {
      action: 'role_update',
      roleName: role.name,
      updatedPermissions: role.permissions,
      updatedFields: Object.keys(req.body),
      ipAddress: req.ip,
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
  
  await logService.logAdmin(req.user as any, 'Role Assigned to User', {
    metadata: {
      action: 'role_assignment',
      assignedUserId: userId,
      roleId,
      ipAddress: req.ip,
    },
  });
  
  res.status(httpStatus.CREATED).send({ message: 'Role assigned successfully' });
});

export const removeRoleFromUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  
  await roleAssignmentService.validateAndRemoveRole(req.user!, userId);
  
  await logService.logAdmin(req.user as any, 'Role Removed from User', {
    metadata: {
      action: 'role_removal',
      userId,
      ipAddress: req.ip,
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
  
  await logService.logAdmin(req.user as any, 'Permission Removed from All Roles', {
    metadata: {
      action: 'permission_removal',
      permission,
      removedFromRoles: result.roles,
      rolesCount: result.removedFrom,
      ipAddress: req.ip,
    },
  });
  
  res.send({
    message: `Permission "${permission}" removed from ${result.removedFrom} role(s)`,
    ...result,
  });
});
