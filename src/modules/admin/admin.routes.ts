import * as adminController from './admin.controller';
import * as adminValidation from './admin.validation';

import { auth } from '../auth';
import express from 'express';
import { validate } from '../validate';

const router = express.Router();

// Get system health
router.route('/system-health').get(auth('getLogs'), validate(adminValidation.getSystemHealth), adminController.getSystemHealth);

// Get system alerts
router.route('/system-alerts').get(auth('getLogs'), validate(adminValidation.getSystemAlerts), adminController.getSystemAlerts);

export default router;

