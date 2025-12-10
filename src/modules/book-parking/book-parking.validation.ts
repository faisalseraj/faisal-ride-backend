import Joi from 'joi';
import { NewCreatedBookParking } from './book-parking.interfaces';

const createBookParkingBody: Record<keyof NewCreatedBookParking, any> = {
  parkingProviderId: Joi.string().required(),
  parkingTime: Joi.number().required(),
  licensePlate: Joi.string().required(),
  isOcrScanner: Joi.boolean().required(),
  state: Joi.string()
};

export const createBookParking = {
  body: Joi.object().keys(createBookParkingBody),
};

export const getBookParkingById = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};

export const assignTowToOperator = {
  body: Joi.object().keys({
    towRequestId: Joi.string().required(),
    assignedTo: Joi.string().required(),
  }),
};

export const updateBookParkingStatus = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys({
    extendedHours: Joi.number().required().min(1),
  }),
};

export const getBookParkings = {
  query: Joi.object().keys({
    sortBy: Joi.string(),
    projectBy: Joi.string(),
    search: Joi.string(),
    limit: Joi.number().integer(),
    from: Joi.string(),
    to: Joi.string(),
    page: Joi.number().integer(),
    requestCreatedBy: Joi.string(),
    towCompanyId: Joi.string(),
    assignedTo: Joi.string(),
  }),
};
