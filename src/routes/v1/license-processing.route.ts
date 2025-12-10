import express, { Router } from 'express';

import { licenseProcessingController } from '../../modules/license-processing';

const router: Router = express.Router();
router.get('/getCompleteDashboard', licenseProcessingController.getCompleteDashboard);
router.get('/getDashboardCases', licenseProcessingController.getDashboardCases);
router.get('/getDashboardImageStats', licenseProcessingController.getDashboardImageStats);
router.get('/getDashboardOpenAIOCR', licenseProcessingController.getDashboardOpenAIOCR);
router.get('/getDashboardReasoningTokens', licenseProcessingController.getDashboardReasoningTokens);
router.get('/getLicenseProcessingStatistics', licenseProcessingController.getLicenseProcessingStatistics);
router.get('/getLicenseProcessingExtremes', licenseProcessingController.getLicenseProcessingExtremes);

export default router;
