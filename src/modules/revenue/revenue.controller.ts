import * as revenueService from './revenue.service';

import { Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import catchAsync from '../utils/catchAsync';
import pick from 'lodash/pick';

/**
 * Get revenue statistics
 */
export const getRevenueStats = catchAsync(async (_: Request, res: Response) => {
  const stats = await revenueService.getRevenueStats();
  res.send(stats);
});

/**
 * Get revenue by date range
 */
export const getRevenueByDateRange = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    throw new ApiError(400, 'Start date and end date are required');
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  const revenue = await revenueService.getRevenueByDateRange(start, end);
  res.send(revenue);
});

/**
 * Get revenues
 */
export const getRevenues = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['subscriptionId', 'companyId', 'tierId', 'billingInterval', 'status', 'paymentDate']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const result = await revenueService.queryRevenues(filter, options);
  res.send(result);
});

/**
 * Get revenue
 */
export const getRevenue = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['revenueId'] === 'string') {
    const revenue = await revenueService.getRevenueById(req.params['revenueId'] as any);
    if (!revenue) {
      throw new ApiError(404, 'Revenue not found');
    }
    res.send(revenue);
  }
});

/**
 * Update revenue
 */
export const updateRevenue = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['revenueId'] === 'string') {
    const revenue = await revenueService.updateRevenueById(req.params['revenueId'] as any, req.body);
    res.send(revenue);
  }
});

/**
 * Delete revenue
 */
export const deleteRevenue = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['revenueId'] === 'string') {
    await revenueService.deleteRevenueById(req.params['revenueId'] as any);
    res.status(204).send();
  }
});
