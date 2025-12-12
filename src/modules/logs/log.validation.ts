/**
 * Faisal Ride - Log Validation
 * Joi schemas for log API endpoints
 */

import { LOG_CATEGORIES, LOG_LEVELS, LogStatus } from './log.interfaces';

import Joi from 'joi';

export const getLogs = {
  query: Joi.object().keys({
    userId: Joi.string(),
    category: Joi.string().valid(...LOG_CATEGORIES),
    level: Joi.string().valid(...LOG_LEVELS),
    status: Joi.string().valid(...Object.values(LogStatus)),
    dateFrom: Joi.date(),
    dateTo: Joi.date(),
    search: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

export const getLogsByCategory = {
  params: Joi.object().keys({
    category: Joi.string().valid(...LOG_CATEGORIES).required(),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

export const getUserLogs = {
  params: Joi.object().keys({
    userId: Joi.string().required(),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
  }),
};

export const getLog = {
  params: Joi.object().keys({
    logId: Joi.string().required(),
  }),
};

export const deleteLog = {
  params: Joi.object().keys({
    logId: Joi.string().required(),
  }),
};

export const cleanupOldLogs = {
  query: Joi.object().keys({
    daysOld: Joi.number().integer().min(1).max(365),
  }),
};

// Backward compatibility validation
export const anonymousSMSLog = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required(),
    message: Joi.string(),
    status: Joi.string().valid('success', 'failed'),
    metadata: Joi.object(),
  }),
};
