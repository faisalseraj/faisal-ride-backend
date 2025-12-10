import { IApartment, IApartmentComplexDoc, NewApartmentComplexPayload } from './apartmentComplex.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IUserDoc, IUserType } from '../user/user.interfaces';
import { User, userService } from '../user';

import { ALL_EVENTS } from '../utils/events';
import { ApartmentComplexModel } from '.';
import { ApiError } from '../errors';
import Booking from '../book-parking/book-parking.model';
import { IApartmentComplex } from './apartmentComplex.interfaces';
import TowRequest from '../tow-request/tow-request.model';
import { createUserManagementLog } from '../logs/enhanced-log-migration.service';
import { emailService } from '../email';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from 'lodash/pick';

// import { userService } from '../user';

/**
 * Create a apartment complex
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createApartmentComplex = async (
  apartmentComplex: NewApartmentComplexPayload,
  user: mongoose.Types.ObjectId
): Promise<IApartmentComplexDoc> => {
  const {
    apartmentComplexName,
    location,
    totalParkingSpaces = 0,
    maxApartments = 0,
    allowApartments,
    apartments,
    licensePlateLimitPerRenter = 1,
    renewalContractTime = '24',
  } = apartmentComplex;
  if (allowApartments === 'on') {
    if (!apartments?.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Atleast 1 apartment has to be added for apartment complex that allow apartments'
      );
    }

    if (apartments?.length > maxApartments) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Maximum number of apartments reached for this apartment complex');
    }

    if (apartments?.length !== maxApartments) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'You must provide list of all the apartments for this apartment complex at the time of creation.'
      );
    }
  }

  const apartmentComplexBody: IApartmentComplex = {
    apartmentComplexName,
    location,
    totalParkingSpaces,
    user,
    availableParkingSpaces: totalParkingSpaces,
    employees: [],
    ...(allowApartments === 'on' && {
      allowApartments,
      apartments,
      maxApartments,
      licensePlateLimitPerRenter,
      renewalContractTime,
    }),
  };
  const newApartmentComplex = await ApartmentComplexModel.create(apartmentComplexBody);
  // await userService.updateApartmentComplexIdToUser(user, newApartmentComplex._id);
  return newApartmentComplex;
};

/**
 * Add a new apartment to an apartment complex
 * @param {ObjectId} apartmentComplexId - The ID of the apartment complex
 * @param {IApartment} apartment - The apartment details to add
 * @param {ObjectId} user - The ID of the user performing the operation
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const createOrUpdateRenterLicenses = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  apartmentId: mongoose.Types.ObjectId,
  licensePlate: { plate: string; stateShort: string; _id?: string; status: 'new' | 'deleted' | 'updated' | 'attached' },
  renterId: mongoose.Types.ObjectId
  // userType: IUserType
): Promise<any> => {
  const apartmentComplex: IApartmentComplexDoc | null = await ApartmentComplexModel.findById(apartmentComplexId);
  let impactedApartmentId = apartmentId;
  if (!apartmentComplex || apartmentComplex?.apartments?.length === 0) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  const apartmentToUpdate = apartmentComplex?.apartments?.find((apartment: IApartment) =>
    (apartment._id as any).equals(new mongoose.Types.ObjectId(apartmentId))
  );

  if (!apartmentToUpdate?._id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment not found');
  }
  if (!apartmentToUpdate?.renters?.some((renter) => renter.toString() === renterId.toString())) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to access this resource');
  }

  const thisRenterLicenses =
    apartmentToUpdate?.licensePlates?.filter((license) => license?.renterId?.toString() === renterId?.toString()) ?? [];
  if (licensePlate.status === 'new' || licensePlate.status === 'attached') {
    if (thisRenterLicenses.length >= (apartmentComplex?.licensePlateLimitPerRenter || 0)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Maximum number of license plates reached for this apartment');
    }
    if (thisRenterLicenses.some((license) => license.plate === licensePlate.plate)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'License plate already exists for this apartment');
    }
    const newLicense = {
      plate: licensePlate.plate,
      stateShort: licensePlate.stateShort,
      renterId,
    };
    apartmentToUpdate?.licensePlates.push(newLicense);
  }

  if (licensePlate.status === 'deleted') {
    apartmentToUpdate.licensePlates = apartmentToUpdate.licensePlates.filter(
      (license: any) => license._id.toString() !== licensePlate._id && license?.renterId?.toString() === renterId.toString()
    );
  }

  if (licensePlate.status === 'updated') {
    if (
      thisRenterLicenses.some(
        (license) => license.plate === licensePlate.plate && (license as any)._id.toString() !== licensePlate._id
      )
    ) {
      throw new ApiError(httpStatus.FORBIDDEN, 'License plate already exists for this apartment');
    }
    apartmentToUpdate.licensePlates = apartmentToUpdate.licensePlates.map((license: any) =>
      license._id.toString() == licensePlate._id && license?.renterId?.toString() === renterId.toString()
        ? { ...license, plate: licensePlate.plate, stateShort: licensePlate.stateShort }
        : license
    );
  }

  apartmentComplex?.apartments?.map((apartment: IApartment) => {
    if ((apartment._id as any).equals(new mongoose.Types.ObjectId(apartmentId))) {
      return apartmentToUpdate;
    } else {
      return apartment;
    }
  });
  const renter = await User.findById(renterId);
  const updatedApartmentComplex = await apartmentComplex.save();
  emailService.sendRenterLicenseAttachedRemovedNotification(
    renter?.fullName!,
    apartmentComplex.apartmentComplexName,
    apartmentToUpdate.apartmentNumber,
    licensePlate.status,
    renter!,
    {
      plate: licensePlate.plate,
      stateShort: licensePlate.stateShort,
    }
  );

  return { ...updatedApartmentComplex.toObject(), impactedApartmentId, apartmentToUpdate };
};

/**
 * Add a new apartment to an apartment complex
 * @param {ObjectId} apartmentComplexId - The ID of the apartment complex
 * @param {IApartment} apartment - The apartment details to add
 * @param {ObjectId} user - The ID of the user performing the operation
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const createOrUpdateApartment = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  apartment: IApartment,
  user: mongoose.Types.ObjectId,
  userType: IUserType
): Promise<any> => {
  try {
    const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
    let impactedApartmentId = apartment?._id;
    if (!apartmentComplex) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
    }

    if (!apartmentComplex.employees?.includes(user) && userType !== 'admin') {
      throw new ApiError(httpStatus.FORBIDDEN, 'No permission');
    }

    if (apartmentComplex.allowApartments !== 'on') {
      throw new ApiError(httpStatus.FORBIDDEN, 'This apartment complex does not allow apartments');
    }

    // if (apartment.licensePlates.length === 0) {
    //   throw new ApiError(httpStatus.FORBIDDEN, 'Please add at least one license plate');
    // }
    // if (apartment.licensePlates.length > Number(apartmentComplex.licensePlateLimitPerRenter)) {
    //   throw new ApiError(
    //     httpStatus.FORBIDDEN,
    //     `This apartment complex allows only ${apartmentComplex.licensePlateLimitPerRenter} license plates per apartment`
    //   );
    // }

    if (!apartmentComplex.apartments) {
      apartmentComplex.apartments = [];
    }

    const existingApartment = apartmentComplex.apartments.find((existing) =>
      (existing._id as any).equals(new mongoose.Types.ObjectId(apartment._id))
    );

    if (existingApartment) {
      if (
        apartmentComplex.apartments.some(
          (existing) =>
            apartment.apartmentNumber === existing.apartmentNumber &&
            !(existing._id as any).equals(new mongoose.Types.ObjectId(apartment._id))
        )
      ) {
        throw new ApiError(httpStatus.FORBIDDEN, 'This apartment already exists in this apartment complex');
      }

      // prohibit updating the licenseplates here instead fall back to
      if (apartment.licensePlates) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Deprecated :: use license create and update functionality API ');
      }
      apartment.licensePlates = existingApartment.licensePlates;
      Object.assign(existingApartment, apartment);
    } else if (apartmentComplex.apartments.some((existing) => apartment.apartmentNumber === existing.apartmentNumber)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'This apartment already exists in this apartment complex');
    } else {
      apartmentComplex.apartments.push(apartment);
    }

    if (apartmentComplex.apartments?.length > (apartmentComplex?.maxApartments || 1)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Maximum number of apartments reached for this apartment complex');
    }

    const updatedApartmentComplex = await apartmentComplex.save();
    if (!impactedApartmentId) {
      const createdApartment = apartmentComplex.apartments.find(
        (existing) => (existing.apartmentNumber as any) === apartment.apartmentNumber
      );

      impactedApartmentId = createdApartment?._id;
    }
    return { ...updatedApartmentComplex.toObject(), impactedApartmentId };
  } catch (e) {
    console.error(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
};

/**
 * Find apartment complex by id
 * @param {ObjectId} id
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const findApartmentComplexById = async (id: mongoose.Types.ObjectId): Promise<IApartmentComplexDoc | null> => {
  return ApartmentComplexModel.findById(id);
};

/**
 * Find apartment complex by name
 * @param {string} name
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const findApartmentComplexByName = async (name: string): Promise<IApartmentComplexDoc | null> => {
  return ApartmentComplexModel.findOne({ apartmentComplexName: name });
};

/**
 * Query for Apartment complexes
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryApartmentComplexes = async (
  filter: Record<string, any>,
  options: IOptions,
  userType?: IUserType
): Promise<QueryResult> => {
  const complexes = await ApartmentComplexModel.paginate({ ...filter }, { ...options, populate: 'user' });
  const complexesWithDetails = await Promise.all(
    complexes.results.map(async (complex) => {
      const { employees, managers, apartments, user, allowApartments } = complex.toObject();

      const employeeDetails = await userService.getEmployeesByIds(employees);

      let managerDetails;
      if (userType === 'admin' || userType === 'apartment-complex-owner' || userType === 'apartment-complex-manager') {
        managerDetails = await userService.getEmployeesByIds(managers);
      }

      let apartmentsWithRenters = apartments || [];

      if (allowApartments === 'on') {
        const renterIds = apartments.map((apartment: any) => apartment.renter);
        const renterDetails = await userService.getEmployeesByIds(renterIds);

        apartmentsWithRenters = apartments.map((apartment: any) => ({
          ...apartment,
          renter: pick(
            renterDetails.find((renter: any) => renter._id.equals(apartment.renter)),
            [
              'firstName',
              'lastName',
              'email',
              'userType',
              'phoneNumber',
              'isVerified',
              'fullName',
              '_id',
              'id',
              'occupants',
              'licensePlates',
              'apartment',
            ]
          ),
        }));
      }

      return {
        ...complex.toObject(),
        user: pick(user, ['firstName', 'lastName', 'fullName', 'email', 'userType', '_id', 'id']),
        employees: employeeDetails,
        managers: managerDetails,
        apartments: apartmentsWithRenters,
      };
    })
  );

  return { ...complexes, results: complexesWithDetails };
};

/**
 * Query for Apartment complexes
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const justPaginateApartmentComplexes = async (
  filter: Record<string, any>,
  options: IOptions
): Promise<QueryResult> => {
  const complexes = await ApartmentComplexModel.paginate({ ...filter }, { ...options });

  return complexes;
};

/**
 * Delete an apartment complex by id
 * @param {ObjectId} id
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const deleteApartmentComplexById = async (
  id: mongoose.Types.ObjectId,
  loggedInUser: IUserDoc
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(id);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  await createUserManagementLog({
    user: loggedInUser,
    ownerId: apartmentComplex.user,
    affectedUser: apartmentComplex.user,
    event: ALL_EVENTS.apartmentComplexCrud.deleteApartmentComplex(apartmentComplex),
    customMetadata: {
      userType: loggedInUser.userType,
      action: 'apartment_complex_delete',
      apartmentComplexName: apartmentComplex.apartmentComplexName,
    },
  });
  return await ApartmentComplexModel.findByIdAndRemove(id);
};

/**
 * Update an apartment complex by id
 * @param {ObjectId} id
 * @param {IApartmentComplex} updateBody
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const updateApartmentComplexById = async (
  id: mongoose.Types.ObjectId,
  updateBody: IApartmentComplex,
  userId?: mongoose.Types.ObjectId
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(id);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  if (userId && !apartmentComplex.user.equals(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is not authorized to update this apartment complex');
  }
  // const { allowApartments, apartments } = apartmentComplex;
  // if (allowApartments === 'on') {
  //   if (!apartments?.length) {
  //     throw new ApiError(
  //       httpStatus.BAD_REQUEST,
  //       'Atleast 1 apartment has to be added for apartment complex that allow apartments'
  //     );
  //   }
  // }

  if (updateBody.apartments) {
    updateBody.apartments = updateBody.apartments.map((apartment) => {
      const existingDetails = apartmentComplex.apartments?.find((ap) => ap._id?.toString() === apartment._id?.toString());
      return {
        ...existingDetails,
        ...apartment,
      };
    });
  } else {
    updateBody.apartments = apartmentComplex.apartments ?? [];
  }
  Object.assign(apartmentComplex, updateBody);

  return apartmentComplex.save();
};

/**
 * Update an apartment complex by id with userId
 * @param {ObjectId} apartmentComplexId
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const updateApartmentComplexByIdWithUserId = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  userType: IUserType
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  if (userType === 'apartment-complex-employee') {
    apartmentComplex.employees = [...(apartmentComplex.employees ?? []), userId];
  }
  if (userType === 'apartment-complex-manager') {
    apartmentComplex.managers = [...(apartmentComplex.managers ?? []), userId];
  }
  return apartmentComplex.save();
};

/**
 * Update an apartment complex by id with userId
 * @param {ObjectId} apartmentComplexId
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const updateApartmentByApartmentComplexIdWithNewRenter = async ({
  apartmentComplexId,
  apartmentId,
  userId,
  isNewUser = true,
  loggedInUser,
}: {
  apartmentComplexId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  apartmentId: mongoose.Types.ObjectId;
  loggedInUser: IUserDoc;
  isNewUser: boolean;
}) => {
  try {
    const user = await userService.getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Renter does not exists');
    }
    const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
    if (!apartmentComplex) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
    }
    if (!apartmentComplex.apartments?.find((apartment) => apartment?._id?.toString() === apartmentId?.toString())) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment not found');
    }
    let impactedAparment: Partial<IApartment> = {
      licensePlates: [],
    };
    apartmentComplex.apartments = [...(apartmentComplex.apartments ?? [])]?.map((apartment) => {
      if (apartment?._id?.toString() === apartmentId?.toString()) {
        impactedAparment = (apartment as any)?.toObject();
        if ((apartment?.renters?.length ?? 0) >= (apartment?.maxRentersAllowed ?? 0)) {
          throw new ApiError(
            httpStatus.FORBIDDEN,
            'No more Apartment renters allowed, use renter swap/remove functionality'
          );
        }

        if (apartment?.renters?.some((renter) => renter?.toString() === userId?.toString())) {
          throw new ApiError(httpStatus.FORBIDDEN, 'The renter is already attached to this apartment');
        }

        // if ((apartment as any).renter) {
        //   if (oldUserId && !(apartment as any).renter.equals(new mongoose.Types.ObjectId(oldUserId))) {
        //   } else {
        //     throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment already has a renter');
        //   }
        // }

        return {
          ...apartment,
          licensePlates: apartment?.licensePlates ?? [],
          renters: [...(apartment.renters ?? []), userId],
        };
      }
      return apartment;
    });
    impactedAparment?.licensePlates?.map((license) => {
      apartmentComplex.licensePlates?.push(pick(license, 'plate', 'stateShort'));
    });
    const updated = await apartmentComplex.save();

    await createUserManagementLog({
      user: loggedInUser,
      ownerId: apartmentComplex.user,
      affectedUser: userId.toString(),
      event: ALL_EVENTS.UserManagementEvents.onboardRenter({
        apartmentComplex: apartmentComplexId.toString() as string,
        apartmentId: apartmentComplexId.toString() as string,
        email: user?.email as string,
        id: user?.id,
        isNewUser,
      }),
      customMetadata: {
        userType: loggedInUser.userType,
        action: 'renter_onboard',
        apartmentComplexId: apartmentComplexId.toString(),
        userEmail: user?.email,
        isNewUser,
      },
    });
    return { updated, impactedAparment, user };
  } catch (error) {
    console.log(error, 'error is herexx');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error updating apartment renter details ');
  }
};

/**
 * Update an apartment complex by id with userId
 * @param {ObjectId} apartmentComplexId
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const promoteDemoteUser = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  userType: IUserType
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  if (userType === 'apartment-complex-employee') {
    apartmentComplex.employees = [...(apartmentComplex.employees ?? []), userId];
    apartmentComplex.managers = [...(apartmentComplex.managers ?? [])]?.filter((id) => !id.equals(userId));
  }
  if (userType === 'apartment-complex-manager') {
    apartmentComplex.managers = [...(apartmentComplex.managers ?? []), userId];
    apartmentComplex.employees = [...(apartmentComplex.employees ?? [])]?.filter((id) => !id.equals(userId));
  }
  return apartmentComplex.save();
};

/**
 * Add licenses to an apartment complex
 * @param {ObjectId} apartmentComplexId
 * @param {{plate:string,stateFull:string,stateShort:string}[]} licenses
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const addLicensesToApartmentComplex = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  licensePlates: { plate: string; stateFull: string; stateShort: string }[]
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }
  apartmentComplex.licensePlates = [...(apartmentComplex.licensePlates ?? []), ...licensePlates];
  return apartmentComplex.save();
};

/**
 * Get my apartment complexes
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const getMyApartmentComplexes = async (
  user: mongoose.Types.ObjectId,
  { skipPopulate = false }: { skipPopulate?: boolean } = {}
): Promise<IApartmentComplexDoc[]> => {
  try {
    const data = await ApartmentComplexModel.aggregate([
      {
        $match: {
          user,
        },
      },
      ...(skipPopulate
        ? []
        : [
            {
              $lookup: {
                from: 'users',
                localField: 'employees',
                foreignField: '_id',
                as: 'employees',
              },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'managers',
                foreignField: '_id',
                as: 'managers',
              },
            },
            {
              $project: {
                'employees.password': 0,
                'managers.password': 0,
              },
            },
          ]),
    ]);

    return data;
  } catch (error) {
    console.error('Error fetching apartment complexes:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complexes');
  }
};

/**
 * Get apartment complexes by ids
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const getApartmentComplexesByIds = async (_ids: mongoose.Types.ObjectId[]): Promise<IApartmentComplexDoc[]> => {
  try {
    const data = await ApartmentComplexModel.find({
      _id: { $in: _ids },
    });

    return data;
  } catch (error) {
    console.error('Error fetching apartment complexes:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complexes');
  }
};

/**
 * Get apartment complexes
 * @param {ObjectId} [userId]
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const listApartmentComplexes = async (
  userId?: mongoose.Types.ObjectId,
  complexId?: mongoose.Types.ObjectId
): Promise<IApartmentComplexDoc[]> => {
  try {
    const match: Record<string, any> = {};
    if (userId) {
      match['user'] = userId;
    }
    if (complexId) {
      match['_id'] = complexId;
    }
    const data = await ApartmentComplexModel.find(match, {
      _id: 1,
      apartmentComplexName: 1,
      licensePlates: 1,
      apartments: 1,
      allowApartments: 1,
      licensePlateLimitPerRenter: 1,
      maxApartments: 1,
      totalParkingSpaces: 1,
      renewalContractTime: 1,
    });
    return data;
  } catch (error) {
    console.error('Error fetching apartment complexes:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complexes');
  }
};

/**
 * Get apartment complexes
 * @param {ObjectId} [userId]
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const listApartments = async (apartmentComplexId?: mongoose.Types.ObjectId): Promise<IApartmentComplexDoc> => {
  try {
    const data = await ApartmentComplexModel.findById(apartmentComplexId).populate({
      path: 'apartments',
      populate: { path: 'renter' },
    });
    if (!data) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
    }
    return data;
  } catch (error) {
    console.error('Error fetching apartment complexes:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complexes');
  }
};

/**
 * Remove a license from an apartment complex
 * @param {ObjectId} apartmentComplexId
 * @param {string} licensePlate
 * @returns {Promise<IApartmentComplexDoc>}
 */
export const removeLicenseFromApartmentComplex = async (
  apartmentComplexId: mongoose.Types.ObjectId,
  licensePlate: string
): Promise<IApartmentComplexDoc | null> => {
  const apartmentComplex = await ApartmentComplexModel.findById(apartmentComplexId);
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
  }

  if (!apartmentComplex.licensePlates) return null;
  const deletedLicense = apartmentComplex?.licensePlates?.find(
    (license: any) => license._id.toString() === licensePlate.toString()
  );
  if (!deletedLicense) return null;
  apartmentComplex.licensePlates = apartmentComplex?.licensePlates?.filter(
    (license: any) => license._id.toString() !== licensePlate.toString()
  );
  await apartmentComplex.save();
  return { ...apartmentComplex.toObject(), deletedLicense } as any;
};

type RoleOptions = {
  user?: boolean;
  managers?: boolean;
  employees?: boolean;
};

export const getApartmentRoleEmails = async (
  apartmentId: string,
  options: RoleOptions = { user: false, managers: false, employees: false }
): Promise<
  {
    user?: { email: string; name: string };
    managerEmails?: { email: string; name: string }[];
    employeeEmails?: { email: string; name: string }[];
  }[]
> => {
  const pipeline: any[] = [
    {
      $match: {
        _id: new mongoose.Types.ObjectId(apartmentId),
      },
    },
  ];

  if (options.user) {
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      }
    );
  }

  if (options.managers) {
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'managers',
        foreignField: '_id',
        as: 'managers',
      },
    });
  }

  if (options.employees) {
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'employees',
        foreignField: '_id',
        as: 'employees',
      },
    });
  }

  const projectStage: any = { _id: 0 };

  if (options.user) {
    projectStage.user = {
      email: '$user.email',
      name: '$user.fullName',
    };
  }

  if (options.managers) {
    projectStage.managerEmails = {
      $map: {
        input: '$managers',
        as: 'manager',
        in: {
          email: '$$manager.email',
          name: '$$manager.fullName',
        },
      },
    };
  }

  if (options.employees) {
    projectStage.employeeEmails = {
      $map: {
        input: '$employees',
        as: 'employee',
        in: {
          email: '$$employee.email',
          name: '$$employee.fullName',
        },
      },
    };
  }
  pipeline.push({ $project: projectStage });

  try {
    const result = await ApartmentComplexModel.aggregate(pipeline);
    console.dir(result, { depth: null });
    return result;
  } catch (error) {
    console.error('Error fetching apartment complex roles:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complex roles');
  }
};

export const apartmentsForRenters = async (
  apartmentDetails: { apartmentComplex: string; apartmentId: string }[],
  renterId: string
) => {
  const apartmentComplexes = await ApartmentComplexModel.find({
    _id: { $in: apartmentDetails.map(({ apartmentComplex }) => new mongoose.Types.ObjectId(apartmentComplex)) },
  })
    .populate('managers')
    .populate('employees')
    .exec();

  const results = await Promise.all(
    apartmentComplexes.map(async (apartmentComplex) => {
      const apartment = apartmentComplex?.apartments?.find(({ _id }) =>
        apartmentDetails.some(({ apartmentId }) => _id!.toString() === apartmentId.toString())
      );

      if (apartmentComplex && apartment) {
        return {
          apartmentComplexName: apartmentComplex.apartmentComplexName,
          apartmentComplex: apartmentComplex._id,
          licensePlateLimitPerRenter: apartmentComplex.licensePlateLimitPerRenter,
          apartment: {
            ...(apartment as any)?.toObject(),
            licensePlates: apartment.licensePlates?.filter(
              (license) => license.renterId?.toString() === renterId?.toString()
            ),
            renters: apartment.renters?.filter((renter) => renter._id?.toString() === renterId?.toString()),
            renter: apartment.renters?.filter((renter) => renter._id?.toString() === renterId?.toString())?.[0],
          },
          employees: apartmentComplex.employees?.map((employee) => ({
            email: employee.email,
            name: employee.fullName,
            _id: employee._id,
          })),
          managers: apartmentComplex.managers?.map((manager) => ({
            email: manager.email,
            name: manager.fullName,
            _id: manager._id,
          })),
        };
      }
      return null;
    })
  );

  return results.filter((item) => item !== null);
};

export const checkIfApartmentHasAnotherRenter = async (apartmentComplex: string, apartmentId: string, renterId: string) => {
  const thisApartmentComplex = await ApartmentComplexModel.findById(new mongoose.Types.ObjectId(apartmentComplex));
  let hasAnotherRenter = false;
  renterId;
  thisApartmentComplex?.apartments?.map((apartment) => {
    if (apartment._id?.toString() === apartmentId.toString()) {
      // if (apartment?.renters?.includes()) {
      //   hasAnotherRenter = true;
      // }
    }
  });
  return hasAnotherRenter;
};

export const checkIfMaxRentersLimitReacher = async (apartmentComplex: string, apartmentId: string) => {
  const thisApartmentComplex = await ApartmentComplexModel.findById(new mongoose.Types.ObjectId(apartmentComplex));
  let canHaveNewRenter = true;
  thisApartmentComplex?.apartments?.map((apartment) => {
    if (apartment._id?.toString() === apartmentId.toString()) {
      if ((apartment?.renters?.length ?? 0) >= (apartment.maxRentersAllowed ?? 0)) {
        canHaveNewRenter = false;
      }
    }
  });
  return canHaveNewRenter;
};

export const getApartmentRentersByApartmentId = async (apartmentId: string) => {
  const apartmentWithRenters = await ApartmentComplexModel.aggregate([
    {
      $unwind: '$apartments',
    },
    {
      $match: {
        'apartments._id': new mongoose.Types.ObjectId(apartmentId),
      },
    },
    {
      $unwind: {
        path: '$apartments.renters',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'apartments.renters',
        foreignField: '_id',
        as: 'renter',
      },
    },
    {
      $unwind: '$renter',
    },
    {
      $project: {
        apartmentComplexName: 1,
        apartmentComplexId: '$_id',
        licensePlateLimitPerRenter: '$licensePlateLimitPerRenter',
        apartment: '$apartments',
        renter: '$renter',
      },
    },
  ]);

  const updated = apartmentWithRenters.map((entry) => {
    const { renter, apartment, apartmentComplexName, apartmentComplexId, licensePlateLimitPerRenter } = entry;
    const filteredPlates = (apartment?.licensePlates || []).filter(
      (plate: any) => plate.renterId?.toString() === renter._id?.toString()
    );

    delete renter.password;
    return {
      _id: renter._id,
      apartmentComplex: {
        name: apartmentComplexName,
        id: apartmentComplexId,
        licensePlateLimitPerRenter: licensePlateLimitPerRenter,
      },
      renter,
      apartment: {
        ...apartment,
        licensePlates: filteredPlates,
      },
    };
  });

  return updated;
};

export const removeRenterFromApartment = async (apartmentId: string, renterId: string, loggedInUser: IUserDoc) => {
  const apartmentComplex = await ApartmentComplexModel.findOne({
    'apartments._id': new mongoose.Types.ObjectId(apartmentId),
  });
  let impactedAparment: any;
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex not found');
  }

  apartmentComplex?.apartments?.find((apartment) => {
    if (apartment._id?.toString() === apartmentId.toString()) {
      impactedAparment = (apartment as any)?.toObject();
      apartment?.renters?.map((renter) => {
        if (renter._id?.toString() === renterId.toString()) {
          apartment?.renters?.splice(apartment?.renters?.indexOf(renter), 1);
        }
      });
      apartment.licensePlates.filter((license) => {
        if (license.renterId?.toString() === renterId.toString()) {
          apartment?.licensePlates?.splice(apartment?.licensePlates?.indexOf(license), 1);
        }
      });
    }
  });
  await userService.removeRenterFromApartment({
    userBody: { oldUserId: renterId, apartmentId, apartmentComplex: apartmentComplex?._id } as any,
    loggedInUser,
    owner: apartmentComplex?.user,
    impactedAparment,
    apartmentComplexName: apartmentComplex?.apartmentComplexName!,
  });

  return apartmentComplex?.save();
};

export const attachRenterToApartment = async (
  apartmentId: string,
  apartmentComplex: string,
  renterId: string,
  loggedInUser: IUserDoc
) => {
  const apartmentdetails = await updateApartmentByApartmentComplexIdWithNewRenter({
    apartmentComplexId: new mongoose.Types.ObjectId(apartmentComplex),
    userId: new mongoose.Types.ObjectId(renterId),
    apartmentId: new mongoose.Types.ObjectId(apartmentId),
    loggedInUser,
    isNewUser: false,
  });

  await userService.attachRenterToApartment({
    apartmentComplex: new mongoose.Types.ObjectId(apartmentComplex),
    renterId: new mongoose.Types.ObjectId(renterId),
    apartmentId: new mongoose.Types.ObjectId(apartmentId),
  });

  if (apartmentdetails.updated?.apartmentComplexName && apartmentdetails.impactedAparment?.apartmentNumber) {
    emailService.sendRenterOnboardAndOffboardEmails(
      {
        apartmentComplexName: apartmentdetails.updated?.apartmentComplexName,
        apartmentNumber: apartmentdetails.impactedAparment?.apartmentNumber,
        reason: 'attached',
      },
      apartmentdetails.user!
    );
  }

  return apartmentdetails;
};

/**
 * Get my apartment complexes
 * @param {ObjectId} userId
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const getAllLicensesByAPartmentComplexId = async (
  complexId: mongoose.Types.ObjectId
): Promise<{
  licensesPool: {
    plate: string;
    stateShort: string;
  }[];
  apartmentLicenses: {
    plate: string;
    stateShort: string;
    renterId: string;
  }[];
}> => {
  try {
    const data = await ApartmentComplexModel.findById({
      _id: complexId,
      isDeleted: false,
    }).exec();

    const licensesPool = data?.toObject().licensePlates || [];
    const apartmentLicenses = data?.toObject()?.apartments?.flatMap((apartment) => apartment.licensePlates) || [];

    return {
      licensesPool,
      apartmentLicenses,
    };
  } catch (error) {
    return {
      licensesPool: [],
      apartmentLicenses: [],
    };
  }
};

/**
 * Get apartment complex status
 * @param {ObjectId} complexId
 * @returns {Promise<Object>}
 */
export const getApartmentComplexStatus = async (complexId: mongoose.Types.ObjectId) => {
  try {
    const complex = await ApartmentComplexModel.findById(complexId).exec();
    if (!complex) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment complex not found');
    }

    // Count active bookings
    const activeBookings = await Booking.countDocuments({
      apartmentComplexId: complexId,
      status: 'ONGOING'
    });

    // Count pending tow requests
    const pendingTowRequests = await TowRequest.countDocuments({
      requestCreatedBy: complexId,
      status: { $in: ['PENDING_ASSIGNMENT', 'PENDING_PSP_APPROVAL', 'ASSIGNED'] }
    });

    // Check parking space availability
    const totalSpaces = complex.totalParkingSpaces || 0;
    const availableSpaces = complex.availableParkingSpaces || 0;
    const utilizationRate = totalSpaces > 0 ? ((totalSpaces - availableSpaces) / totalSpaces * 100).toFixed(1) : '0';

    // Determine overall status
    let status = 'active';
    let message = 'All systems operational';

    if (pendingTowRequests > 10) {
      status = 'warning';
      message = `${pendingTowRequests} pending tow requests need attention`;
    } else if (parseFloat(utilizationRate) > 90) {
      status = 'warning';
      message = 'Parking spaces nearly full';
    } else if (activeBookings === 0 && pendingTowRequests === 0) {
      status = 'inactive';
      message = 'No recent activity';
    }

    return {
      status,
      message,
      metrics: {
        activeBookings,
        pendingTowRequests,
        totalParkingSpaces: totalSpaces,
        availableParkingSpaces: availableSpaces,
        utilizationRate: utilizationRate + '%'
      },
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting apartment complex status:', error);
    return {
      status: 'error',
      message: 'Failed to retrieve status',
      metrics: {
        activeBookings: 0,
        pendingTowRequests: 0,
        totalParkingSpaces: 0,
        availableParkingSpaces: 0,
        utilizationRate: '0%'
      },
      lastChecked: new Date().toISOString()
    };
  }
};
