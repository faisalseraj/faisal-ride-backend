import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { xAIController } from '../../modules/xAI';

const router: Router = express.Router();
router.route('/ocrScanningForLicensePlate').post(auth(), xAIController.ocrScanningForLicensePlate);

export default router;
