/**
 * Faisal Ride - Simplified Log System
 * Clean, effective logging for carpooling application
 */

import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';
import { QueryResult } from '../paginate/paginate';

// ============================================
// LOG CATEGORIES - What type of action occurred
// ============================================
export type LogCategory = 
  | 'auth'           // Login, logout, password reset, OTP
  | 'user'           // User profile updates, registration
  | 'trip'           // Trip creation, booking, completion
  | 'payment'        // Stripe payments, subscriptions
  | 'communication'  // Emails, SMS sent
  | 'system'         // System events, errors, webhooks
  | 'admin';         // Admin actions

export const LOG_CATEGORIES: LogCategory[] = ['auth', 'user', 'trip', 'payment', 'communication', 'system', 'admin'];

// ============================================
// LOG LEVELS - Severity of the event
// ============================================
export type LogLevel = 'info' | 'warning' | 'error' | 'success';
export const LOG_LEVELS: LogLevel[] = ['info', 'warning', 'error', 'success'];

// ============================================
// LOG STATUS - Outcome of the action
// ============================================
export enum LogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  // Backward compatibility aliases
  LOGIN_SUCCESS = 'success',
  INCORRECT_PASSWORD_OR_EMAIL = 'failed',
  NA = 'pending',
  INCORRECT_OTP = 'failed',
}

// Backward compatibility alias - must be same type as LogStatus for assignability
export const StatusEnum = LogStatus;

// ============================================
// LOG INTERFACE
// ============================================
export interface ILog {
  // Core fields
  userId: IUserDoc['_id'] | null;
  userName: string;
  userType: string;
  
  // Event details
  event: string;
  category: LogCategory;
  level: LogLevel;
  status: LogStatus;
  
  // Context
  ipAddress?: string;
  country?: string;
  
  // Additional data (flexible for different log types)
  metadata?: Record<string, any>;
  
  // For communication logs
  recipient?: {
    type: 'email' | 'phone';
    value: string;
    content?: string;
  };
  
  // Timestamps
  createdAt?: Date;
  date?: Date; // Backward compat alias for createdAt
}

export interface ILogDoc extends ILog, Document {}

export interface ILogModel extends Model<ILogDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

// ============================================
// LOG INPUT TYPES - For creating logs
// ============================================
export interface CreateLogInput {
  user: Partial<IUserDoc> | null;
  event: string;
  category?: LogCategory; // Optional for backward compat
  level?: LogLevel;
  status?: LogStatus;
  ipAddress?: string;
  metadata?: Record<string, any>;
  // Backward compatibility fields (ignored but allowed)
  ownerId?: any;
  eventEnum?: string;
  affectedUser?: any;
}

export interface CreateCommunicationLogInput {
  user: Partial<IUserDoc> | null;
  event: string;
  type?: 'email' | 'phone' | 'sms' | 'chat'; // Backward compat
  recipient?: string; // Backward compat
  recipientType?: 'email' | 'phone';
  recipientValue?: string;
  content?: string;
  status?: LogStatus;
  metadata?: Record<string, any>;
  // Backward compat fields
  eventEnum?: string;
  receiverDetails?: any;
}

// ============================================
// BACKWARD COMPATIBILITY TYPES
// ============================================
export type EventsEnum = string;
export type GPTDetails = {
  model?: string;
  prompt?: string;
  response?: string;
  tokens?: number;
  type?: string;
  tokensUsage?: number;
  charactersLength?: number;
};

// ============================================
// LOG QUERY TYPES
// ============================================
export interface LogFilters {
  userId?: string;
  category?: LogCategory;
  level?: LogLevel;
  status?: LogStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface LogCounts {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byCategory: Record<LogCategory, number>;
  byLevel: Record<LogLevel, number>;
}

export type UpdateLogBody = Partial<ILog>;
