import Joi from 'joi';
import { NewCreatedUnsub } from './unsub.interfaces';

const createUnsubBody: Record<keyof NewCreatedUnsub, any> = {
  contactInfo: Joi.string().required(),
  contactType: Joi.string().required().valid('EMAIL', 'SMS'),
  source: Joi.string().required().valid('EMAIL_API', 'MENU_SHARING_SMS'),
  unsubscribedOn: Joi.string(),
};

export const createUnsub = {
  body: Joi.object().keys(createUnsubBody),
};

export const unsubscribe = {
  body: Joi.object().keys({
    unsubToken: Joi.string().required(),
  }),
};
