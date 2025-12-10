import { EventsEnum, StatusEnum } from './log.interfaces';

import { ApiError } from '../errors';
import { IUserDoc } from '../user/user.interfaces';
import { createEnhancedLog } from './enhanced-log.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Enhanced Log Migration Service
 * 
 * This service provides utilities to migrate from the old logService.createLog
 * to the new createEnhancedLog functionality with enhanced metadata and better error handling.
 */

export interface LegacyLogData {
  user: Partial<IUserDoc>;
  event: string;
  siteId?: string;
  affectedUser?: string;
  userType?: string;
  eventEnum: EventsEnum;
  ipAddress?: string;
  status?: StatusEnum;
  ownerId?: mongoose.Types.ObjectId | null;
}

export interface EnhancedLogData {
  user: Partial<IUserDoc>;
  event: string;
  eventEnum: EventsEnum;
  category?: string;
  action?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
  affectedUser?: string ;
  siteId?: string | undefined;
  ipAddress?: string | undefined;
  status?: StatusEnum | undefined;
  ownerId?: mongoose.Types.ObjectId | null | undefined;
}

/**
 * Migrate legacy log data to enhanced log format
 */
export const migrateLegacyLog = async (legacyData: LegacyLogData): Promise<any> => {
  try {
    // Extract category and action from event string
    const { category, action, priority } = extractEventDetails(legacyData.event, legacyData.eventEnum);
    
    // Prepare enhanced metadata
    const enhancedMetadata = {
      legacyEvent: legacyData.event,
      userType: legacyData.userType,
      siteId: legacyData.siteId,
      timestamp: new Date().toISOString(),
      migrationVersion: '1.0',
      ...(legacyData.status && { status: legacyData.status }),
    };

    // Create enhanced log data
    const enhancedData: EnhancedLogData = {
      user: legacyData.user,
      event: legacyData.event,
      eventEnum: legacyData.eventEnum,
      category,
      action,
      priority,
      metadata: enhancedMetadata,
    ...(legacyData.affectedUser && { affectedUser: legacyData.affectedUser! }),
    ...(legacyData.siteId && { siteId: legacyData.siteId }),
    ...(legacyData.ipAddress && { ipAddress: legacyData.ipAddress }),
    ...(legacyData.status && { status: legacyData.status }),
    ...(legacyData.ownerId && { ownerId: legacyData.ownerId }),      
    };

    return await createEnhancedLog(enhancedData as any);
  } catch (error:any) {
    console.error('Error migrating legacy log:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error migrating legacy log');
  }
};

/**
 * Extract category, action, and priority from event string and event enum
 */
const extractEventDetails = (event: string, eventEnum: EventsEnum) => {
  let category = 'general';
  let action = 'unknown';
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  // Extract category based on event enum
  switch (eventEnum) {
    case 'UE': // User Event
      category = 'user_management';
      break;
    case 'MaE': // Management Event
      category = 'management';
      break;
    case 'AE': // Admin Event
      category = 'admin';
      break;
    case 'SSE': // System Event
      category = 'system';
      break;
    case 'LE': // Login Event
      category = 'authentication';
      break;
    case 'ComE': // Email Event
      category = 'communication';
      break;
    case 'ComE': // Communication Event
      category = 'communication';
      break;
    case 'FE': // File Event
      category = 'file';
      break;
    case 'UME': // User Management Event
      category = 'user_management';
      break;
    case 'CE': // Chat Event
      category = 'chat';
      break;
    case 'GPTE': // GPT Event
      category = 'ai';
      break;
    case 'ACE': // Apartment Complex Event
      category = 'apartment_complex';
      break;
    case 'TWE': // Tow Event
      category = 'tow_request';
      break;
    case 'PBE': // Parking Booking Event
      category = 'parking_booking';
      break;
    case 'SE': // Socket Event
      category = 'socket';
      break;
    case 'STE': // Stripe Event
      // Category will be determined by event content for Stripe events
      category = 'payment';
      break;
    default:
      category = 'general';
  }

  // For Stripe events, determine specific category based on event content
  if (eventEnum === 'STE') {
    const eventLower = event.toLowerCase();
    if (eventLower.includes('checkout') && eventLower.includes('verify')) {
      category = 'checkout_verification';
    } else if (eventLower.includes('checkout') && eventLower.includes('completed')) {
      category = 'checkout_completion';
    } else if (eventLower.includes('payment') && eventLower.includes('succeeded')) {
      category = 'payment_success';
    } else if (eventLower.includes('payment') && eventLower.includes('failed')) {
      category = 'payment_failure';
    } else if (eventLower.includes('subscription') && eventLower.includes('deleted')) {
      category = 'subscription_cancellation';
    } else if (eventLower.includes('subscription') && eventLower.includes('updated')) {
      category = 'subscription_update';
    } else if (eventLower.includes('webhook')) {
      category = 'webhook_processing';
    }
  }

  // Extract action and priority from event string
  const eventLower = event.toLowerCase();
  
  if (eventLower.includes('create') || eventLower.includes('created')) {
    action = 'create';
    priority = 'medium';
  } else if (eventLower.includes('update') || eventLower.includes('updated')) {
    action = 'update';
    priority = 'medium';
  } else if (eventLower.includes('delete') || eventLower.includes('deleted')) {
    action = 'delete';
    priority = 'high';
  } else if (eventLower.includes('login') || eventLower.includes('logged')) {
    action = 'login';
    priority = 'low';
  } else if (eventLower.includes('logout') || eventLower.includes('logged out')) {
    action = 'logout';
    priority = 'low';
  } else if (eventLower.includes('suspend') || eventLower.includes('suspended')) {
    action = 'suspend';
    priority = 'high';
  } else if (eventLower.includes('resume') || eventLower.includes('resumed')) {
    action = 'resume';
    priority = 'high';
  } else if (eventLower.includes('archive') || eventLower.includes('archived')) {
    action = 'archive';
    priority = 'high';
  } else if (eventLower.includes('promote') || eventLower.includes('promoted')) {
    action = 'promote';
    priority = 'high';
  } else if (eventLower.includes('demote') || eventLower.includes('demoted')) {
    action = 'demote';
    priority = 'high';
  } else if (eventLower.includes('verify') || eventLower.includes('verified')) {
    action = 'verify';
    priority = 'medium';
  } else if (eventLower.includes('email') || eventLower.includes('sent')) {
    action = 'email_send';
    priority = 'low';
  } else if (eventLower.includes('otp') || eventLower.includes('code')) {
    action = 'otp_send';
    priority = 'low';
  } else if (eventLower.includes('error') || eventLower.includes('failed')) {
    action = 'error';
    priority = 'critical';
  } else if (eventLower.includes('success') || eventLower.includes('successful')) {
    action = 'success';
    priority = 'low';
  }

  return { category, action, priority };
};

/**
 * Create enhanced log with automatic category/action detection
 */
export const createEnhancedLogAuto = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  eventEnum: EventsEnum;
  affectedUser?: string;
  siteId?: string;
  ipAddress?: string;
  status?: StatusEnum;
  ownerId?: mongoose.Types.ObjectId | null;
  customMetadata?: any;
}): Promise<any> => {

  const { category, action, priority } = extractEventDetails(data.event, data.eventEnum);
  
  const enhancedMetadata = {
    ...data.customMetadata,
    timestamp: new Date().toISOString(),
    version: '2.0',
  };

  return await createEnhancedLog({
    user: data.user,
    event: data.event,
    eventEnum: data.eventEnum,
    category,
    action,
    priority,
    metadata: enhancedMetadata,
    ...(data.affectedUser && { affectedUser: data.affectedUser }),
    ...(data.siteId && { siteId: data.siteId }),
    ...(data.ipAddress && { ipAddress: data.ipAddress }),
    ...(data.status && { status: data.status }),
    ...(data.ownerId && { ownerId: data.ownerId }),
  });
};

/**
 * Batch migrate multiple legacy logs
 */
export const batchMigrateLegacyLogs = async (legacyLogs: LegacyLogData[]): Promise<any[]> => {
  const results = [];
  
  for (const legacyLog of legacyLogs) {
    try {
      const result = await migrateLegacyLog(legacyLog);
      results.push(result);
    } catch (error:any) {
      console.error('Error migrating legacy log:', error);
      results.push({ error: error?.message, originalData: legacyLog });
    }
  }
  
  return results;
};

/**
 * Helper function to create enhanced logs for common patterns
 */
export const createUserManagementLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ownerId?: mongoose.Types.ObjectId | null;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'UE',
    customMetadata: {
      ...data.customMetadata,
      module: 'user_management',
    },
  });
};

export const createAuthLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'LE',
    customMetadata: {
      ...data.customMetadata,
      module: 'authentication',
    },
  });
};

export const createEmailLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'ComE',
    customMetadata: {
      ...data.customMetadata,
      module: 'email',
    },
  });
};

export const createSystemLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'SSE',
    customMetadata: {
      ...data.customMetadata,
      module: 'system',
    },
  });
};

export const createOtpLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'ComE',
    customMetadata: {
      ...data.customMetadata,
      module: 'otp',
    },
  });
};

export const createTowRequestLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'TWE',
    customMetadata: {
      ...data.customMetadata,
      module: 'tow_request',
    },
  });
};

export const createParkingBookingLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'PBE',
    customMetadata: {
      ...data.customMetadata,
      module: 'parking_booking',
    },
  });
};

export const createSocketLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'SE',
    customMetadata: {
      ...data.customMetadata,
      module: 'socket',
    },
  });
};

export const createChatLog = async (data: {
  user: Partial<IUserDoc>;
  event: string;
  affectedUser?: string;
  ipAddress?: string;
  customMetadata?: any;
}): Promise<any> => {
  return createEnhancedLogAuto({
    ...data,
    eventEnum: 'CE',
    customMetadata: {
      ...data.customMetadata,
      module: 'chat',
    },
  });
};
