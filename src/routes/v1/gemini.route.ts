import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { geminiController } from '../../modules/gemini';

const router: Router = express.Router();
router.route('/ocrScanningForLicensePlate').post(auth(), geminiController.ocrScanningForLicensePlate);

export default router;
