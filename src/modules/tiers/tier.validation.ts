import * as Joi from 'joi';

const createTier = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    price: Joi.number().min(0).required(),
    billingInterval: Joi.string().valid('day', 'week', 'month', 'year').required(),
    freeTowRequests: Joi.number().min(0).default(0),
    additionalTowCost: Joi.number().min(0).required(),
    features: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().default(true),
  }),
};

const updateTier = {
  params: Joi.object().keys({
    tierId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    price: Joi.number().min(0).optional(),
    billingInterval: Joi.string().valid('day', 'week', 'month', 'year').optional(),
    freeTowRequests: Joi.number().min(0).optional(),
    additionalTowCost: Joi.number().min(0).optional(),
    features: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const tierValidation = {
  createTier,
  updateTier,
};
