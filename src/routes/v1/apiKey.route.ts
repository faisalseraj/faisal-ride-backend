import { emailController, emailValidation } from '../../modules/email';
import express, { Router } from 'express';
import { logController, logValidation } from '../../modules/logs';
import { userController, userValidation } from '../../modules/user';

import { apiKeysController } from '../../modules/apiKeys';
import { auth } from '../../modules/auth';
import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
// import { catchAsync } from '../../modules/utils';
// import multer from 'multer';
import { validate } from '../../modules/validate';

// Configure multer to handle file uploads
// const upload = multer({ dest: '../uploads/' });

const router: Router = express.Router();

router.route('/create').post(auth('createAPIKey'), apiKeysController.createAPIKey);

router
  .route('/sendTemplatedEmail')
  .post(authenticateApiKey, validate(emailValidation.sendTemplatedEmail), emailController.sendAnonymousTemplatedEmail);



router
  .route('/createSMSLog')
  .post(authenticateApiKey, validate(logValidation.anonymousSMSLog), logController.createAnonymousSMSLog);

router
  .route('/getUsersByUserType')
  .get(authenticateApiKey, validate(userValidation.getUsersByType), userController.listUsersByUserType);

export default router;
