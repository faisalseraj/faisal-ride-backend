import * as apartmentComplex from './apartmentComplex.service';

import { Request, Response } from 'express';

import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
import { IUserDoc } from '../user/user.interfaces';
import { apartmentComplexService } from '.';
import catchAsync from '../utils/catchAsync';
import { createUserManagementLog } from '../logs/enhanced-log-migration.service';
import httpStatus from 'http-status';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { pick } from '../utils';
import { userService } from '../user';

// import { uploadService } from '../upload';
/**
 * @api {post} /apartmentComplex Create Apartment Complex
 * @apiName CreateApartmentComplex
 * @apiGroup ApartmentComplex
 * @apiPermission admin, apartment-complex-owner
 *
 * @apiParam {String} apartmentComplexName Name of the apartment complex
 * @apiParam {String} location.lat Latitude of the location
 * @apiParam {String} location.lng Longitude of the location
 * @apiParam {Number} totalParkingSpaces Total number of parking spaces
 * @apiParam {Number} availableParkingSpaces Available parking spaces
 * @apiParam {String} [userId] User Id of the apartment complex manager
 *
 * @apiSuccess {Object} company Apartment complex object
 *
 * @apiError (Bad Request 400)  Validation Error
 * @apiError (Unauthorized 401)  Unauthorized
 * @apiError (Forbidden 403)    Forbidden
 */
export const createApartmentComplex = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as unknown as IUserDoc;
  const userId = loggedInUser.userType === 'admin' ? req.body.userId : loggedInUser._id;

  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User Id is required');
  }
  const complex = await apartmentComplex.createApartmentComplex(req.body, userId);
  await createUserManagementLog({
    user: loggedInUser,
    affectedUser: complex.user,
    ownerId: complex.user,
    event: ALL_EVENTS.apartmentComplexCrud.createApartmentComplex(complex),
    customMetadata: {
      userType: loggedInUser.userType,
      action: 'apartment_complex_create',
      apartmentComplexName: complex.apartmentComplexName,
    },
  });
  res.status(httpStatus.CREATED).send({ complex });
});

export const createUpdateApartment = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user as unknown as IUserDoc;
    const userId = req.body.userId;
    delete req.body.userId;
    if (!userId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User Id is required');
    }
    const apartmentCOmplexId = req.params['apartmentComplexId'];
    if (!req.params['apartmentComplexId']) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex Id is required');
    }

    if (req.body['licensePlates']) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Deprecated :: License plates update is allowed only via dedicated endpoint'
      );
    }

    const apartment = await apartmentComplex.createOrUpdateApartment(
      new mongoose.Types.ObjectId(apartmentCOmplexId) as any,
      req.body,
      new mongoose.Types.ObjectId(userId),
      req.user.userType as any
    );

    await logService.createLog({
      user: loggedInUser,
      ownerId: apartment.user,
      affectedUser: apartment.user,
      eventEnum: 'ACE',
      userType: loggedInUser.userType,
      event: apartment?._id
        ? ALL_EVENTS.apartmentComplexCrud.updateApartmentOfComplex(
            apartmentCOmplexId as string,
            apartment?._id,
            req.body['apartmentNumber'],
            pick(req.body, ['apartmentNumber', 'licensePlates'])
          )
        : ALL_EVENTS.apartmentComplexCrud.addApartmentToComplex(
            apartmentCOmplexId as string,
            apartment.impactedApartmentId,
            req.body['apartmentNumber']
          ),
    });
    res.send({ apartment });
  } catch (error: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
});

export const createOrUpdateRenterLicenses = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user as unknown as IUserDoc;
    const renterId = req.body['renterId'];
    delete req.body.renterId;
    if (!renterId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Renter Id is required');
    }

    const apartmentCOmplexId = req.params['apartmentComplexId'];
    if (!apartmentCOmplexId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex Id is required');
    }
    const apartmentId = req.params['apartmentId'];
    if (!apartmentId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex Id is required');
    }

    const apartment = await apartmentComplex.createOrUpdateRenterLicenses(
      new mongoose.Types.ObjectId(apartmentCOmplexId) as any,
      new mongoose.Types.ObjectId(apartmentId) as any,
      req.body,
      new mongoose.Types.ObjectId(renterId)
    );

    await logService.createLog({
      user: loggedInUser,
      ownerId: apartment.user,
      affectedUser: renterId,
      eventEnum: 'ACE',
      userType: loggedInUser.userType,
      event: ALL_EVENTS.apartmentComplexCrud.updateLicenseByRenter(
        apartmentCOmplexId as string,
        apartmentId,
        apartment.apartmentToUpdate.apartmentNumber,
        req.body.plate,
        loggedInUser.fullName!,
        req.body.status
      ),
    });
    res.send({ apartment: apartment.apartmentToUpdate });
  } catch (error: any) {
    console.log(error, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
});

export const attachExistingLicense = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user as unknown as IUserDoc;
    const renterId = req.body['renterId'];
    delete req.body.renterId;
    if (!renterId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Renter Id is required');
    }

    const apartmentCOmplexId = req.body['apartmentComplexId'];
    if (!apartmentCOmplexId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex Id is required');
    }
    const apartmentId = req.body['apartmentId'];
    // if (!apartmentId) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex Id is required');
    // }

    if (!req.body['licenseId']) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'License plate ID is required');
    }

    const renter = await userService.getUserById(renterId);
    const licensePlate = renter?.licensePlates?.find((plate: any) => plate._id.toString() === req.body['licenseId']);
    if (!licensePlate?.plate) {
      throw new ApiError(httpStatus.NOT_FOUND, 'License plate is missing in the pool');
    }

    const plate = {
      plate: licensePlate.plate,
      stateShort: licensePlate.stateShort,
      // renterId: renterId,
      status: 'attached' as any,
    };

    const apartment = await apartmentComplex.createOrUpdateRenterLicenses(
      new mongoose.Types.ObjectId(apartmentCOmplexId) as any,
      new mongoose.Types.ObjectId(apartmentId) as any,
      plate,
      new mongoose.Types.ObjectId(renterId)
    );
    if (renter?.licensePlates) {
      renter.licensePlates = renter?.licensePlates?.filter((plate: any) => plate._id.toString() !== req.body['licenseId']);
      await renter?.save();
    }
    await logService.createLog({
      user: loggedInUser,
      ownerId: apartment.user,
      affectedUser: renterId,
      eventEnum: 'ACE',
      userType: loggedInUser.userType,
      event: ALL_EVENTS.apartmentComplexCrud.updateLicenseByRenter(
        apartmentCOmplexId as string,
        apartmentId,
        apartment.apartmentToUpdate.apartmentNumber,
        plate.plate,
        loggedInUser.fullName!,
        plate.status
      ),
    });
    res.send({ apartment: apartment.apartmentToUpdate });
  } catch (error: any) {
    console.log(error, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
});
/**
 * @api {get} /apartmentComplex Query Apartment Complexes
 * @apiName QueryApartmentComplexes
 * @apiGroup ApartmentComplex
 * @apiPermission public
 *
 * @apiParam {String} [apartmentComplexName] Name of the apartment complex
 * @apiParam {String} [sortBy] Sort order of the results
 * @apiParam {Number} [limit] Limit number of results per page
 * @apiParam {Number} [page] Page number of results
 * @apiParam {String} [projectBy] Fields to project in the results
 * @apiParam {String} [search] Search query for filtering results
 *
 * @apiSuccess {Object[]} results List of apartment complexes
 *
 * @apiError (Bad Request 400) Validation Error
 */
export const queryApartmentComplexes = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['apartmentComplexName', 'allowApartments']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);

  // let user;
  if (req.user.userType === 'apartment-complex-owner') {
    filter.user = new mongoose.Types.ObjectId(req.user.id);
  }

  if (req.user.userType === 'apartment-complex-manager') {
    if (!req.user.apartmentComplex) {
      throw new ApiError(httpStatus.NOT_FOUND, 'You have no apartment complex to manage');
    }
    filter._id = new mongoose.Types.ObjectId(req.user.apartmentComplex);
  }

  const result = await apartmentComplexService.queryApartmentComplexes(
    { ...filter },
    {
      ...options,
      ...(search?.search && {
        search: `${decodeURIComponent(
          search.search
        )}#apartmentComplexName,licensePlates.stateShort,licensePlates.plate,apartments.licensePlates.stateShort,apartments.licensePlates.plate,apartments.apartmentNumber`,
      }),
    },
    req.user.userType
  );

  res.send(result);
});

/**
 * @api {get} /apartmentComplex/:id Get Apartment Complex By Id
 * @apiName GetApartmentComplexById
 * @apiGroup ApartmentComplex
 * @apiPermission public
 *
 * @apiParam {String} id Id of the apartment complex
 *
 * @apiSuccess {Object} apartmentComplex Apartment complex object
 *
 * @apiError (Not Found 404)  Apartment complex not found
 */
export const getApartmentComplexById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const apartmentComplex = await apartmentComplexService.findApartmentComplexById(new mongoose.Types.ObjectId(id));
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  res.send(apartmentComplex);
});

/**
 * Get apartment complex status
 */
export const getApartmentComplexStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const status = await apartmentComplexService.getApartmentComplexStatus(new mongoose.Types.ObjectId(id));
  res.send(status);
});

/**
 * @api {get} /apartmentComplex?name=:name Get Apartment Complex By Name
 * @apiName GetApartmentComplexByName
 * @apiGroup ApartmentComplex
 * @apiPermission public
 *
 * @apiParam {String} name Name of the apartment complex
 *
 * @apiSuccess {Object} apartmentComplex Apartment complex object
 *
 * @apiError (Not Found 404)  Apartment complex not found
 */
export const getApartmentComplexByName = catchAsync(async (req: Request, res: Response) => {
  const { name } = req.query;
  const apartmentComplex = await apartmentComplexService.findApartmentComplexByName(name as string);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  res.send(apartmentComplex);
});

/**
 * @api {delete} /apartmentComplex/:id Delete Apartment Complex By Id
 * @apiName DeleteApartmentComplexById
 * @apiGroup ApartmentComplex
 * @apiPermission admin, apartment-complex-owner
 *
 * @apiParam {String} id Id of the apartment complex
 *
 * @apiSuccess {Object} apartmentComplex Apartment complex object
 *
 * @apiError (Not Found 404)  Apartment complex not found
 */
export const removeApartmentComplexById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const loggedInUser = req.user;
  const apartmentComplex = await apartmentComplexService.deleteApartmentComplexById(
    new mongoose.Types.ObjectId(id),
    loggedInUser
  );

  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  res.status(httpStatus.NO_CONTENT).send();
});

export const addLicensesToApartmentComplex = catchAsync(async (req: Request, res: Response) => {
  const apartmentComplex = await apartmentComplexService.addLicensesToApartmentComplex(
    req.body['apartmentComplexId'],
    req.body['licensePlates']
  );
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  await logService.createLog({
    user: req.user,
    ownerId: apartmentComplex.user,

    affectedUser: apartmentComplex.user,
    eventEnum: 'ACE',
    userType: req.user.userType,
    event: ALL_EVENTS.apartmentComplexCrud.addLicenseToApartmentComplex(apartmentComplex, req.body['licensePlates']),
  });
  res.status(httpStatus.NO_CONTENT).send();
});

export const listApartmentComplexes = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user as unknown as IUserDoc;
    let userId;
    let apartmentComplex;
    if (loggedInUser.userType === 'apartment-complex-owner') {
      userId = loggedInUser._id;
    }

    if (loggedInUser.userType === 'apartment-complex-manager' || loggedInUser.userType === 'apartment-complex-employee') {
      apartmentComplex = new mongoose.Types.ObjectId(loggedInUser.apartmentComplex);
    }
    const apartmentComplexes = await apartmentComplexService.listApartmentComplexes(userId, apartmentComplex);
    res.send({ results: apartmentComplexes });
  } catch (error) {
    console.error('Error listing apartment complexes:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ error: 'An error occurred while listing apartment complexes' });
  }
});

export const listApartments = catchAsync(async (req: Request, res: Response) => {
  try {
    const apartmentComplexId = req.params['apartmentComplexId'] as unknown as IUserDoc;
    if (!apartmentComplexId) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
    }
    const loggedInUser = req.user;
    if (!loggedInUser.userType.includes('apartment') && loggedInUser.userType !== 'admin') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to access this resource');
    }
    const apartments = await apartmentComplexService.listApartments(
      new mongoose.Types.ObjectId(req.params['apartmentComplexId'])
    );
    Object.assign(apartments, { _id: apartments?.id });
    res.send(apartments);
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'An error occurred while listing apartment complexes' + error);
  }
});

/**
 * @api {patch} /apartmentComplex/:id Update Apartment Complex By Id
 * @apiName UpdateApartmentComplexById
 * @apiGroup ApartmentComplex
 * @apiPermission admin, apartment-complex-owner
 *
 * @apiParam {String} id Id of the apartment complex
 * @apiBody {Object} updateBody Data to update apartment complex
 *
 * @apiSuccess {Object} apartmentComplex Apartment complex object
 *
 * @apiError (Not Found 404)  Apartment complex not found
 */
export const modifyApartmentComplexById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const loggedInUser = req.user;
  const updateBody = req.body;
  let userId = undefined;
  if (req.user.userType === 'apartment-complex-owner') {
    userId = req.user._id;
  }
  if (loggedInUser.userType !== 'admin') {
    delete updateBody['allowApartments'];
    delete updateBody['licensePlateLimitPerRenter'];
    delete updateBody['renewalContractTime'];
  }

  if (loggedInUser.userType !== 'admin' && loggedInUser.userType !== 'apartment-complex-employee') {
    delete updateBody['apartments'];
  }
  const apartmentComplex = await apartmentComplexService.updateApartmentComplexById(
    new mongoose.Types.ObjectId(id),
    updateBody,
    userId
  );
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  await logService.createLog({
    user: req.user,
    ownerId: apartmentComplex.user,

    affectedUser: apartmentComplex.user,
    eventEnum: 'ACE',
    userType: req.user.userType,
    event: ALL_EVENTS.apartmentComplexCrud.updateApartmentComplex(apartmentComplex),
  });
  res.send(apartmentComplex);
});

export const removeLicenseFromApartmentComplexController = catchAsync(async (req: Request, res: Response) => {
  const { apartmentComplexId, licensePlate } = req.body;

  const apartmentComplex = await apartmentComplexService.removeLicenseFromApartmentComplex(apartmentComplexId, licensePlate);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  await logService.createLog({
    user: req.user,
    ownerId: apartmentComplex.user,

    affectedUser: apartmentComplex.user,
    eventEnum: 'ACE',
    userType: req.user.userType,
    event: ALL_EVENTS.apartmentComplexCrud.removeLicenseFromApartmentComplex(
      apartmentComplex,
      (apartmentComplex as any)?.deletedLicense?.plate
    ),
  });
  res.send(apartmentComplex);
});

export const getApartmentRentersByApartmentId = catchAsync(async (req: Request, res: Response) => {
  const apartmentId = req.params['apartmentId'];
  if (!apartmentId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment ID is required');
  }

  const apartmentComplex = await apartmentComplexService.getApartmentRentersByApartmentId(apartmentId);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  res.send(apartmentComplex);
});

export const removeApartmentRenter = catchAsync(async (req: Request, res: Response) => {
  const apartmentId = req.params['apartmentId'];
  if (!apartmentId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment ID is required');
  }
  const renterId = req.params['renterId'];
  if (!renterId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Renter ID is required');
  }

  const apartmentComplex = await apartmentComplexService.removeRenterFromApartment(apartmentId, renterId, req.user);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  res.send(apartmentComplex);
});

export const attachRenterToApartment = catchAsync(async (req: Request, res: Response) => {
  const { apartmentId, renterId, apartmentComplexId } =
    pick(req.body, ['apartmentId', 'apartmentComplexId', 'renterId']) ?? {};
  if (!apartmentId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment ID is required');
  }
  if (!renterId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Renter ID is required');
  }
  if (!apartmentId) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment ID is required');
  }
  const apartmentComplex = await apartmentComplexService.attachRenterToApartment(
    apartmentId,
    apartmentComplexId,
    renterId,
    req.user
  );

  res.send(apartmentComplex);
});
