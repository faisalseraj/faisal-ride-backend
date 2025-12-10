import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { chatGPTController } from '../../modules/chatGPT';

const router: Router = express.Router();
router.route('/ocrScanningForLicensePlate').post(auth(), chatGPTController.ocrScanningForLicensePlate);
router.route('/testGpt').post(auth(), chatGPTController.testGPT);

export default router;
