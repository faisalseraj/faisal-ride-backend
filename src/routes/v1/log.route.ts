import express, { Router } from 'express';
import { logController, logValidation } from '../../modules/logs';

import { auth } from '../../modules/auth';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

router.route('/').get(auth('getLogs'), validate(logValidation.getLogs), logController.getLogs);

router.route('/getEmailLogs').get(auth('getLogs'), validate(logValidation.getLogs), logController.getEmailLogs);
router.route('/getAILogs').get(auth('getLogs'), validate(logValidation.getLogs), logController.getAILogs);

router.route('/getSMSLogs').get(auth('getLogs'), validate(logValidation.getLogs), logController.getSMSLogs);

router.route('/getCounts').get(auth('fetchStatistics'), logController.getLogcounts);
router.route('/getEmailCounts').get(auth('fetchStatistics'), logController.getEmailLogcounts);
router.route('/getAICounts').get(auth('fetchStatistics'), logController.getAILogcounts);
router.route('/getSMSCounts').get(auth('fetchStatistics'), logController.getSMSLogcounts);

export default router;
