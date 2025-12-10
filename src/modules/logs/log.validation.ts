import { objectId, phoneNumberValidation } from '../validate/custom.validation';

import Joi from 'joi';
import { NewCreatedLog } from './log.interfaces';
import { USER_TYPE } from '../user/user.interfaces';

const createLogBody: Record<keyof NewCreatedLog, any> = {
  phoneNumber: Joi.string().required().custom(phoneNumberValidation),
  date: Joi.string(),
  country: Joi.string(),
  siteId: Joi.string(),
  eventEnum: Joi.string(),
  affectedUser: Joi.string(),
  name: Joi.string().required(),
  eventType: Joi.string()
    .required()
    .valid(...USER_TYPE, 'external'),
  event: Joi.string().required(),
  userId: Joi.string().required(),
  ownerId: Joi.string(),
  ipAddress: Joi.string(),
  status: Joi.string(),
  apiKey: Joi.string(),
  receiverDetails: Joi.object().keys({
    name: Joi.string(),
    sentTo: Joi.string(),
    type: Joi.string(),
    content: Joi.string(),
  }),
  GPTDetails: Joi.object(),
  enhancedMetadata: Joi.object().allow(null),
};

export const createLog = {
  body: Joi.object().keys(createLogBody),
};

export const getLogs = {
  query: Joi.object().keys({
    phoneNumber: Joi.string().custom(phoneNumberValidation),
    name: Joi.string(),
    eventType: Joi.string(),
    eventEnum: Joi.string(),
    from: Joi.string(),
    to: Joi.string(),
    event: Joi.string(),
    country: Joi.string(),
    userId: Joi.string(),
    search: Joi.string(),
    affectedUser: Joi.string(),
    siteId: Joi.string().allow(""),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getLog = {
  params: Joi.object().keys({
    logId: Joi.string().custom(objectId),
  }),
};

export const updateLog = {
  params: Joi.object().keys({
    logId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      phoneNumber: Joi.string().custom(phoneNumberValidation),
      name: Joi.string(),
      eventType: Joi.string(),
      event: Joi.string(),
      userId: Joi.string(),
    })
    .min(1),
};

export const deleteLog = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export const anonymousSMSLog = {
  name: Joi.string().required(),
  phoneNumber: Joi.string().required(),
  content: Joi.string().required(),
};
