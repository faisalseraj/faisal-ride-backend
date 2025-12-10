import Joi from 'joi';
import { NewCreatedTowRequest } from './tow-request.interfaces';

const createTowRequestBody: Record<keyof NewCreatedTowRequest, any> = {
  licensePlates: Joi.array()
    .items(
      Joi.object({
        plateText: Joi.string().required(),
        croppedImage: Joi.string().required(),
        completeImage: Joi.string().required(),
        _id: Joi.string().allow(''),
      })
    )
   ,

  requesterPhoneNumber: Joi.string(),
  requesterEmail: Joi.string(),
  requesterName: Joi.string(),
  vehicleYear: Joi.string().allow(''), // changed to string
  vehicleMake: Joi.string().allow(''),
  vehicleModel: Joi.string().allow(''),
  vehicleColor: Joi.string().allow(''),
  vehicleType: Joi.string().allow(''),
  driveType: Joi.string().allow(''),
  vin: Joi.string().length(17).allow(''),
  odometer: Joi.string().allow(''), // changed to string
  stockNumber: Joi.string().allow(''),
  hasKeys: Joi.boolean(),
  keysLocation: Joi.string().allow('').when('hasKeys', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  location: Joi.object({
    address: Joi.string().required(),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zip: Joi.string().allow(''),
    distance: Joi.string().allow(''),
    county: Joi.string().allow(''),

    lat: Joi.string().allow(''),
    lng: Joi.string().allow(''),
  }),

  destination: Joi.object({
    address: Joi.string(),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zip: Joi.string().allow(''),
    distance: Joi.string().allow(''),
    county: Joi.string().allow(''),

    lat: Joi.string().allow(''),
    lng: Joi.string().allow(''),
  }).optional(),

  towOperatorLocation: Joi.object({
    address: Joi.string(),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zip: Joi.string().allow(''),
    distance: Joi.string().allow(''),
    county: Joi.string().allow(''),

    lat: Joi.string().allow(''),
    lng: Joi.string().allow(''),
  }).optional(),

  towType: Joi.string().valid('PPI', 'Consent'),
  invoiceNumber: Joi.string().allow(''),
  jurisdiction: Joi.string().allow(''),
  driverBadgeNumber: Joi.string().allow(''),
  truckNumber: Joi.string().allow(''),
  eta: Joi.string().allow(''),
  impoundDate: Joi.string().allow(''),
  inventoryDate: Joi.string().allow(''),
  vehicleSecuredDate: Joi.string().allow(''),
  accountNotes: Joi.string().allow(''),
  impoundNotes: Joi.string().allow(''),
  gateCode: Joi.string().allow(''),

  charges: Joi.object({
    unloadedEnrouteMileage: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    loadedHookedMileage: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    impoundFee: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    privatePropertyTowFee: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    notificationFee: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    dailyImpoundRate: Joi.object({ quantity: Joi.number(), price: Joi.number() }),
    subTotal: Joi.number(),
    consentTowFee: Joi.number()
  }),
  referer: Joi.string().allow(''),
};

export const createTowRequest = {
  body: Joi.object().keys(createTowRequestBody),
};

export const getTowRequestById = {
  params: Joi.object().keys({
    towRequestId: Joi.string().required(),
  }),
};

export const assignTowToOperator = {
  body: Joi.object().keys({
    towRequestId: Joi.string().required(),
    assignedTo: Joi.string().required(),
    towOperatorLocation: Joi.object({
      address: Joi.string(),
      city: Joi.string().allow(''),
      state: Joi.string().allow(''),
      zip: Joi.string().allow(''),
      county: Joi.string().allow(''),
      distance: Joi.string().allow(''),
      lat: Joi.string().required(),
      lng: Joi.string().required(),
    }).required(),
  }),
};

export const updateTowRequestStatus = {
  body: Joi.object().keys({
    towRequestId: Joi.string().required(),
    status: Joi.string().required().valid('ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'),
  }),
};

export const updateTowRequest = {
  body: Joi.object().keys(createTowRequestBody),
};

export const followUpTowRequest = {
  body: Joi.object().keys({
    towRequestId: Joi.string().required(),
  }),
};

export const oneTimeInviteLink = {
  body: Joi.object().keys({
    email: Joi.string().email().optional(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    otherInfo: Joi.object(),
    passkey: Joi.string().optional(),
    contactMethod: Joi.string().valid('email', 'phone').optional(),
  }).custom((value, helpers) => {
    // Either email or phoneNumber must be provided, but not both
    if (!value.email && !value.phoneNumber) {
      return helpers.error('custom.missingContact');
    }
   
    return value;
  }).messages({
    'custom.missingContact': 'Either email or phone number must be provided',
    // 'custom.bothContact': 'Provide either email or phone number, not both',
  }),
};
export const verifyOneTimeInviteLink = {
  params: Joi.object().keys({
    token: Joi.string().required(),
  }),
};

export const getTowRequests = {
  query: Joi.object().keys({
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    search: Joi.string(),
    limit: Joi.number().integer(),
    status: Joi.string(),
    from: Joi.string(),
    to: Joi.string(),
    page: Joi.number().integer(),
    requestCreatedBy: Joi.string(),
    towCompanyId: Joi.string(),
    assignedTo: Joi.string(),
  }),
};
