import Joi from 'joi';

// Validation schemas for report endpoints

export const generateAdminReport = {
  query: Joi.object().keys({
    span: Joi.string().valid('weekly', 'monthly', 'yearly').optional().default('weekly'),
  }),
};

export const generateCompanyReport = {
  query: Joi.object().keys({
    span: Joi.string().valid('weekly', 'monthly', 'yearly').optional().default('weekly'),
  }),
};

