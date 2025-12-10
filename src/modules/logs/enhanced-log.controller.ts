import { Request, Response } from 'express';

import { IUserDoc } from '../user/user.interfaces';
import catchAsync from '../utils/catchAsync';
import { enhancedLogService } from '.';
import httpStatus from 'http-status';
import pick from '../utils/pick';

export const searchLogs = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const filters = pick(req.query, [
    'userId',
    'affectedUser',
    'eventType',
    'eventEnum',
    'status',
    'dateFrom',
    'dateTo',
    'search',
    'ipAddress',
    'country',
    'siteId',
    'ownerId',
    'priority',
    'category',
    'action',
  ]);
  
  const options = pick(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'includeArchived',
    'groupBy',
    'aggregate',
  ]);

  const result = await enhancedLogService.searchLogs(user, filters, options);
  res.send(result);
});

export const getLogStatistics = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const filters = pick(req.query, [
    'userId',
    'affectedUser',
    'eventType',
    'eventEnum',
    'status',
    'dateFrom',
    'dateTo',
    'search',
    'ipAddress',
    'country',
    'siteId',
    'ownerId',
    'priority',
    'category',
    'action',
  ]);

  const dateRange = req.query['dateRange'] ? JSON.parse(req.query['dateRange'] as string) : undefined;

  const statistics = await enhancedLogService.getLogStatistics(user, filters, dateRange);
  res.send(statistics);
});

export const exportLogs = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const filters = pick(req.query, [
    'userId',
    'affectedUser',
    'eventType',
    'eventEnum',
    'status',
    'dateFrom',
    'dateTo',
    'search',
    'ipAddress',
    'country',
    'siteId',
    'ownerId',
    'priority',
    'category',
    'action',
  ]);

  const format = (req.query['format'] as 'csv' | 'json' | 'xlsx') || 'csv';

  const buffer = await enhancedLogService.exportLogs(user, filters, format);

  const filename = `logs-export-${new Date().toISOString().split('T')[0]}.${format}`;
  
  res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

export const getLogById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { logId } = req.params;

  // Find the log
  const log = await enhancedLogService.searchLogs(user, { userId: logId! }, { limit: 1 });
  
  if (!log.results || log.results.length === 0) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'Log not found' });
  }

  return res.send(log.results[0]);
});

export const getLogAccessControl = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const accessControl = await enhancedLogService.getUserLogAccessControl(user);
  res.send(accessControl);
});

export const getLogCategories = catchAsync(async (_: Request, res: Response) => {
  const categories = [
    'authentication',
    'authorization',
    'user_management',
    'tow_request',
    'parking',
    'apartment',
    'chat',
    'system',
    'security',
    'communication',
    'ai',
    'api',
    'error',
    'audit',
  ];
  res.send(categories);
});

export const getLogActions = catchAsync(async (_: Request, res: Response) => {
  const actions = [
    'create',
    'read',
    'update',
    'delete',
    'login',
    'logout',
    'register',
    'verify',
    'reset',
    'assign',
    'unassign',
    'approve',
    'reject',
    'complete',
    'cancel',
    'send',
    'receive',
    'join',
    'leave',
    'upload',
    'download',
    'export',
    'import',
    'backup',
    'restore',
  ];
  res.send(actions);
});

export const getLogPriorities = catchAsync(async (_: Request, res: Response) => {
  const priorities = ['low', 'medium', 'high', 'critical'];
  res.send(priorities);
});

export const getLogEventTypes = catchAsync(async (_: Request, res: Response) => {
  const eventTypes = [
    'admin',
    'apartment-complex-owner',
    'apartment-complex-manager',
    'apartment-complex-employee',
    'tow-company-owner',
    'tow-company-manager',
    'tow-company-employee',
    'parking-spaces-provider-owner',
    'parking-spaces-provider-manager',
    'parking-spaces-provider-employee',
    'renter',
    'external',
  ];
  res.send(eventTypes);
});

export const getLogEventEnums = catchAsync(async (_: Request, res: Response) => {
  const eventEnums = [
    'UE', // User Events
    'MaE', // Management Events
    'AE', // Admin Events
    'FE', // Feature Events
    'UME', // User Management Events
    'CE', // Communication Events
    'ComE', // Communication Events
    'SSE', // System Security Events
    'LE', // Link Events
    'GPTE', // GPT Events
    'ACE', // Apartment Complex Events
  ];
  res.send(eventEnums);
});

export const getLogStatuses = catchAsync(async (_: Request, res: Response) => {
  const statuses = [
    'LOGIN_SUCCESS',
    'INCORRECT_PASSWORD_OR_EMAIL',
    'INCORRECT_OTP',
    'NA',
  ];
  res.send(statuses);
});

export const createEnhancedLog = catchAsync(async (req: Request, res: Response) => {
  const log = await enhancedLogService.createEnhancedLog(req.body);
  res.status(httpStatus.CREATED).send(log);
});

export const getLogDashboard = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  
  // Get statistics for different time periods
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [stats24h, stats7d, stats30d, recentLogs] = await Promise.all([
    enhancedLogService.getLogStatistics(user, {}, { from: last24Hours, to: now.toISOString() }),
    enhancedLogService.getLogStatistics(user, {}, { from: last7Days, to: now.toISOString() }),
    enhancedLogService.getLogStatistics(user, {}, { from: last30Days, to: now.toISOString() }),
    enhancedLogService.searchLogs(user, {}, { page: 1, limit: 10 }),
  ]);

  const dashboard = {
    timePeriods: {
      last24Hours: stats24h,
      last7Days: stats7d,
      last30Days: stats30d,
    },
    recentLogs: recentLogs.results || [],
    summary: {
      totalLogs: stats30d.totalLogs,
      recentActivity: stats24h.recentActivity,
      errorRate: stats30d.errorRate,
      averageLogsPerDay: stats30d.averageLogsPerDay,
    },
  };

  res.send(dashboard);
});

export const getLogDetails = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IUserDoc;
  const { logId } = req.params;

  // Find the specific log with full details
  const log = await enhancedLogService.getLogDetails(user, logId!);
  
  if (!log) {
    return res.status(httpStatus.NOT_FOUND).send({ message: 'Log not found' });
  }

  return res.send(log);
});
