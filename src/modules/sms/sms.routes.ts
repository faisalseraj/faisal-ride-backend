import { Router } from 'express';
import { auth } from '../auth';
import { validate } from '../validate';
import * as smsController from './sms.controller';
import * as smsValidation from './sms.validation';

const router = Router();

// All SMS routes require authentication
router.use(auth());

// Send SMS
router.post('/send', validate(smsValidation.sendSMS), smsController.sendSMS);

// Send one-time link via SMS
router.post('/one-time-link', validate(smsValidation.sendOneTimeLinkSMS), smsController.sendOneTimeLinkSMS);

// Send templated SMS
router.post('/template', validate(smsValidation.sendTemplatedSMS), smsController.sendTemplatedSMS);

// Get SMS delivery status
router.get('/status/:messageId', validate(smsValidation.getSMSStatus), smsController.getSMSStatus);

// Validate phone number
router.post('/validate-phone', smsController.validatePhoneNumber);

export default router;
