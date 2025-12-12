/**
 * Faisal Ride - User Validation
 * Simplified validation for carpooling application
 */

import { objectId, password, phoneNumberValidation } from '../validate/custom.validation';

import Joi from 'joi';
import { USER_TYPE } from './user.interfaces';

// ============================================
// USER CREATION
// ============================================

export const createUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    phoneNumber: Joi.string().custom(phoneNumberValidation),
    password: Joi.string().required().custom(password),
    firstName: Joi.string().required(),
    lastName: Joi.string(),
    userType: Joi.string().valid(...USER_TYPE).default('rider'),
  }),
};

export const createRider = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    phoneNumber: Joi.string().custom(phoneNumberValidation),
    password: Joi.string().required().custom(password),
    firstName: Joi.string().required(),
    lastName: Joi.string(),
  }),
};

export const createAdmin = {
  body: Joi.object().keys({
    email: Joi.string().email(),
    phoneNumber: Joi.string().custom(phoneNumberValidation),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
  }),
};

// ============================================
// USER RETRIEVAL
// ============================================

export const getUsers = {
  query: Joi.object().keys({
    userType: Joi.string().valid(...USER_TYPE, 'ALL'),
    isVerified: Joi.boolean(),
    isSuspended: Joi.boolean(),
    isArchived: Joi.boolean(),
    isDriverVerified: Joi.boolean(),
    city: Joi.string(),
    search: Joi.string(),
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100).default(10),
    page: Joi.number().integer().min(1).default(1),
  }),
};

export const getRiders = {
  query: Joi.object().keys({
    city: Joi.string(),
    isDriverVerified: Joi.boolean(),
    sortBy: Joi.string(),
    limit: Joi.number().integer().min(1).max(100).default(10),
    page: Joi.number().integer().min(1).default(1),
  }),
};

export const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

export const searchUsers = {
  query: Joi.object().keys({
    q: Joi.string().required(),
    userType: Joi.string().valid(...USER_TYPE),
    city: Joi.string(),
  }),
};

// ============================================
// USER UPDATE
// ============================================

export const updateUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      phoneNumber: Joi.string().custom(phoneNumberValidation),
      firstName: Joi.string(),
      lastName: Joi.string(),
      image: Joi.string().uri().allow(''),
      bio: Joi.string().max(500),
      dateOfBirth: Joi.string(),
      gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say'),
      address: Joi.string(),
      city: Joi.string(),
      country: Joi.string(),
      preferredLanguage: Joi.string(),
    })
    .min(1),
};

export const updateProfile = {
  body: Joi.object()
    .keys({
      firstName: Joi.string(),
      lastName: Joi.string(),
      image: Joi.string().uri().allow(''),
      bio: Joi.string().max(500),
      dateOfBirth: Joi.string(),
      gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say'),
      address: Joi.string(),
      city: Joi.string(),
      country: Joi.string(),
      preferredLanguage: Joi.string(),
      vehicle: Joi.object().keys({
        make: Joi.string(),
        model: Joi.string(),
        year: Joi.number().min(1900).max(new Date().getFullYear() + 1),
        color: Joi.string(),
        licensePlate: Joi.string(),
        seats: Joi.number().min(1).max(50),
      }),
      ridePreferences: Joi.object().keys({
        smokingAllowed: Joi.boolean(),
        petsAllowed: Joi.boolean(),
        musicAllowed: Joi.boolean(),
        chatPreference: Joi.string().valid('quiet', 'friendly', 'any'),
        genderPreference: Joi.string().valid('male', 'female', 'any'),
      }),
    })
    .min(1),
};

export const updateUserStatus = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      isSuspended: Joi.boolean(),
      isArchived: Joi.boolean(),
      suspendReason: Joi.string(),
      archiveReason: Joi.string(),
    })
    .min(1),
};

export const updateSuperAdmin = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    isSuperAdmin: Joi.boolean().required(),
  }),
};

export const syncLocation = {
  body: Joi.object().keys({
    location: Joi.object()
      .keys({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
      })
      .required(),
  }),
};

// ============================================
// RIDER SPECIFIC
// ============================================

export const updateVehicle = {
  body: Joi.object()
    .keys({
      make: Joi.string(),
      model: Joi.string(),
      year: Joi.number().min(1900).max(new Date().getFullYear() + 1),
      color: Joi.string(),
      licensePlate: Joi.string(),
      seats: Joi.number().min(1).max(50),
    })
    .min(1),
};

export const updateRidePreferences = {
  body: Joi.object()
    .keys({
      smokingAllowed: Joi.boolean(),
      petsAllowed: Joi.boolean(),
      musicAllowed: Joi.boolean(),
      chatPreference: Joi.string().valid('quiet', 'friendly', 'any'),
      genderPreference: Joi.string().valid('male', 'female', 'any'),
    })
    .min(1),
};

// ============================================
// USER DELETION
// ============================================

export const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

// ============================================
// NOTIFICATIONS
// ============================================

export const notification = {
  params: Joi.object().keys({
    notificationId: Joi.string().required().custom(objectId),
  }),
};

// ============================================
// VERIFICATION
// ============================================

export const resendVerificationEmail = {
  body: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
};

export const verifyDriversLicense = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    isVerified: Joi.boolean().required(),
  }),
};

// ============================================
// EMAIL SET TOKEN VALIDATION
// ============================================

export const validateEmailSetToken = {
  params: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

export const requestOTPSforEmailSet = {
  params: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    email: Joi.string().email(),
    language: Joi.string(),
  }),
};

export const setEmail = {
  params: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    email: Joi.string().email(),
    phoneOtp: Joi.string().required(),
    emailOtp: Joi.string().required(),
    language: Joi.string(),
  }),
};
