import Joi from 'joi';

const sendSMSBody: Record<string, any> = {
  to: Joi.string().required().pattern(/^\+?[1-9]\d{1,14}$/).messages({
    'string.pattern.base': 'Phone number must be in valid international format (e.g., +1234567890)',
  }),
  body: Joi.string().required().min(1).max(1600).messages({
    'string.min': 'SMS body cannot be empty',
    'string.max': 'SMS body cannot exceed 1600 characters',
  }),
};

const sendOneTimeLinkSMSBody: Record<string, any> = {
  phoneNumber: Joi.string().required().pattern(/^\+?[1-9]\d{1,14}$/).messages({
    'string.pattern.base': 'Phone number must be in valid international format (e.g., +1234567890)',
  }),
  link: Joi.string().required().uri().messages({
    'string.uri': 'Link must be a valid URL',
  }),
  linkTitle: Joi.string().required().min(1).max(50).messages({
    'string.min': 'Link title cannot be empty',
    'string.max': 'Link title cannot exceed 50 characters',
  }),
  receiverName: Joi.string().optional().min(1).max(100),
  expirationTime: Joi.string().optional().isoDate(),
  purpose: Joi.string().optional().valid(
    'password-reset',
    'account-verification', 
    'tow-invite',
    'general'
  ),
};

const sendTemplatedSMSBody: Record<string, any> = {
  phoneNumber: Joi.string().required().pattern(/^\+?[1-9]\d{1,14}$/).messages({
    'string.pattern.base': 'Phone number must be in valid international format (e.g., +1234567890)',
  }),
  template: Joi.string().required().min(1).max(1600),
  data: Joi.object().required(),
  receiverName: Joi.string().optional().min(1).max(100),
};

const getSMSStatusParams: Record<string, any> = {
  messageId: Joi.string().required().pattern(/^SM[a-f0-9]{32}$/).messages({
    'string.pattern.base': 'Invalid Twilio message ID format',
  }),
};

export const sendSMS = {
  body: Joi.object().keys(sendSMSBody),
};

export const sendOneTimeLinkSMS = {
  body: Joi.object().keys(sendOneTimeLinkSMSBody),
};

export const sendTemplatedSMS = {
  body: Joi.object().keys(sendTemplatedSMSBody),
};

export const getSMSStatus = {
  params: Joi.object().keys(getSMSStatusParams),
};
