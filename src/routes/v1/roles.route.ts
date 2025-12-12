import { rolesController, rolesValidation } from '../../modules/roles';

import { auth } from '../../modules/auth';
import express from 'express';
import { validate } from '../../modules/validate';

const router = express.Router();

// Role management routes (admin only)
router
  .route('/')
  .get(auth('manageRoles'), rolesController.getAllRoles)
  .post(
    auth('manageRoles'),
    validate(rolesValidation.createRole),
    rolesController.createRole
  );

router
  .route('/permissions')
  .get(auth('manageRoles'), rolesController.getAllPermissions);

router
  .route('/:roleName')
  .get(auth('manageRoles'), validate(rolesValidation.getRole), rolesController.getRole)
  .patch(
    auth('manageRoles'),
    validate(rolesValidation.updateRole),
    rolesController.updateRole
  );

// Role assignment routes
router
  .route('/assign')
  .post(
    auth('manageRoles'),
    validate(rolesValidation.assignRoleToUser),
    rolesController.assignRoleToUser
  );

router
  .route('/remove')
  .post(
    auth('manageRoles'),
    validate(rolesValidation.removeRoleFromUser),
    rolesController.removeRoleFromUser
  );

router
  .route('/user/:userId')
  .get(auth('self'), validate(rolesValidation.getUserRole), rolesController.getUserRole);

router
  .route('/user/:userId/permissions')
  .get(auth('self'), validate(rolesValidation.getUserPermissions), rolesController.getUserPermissions);

router
  .route('/user/:userId/assignments')
  .get(auth('manageRoles'), validate(rolesValidation.getUserRoleAssignments), rolesController.getUserRoleAssignments);

router
  .route('/role/:roleId/users')
  .get(auth('manageRoles'), validate(rolesValidation.getUsersByRole), rolesController.getUsersByRole);

router
  .route('/permissions/remove')
  .post(
    auth('manageRoles'),
    validate(rolesValidation.removePermissionFromAllRoles),
    rolesController.removePermissionFromAllRoles
  );

router
  .route('/permissions/:permission/apis')
  .get(
    auth('manageRoles'),
    validate(rolesValidation.getApisByPermission),
    rolesController.getApisByPermission
  );

export default router;
