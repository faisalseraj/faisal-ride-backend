import { EventsEnum, ILogDoc, StatusEnum } from './log.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IUserDoc, IUserType } from '../user/user.interfaces';

import ApiError from '../errors/ApiError';
import Log from './log.model';
import httpStatus from 'http-status';
import { mapUserForLogging } from './user-mapping.util';
import mongoose from 'mongoose';
import { roleRights } from '../../config/roles';
import { userService } from '../user';

export interface LogFilters {
  userId?: string | { $in: string[] };
  affectedUser?: string;
  eventType?: IUserType | 'external' | { $in: IUserType[] };
  eventEnum?: EventsEnum | { $in: EventsEnum[] };
  status?: StatusEnum;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  ipAddress?: string;
  country?: string;
  siteId?: string;
  ownerId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  action?: string;
}

export interface LogSearchOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  groupBy?: string;
  aggregate?: boolean;
}

export interface LogAccessControl {
  canViewAllLogs: boolean;
  canViewUserLogs: boolean;
  canViewSystemLogs: boolean;
  canViewSecurityLogs: boolean;
  canViewCommunicationLogs: boolean;
  canViewAILogs: boolean;
  allowedUserIds?: string[];
  allowedEventTypes?: IUserType[];
  allowedEventEnums?: EventsEnum[];
  restrictedFields?: string[];
}

export interface LogStatistics {
  totalLogs: number;
  logsByEventType: Record<string, number>;
  logsByEventEnum: Record<string, number>;
  logsByStatus: Record<string, number>;
  logsByCountry: Record<string, number>;
  logsByDate: Record<string, number>;
  recentActivity: number;
  topUsers: Array<{ userId: string; count: number; user?: any }>;
  errorRate: number;
  averageLogsPerDay: number;
}

/**
 * Get access control rules for a user based on their role
 */
export const getUserLogAccessControl = async (user: IUserDoc): Promise<LogAccessControl> => {
  const accessControl: LogAccessControl = {
    canViewAllLogs: false,
    canViewUserLogs: false,
    canViewSystemLogs: false,
    canViewSecurityLogs: false,
    canViewCommunicationLogs: false,
    canViewAILogs: false,
  };

  // Check if user has getLogs permission
  const userRights = roleRights.get(user.userType) || [];
  if (!userRights.includes('getLogs')) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied: No permission to view logs');
  }

  // Super admin has full access
  if (user.isSuperAdmin) {
    return {
      canViewAllLogs: true,
      canViewUserLogs: true,
      canViewSystemLogs: true,
      canViewSecurityLogs: true,
      canViewCommunicationLogs: true,
      canViewAILogs: true,
    };
  }

  // Admin has full access
  if (user.userType.includes('admin')) {
    accessControl.canViewAllLogs = true;
    accessControl.canViewUserLogs = true;
    accessControl.canViewSystemLogs = true;
    accessControl.canViewSecurityLogs = true;
    accessControl.canViewCommunicationLogs = true;
    accessControl.canViewAILogs = true;
  }

  // Owner access - their company's logs
  if (user.userType.includes('owner')) {
    accessControl.canViewUserLogs = true;
    accessControl.canViewSystemLogs = true;
    accessControl.canViewCommunicationLogs = true;

    // Get all users under this owner's company
    const companyUsers = await userService.getUsersByOwnerId(new mongoose.Types.ObjectId(user.id));
    accessControl.allowedUserIds = companyUsers.map((u) => u.id);

    // Set allowed event types based on company type
    if (user.userType.includes('apartment-complex-owner')) {
      accessControl.allowedEventTypes = [
        'apartment-complex-employee',
        'apartment-complex-manager',
        'apartment-complex-owner',
      ];
    } else if (user.userType.includes('tow-company-owner')) {
      accessControl.allowedEventTypes = ['tow-company-employee', 'tow-company-manager', 'tow-company-owner'];
    } else if (user.userType.includes('parking-spaces-provider-owner')) {
      accessControl.allowedEventTypes = [
        'parking-spaces-provider-employee',
        'parking-spaces-provider-manager',
        'parking-spaces-provider-owner',
      ];
    }
  }

  // Manager access - their company's logs
  if (user.userType.includes('manager')) {
    accessControl.canViewUserLogs = true;
    accessControl.canViewSystemLogs = true;
    accessControl.canViewCommunicationLogs = true;

    // Get all users under this manager's company
    const companyUsers = await userService.getUsersByOwnerId(new mongoose.Types.ObjectId(user.id));
    accessControl.allowedUserIds = companyUsers.map((u) => u.id);

    // Set allowed event types based on company type
    if (user.userType.includes('apartment-complex-manager')) {
      accessControl.allowedEventTypes = ['apartment-complex-employee', 'apartment-complex-manager'];
    } else if (user.userType.includes('tow-company-manager')) {
      accessControl.allowedEventTypes = ['tow-company-employee', 'tow-company-manager'];
    } else if (user.userType.includes('parking-spaces-provider-manager')) {
      accessControl.allowedEventTypes = ['parking-spaces-provider-employee', 'parking-spaces-provider-manager'];
    }
  }

  // Employee access - only their own logs
  if (user.userType.includes('employee')) {
    accessControl.canViewUserLogs = true;
    accessControl.allowedUserIds = [user.id];
    accessControl.allowedEventTypes = [user.userType as IUserType];
  }

  // Renter access - only their own logs
  if (user.userType === 'renter') {
    accessControl.canViewUserLogs = true;
    accessControl.allowedUserIds = [user.id];
    accessControl.allowedEventTypes = ['renter'];
  }

  return accessControl;
};

/**
 * Apply access control filters to log query
 */
export const applyAccessControl = (filters: LogFilters, accessControl: LogAccessControl): LogFilters => {
  const controlledFilters = { ...filters };

  // Apply user restrictions
  if (accessControl.allowedUserIds && !accessControl.canViewAllLogs) {
    if (controlledFilters.userId) {
      // Check if requested user is in allowed list
      if (typeof controlledFilters.userId === 'string' && !accessControl.allowedUserIds.includes(controlledFilters.userId)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Access denied to view logs for this user');
      }
    } else {
      // Filter to only allowed users
      controlledFilters.userId = { $in: accessControl.allowedUserIds };
    }
  }

  // Apply event type restrictions
  if (accessControl.allowedEventTypes && !accessControl.canViewAllLogs) {
    controlledFilters.eventType = { $in: accessControl.allowedEventTypes };
  }

  // Apply event enum restrictions
  if (accessControl.allowedEventEnums && !accessControl.canViewAllLogs) {
    controlledFilters.eventEnum = { $in: accessControl.allowedEventEnums };
  }

  return controlledFilters;
};

/**
 * Enhanced log search with advanced filtering and RBAC
 */
export const searchLogs = async (
  user: IUserDoc,
  filters: LogFilters = {},
  options: LogSearchOptions = {}
): Promise<QueryResult> => {
  try {
    // Get user access control
    const accessControl = await getUserLogAccessControl(user);

    // Apply access control
    const controlledFilters = applyAccessControl(filters, accessControl);

    // Build MongoDB query
    const query: any = {};

    // Basic filters
    if (controlledFilters.userId) {
      if (typeof controlledFilters.userId === 'string') {
        query.userId = new mongoose.Types.ObjectId(controlledFilters.userId);
      } else {
        query.userId = controlledFilters.userId;
      }
    }

    if (controlledFilters.affectedUser) {
      query.affectedUser = new mongoose.Types.ObjectId(controlledFilters.affectedUser);
    }

    if (controlledFilters.eventType) {
      if (typeof controlledFilters.eventType === 'string') {
        query.eventType = controlledFilters.eventType;
      } else {
        query.eventType = controlledFilters.eventType;
      }
    }

    if (controlledFilters.eventEnum) {
      query.eventEnum = controlledFilters.eventEnum;
    }

    if (controlledFilters.status) {
      query.status = controlledFilters.status;
    }

    if (controlledFilters.ipAddress) {
      query.ipAddress = { $regex: controlledFilters.ipAddress, $options: 'i' };
    }

    if (controlledFilters.country) {
      query.country = { $regex: controlledFilters.country, $options: 'i' };
    }

    if (controlledFilters.siteId) {
      query.siteId = controlledFilters.siteId;
    }

    if (controlledFilters.ownerId) {
      query.ownerId = controlledFilters.ownerId;
    }

    // Date range filters
    if (controlledFilters.dateFrom || controlledFilters.dateTo) {
      query.date = {};
      if (controlledFilters.dateFrom) {
        query.date.$gte = controlledFilters.dateFrom;
      }
      if (controlledFilters.dateTo) {
        query.date.$lte = controlledFilters.dateTo;
      }
    }

    // Text search
    if (controlledFilters.search) {
      query.$or = [
        { event: { $regex: controlledFilters.search, $options: 'i' } },
        { name: { $regex: controlledFilters.search, $options: 'i' } },
        { phoneNumber: { $regex: controlledFilters.search, $options: 'i' } },
      ];
    }

    // Exclude archived logs unless specifically requested
    if (!options.includeArchived) {
      query.isArchived = { $ne: true };
    }

    // Build options
    const queryOptions: IOptions = {
      page: options.page || 1,
      limit: options.limit || 20,
      sortBy: options.sortBy || 'createdAt:desc',
    };

    // Execute query with pagination
    const result = await Log.paginate(query, {
      ...queryOptions,
      populate: 'userId affectedUser',
    });

    // Apply field restrictions if any
    if (accessControl.restrictedFields && result.results) {
      result.results = result.results.map((log: any) => {
        const restrictedLog = { ...log.toObject() };
        accessControl.restrictedFields!.forEach((field) => {
          delete restrictedLog[field];
        });
        return restrictedLog;
      });
    }

    return result;
  } catch (error) {
    console.error('Error in enhanced log search:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to search logs');
  }
};

/**
 * Get log statistics with RBAC
 */
export const getLogStatistics = async (
  user: IUserDoc,
  filters: LogFilters = {},
  dateRange?: { from: string; to: string }
): Promise<LogStatistics> => {
  try {
    const accessControl = await getUserLogAccessControl(user);
    const controlledFilters = applyAccessControl(filters, accessControl);

    // Build base query
    const baseQuery: any = {};
    if (controlledFilters.userId) {
      baseQuery.userId =
        typeof controlledFilters.userId === 'string'
          ? new mongoose.Types.ObjectId(controlledFilters.userId)
          : controlledFilters.userId;
    }

    // Add date range if provided
    if (dateRange) {
      baseQuery.date = {
        $gte: dateRange.from,
        $lte: dateRange.to,
      };
    }

    // Get total logs
    const totalLogs = await Log.countDocuments(baseQuery);

    // Get logs by event type
    const logsByEventType = await Log.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $project: { eventType: '$_id', count: 1, _id: 0 } },
    ]);

    // Get logs by event enum
    const logsByEventEnum = await Log.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$eventEnum', count: { $sum: 1 } } },
      { $project: { eventEnum: '$_id', count: 1, _id: 0 } },
    ]);

    // Get logs by status
    const logsByStatus = await Log.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]);

    // Get logs by country
    const logsByCountry = await Log.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $project: { country: '$_id', count: 1, _id: 0 } },
    ]);

    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentActivity = await Log.countDocuments({
      ...baseQuery,
      date: { $gte: oneDayAgo },
    });

    // Get top users
    const topUsers = await Log.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          count: 1,
          user: {
            fullName: '$user.fullName',
            email: '$user.email',
            userType: '$user.userType',
          },
        },
      },
    ]);

    // Calculate error rate
    const errorLogs = await Log.countDocuments({
      ...baseQuery,
      status: { $in: ['INCORRECT_PASSWORD_OR_EMAIL', 'INCORRECT_OTP'] },
    });
    const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

    // Calculate average logs per day
    const dateRangeDays = dateRange
      ? Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const averageLogsPerDay = totalLogs / dateRangeDays;

    return {
      totalLogs,
      logsByEventType: logsByEventType.reduce((acc, item) => {
        acc[item.eventType] = item.count;
        return acc;
      }, {} as Record<string, number>),
      logsByEventEnum: logsByEventEnum.reduce((acc, item) => {
        acc[item.eventEnum] = item.count;
        return acc;
      }, {} as Record<string, number>),
      logsByStatus: logsByStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>),
      logsByCountry: logsByCountry.reduce((acc, item) => {
        acc[item.country] = item.count;
        return acc;
      }, {} as Record<string, number>),
      logsByDate: {}, // This would need additional aggregation for date grouping
      recentActivity,
      topUsers,
      errorRate,
      averageLogsPerDay,
    };
  } catch (error) {
    console.error('Error getting log statistics:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get log statistics');
  }
};

/**
 * Export logs with RBAC
 */
export const exportLogs = async (
  user: IUserDoc,
  filters: LogFilters = {},
  format: 'csv' | 'json' | 'xlsx' = 'csv'
): Promise<Buffer> => {
  try {
    const accessControl = await getUserLogAccessControl(user);
    const controlledFilters = applyAccessControl(filters, accessControl);

    // Build query (same as searchLogs but without pagination)
    const query: any = {};
    if (controlledFilters.userId) {
      query.userId =
        typeof controlledFilters.userId === 'string'
          ? new mongoose.Types.ObjectId(controlledFilters.userId)
          : controlledFilters.userId;
    }
    // ... (apply other filters similar to searchLogs)

    const logs = await Log.find(query).populate('userId affectedUser').sort({ createdAt: -1 }).lean();

    // Apply field restrictions
    if (accessControl.restrictedFields) {
      logs.forEach((log: any) => {
        accessControl.restrictedFields!.forEach((field) => {
          delete log[field];
        });
      });
    }

    // Convert to requested format
    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(logs, null, 2));
      case 'csv':
        // Implement CSV conversion
        const csvHeaders = Object.keys(logs[0] || {}).join(',');
        const csvRows = logs.map((log) => Object.values(log).join(','));
        const csvContent = [csvHeaders, ...csvRows].join('\n');
        return Buffer.from(csvContent);
      case 'xlsx':
        // Implement XLSX conversion (would need xlsx library)
        throw new ApiError(httpStatus.NOT_IMPLEMENTED, 'XLSX export not implemented yet');
      default:
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid export format');
    }
  } catch (error) {
    console.error('Error exporting logs:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to export logs');
  }
};

/**
 * Create enhanced log entry with additional metadata
 */
export const createEnhancedLog = async (logData: {
  user: Partial<IUserDoc>;
  event: string;
  eventEnum: EventsEnum;
  category?: string;
  action?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  affectedUser?: string;
  siteId?: string;
  ipAddress?: string;
  status?: StatusEnum;
  ownerId?: mongoose.Types.ObjectId | null;
}): Promise<ILogDoc> => {
  try {
    // Use the dynamic user mapping utility to handle both Mongoose docs and plain objects
    const userWithRequiredFields = mapUserForLogging(logData.user);

    const enhancedLogData = {
      // Flatten user fields to match log model schema
      name: userWithRequiredFields.name,
      phoneNumber: userWithRequiredFields.phoneNumber,
      userId: userWithRequiredFields.id,
      event: logData.event,
      eventEnum: logData.eventEnum,
      eventType: userWithRequiredFields.userType || 'admin',
      date: new Date().toISOString(),
      country: userWithRequiredFields['country'] || 'Global',
      ipAddress: logData.ipAddress,
      status: logData.status,
      ownerId: logData.ownerId,
      affectedUser: logData.affectedUser,
      siteId: logData.siteId,
      // Store enhanced metadata in dedicated field
      enhancedMetadata: logData.metadata ? {
        ...logData.metadata,
        category: logData.category,
        action: logData.action,
        priority: logData.priority || 'medium',
        timestamp: new Date().toISOString(),
        version: '2.0',
      } : undefined,
    };

    return await Log.create(enhancedLogData);
  } catch (error) {
    console.error('Error in createEnhancedLog:', error);
    console.error('Log data that failed:', JSON.stringify(logData, null, 2));

    // Create a minimal log entry as fallback
    const fallbackLogData = {
      name: 'System',
      phoneNumber: '',
      id: new mongoose.Types.ObjectId('000000000000000000000000'), // System user ID for Stripe webhooks
      event: logData.event || 'Unknown Event',
      eventEnum: logData.eventEnum || 'UE',
      eventType: 'admin',
      date: new Date().toISOString(),
      country: 'Global',
      ipAddress: logData.ipAddress,
      status: logData.status,
      ownerId: logData.ownerId,
      affectedUser: logData.affectedUser,
      siteId: logData.siteId,
      enhancedMetadata: {
        ...logData.metadata,
        category: logData.category || 'system',
        action: logData.action || 'error',
        priority: 'high',
        originalError: (error as any)?.message,
        timestamp: new Date().toISOString(),
        version: '2.0-fallback',
      },
    };

    return await Log.create(fallbackLogData);
  }
};

/**
 * Get detailed information for a specific log
 */
export const getLogDetails = async (user: IUserDoc, logId: string): Promise<any> => {
  try {
    // Get user access control
    const accessControl = await getUserLogAccessControl(user);

    // Find the log with full population
    const log = await Log.findById(logId)
      .populate('userId', 'fullName email userType phoneNumber')
      .populate('affectedUser', 'fullName email userType phoneNumber')
      .lean();

    if (!log) {
      return null;
    }

    // Check if user has access to this specific log
    if (!accessControl.canViewAllLogs) {
      if (accessControl.allowedUserIds && !accessControl.allowedUserIds.includes(log.userId?._id?.toString())) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Access denied to view this log');
      }
    }

    // Format the detailed log information
    const detailedLog = {
      ...log,
      formattedDate: new Date((log as any).createdAt).toLocaleString(),
      userInfo: log.userId
        ? {
            id: log.userId._id,
            name: log.userId.fullName,
            email: log.userId.email,
            userType: log.userId.userType,
            phoneNumber: log.userId.phoneNumber,
          }
        : null,
      affectedUserInfo: log.affectedUser
        ? {
            id: log.affectedUser._id,
            name: log.affectedUser.fullName,
            email: log.affectedUser.email,
            userType: log.affectedUser.userType,
            phoneNumber: log.affectedUser.phoneNumber,
          }
        : null,
      metadata: {
        ...(log as any).enhancedMetadata,
        formattedTimestamp: (log as any).enhancedMetadata?.timestamp
          ? new Date((log as any).enhancedMetadata.timestamp).toLocaleString()
          : null,
      },
      systemInfo: {
        ipAddress: (log as any).ipAddress,
        country: (log as any).country,
        userAgent: (log as any).userAgent,
        siteId: (log as any).siteId,
      },
      eventDetails: {
        event: (log as any).event,
        eventEnum: (log as any).eventEnum,
        eventType: (log as any).eventType,
        status: (log as any).status,
        priority: (log as any).enhancedMetadata?.priority || 'medium',
        category: (log as any).enhancedMetadata?.category || 'general',
        action: (log as any).enhancedMetadata?.action || 'unknown',
      },
    };

    return detailedLog;
  } catch (error) {
    console.error('Error getting log details:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get log details');
  }
};
