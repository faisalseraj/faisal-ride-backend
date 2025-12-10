import { NewCreatedUser, USER_TYPE } from './user.interfaces';
import { objectId, password, phoneNumberValidation } from '../validate/custom.validation';

import Joi from 'joi';

const createUserBody: Record<keyof NewCreatedUser, any> = {
  email: Joi.string().email(),
  phoneNumber: Joi.string().required().custom(phoneNumberValidation),
  password: Joi.string().required().custom(password),
  firstName: Joi.string().required(),
  fullName: Joi.string(),
  lastName: Joi.string().required(),
  image: Joi.string(),
  userType: Joi.string()
    .required()
    .valid(...USER_TYPE),
  isVerified: Joi.boolean().required(),
  isSuspended: Joi.boolean(),
  isArchived: Joi.boolean(),
  isTemporaryBlocked: Joi.boolean(),
  temporaryBlockedTill: Joi.string(),
  country: Joi.string(),
  district: Joi.string(),
  address: Joi.string(),

  manualPosition: Joi.object(),
  preferredLanguage: Joi.string(),
  deviceToken: Joi.string(),
  deviceType: Joi.string(),
  emailVerificationReminders: Joi.array(),
  isTowOperator: Joi.boolean(),
  driverBadgeNumber: Joi.string(),
  isPaidParkingSpaceProvider: Joi.boolean(),
} as any;

export const createUser = {
  body: Joi.object().keys(createUserBody),
};

export const clientSignUp = {
  body: Joi.object().keys({
    ...createUserBody,
    email: Joi.string(),
    country: Joi.string().required(),
    measurementUnit: Joi.string().required(),
    dob: Joi.string().required(),
    userType: Joi.string(),
    isVerified: Joi.string(),
  }),
};

export const getUsers = {
  query: Joi.object().keys({
    isVerified: Joi.boolean(),
    isSuspended: Joi.boolean(),
    isArchived: Joi.boolean(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    userType: Joi.string().valid(...USER_TYPE, 'ALL'),
    role: Joi.string(),
    towCompanyId: Joi.string(),
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    search: Joi.string(),
    limit: Joi.number().integer(),
    from: Joi.string(),
    to: Joi.string(),
    clicks: Joi.string(),
    page: Joi.number().integer(),
    country: Joi.string(),
    status: Joi.string(),
  }),
};

export const sendVerificationSMSToUsers = {
  body: Joi.object().keys({
    userIds: Joi.array().required(),
  }),
};

export const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export const getUsersByType = {
  query: Joi.object().keys({
    userType: Joi.string().valid(...USER_TYPE, 'ALL', 'regionalManagerAndAdmin'),
  }),
};

export const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      // image: Joi.string(),
      // phoneNumber: Joi.string().custom(phoneNumberValidation), password: Joi.string().custom(password),
      firstName: Joi.string(),
      phoneNumber: Joi.string(),
      lastName: Joi.string(),
      companyName: Joi.string(),
      isTowOperator: Joi.boolean(),
      isPaidParkingSpaceProvider: Joi.boolean(),
      towCompanyId: Joi.string(),
      parkingDetails: Joi.object().keys({
        charges: Joi.number(),
        unit: Joi.string().valid('hour', 'day', 'week', 'month', 'year'),
        availabilityTimes: Joi.array(),
      }),
      driverBadgeNumber: Joi.string().allow(''),
      passkey: Joi.string().allow(''),

      // country: Joi.string(),
      // address: Joi.string(),
      // district: Joi.string(),
      // lastLogin: Joi.string(),
      // isVerified: Joi.boolean(),
      // isSuspended: Joi.boolean(),
      // isArchived: Joi.boolean(),
      // isTemporaryBlocked: Joi.boolean(),
    })
    .min(1),
};

export const promoteDemote = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
};
export const updateSuperAdmin = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    isSuperAdmin: Joi.boolean().required(),
  }),
};

export const acceptReject = {
  query: Joi.object().keys({
    token: Joi.string().required(),
    status: Joi.string().valid('accept', 'reject').required(),
  }),
};
export const updateStatus = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      isSuspended: Joi.boolean(),
      isArchived: Joi.boolean(),
    })
    .min(1),
};

export const recoverUser = {
  body: Joi.object().keys({
    userId: Joi.string().required(),
  }),
};

export const getUserNamesByIds = {
  body: Joi.object().keys({
    userIds: Joi.array(),
  }),
};

export const updateProfile = {
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      company: Joi.object().keys({
        businessEmail: Joi.string().allow('').email(),
        businessPhoneNumber: Joi.string().allow('').optional().custom(phoneNumberValidation),
        businessAddress: Joi.string().allow('').optional(),
      }),
      otp: Joi.string(),
      phoneNumber: Joi.string().custom(phoneNumberValidation).optional(),
      password: Joi.string().custom(password),
      firstName: Joi.string(),
      lastName: Joi.string(),
      image: Joi.string(),
      driverBadgeNumber: Joi.string(),

      preferredLanguage: Joi.string(),
    })
    .min(1),
};

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

export const setEmailWithEmailOTPOnly = {
  params: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    email: Joi.string().email(),
    emailOtp: Joi.string().required(),
  }),
};
export const updateSuspend = {
  params: Joi.object().keys({
    siteId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    isSuspended: Joi.boolean().required(),
    userId: Joi.string().required(),
  }),
};

export const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export const generateQRCode = {
  body: Joi.object().keys({
    data: Joi.string().required(),
  }),
};

export const syncLocation = {
  body: Joi.object().keys({
    manualPosition: Joi.object()
      .keys({
        latitude: Joi.string().required(),
        longitude: Joi.string().required(),
      })
      .required(),
  }),
};

export const generateParkingQRCode = {
  params: Joi.object().keys({
    parkingId: Joi.string().required(),
  }),
};

export const notifications = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

const createUserWithTypeBody = {
  companyName: Joi.string(),
  userType: Joi.string()
    .required()
    .valid(...USER_TYPE),
  email: Joi.string().email(),
  phoneNumber: Joi.string().required().custom(phoneNumberValidation),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  apartmentComplex: Joi.string(),
  oldUserId: Joi.string(),
  towCompanyId: Joi.string(),
  apartmentId: Joi.string(),
  isTowOperator: Joi.boolean(),
  isPaidParkingSpaceProvider: Joi.boolean(),
  driverBadgeNumber: Joi.string().allow(''),
  parkingDetails: {
    charges: Joi.number(),
    unit: Joi.string().valid('hour', 'day', 'week', 'month', 'year'),
  },
  passkey: Joi.string().allow(''),
};

export const createAdmin = {
  email: Joi.string().allow('').optional().email(),
  phoneNumber: Joi.string().allow('').optional().custom(phoneNumberValidation),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
};

export const createUserWithType = {
  body: Joi.object().keys(createUserWithTypeBody),
};

export const createOccupant = {
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    apartmentComplex: Joi.string().required(),
    apartmentId: Joi.string().required(),
    dob: Joi.string(),
    relation: Joi.string().allow(''),
  }),
};

export const attachOccupantToApartment = {
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    apartmentComplex: Joi.string().required(),
    apartmentId: Joi.string().required(),
    occupantId: Joi.string().required(),
  }),
};

export const updateOccupant = {
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    _id: Joi.string().required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    apartmentComplex: Joi.string().required(),
    apartmentId: Joi.string().required(),
    dob: Joi.string(),
    relation: Joi.string().allow(''),
  }),
};

export const deleteOccupant = {
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    occupantId: Joi.string().required(),
    type: Joi.string().valid('permanent', 'detached'),
  }),
};

// new auth apis for mobile applications
