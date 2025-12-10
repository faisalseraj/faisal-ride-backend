import Joi from 'joi';
import { objectId } from '../validate/custom.validation';

const createPasskeyBody: Record<string, any> = {
  pspId: Joi.string().required().custom(objectId),
  towCompanyId: Joi.string().required().custom(objectId),
  passkey: Joi.string()
    .required()
    .pattern(/^\d{4}$/)
    .messages({
      'string.pattern.base': 'Passkey must be exactly 4 digits',
    }),
};

const validatePasskeyBody: Record<string, any> = {
  pspId: Joi.string().required().custom(objectId),
  towCompanyId: Joi.string().required().custom(objectId),
  passkey: Joi.string()
    .required()
    .pattern(/^\d{4}$/)
    .messages({
      'string.pattern.base': 'Passkey must be exactly 4 digits',
    }),
};

const deletePasskeyBody: Record<string, any> = {
  pspId: Joi.string().required().custom(objectId),
  towCompanyId: Joi.string().required().custom(objectId),
};

export const createPasskey = {
  body: Joi.object().keys(createPasskeyBody),
};

export const validatePasskey = {
  body: Joi.object().keys(validatePasskeyBody),
};

export const deletePasskey = {
  body: Joi.object().keys(deletePasskeyBody),
};

export const getPasskey = {
  query: Joi.object().keys({
    pspId: Joi.string().required().custom(objectId),
    towCompanyId: Joi.string().required().custom(objectId),
  }),
};

export const checkPasskeyRequirement = {
  params: Joi.object().keys({
    pspId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    towCompanyId: Joi.string().required().custom(objectId),
  }),
};

export const getPasskeysForPSP = {
  params: Joi.object().keys({
    pspId: Joi.string().required().custom(objectId),
  }),
};

export const getPasskeysForTowCompany = {
  params: Joi.object().keys({
    towCompanyId: Joi.string().required().custom(objectId),
  }),
};
