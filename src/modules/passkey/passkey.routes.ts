import {
  checkPasskeyRequirement,
  createPasskey,
  deletePasskey,
  getPasskey,
  getPasskeysForPSP,
  getPasskeysForTowCompany,
  validatePasskey,
} from './passkey.controller';
import {
  checkPasskeyRequirement as checkPasskeyRequirementValidation,
  createPasskey as createPasskeyValidation,
  deletePasskey as deletePasskeyValidation,
  getPasskey as getPasskeyValidation,
  getPasskeysForPSP as getPasskeysForPSPValidation,
  getPasskeysForTowCompany as getPasskeysForTowCompanyValidation,
  validatePasskey as validatePasskeyValidation,
} from './passkey.validation';

import { Router } from 'express';
import { auth } from '../auth';
import { validate } from '../validate';

const router = Router();

// All routes require authentication
router.use(auth());

// Create passkey
router.post('/', validate(createPasskeyValidation), createPasskey);

// Validate passkey
router.post('/validate', validate(validatePasskeyValidation), validatePasskey);

// Check if PSP requires passkey
router.get('/check-requirement/:pspId', validate(checkPasskeyRequirementValidation), checkPasskeyRequirement);

// Get passkey (admin only)
router.get('/', validate(getPasskeyValidation), getPasskey);

// Delete passkey
router.delete('/', validate(deletePasskeyValidation), deletePasskey);

// Get all passkeys for a PSP
router.get('/psp/:pspId', validate(getPasskeysForPSPValidation), getPasskeysForPSP);

// Get all passkeys for a tow company
router.get('/tow-company/:towCompanyId', validate(getPasskeysForTowCompanyValidation), getPasskeysForTowCompany);

export default router;
