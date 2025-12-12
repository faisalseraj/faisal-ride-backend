import { revenueController, revenueValidation } from './';

import { auth } from '../auth';
import express from 'express';
import { validate } from '../validate';

const router = express.Router();

router
  .route('/')
  .get(auth('getRevenues'), revenueController.getRevenues);

router
  .route('/stats')
  .get(auth('getRevenues'), revenueController.getRevenueStats);

router
  .route('/date-range')
  .get(auth('getRevenues'), revenueController.getRevenueByDateRange);

router
  .route('/:revenueId')
  .get(auth('getRevenues'), revenueController.getRevenue)
  .patch(auth('manageRevenues'), validate(revenueValidation.updateRevenue), revenueController.updateRevenue)
  .delete(auth('manageRevenues'), revenueController.deleteRevenue);

export { router as revenueRoutes };
