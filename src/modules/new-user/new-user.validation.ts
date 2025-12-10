import Joi from 'joi';
import { NewNewCreatedUser } from './new-user.interfaces';
import { USER_TYPE } from '../user/user.interfaces';
import { phoneNumberValidation } from '../validate/custom.validation';

const createUserBody: Record<keyof NewNewCreatedUser, any> = {
  email: Joi.string().email(),
  phoneNumber: Joi.string().required().custom(phoneNumberValidation),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  userType: Joi.string()
    .required()
    .valid(...USER_TYPE),
    companyName: Joi.string(),
    passkey: Joi.string().allow(''),
} as any;

export const createUserWithType = {
  body: Joi.object().keys(createUserBody),
};

export const approveRejectUser = {
  body: Joi.object().keys({
    uid: Joi.string().required(),
    status: Joi.string().valid('approved', 'rejected'),
    comments: Joi.string().allow(''),
  }),
};

export const getUserById = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};
