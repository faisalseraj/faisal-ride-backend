import { auth, authController, authValidation } from '../../modules/auth';
import express, { Router } from 'express';

import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
import { userController } from '../../modules/user';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router.post('/register', authenticateApiKey, validate(authValidation.register), userController.registerUser);

router.post('/emailLogin', authenticateApiKey, validate(authValidation.login), authController.emailLoginAttempt);
router.post(
  '/verifyEmailLogin',
  authenticateApiKey,
  validate(authValidation.verifyEmailLogin),
  authController.verifymailLoginAttempt
);
router.post(
  '/resendEmailLoginOTP',
  authenticateApiKey,
  validate(authValidation.resendEmailLoginOTP),
  authController.resendEmailLoginOTP
);
// router.post('/login', validate(authValidation.login), authController.login);
// router.post('/sendOtp',authenticateApiKey, validate(authValidation.sendOtpInPhoneNumber), authController.sendOtp);
// router.post('/phoneLogin',authenticateApiKey, validate(authValidation.phoneLogin), authController.phoneLogin);
router.post(
  '/requestOTPBeforeEmailVerification',
  authenticateApiKey,
  validate(authValidation.sendOtpInPhoneNumber),
  authController.requestOTPBeforeEmailVerification
);
// router.post(
//   '/verifyOTPBeforeEmailVerification',
//   authenticateApiKey,
//   validate(authValidation.phoneLogin),
//   authController.verifyOTPBeforeEmailVerification
// );
// router.post(
//   '/request-otp-for-phoneNumber-change',
//   auth(),
//   validate(authValidation.sendOtpInPhoneNumber),
//   authController.requestOtpForPhoneChange
// );
router.post(
  '/request-otp-for-email-change',
  auth(),
  validate(authValidation.sendOtpInEmail),
  authController.requestOtpForEmailChange
);

router.post(
  '/request-otp-for-email-change-v2',
  auth('changeEmail'),
  validate(authValidation.sendOtpInEmail),
  authController.requestOtpForEmailChangeV2
);
// router.post('/impersonate', auth('impersonation'), validate(authValidation.impersonate), authController.impersonateUser);
router.post('/logout', authenticateApiKey, validate(authValidation.logout), authController.logout);
router.post('/refresh-tokens', authenticateApiKey, validate(authValidation.refreshTokens), authController.refreshTokens);
router.post('/forgot-password', authenticateApiKey, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', authenticateApiKey, validate(authValidation.resetPassword), authController.resetPassword);
router.post('/send-verification-email', auth(), authController.sendVerificationEmail);
router.post('/verify-email', authenticateApiKey, validate(authValidation.verifyEmail), authController.verifyEmail);
router.post('/post-invitation/setup-account', auth('self'), validate(authValidation.setupAccount), authController.setupPasswordAndName);
router.post('/setup-email-and-password', auth('self'), validate(authValidation.setupEmailAndPassword), authController.setupEmailAndPassword);
router.post('/setup-phone-and-password', auth('self'), validate(authValidation.setupPhoneAndPassword), authController.setupPhoneAndPassword);
router.post('/send-phone-verification-otp', auth('self'), validate(authValidation.sendPhoneVerificationOTP), authController.sendPhoneVerificationOTP);
router.post('/verify-phone-number', auth('self'), validate(authValidation.verifyPhoneNumber), authController.verifyPhoneNumber);
router.get('/verify-account-setup-token/:token', authenticateApiKey, authController.verifyAccountSetupToken);

export default router;
