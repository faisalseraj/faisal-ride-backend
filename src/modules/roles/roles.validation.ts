import Joi from 'joi';

export const getRole = {
  params: Joi.object().keys({
    roleName: Joi.string().required(),
  }),
};

export const createRole = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    permissions: Joi.array().items(Joi.string()).required(),
    description: Joi.string().allow('', null).optional(),
    isSystemRole: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const updateRole = {
  params: Joi.object().keys({
    roleName: Joi.string().required(),
  }),
  body: Joi.object().keys({
    permissions: Joi.array().items(Joi.string()).optional(),
    description: Joi.string().allow('', null).optional(),
    isActive: Joi.boolean().optional(),
  }).min(1), // At least one field must be provided
};

export const assignRoleToUser = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
    roleId: Joi.string().required(),
    notes: Joi.string().allow('', null).optional(),
  }),
};

export const removeRoleFromUser = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

export const getUserRole = {
  params: Joi.object().keys({
    userId: Joi.string().optional(),
  }),
};

export const getUserPermissions = {
  params: Joi.object().keys({
    userId: Joi.string().optional(),
  }),
};

export const getUsersByRole = {
  params: Joi.object().keys({
    roleId: Joi.string().required(),
  }),
};

export const getUserRoleAssignments = {
  params: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

export const removePermissionFromAllRoles = {
  body: Joi.object().keys({
    permission: Joi.string().required(),
  }),
};

export const getApisByPermission = {
  params: Joi.object().keys({
    permission: Joi.string().required(),
  }),
};
