import Joi from 'joi';
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

const getSubscriptions = {
  query: Joi.object().keys({
    companyId: Joi.string(),
    tierId: Joi.string(),
    status: Joi.string().valid('active', 'expired', 'canceled'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
  }),
};

const getCompanySubscription = {
  params: Joi.object().keys({
    companyId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid company id' });
      }
      return value;
    }),
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

const renewSubscription = {
  params: Joi.object().keys({
    subscriptionId: Joi.string().custom((value, helpers) => {
      if (!value.match(/^[0-9a-fA-F]{24}$/)) {
        return helpers.message({ custom: 'Invalid subscription id' });
      }
      return value;
    }),
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

export {
  createSubscription,
  getSubscriptions,
  getSubscription,
  getCompanySubscription,
  updateSubscription,
  cancelSubscription,
  renewSubscription,
  changeSubscriptionTier,
};
