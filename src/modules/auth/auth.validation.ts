import { NewRegisteredUser, USER_TYPE } from '../user/user.interfaces';
import { password, phoneNumberValidation } from '../validate/custom.validation';

import Joi from 'joi';

const registerBody: Partial<Record<keyof NewRegisteredUser, any>> = {
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  firstName: Joi.string().optional().allow(''),
  lastName: Joi.string().optional().allow(''),
  phoneNumber: Joi.string().optional().allow('').custom(phoneNumberValidation),
  userType: Joi.string()
    .optional()
    .valid(...USER_TYPE),
};

export const register = {
  body: Joi.object().keys(registerBody),
};

export const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
    preferredLanguage: Joi.string(),
  }),
};

export const verifyEmailLogin = {
  body: Joi.object().keys({
    otp: Joi.string().required(),
    token: Joi.string().required(),
    deviceToken: Joi.string(),
    deviceType: Joi.string(),
    uniqueIdentifier: Joi.string(),
    deviceOS: Joi.string(),
    deviceName: Joi.string(),
    preferredLanguage: Joi.string(),
  }),
};

export const resendEmailLoginOTP = {
  body: Joi.object().keys({
    token: Joi.string().required(),
    preferredLanguage: Joi.string(),
  }),
};

export const sendOtpInPhoneNumber = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required().custom(phoneNumberValidation),
    userType: Joi.string(),
    preferredLanguage: Joi.string(),
  }),
};

export const sendOtpInEmail = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

export const emailChange = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    otp: Joi.string().required(),
  }),
};

export const emailChangeV2 = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    otpOld: Joi.string().optional().allow(''), // Optional for dummy email users
    otpNew: Joi.string().required(),
  }),
};

export const resendVerificationLink = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

export const messageSend = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required().custom(phoneNumberValidation),
    message: Joi.string().required(),
  }),
};

export const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
    deviceToken: Joi.string(),
  }),
};

export const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

export const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
    preferredLanguage: Joi.string(),
  }),
};

export const resetPassword = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
  }),
};

export const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required(),
    preferredLanguage: Joi.string(),
  }),
};

export const setupAccount = {
  body: Joi.object().keys({
    firstName: Joi.string().allow(''),
    lastName: Joi.string().allow(''),
    phoneNumber: Joi.string().allow(''),
    password: Joi.string().required().custom(password),
  }),
};

export const setupEmailAndPassword = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
  }),
};

export const setupPhoneAndPassword = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().required().custom(phoneNumberValidation),
    password: Joi.string().required().custom(password),
  }),
};

export const sendPhoneVerificationOTP = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().optional().custom(phoneNumberValidation),
  }),
};

export const verifyPhoneNumber = {
  body: Joi.object().keys({
    phoneNumber: Joi.string().optional().custom(phoneNumberValidation),
    otp: Joi.string().required().length(4),
  }),
};

export const impersonate = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

export const listUser = {
  params: Joi.object().keys({
    userType: Joi.string().valid(...USER_TYPE, 'ALL'),
  }),
  query: Joi.object().keys({
    country: Joi.string(),
  }),
};
