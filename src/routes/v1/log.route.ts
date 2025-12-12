/**
 * Faisal Ride - Log Routes
 * Simple API routes for log management
 */

import express, { Router } from 'express';
import { logController, logValidation } from '../../modules/logs';

import { auth } from '../../modules/auth';
import { validate } from '../../modules/validate';

const router: Router = express.Router();

// Get logs with filtering
router.route('/')
  .get(auth('getLogs'), validate(logValidation.getLogs), logController.getLogs);

// Get logs by category
router.route('/category/:category')
  .get(auth('getLogs'), validate(logValidation.getLogsByCategory), logController.getLogsByCategory);

// Get user's logs
router.route('/user/:userId')
  .get(auth('getLogs'), validate(logValidation.getUserLogs), logController.getUserLogs);

// Get my logs (current user)
router.route('/my')
  .get(auth('self'), logController.getMyLogs);

// Get recent logs
router.route('/recent')
  .get(auth('getLogs'), logController.getRecentLogs);

// Get log counts/statistics
router.route('/counts')
  .get(auth('fetchStatistics'), logController.getLogCounts);

// Cleanup old logs (admin only)
router.route('/cleanup')
  .delete(auth('manageUsers'), validate(logValidation.cleanupOldLogs), logController.cleanupOldLogs);

// Get/Delete single log
router.route('/:logId')
  .get(auth('getLogs'), validate(logValidation.getLog), logController.getLog)
  .delete(auth('manageUsers'), validate(logValidation.deleteLog), logController.deleteLog);

export default router;
