import Joi from 'joi';

const getAllSubscriptions = {
  query: Joi.object().keys({
    status: Joi.string().valid('active', 'expired', 'canceled'),
    tierId: Joi.string().custom((value, helpers) => {
      if (value && !value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid tier id' });
      }
      return value;
    }),
    companyId: Joi.string().custom((value, helpers) => {
      if (value && !value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid company id' });
      }
      return value;
    }),
    search: Joi.string().allow(''),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getCompanySubscriptions = {
  params: Joi.object().keys({
    companyId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid company id' });
      }
      return value;
    }),
  }),
};

const getTierSubscriptions = {
  params: Joi.object().keys({
    tierId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid tier id' });
      }
      return value;
    }),
  }),
};

const getSubscriptionDetails = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
};

const createSubscription = {
  body: Joi.object().keys({
    companyId: Joi.string().required(),
    tierId: Joi.string().required(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    status: Joi.string().valid('active', 'expired', 'canceled').optional(),
    autoRenew: Joi.boolean().optional(),
    paymentMethod: Joi.string().optional(),
  }),
};

const updateSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
  body: Joi.object()
    .keys({
      tierId: Joi.string(),
      startDate: Joi.date(),
      endDate: Joi.date(),
      status: Joi.string().valid('active', 'expired', 'canceled'),
      autoRenew: Joi.boolean(),
      paymentMethod: Joi.string(),
    })
    .min(1),
};

const cancelSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
};

const reactivateSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
};

const extendSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
  body: Joi.object().keys({
    days: Joi.number().integer().min(1).required(),
  }),
};

const changeSubscriptionTier = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
  body: Joi.object().keys({
    tierId: Joi.string().required(),
  }),
};

const getExpiringSubscriptions = {
  query: Joi.object().keys({
    days: Joi.number().integer().min(1).max(30).optional(),
  }),
};

const getSubscriptionAnalytics = {
  query: Joi.object().keys({
    startDate: Joi.string().required(),
    endDate: Joi.string().required(),
  }),
};

const bulkUpdateSubscriptionStatus = {
  body: Joi.object().keys({
    subscriptionIds: Joi.array().items(Joi.string()).min(1).required(),
    status: Joi.string().valid('active', 'expired', 'canceled').required(),
  }),
};

const deleteSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
};

export {
  getAllSubscriptions,
  getCompanySubscriptions,
  getTierSubscriptions,
  getSubscriptionDetails,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  extendSubscription,
  changeSubscriptionTier,
  getExpiringSubscriptions,
  getSubscriptionAnalytics,
  bulkUpdateSubscriptionStatus,
  deleteSubscription,
};
