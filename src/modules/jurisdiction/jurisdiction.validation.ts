import Joi from 'joi';

const charges = Joi.object().keys({
  unloadedEnrouteMileage: Joi.number().required(),
  loadedHookedMileage: Joi.number().required(),
  impoundFee: Joi.number().required(),
  privatePropertyTowFee: Joi.number().required(),
  notificationFee: Joi.number().required(),
  dailyImpoundRate: Joi.number().required(),
});

export const createJurisdiction = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
    county: Joi.string().required(),
    charges: charges.required(),
    chargesUpdatedAt: Joi.date().allow(null),
    isVerified: Joi.boolean(),
  }),
};

export const updateJurisdiction = {
  body: Joi.object().keys({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    lat: Joi.number().required(),
    lng: Joi.number().required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    zip: Joi.string().required(),
    county: Joi.string().required(),
    charges: charges,
    chargesUpdatedAt: Joi.date().allow(null),
    isVerified: Joi.boolean(),
  }),
};

export const getJurisdictions = {
  query: Joi.object().keys({
    name: Joi.string(),
    search: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    isVerified: Joi.boolean(),
  }),
};

export const bulkUpdateJurisdictions = {
  body: Joi.object().keys({
    jurisdictionIds: Joi.array().items(Joi.string().required()).min(1).required(),
    updates: Joi.object().keys({
      isVerified: Joi.boolean(),
      chargesUpdatedAt: Joi.date().allow(null),
    }).min(1).required(),
  }),
};
