import Joi from 'joi';

export const createRevenue = {
  body: Joi.object().keys({
    subscriptionId: Joi.string().required(),
    companyId: Joi.string().required(),
    tierId: Joi.string().required(),
    amount: Joi.number().min(0).required(),
    billingInterval: Joi.string().valid('day', 'week', 'month', 'year').required(),
    paymentDate: Joi.date().default(Date.now),
    stripeInvoiceId: Joi.string().required(),
    stripePaymentIntentId: Joi.string().optional(),
    status: Joi.string().valid('succeeded', 'failed', 'refunded').default('succeeded'),
    currency: Joi.string().default('usd'),
    metadata: Joi.object().keys({
      periodStart: Joi.date().optional(),
      periodEnd: Joi.date().optional(),
      tierName: Joi.string().optional(),
      companyName: Joi.string().optional(),
    }).optional(),
  }),
};

export const updateRevenue = {
  params: Joi.object().keys({
    revenueId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      amount: Joi.number().min(0),
      status: Joi.string().valid('succeeded', 'failed', 'refunded'),
      metadata: Joi.object().keys({
        periodStart: Joi.date().optional(),
        periodEnd: Joi.date().optional(),
        tierName: Joi.string().optional(),
        companyName: Joi.string().optional(),
      }).optional(),
    })
    .min(1),
};

export const getRevenue = {
  params: Joi.object().keys({
    revenueId: Joi.string().required(),
  }),
};

export const deleteRevenue = {
  params: Joi.object().keys({
    revenueId: Joi.string().required(),
  }),
};
