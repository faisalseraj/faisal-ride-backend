/**
 * Faisal Ride - Log Controller
 * Simple API endpoints for log management
 */

import * as logService from './log.service';

import { LogCategory, LogStatus } from './log.interfaces';
import { Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from '../utils/pick';

/**
 * Get logs with filtering and pagination
 */
export const getLogs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['userId', 'category', 'level', 'status', 'dateFrom', 'dateTo', 'search']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page']);

  const result = await logService.queryLogs(filter, options);
  res.send(result);
});

/**
 * Get logs by category
 */
export const getLogsByCategory = catchAsync(async (req: Request, res: Response) => {
  const { category } = req.params;
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page']);

  if (!category) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Category is required');
  }

  const result = await logService.getLogsByCategory(category as LogCategory, options);
  res.send(result);
});

/**
 * Get user's logs
 */
export const getUserLogs = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page']);

  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  const result = await logService.getUserLogs(userId, options);
  res.send(result);
});

/**
 * Get my logs (current user)
 */
export const getMyLogs = catchAsync(async (req: Request, res: Response) => {
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await logService.getUserLogs(req.user.id, options);
  res.send(result);
});

/**
 * Get recent logs
 */
export const getRecentLogs = catchAsync(async (req: Request, res: Response) => {
  const limit = parseInt(req.query['limit'] as string) || 100;
  const logs = await logService.getRecentLogs(limit);
  res.send(logs);
});

/**
 * Get log counts/statistics
 */
export const getLogCounts = catchAsync(async (_req: Request, res: Response) => {
  const counts = await logService.getLogCounts();
  res.send(counts);
});

/**
 * Get single log by ID
 */
export const getLog = catchAsync(async (req: Request, res: Response) => {
  const { logId } = req.params;

  if (!logId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Log ID is required');
  }

  const log = await logService.getLogById(new mongoose.Types.ObjectId(logId));

  if (!log) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Log not found');
  }

  res.send(log);
});

/**
 * Delete log by ID (admin only)
 */
export const deleteLog = catchAsync(async (req: Request, res: Response) => {
  const { logId } = req.params;

  if (!logId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Log ID is required');
  }

  await logService.deleteLogById(new mongoose.Types.ObjectId(logId));
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Cleanup old logs (admin only)
 */
export const cleanupOldLogs = catchAsync(async (req: Request, res: Response) => {
  const daysOld = parseInt(req.query['daysOld'] as string) || 90;
  const deletedCount = await logService.deleteOldLogs(daysOld);
  res.send({ message: `Deleted ${deletedCount} logs older than ${daysOld} days` });
});

/**
 * Create anonymous SMS log (backward compatibility)
 */
export const createAnonymousSMSLog = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, message, status, metadata } = req.body;
  
  await logService.logSMS(null, phoneNumber, message || 'SMS sent', status === 'failed' ? LogStatus.FAILED : LogStatus.SUCCESS);
  
  res.status(httpStatus.CREATED).send({ message: 'SMS log created', metadata });
});
