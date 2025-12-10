import Joi from 'joi';
import { NewApartmentComplexBody } from './apartmentComplex.interfaces';
import { objectId } from '../validate/custom.validation';

const createApartmentComplexBody: Record<keyof NewApartmentComplexBody & { userId: string }, any> = {
  apartmentComplexName: Joi.string().required(),
  userId: Joi.string().required(),
  totalParkingSpaces: Joi.number().required(),
  maxApartments: Joi.number(),
  location: Joi.object()
    .keys({
      lat: Joi.string().required(),
      lng: Joi.string().required(),
    })
    .required(),
  allowApartments: Joi.string().valid('on', 'off'),
  apartments: Joi.array().when('allowApartments', {
    is: 'on',
    then: Joi.array()
      // .min(1)
      .required()
      .items(
        Joi.object().keys({
          apartmentNumber: Joi.string().required(),
          // licensePlates: Joi.array()
          //   .required()
          //   .items(
          //     Joi.object().keys({
          //       plate: Joi.string(),
          //       stateShort: Joi.string(),
          //     })
          //   ),
        })
      ),
    otherwise: Joi.array(),
  }),
  licensePlateLimitPerRenter: Joi.number().when('allowApartments', {
    is: 'on',
    then: Joi.number().required(),
  }),
  renewalContractTime: Joi.string().when('allowApartments', {
    is: 'on',
    then: Joi.string().required(),
  }),
};

export const createApartmentComplex = {
  body: Joi.object().keys(createApartmentComplexBody),
};

export const createUpdateApartment = {
  params: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    userId: Joi.string().required(),
    _id: Joi.string(),
    // apartments: Joi.object().keys({
    apartmentNumber: Joi.string().required(),
    maxOccupantsAllowed: Joi.number().min(0),
    maxRentersAllowed: Joi.number().min(1),
    // licensePlates: Joi.array()
    //   .min(1)
    //   .required()
    //   .items(
    //     Joi.object().keys({
    //       plate: Joi.string(),
    //       stateShort: Joi.string(),
    //       _id: Joi.string(),
    //     })
    //   ),
    // }),
  }),
};

export const createOrUpdateRenterLicenses = {
  params: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
    apartmentId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    // apartments: Joi.object().keys({
    // apartmentNumber: Joi.string().required(),
    // licensePlates: Joi.object().keys({
    plate: Joi.string().required(),
    stateShort: Joi.string().required(),
    _id: Joi.string(),
    status: Joi.string().valid('new', 'updated', 'deleted'),
    // }),

    // }),
  }),
};

export const attachExistingLicense = {
  body: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
    apartmentId: Joi.string().required(),
    licenseId: Joi.string().required(),
    renterId: Joi.string().required(),
  }),
};

export const attachRenterToApartment = {
  body: Joi.object().keys({
    renterId: Joi.string().required(),
    apartmentComplexId: Joi.string().required(),
    apartmentId: Joi.string().required(),
  }),
};

export const listApartments = {
  params: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
  }),
};
const updateApartmentComplexBody = {
  apartmentComplexName: Joi.string(),
  // availableParkingSpaces: Joi.number(),
  totalParkingSpaces: Joi.number(),
  maxApartments: Joi.number(),
  location: Joi.object().keys({
    lat: Joi.string(),
    lng: Joi.string(),
  }),
  allowApartments: Joi.string().valid('on', 'off'),
  apartments: Joi.array().when('allowApartments', {
    is: 'on',
    then: Joi.array()
      .min(1)
      .required()
      .items(
        Joi.object().keys({
          apartmentNumber: Joi.string().required(),
          _id: Joi.string(),
          renter: Joi.string(),
          // licensePlates: Joi.array().items(
          //   Joi.object().keys({
          //     plate: Joi.string(),
          //     stateShort: Joi.string(),
          //     _id: Joi.string(),
          //   })
          // ),
        })
      ),
    otherwise: Joi.array(),
  }),
  licensePlateLimitPerRenter: Joi.number().when('allowApartments', {
    is: 'on',
    then: Joi.number().required(),
  }),
  renewalContractTime: Joi.string().when('allowApartments', {
    is: 'on',
    then: Joi.string().required(),
  }),
};

export const updateApartmentComplex = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys(updateApartmentComplexBody).min(1),
};

export const getApartmentComplexStatus = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

export const getApartmentComplexById = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};

export const deleteApartmentComplexById = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};

export const queryApartmentComplexes = {
  query: Joi.object().keys({
    apartmentComplexName: Joi.string(),
    allowApartments: Joi.string().valid('on', 'off'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    projectBy: Joi.string(),
    search: Joi.string(),
  }),
};

export const addLicensesToApartmentComplex = {
  body: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
    licensePlates: Joi.array().items(
      Joi.object().keys({
        plate: Joi.string().required(),
        // stateFull: Joi.string().required(),
        stateShort: Joi.string().required(),
      })
    ),
  }),
};

export const removeLicenseFromApartmentComplex = {
  body: Joi.object().keys({
    apartmentComplexId: Joi.string().required(),
    licensePlate: Joi.string().required(),
  }),
};
