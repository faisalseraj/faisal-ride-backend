import express, { Router } from 'express';
import { userController, userValidation } from '../../modules/user';

import { auth } from '../../modules/auth';
// import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();
router.route('/').get(auth('superadmin'), userController.getAllAdmins);

router
  .route('/:userId/change-role')
  .patch(auth('superadmin'), validate(userValidation.updateSuperAdmin), userController.updateSuperAdmin);
router.route('/create-admin').post(auth('superadmin'), validate(userValidation.createAdmin), userController.createAdmin);
export default router;
