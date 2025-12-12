import { emailController, emailValidation } from '../../modules/email';
import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import authenticateApiKey from '../../modules/apiKeys/apiKey.middleware';
// import { uploadMiddleware } from '../../modules/upload/upload.email.middleware';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router
  .route('/sendContactSupportEmail')
  .post(authenticateApiKey, validate(emailValidation.contactSupportEmailBody), emailController.sendContactSupportEmail);

  router
  .route('/sendContactSupportEmailForHuntItServices')
  .post(authenticateApiKey, validate(emailValidation.contactSupportEmailBody), emailController.sendContactSupportEmailForHuntItServices);

router
  .route('/sendTemplatedEmail')
  .post(auth(), validate(emailValidation.sendTemplatedEmail), emailController.sendTemplatedEmail);


// router
//   .route('/sendTemplatedEmailWithAttachment')
//   .post(
//     auth(),
//     validate(emailValidation.sendTemplatedEmailWithAttachmentInternal),
//     uploadMiddleware.single('file'),
//     emailController.sendTemplatedEmailWithAttachment
//   );

// router
//   .route('/emailCampaignUsingEmails')
//   .post(
//     auth(),
//     validate(emailValidation.emailCampaignUsingEmails),
//     uploadMiddleware.single('file'),
//     emailController.emailCampaignUsingEmails
//   );

// router.route('/sendTemplate').get(emailController.sendTemplatedEmail)
export default router;
