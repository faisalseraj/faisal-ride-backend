import { reportController, reportValidation } from '../../modules/reports';

import { auth } from '../../modules/auth';
import express from 'express';
import { validate } from '../../modules/validate';

const router = express.Router();

// Company report route for tow company owners and managers
// GET /reports/company?span=weekly|monthly|yearly
router
  .route('/company')
  .get(
    auth(),
    validate(reportValidation.generateCompanyReport),
    reportController.generateCompanyReportController
  );

export default router;

