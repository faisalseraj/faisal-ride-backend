import * as adminService from './admin.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';

/**
 * Get system health
 */
export const getSystemHealth = catchAsync(async (_: Request, res: Response) => {
  const health = await adminService.getSystemHealth();
  res.send(health);
});

/**
 * Get system alerts
 */
export const getSystemAlerts = catchAsync(async (_: Request, res: Response) => {
  const alerts = await adminService.getSystemAlerts();
  res.send(alerts);
});

