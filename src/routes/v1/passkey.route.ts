import {
  checkPasskeyRequirement,
  createPasskey,
  deletePasskey,
  getPasskey,
  getPasskeysForPSP,
  getPasskeysForTowCompany,
  validatePasskey,
} from '../../modules/passkey';
import express, { Router } from 'express';

import { auth } from '../../modules/auth';

const router: Router = express.Router();

// All routes require authentication
router.use(auth());

// Create passkey
router.post('/', createPasskey);

// Validate passkey
router.post('/validate', validatePasskey);

// Check if PSP requires passkey
router.get('/check-requirement/:pspId', checkPasskeyRequirement);

// Get passkey (admin only)
router.get('/', getPasskey);

// Delete passkey
router.delete('/', deletePasskey);

// Get all passkeys for a PSP
router.get('/psp/:pspId', getPasskeysForPSP);   

// Get all passkeys for a tow company
router.get('/tow-company/:towCompanyId', getPasskeysForTowCompany);

export default router;