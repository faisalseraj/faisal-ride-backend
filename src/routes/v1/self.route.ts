import express, { Router } from 'express';
import { userController, userValidation } from '../../modules/user';

import { auth } from '../../modules/auth';
import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
// import { uploadController } from '../../modules/upload/index';
// import { uploadMiddleware } from '../../modules//upload/upload.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/')
  .get(auth('self'), userController.getSelf)
  .patch(auth('self'), validate(userValidation.updateProfile), userController.updateProfileV2);

// router.route('/upload-image').post(authenticateApiKey, uploadMiddleware.single('fileToSend'), uploadController.uploadImage);

// router.route('/generateAndUploadProfile').post(authenticateApiKey, uploadController.generateAndUploadProfile);
// router.route('/generateAndUploadMenuImages').post(authenticateApiKey, uploadController.generateAndUploadMenuImages);

// router.route('/getSignedUrl').get(auth('manageUsers'), uploadController.signedUrl);


router
  .route('/validateEmailSetToken/:token')
  .get(authenticateApiKey, validate(userValidation.validateEmailSetToken), userController.validateEmailSetToken);

router.post(
  '/requestOtpsForEmailSet/:token',
  authenticateApiKey,
  validate(userValidation.requestOTPSforEmailSet),
  userController.requestOTPSforEmailSet
);

router.post('/setEmail/:token', validate(userValidation.setEmail), userController.setEmail);

router
  .route('/validateEmailSetTokenPrePhoneOTP/:token')
  .get(authenticateApiKey, validate(userValidation.validateEmailSetToken), userController.validateEmailSetTokenPrePhoneOTP);

export default router;
