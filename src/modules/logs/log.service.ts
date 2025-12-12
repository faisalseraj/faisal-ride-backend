/**
 * Faisal Ride - Log Service
 * Simple, effective logging functions
 */

import {
  CreateCommunicationLogInput,
  CreateLogInput,
  ILogDoc,
  LogCategory,
  LogCounts,
  LogFilters,
  LogLevel,
  LogStatus,
} from './log.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';

import ApiError from '../errors/ApiError';
import { IUserDoc } from '../user/user.interfaces';
import Log from './log.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract user info for logging
 */
const getUserInfo = (user: Partial<IUserDoc> | null) => {
  if (!user) {
    return {
      userId: null,
      userName: 'System',
      userType: 'system',
    };
  }

  return {
    userId: user._id || user.id || null,
    userName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
    userType: user.userType || 'unknown',
  };
};

// ============================================
// CORE LOG CREATION
// ============================================

/**
 * Create a log entry
 */
export const createLog = async (input: CreateLogInput): Promise<ILogDoc> => {
  const userInfo = getUserInfo(input.user);
  
  // Determine category from eventEnum for backward compat
  let category = input.category || 'system';
  if (input.eventEnum) {
    if (input.eventEnum === 'UE') category = 'user';
    else if (input.eventEnum === 'AE' || input.eventEnum === 'MaE') category = 'admin';
    else if (input.eventEnum === 'OE') category = 'auth';
    else if (input.eventEnum === 'STE') category = 'payment';
  }

  return Log.create({
    ...userInfo,
    event: input.event,
    category,
    level: input.level || 'info',
    status: input.status || LogStatus.SUCCESS,
    ipAddress: input.ipAddress,
    country: input.user?.country,
    metadata: input.metadata,
  });
};

// ============================================
// CONVENIENCE LOG FUNCTIONS
// ============================================

/**
 * Log authentication events (login, logout, password reset, etc.)
 */
export const logAuth = async (
  user: Partial<IUserDoc> | null,
  event: string,
  options?: { status?: LogStatus; ipAddress?: string; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user,
    event,
    category: 'auth',
    level: options?.status === LogStatus.FAILED ? 'warning' : 'info',
    ...options,
  });
};

/**
 * Log user events (profile updates, registration, etc.)
 */
export const logUser = async (
  user: Partial<IUserDoc>,
  event: string,
  options?: { status?: LogStatus; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user,
    event,
    category: 'user',
    level: 'info',
    ...options,
  });
};

/**
 * Log trip events (creation, booking, completion, etc.)
 */
export const logTrip = async (
  user: Partial<IUserDoc>,
  event: string,
  options?: { status?: LogStatus; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user,
    event,
    category: 'trip',
    level: 'info',
    ...options,
  });
};

/**
 * Log payment events (Stripe webhooks, subscriptions, etc.)
 */
export const logPayment = async (
  user: Partial<IUserDoc> | null,
  event: string,
  options?: { status?: LogStatus; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user,
    event,
    category: 'payment',
    level: options?.status === LogStatus.FAILED ? 'error' : 'success',
    ...options,
  });
};

/**
 * Log admin actions
 */
export const logAdmin = async (
  user: Partial<IUserDoc>,
  event: string,
  options?: { status?: LogStatus; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user,
    event,
    category: 'admin',
    level: 'info',
    ...options,
  });
};

/**
 * Log system events (webhooks, cron jobs, errors, etc.)
 */
export const logSystem = async (
  event: string,
  options?: { level?: LogLevel; status?: LogStatus; metadata?: Record<string, any> }
): Promise<ILogDoc> => {
  return createLog({
    user: null,
    event,
    category: 'system',
    level: options?.level || 'info',
    status: options?.status || LogStatus.SUCCESS,
    ...(options?.metadata && { metadata: options.metadata }),
  });
};

/**
 * Log errors
 */
export const logError = async (
  event: string,
  error: Error | string,
  user?: Partial<IUserDoc> | null
): Promise<ILogDoc> => {
  return createLog({
    user: user || null,
    event,
    category: 'system',
    level: 'error',
    status: LogStatus.FAILED,
    metadata: {
      error: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
    },
  });
};

/**
 * Log communication (email/SMS sent)
 */
export const logCommunication = async (input: CreateCommunicationLogInput): Promise<ILogDoc> => {
  const userInfo = getUserInfo(input.user);
  
  // Handle backward compatibility
  const recipientType = input.recipientType || (input.type === 'sms' ? 'phone' : input.type as 'email' | 'phone') || 'email';
  const recipientValue = input.recipientValue || input.recipient || '';

  return Log.create({
    ...userInfo,
    event: input.event,
    category: 'communication',
    level: input.status === LogStatus.FAILED ? 'error' : 'info',
    status: input.status || LogStatus.SUCCESS,
    recipient: {
      type: recipientType,
      value: recipientValue,
      content: input.content,
    },
    metadata: input.metadata,
  });
};

// ============================================
// BACKWARD COMPATIBILITY FUNCTIONS
// ============================================

/**
 * Create communication log (backward compat)
 */
export const createCommunicationLog = async (input: {
  user: Partial<IUserDoc> | null;
  event: string;
  type?: string;
  recipient?: string;
  metadata?: Record<string, any>;
  eventEnum?: string;
  receiverDetails?: any;
}): Promise<ILogDoc> => {
  return logCommunication({
    user: input.user,
    event: input.event,
    type: (input.type as any) || 'email',
    recipient: input.recipient || '',
    metadata: { ...input.metadata, receiverDetails: input.receiverDetails },
    ...(input.eventEnum && { eventEnum: input.eventEnum }),
  });
};

/**
 * Create anonymous email log (for unsubscribe, etc.)
 */
export const createAnonymousEmailLog = async (input: {
  email?: string; // Optional for backward compat
  event: string;
  metadata?: Record<string, any>;
  apiKey?: string; // Backward compat
  name?: string; // Backward compat
  receiverDetails?: any; // Backward compat
}): Promise<ILogDoc> => {
  return createLog({
    user: null,
    event: input.event,
    category: 'communication',
    metadata: { 
      email: input.email, 
      name: input.name, 
      apiKey: input.apiKey,
      receiverDetails: input.receiverDetails,
      ...input.metadata,
    },
  });
};

/**
 * Create anonymous unsub log
 */
export const createAnonymousUnsubLog = async (input: {
  email?: string; // Optional for backward compat
  event: string;
  metadata?: Record<string, any>;
  name?: string; // Backward compat
}): Promise<ILogDoc> => {
  return createAnonymousEmailLog({ ...input, email: input.email || input.name || '' });
};

/**
 * Log email sent
 */
export const logEmail = async (
  user: Partial<IUserDoc> | null,
  recipientEmail: string,
  subject: string,
  status: LogStatus = LogStatus.SUCCESS
): Promise<ILogDoc> => {
  return logCommunication({
    user,
    event: `Email sent: ${subject}`,
    recipientType: 'email',
    recipientValue: recipientEmail,
    status,
  });
};

/**
 * Log SMS sent
 */
export const logSMS = async (
  user: Partial<IUserDoc> | null,
  phoneNumber: string,
  content: string,
  status: LogStatus = LogStatus.SUCCESS
): Promise<ILogDoc> => {
  return logCommunication({
    user,
    event: 'SMS sent',
    recipientType: 'phone',
    recipientValue: phoneNumber,
    content,
    status,
  });
};

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Query logs with pagination
 */
export const queryLogs = async (
  filters: LogFilters,
  options: IOptions
): Promise<QueryResult> => {
  const query: Record<string, any> = {};

  if (filters['userId']) {
    query['userId'] = new mongoose.Types.ObjectId(filters['userId']);
  }

  if (filters['category']) {
    query['category'] = filters['category'];
  }

  if (filters['level']) {
    query['level'] = filters['level'];
  }

  if (filters['status']) {
    query['status'] = filters['status'];
  }

  if (filters['dateFrom'] || filters['dateTo']) {
    query['createdAt'] = {};
    if (filters['dateFrom']) {
      query['createdAt']['$gte'] = filters['dateFrom'];
    }
    if (filters['dateTo']) {
      query['createdAt']['$lte'] = filters['dateTo'];
    }
  }

  if (filters['search']) {
    query['$or'] = [
      { event: { $regex: filters['search'], $options: 'i' } },
      { userName: { $regex: filters['search'], $options: 'i' } },
    ];
  }

  const result = await Log.paginate(query, {
    ...options,
    sortBy: options.sortBy || 'createdAt:desc',
    populate: 'userId',
  });

  return result;
};

/**
 * Get logs by category
 */
export const getLogsByCategory = async (
  category: LogCategory,
  options: IOptions
): Promise<QueryResult> => {
  return queryLogs({ category }, options);
};

/**
 * Get user's logs
 */
export const getUserLogs = async (
  userId: string,
  options: IOptions
): Promise<QueryResult> => {
  return queryLogs({ userId }, options);
};

/**
 * Get recent logs
 */
export const getRecentLogs = async (limit: number = 100): Promise<ILogDoc[]> => {
  return Log.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'firstName lastName fullName email phoneNumber');
};

/**
 * Get log counts
 */
export const getLogCounts = async (): Promise<LogCounts> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, today, thisWeek, thisMonth, byCategory, byLevel] = await Promise.all([
    Log.countDocuments(),
    Log.countDocuments({ createdAt: { $gte: todayStart } }),
    Log.countDocuments({ createdAt: { $gte: weekStart } }),
    Log.countDocuments({ createdAt: { $gte: monthStart } }),
    Log.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    Log.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    total,
    today,
    thisWeek,
    thisMonth,
    byCategory: Object.fromEntries(byCategory.map(c => [c._id || 'unknown', c.count])) as Record<LogCategory, number>,
    byLevel: Object.fromEntries(byLevel.map(l => [l._id || 'unknown', l.count])) as Record<LogLevel, number>,
  };
};

/**
 * Get log by ID
 */
export const getLogById = async (id: mongoose.Types.ObjectId): Promise<ILogDoc | null> => {
  return Log.findById(id);
};

/**
 * Delete log by ID
 */
export const deleteLogById = async (id: mongoose.Types.ObjectId): Promise<ILogDoc | null> => {
  const log = await Log.findById(id);
  if (!log) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Log not found');
  }
  await log.deleteOne();
  return log;
};

/**
 * Delete old logs (for cleanup)
 */
export const deleteOldLogs = async (daysOld: number = 90): Promise<number> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await Log.deleteMany({ createdAt: { $lt: cutoffDate } });
  return result.deletedCount;
};
