import { adminController, adminValidation } from '../../modules/admin';

import { auth } from '../../modules/auth';
import express from 'express';
import { validate } from '../../modules/validate';
// import { reportController, reportValidation } from '../../modules/reports';


const router = express.Router();

// Get system health
router.route('/system-health').get(auth('getLogs'), validate(adminValidation.getSystemHealth), adminController.getSystemHealth);

// Get system alerts
router.route('/system-alerts').get(auth('getLogs'), validate(adminValidation.getSystemAlerts), adminController.getSystemAlerts);

// Generate admin report
// GET /admin/reports?span=weekly|monthly|yearly
// router
//   .route('/reports')
//   .get(auth('generateAdminReport'), validate(reportValidation.generateAdminReport), reportController.generateAdminReportController);

export default router;

