import { auth, authController, authValidation } from '../../modules/auth';
import express, { Router } from 'express';

import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
// import { uploadController } from '../../modules/upload';
// import { uploadMiddleware } from '../../modules/upload/upload.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

// router.post(
//   '/auth/emailLogin',
//   authenticateApiKey,
//   validate(authValidation.loginBasedOnUserType),
//   authController.emailLoginAttemptForApplications
// );
router.post(
  '/auth/verifyEmailLogin',
  authenticateApiKey,
  validate(authValidation.verifyEmailLogin),
  authController.verifymailLoginAttempt
);
router.post(
  '/auth/resendEmailLoginOTP',
  authenticateApiKey,
  validate(authValidation.resendEmailLoginOTP),
  authController.resendEmailLoginOTP
);
// router.post(
//   '/auth/requestOtpForLogin',
//   authenticateApiKey,
//   validate(authValidation.requestOTPForPartner),
//   authController.sendOtp
// );
router.post(
  '/auth/forgot-password',
  authenticateApiKey,
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);
// router.post('/auth/phoneLogin', authenticateApiKey, validate(authValidation.phoneLogin), authController.phoneLogin);



// settings APIs

//
// router.post(
//   '/request-otp-for-phoneNumber-change',
//   auth('self'),
//   validate(authValidation.sendOtpInPhoneNumber),
//   authController.requestOtpForPhoneChange
// );
router.post(
  '/request-otp-for-email-change',
  auth('changeEmail'),
  validate(authValidation.sendOtpInEmail),
  authController.requestOtpForEmailChange
);


export default router;
