import {
  IOccupant,
  IUser,
  IUserDoc,
  IUserType,
  NewCreatedUser,
  SearchUsersOptions,
  UpdateUserBody,
} from './user.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
// import { SortOrder, sortArrayOfObjectsByKey } from '../utils/sortUtil';
import { Token, tokenService, tokenTypes } from '../token';
import {
  acceptRejectPromoteDemoteEmail,
  promoteDemoteUserRequest,
  resendAccountVerificationEmail,
  sendAccountEmailChanged,
  sendArchiveEmail,
  sendEmailChangedConfirmation,
  sendNewAccountEmail,
  sendNotificationToOwnerManagerOfBlockedUser,
  sendOccupantCreateAndDeleteEmails,
  sendResumeEmail,
  sendRetrieveEmail,
  sendSuspensionEmail,
  sendTBFor24Email,
} from '../email/email.service';
import {
  checkIfMaxRentersLimitReacher,
  updateApartmentByApartmentComplexIdWithNewRenter,
  updateApartmentComplexByIdWithUserId,
} from '../apartmentComplex/apartmentComplex.service';

import { ALL_EVENTS } from '../utils/events';
import ApartmentComplex from '../apartmentComplex/apartmentComplex.model';
import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
import { Message } from '../utils/errorMessage';
import TowRequest from '../tow-request/tow-request.model';
import User from './user.model';
import { apartmentComplexService } from '../apartmentComplex';
import config from '../../config/config';
import { createUserManagementLog } from '../logs/enhanced-log-migration.service';
import { emailService } from '../email';
import { emailTemplate } from '../email/Template/email-template';
// import { getSignedUrl } from '../upload/upload.service';
import httpStatus from 'http-status';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { newUserService } from '../new-user';
import { notifyOwnerManagerOfBlockedUser } from '../email/email.util';
// import { orderService } from '../order';
import { otpService } from '../otp';
import { passkeyService } from '../passkey';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';
// import { reviewService } from '../review';
import { verifyOtp } from '../otp/otp.service';
import { verifyToken } from '../token/token.service';

// import fetch from 'node-fetch';
// import { formatExistingBusinessesToNewBusinesses } from './business.util';

// import fetch from 'node-fetch';
// import { formatExistingBusinessesToNewBusinesses } from './business.util';

/**
 * Generates a reset password token and sends a new account email to the user.
 * Also generates authentication tokens for the user.
 *
 * @param {IUserDoc} user - The user document containing user details.
 * @param {string} [exposedPassword] - An optional parameter for the exposed user password.
 * @returns {Promise<{ user: IUserDoc, tokens: AccessAndRefreshTokens }>} - A promise that resolves to an object containing the user and their auth tokens.
 */

export const createUserHelper = async (user: IUserDoc, exposedPassword?: string) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(user?.email!, 30);

  await sendNewAccountEmail(user.email!, resetPasswordToken, user.fullName!, user, exposedPassword);
  const tokens = await tokenService.generateAuthTokens(user);

  if (user?.password) delete (user as any)?.password;
  return {
    user,
    tokens,
  };
};

export const resendEmailLink = async (user: IUserDoc) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(user?.email!, 30);

  await resendAccountVerificationEmail(user.email!, resetPasswordToken, user.fullName!, user);

  // await logService.createAnonymousManagementLog({
  //   name: user?.fullName!,
  //   event: ALL_EVENTS.UserManagementEvents.createUser(user),
  // });
  return 'success';
};
/**
 * Create a user
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createUser = async (userBodyToCreate: NewCreatedUser): Promise<IUserDoc> => {
  const userBody: any = userBodyToCreate;

  userBody.email = userBody.email.toLowerCase();

  if (await User.isEmailTaken(userBody.email!)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another Email');
  }
  if (await User.isPhoneNumberTaken(userBody.phoneNumber!, userBody?.userType)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number in use. Try another number');
  }

  // if (!userBody?.image) {
  //   const image = await generateProfilePic();
  //   userBody.image = image;
  // }

  return User.create({
    ...userBody,
    fullName: userBody.fullName ?? userBody.firstName + ' ' + userBody.lastName,
  });
};

/**
 * Create a user
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createUserWithType = async (
  userBody: Partial<IUser & { companyName: string; apartmentId: string; pspCompanyId: string }>,
  loggedInUser: IUserDoc,
  excludeCreateCheckId?: string,
  skipPostEmail?: boolean
): Promise<IUser> => {
  if (await User.isEmailTaken(userBody.email!)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another Email');
  }

  if (await User.isPhoneNumberTaken(userBody.phoneNumber!)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already registered. Try another Phone number');
  }

  const tempUser = await newUserService.getUserEmail(userBody.email!);
  if (tempUser && tempUser.id.toString() !== excludeCreateCheckId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another Email');
  }
  if ((loggedInUser.userType !== 'admin' || !loggedInUser.isSuperAdmin) && userBody.userType === 'admin') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only super admin can create admin');
  }

  let userPayload: any = {
    ...staticUserBody(userBody),
  };

  if (userBody.userType === 'apartment-complex-owner') {
    if (!userBody.companyName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Company name is required');
    }
    userPayload = {
      ...userPayload,
      userType: 'apartment-complex-owner',
      company: {
        companyName: userBody.companyName as string,
      },
    };
  }
  if (userBody.userType === 'tow-company-owner') {
    if (!userBody.companyName) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company name is required');
    }
    userPayload = {
      ...userPayload,
      userType: 'tow-company-owner',
      towCompany: {
        companyName: userBody.companyName as string,
      },
    };
  }

  if (userBody.userType === 'apartment-complex-employee' || userBody.userType === 'apartment-complex-manager') {
    if (!userBody.apartmentComplex) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex id is required');
    }
    userPayload = {
      ...userPayload,
      userType: userBody.userType,
      apartmentComplex: userBody.apartmentComplex,
    };
  }

  if (userBody.userType === 'tow-company-employee' || userBody.userType === 'tow-company-manager') {
    if (!userBody.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company Id is required ');
    }
    userPayload = {
      ...userPayload,
      userType: userBody.userType,
      towCompanyId: userBody.towCompanyId,
      driverBadgeNumber: userBody.driverBadgeNumber,
    };
  }

  if (userBody.userType === 'parking-spaces-provider-owner') {
    if (!userBody.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company Id is required ');
    }

    if (!userBody?.parkingDetails?.charges && userBody.isPaidParkingSpaceProvider !== false) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Charges is required ');
    }
    userPayload = {
      isPaidParkingSpaceProvider: userBody?.isPaidParkingSpaceProvider === false ? false : true,
      ...userPayload,
      parkingDetails: userBody.parkingDetails,
      userType: userBody.userType,
      towCompanyId: userBody.towCompanyId,
      company: {
        companyName: (userBody.companyName as string) || '',
      },
    };
  }

  if (userBody.userType === 'tow-requester') {
    if (!userBody.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company Id is required ');
    }
    // Check if email is a dummy email (created via phone number)
    const isDummyEmail = userBody.email?.toLowerCase().includes('dummy');
    // Check if phone is a dummy phone number (starts with +1000000)
    const isDummyPhone = userBody.phoneNumber?.startsWith('+1000000');
    userPayload = {
      ...userPayload,
      userType: 'tow-requester',
      towCompanyId: userBody.towCompanyId,
      isEmailVerified: !isDummyEmail, // false if dummy email, true otherwise
      isPhoneNumberVerified: !isDummyPhone, // false if dummy phone, true otherwise
    };
  }

  if (userBody.userType === 'parking-spaces-provider-employee') {
    if (!userBody.towCompanyId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company Id is required ');
    }

    userPayload = {
      ...userPayload,
      userType: userBody.userType,
      towCompanyId: userBody.towCompanyId,
      pspCompanyId: userBody.pspCompanyId,
      accountApproval: {
        //is approved = true because of entering a passkey
        isApproved: true,
      },
    };
  }

  if (userBody.userType === 'renter') {
    // check if the apartment is already attached to a renter if yes then oldUserId must be compulsory
    const canHaveNewRenter = await checkIfMaxRentersLimitReacher(userBody.apartmentComplex!, userBody.apartmentId!);
    if (!canHaveNewRenter) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Apartment is full, and cannot have any more renters. Use Change renter functionality.'
      );
    }
    userPayload = {
      ...userPayload,
      userType: userBody.userType,
      apartment: [
        {
          apartmentId: new mongoose.Types.ObjectId(userBody.apartmentId),
          apartmentComplex: new mongoose.Types.ObjectId(userBody.apartmentComplex),
        },
      ],
    };
  }
  if (userBody.userType === 'admin') {
    userPayload = {
      ...userPayload,
      userType: userBody.userType,
    };
  }
  const user = await createUser(userPayload as NewCreatedUser);
  const owner = await getOwnerIdByUserId(user.id || user._id);
  if (userBody.userType === 'apartment-complex-employee' || userBody.userType === 'apartment-complex-manager') {
    const complex = await updateApartmentComplexByIdWithUserId(
      new mongoose.Types.ObjectId(userBody.apartmentComplex),
      user.id,
      userBody.userType
    );
    await createUserManagementLog({
      user: loggedInUser,
      ownerId: owner,
      affectedUser: user._id || user.id,
      event:
        user.userType === 'apartment-complex-employee'
          ? ALL_EVENTS.UserManagementEvents.createCompanyEmployee({
              apartmentComplexName: complex?.apartmentComplexName as string,
              apartmentComplexId: userBody.apartmentComplex as string,
              email: user.email as string,
              userId: user.id as string,
            })
          : ALL_EVENTS.UserManagementEvents.createCompanyManager({
              apartmentComplexName: complex?.apartmentComplexName as string,
              apartmentComplexId: userBody.apartmentComplex as string,
              email: user.email as string,
              userId: user.id as string,
            }),
      customMetadata: {
        userType: loggedInUser.userType,
        apartmentComplexName: complex?.apartmentComplexName,
        apartmentComplexId: userBody.apartmentComplex,
        createdUserType: user.userType,
      },
    });
  }

  if (userBody.userType === 'tow-company-employee' || userBody.userType === 'tow-company-manager') {
    await updateTowCompanyWithUserId(new mongoose.Types.ObjectId(userBody.towCompanyId), user.id, userBody.userType);
    const towCompany = await User.findById(new mongoose.Types.ObjectId(userBody.towCompanyId));
    await createUserManagementLog({
      user: loggedInUser,
      ownerId: owner,
      affectedUser: user._id || user.id,
      event:
        user.userType === 'tow-company-employee'
          ? ALL_EVENTS.UserManagementEvents.createTowCompanyEmployee({
              companyName: towCompany?.towCompany?.companyName as string,
              email: user.email as string,
              towCompanyId: userBody.towCompanyId,
              userId: user._id || user.id,
            })
          : ALL_EVENTS.UserManagementEvents.createTowCompanyManager({
              companyName: towCompany?.towCompany?.companyName as string,
              email: user.email as string,
              towCompanyId: userBody.towCompanyId,
              userId: user._id || user.id,
            }),
      customMetadata: {
        userType: loggedInUser.userType,
        companyName: towCompany?.towCompany?.companyName,
        towCompanyId: userBody.towCompanyId,
        createdUserType: user.userType,
      },
    });
  }
  if (userBody.userType === 'apartment-complex-owner') {
    await createUserManagementLog({
      user: loggedInUser,
      affectedUser: user._id || user.id,
      event: ALL_EVENTS.UserManagementEvents.onboardCompany({
        companyName: userBody.companyName as string,
        email: user.email as string,
        id: user.id,
      }),
      customMetadata: {
        userType: loggedInUser.userType,
        companyName: userBody.companyName,
        createdUserType: user.userType,
      },
    });
  }
  if (userBody.userType === 'tow-company-owner') {
    await createUserManagementLog({
      user: loggedInUser,
      affectedUser: user._id || user.id,
      event: ALL_EVENTS.UserManagementEvents.onboardTowCompany({
        companyName: userBody.companyName as string,
        email: user.email as string,
        id: user.id,
      }),
      customMetadata: {
        userType: loggedInUser.userType,
        companyName: userBody.companyName,
        createdUserType: user.userType,
      },
    });
  }
  if (userBody.userType === 'renter') {
    postRenterCreation({
      user,
      userBody,
      loggedInUser,
    });
  }
  if (userBody.userType === 'admin') {
    await createUserManagementLog({
      user: loggedInUser,
      affectedUser: user._id || user.id,
      event: ALL_EVENTS.AdminEvents.addAdmin(loggedInUser, user),
      customMetadata: {
        userType: loggedInUser.userType,
        createdUserType: user.userType,
        action: 'admin_creation',
      },
    });
  }

  if (userBody.userType === 'parking-spaces-provider-owner') {
    await createUserManagementLog({
      user: loggedInUser,
      affectedUser: user._id || user.id,
      event: ALL_EVENTS.AdminEvents.approvedParkingSpacesProviderUnpaid(loggedInUser, user),
      customMetadata: {
        userType: loggedInUser.userType,
        createdUserType: user.userType,
        action: 'parking_provider_approval',
      },
    });

    // Create passkey if provided
    if (userBody.passkey && userBody.towCompanyId) {
      try {
        await passkeyService.createPasskey({
          pspId: user.id || user._id,
          towCompanyId: userBody.towCompanyId,
          passkey: userBody.passkey,
        });
      } catch (error) {
        console.error('Error creating passkey:', error);
        // Don't fail user creation if passkey creation fails
      }
    }
  }
  if (!skipPostEmail) {
    await createUserHelper(user);
  }

  return user;
};

export const removeRenterFromApartment = async ({
  userBody,
  loggedInUser,
  owner,
  impactedAparment,
  apartmentComplexName,
}: {
  userBody: Partial<IUser & { companyName: string; apartmentId: string; apartmentComplex: string; oldUserId: string }>;
  owner: IUserDoc['_id'];
  loggedInUser: IUserDoc;
  impactedAparment: any;
  apartmentComplexName: string;
}) => {
  if ((userBody as any).oldUserId) {
    const offboardedUser = await User.findById(new mongoose.Types.ObjectId((userBody as any).oldUserId));
    if (offboardedUser?.apartment && offboardedUser?.apartment?.length > 0) {
      offboardedUser.apartment = offboardedUser.apartment.filter((apartment) => {
        if (apartment.apartmentId?.toString() !== userBody.apartmentId?.toString()) {
          return true;
          // apartment.apartmentId = null as any;
        }
        return false;
      });

      offboardedUser.occupants = offboardedUser.occupants.filter((occupant) => {
        return occupant?.apartmentId?.toString() !== userBody?.apartmentId?.toString();
      });
      const freeLicensesFromApartment = impactedAparment?.licensePlates?.filter((plate: any) => {
        if (plate?.renterId?.toString() === (userBody as any).oldUserId?.toString()) {
          return true;
        } else {
          return false;
        }
      });
      if (!offboardedUser?.licensePlates) {
        offboardedUser.licensePlates = [];
      }
      freeLicensesFromApartment?.map((plate: any) => {
        offboardedUser?.licensePlates.push({
          ...pick(plate, 'plate', 'stateShort'),
          apartmentComplex: new mongoose.Types.ObjectId(userBody.apartmentComplex),
        });
      });

      //   }
      // });

      offboardedUser.save();
    }
    if (offboardedUser?._id)
      emailService.sendRenterOnboardAndOffboardEmails(
        {
          apartmentComplexName: apartmentComplexName,
          apartmentNumber: impactedAparment.apartmentNumber!,
          reason: 'removed',
        },
        offboardedUser
      );

    await createUserManagementLog({
      user: loggedInUser,
      affectedUser: (userBody as any).oldUserId,
      ownerId: owner,
      event: ALL_EVENTS.UserManagementEvents.offboardRenter({
        apartmentComplex: userBody.apartmentComplex as string,
        apartmentId: userBody.apartmentId as string,
        email: offboardedUser?.email as string,
        id: (userBody as any).oldUserId,
      }),
      customMetadata: {
        userType: loggedInUser.userType,
        apartmentComplex: userBody.apartmentComplex,
        apartmentId: userBody.apartmentId,
        action: 'renter_offboard',
      },
    });
  }
};

const postRenterCreation = async ({
  user,
  userBody,
  loggedInUser,
}: {
  userBody: Partial<IUser & { companyName: string; apartmentId: string }>;
  user: IUserDoc;
  loggedInUser: IUserDoc;
}) => {
  try {
    const apartmentDetails = await updateApartmentByApartmentComplexIdWithNewRenter({
      apartmentComplexId: new mongoose.Types.ObjectId(userBody.apartmentComplex),
      apartmentId: new mongoose.Types.ObjectId(userBody.apartmentId),
      isNewUser: true,
      loggedInUser,
      userId: user.id,
    });

    removeRenterFromApartment({
      userBody,
      loggedInUser,
      owner: apartmentDetails.updated.user,
      apartmentComplexName: apartmentDetails.updated.apartmentComplexName,
      impactedAparment: apartmentDetails.impactedAparment,
    });
  } catch (error) {
    console.error(error);

    // throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error onboarding renter');
  }
};

// TODO transactions

// /**
//  * Create a user with type-specific behavior in a transaction
//  * @param {Partial<IUser & { companyName: string }>} userBody
//  * @returns {Promise<IUser>}
//  */
// export const createUserWithType = async (
//   userBody: Partial<IUser & { companyName: string }>
// ): Promise<IUser> => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     let userPayload: any = {
//       ...staticUserBody(userBody),
//     };

//     if (userBody.userType === 'apartment-complex-owner') {
//       if (!userBody.companyName) {
//         throw new ApiError(httpStatus.BAD_REQUEST, 'Company name is required');
//       }
//       userPayload = {
//         ...userPayload,
//         userType: 'apartment-complex-owner',
//         company: {
//           companyName: userBody.companyName,
//         },
//       };
//     }

//     if (userBody.userType === 'tow-company-owner') {
//       if (!userBody.companyName) {
//         throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company name is required');
//       }
//       userPayload = {
//         ...userPayload,
//         userType: 'tow-company-owner',
//         towCompany: {
//           companyName: userBody.companyName,
//         },
//       };
//     }

//     if (userBody.userType === 'apartment-complex-employee') {
//       if (!userBody.apartmentComplex) {
//         throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment complex id is required');
//       }
//       userPayload = {
//         ...userPayload,
//         userType: 'apartment-complex-employee',
//         apartmentComplex: userBody.apartmentComplex,
//       };
//     }

//     if (userBody.userType === 'tow-company-employee') {
//       if (!userBody.towCompanyId) {
//         throw new ApiError(httpStatus.BAD_REQUEST, 'Tow Company Id is required');
//       }
//       userPayload = {
//         ...userPayload,
//         userType: 'tow-company-employee',
//         towCompanyId: userBody.towCompanyId,
//       };
//     }

//     // Step 1: Create User
//     const user = await createUser(userPayload as NewCreatedUser, session); // Pass session here

//     // Step 2: Update related entity based on userType
//     if (userBody.userType === 'apartment-complex-employee') {
//       await updateApartmentComplexByIdWithUserId(
//         new mongoose.Types.ObjectId(userBody.apartmentComplex),
//         user.id,
//         session
//       );
//     }

//     if (userBody.userType === 'tow-company-employee') {
//       await updateTowCompanyWithUserId(
//         new mongoose.Types.ObjectId(userBody.towCompanyId),
//         user.id,
//         session
//       );
//     }

//     // Step 3: Create helper data
//     await createUserHelper(user, session);

//     await session.commitTransaction();
//     session.endSession();

//     return user;
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

/**
 * Reset password
 * @param {string} email
 * @param {string} code
 * @param {string} user
 * @returns {Promise<void>}
 */
export const resetEmail = async (email: string, resetEmailCode: any, user: IUserDoc): Promise<void> => {
  try {
    await verifyOtp(email, resetEmailCode, 'changeEmail');
    if (!user) {
      throw new Error();
    }
    await updateUserById(user.id, { email });
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email reset failed');
  }
};

/**
 * Reset password
 * @param {string} userIds
 * @returns {Promise<void>}
 */
export const sendVerificationSMSToUsers = async (userIds: string[]): Promise<void> => {
  const modifiedUsers = userIds.map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find({ _id: { $in: modifiedUsers }, isVerified: false });
  if (users?.length && users.length > 0) {
    const promises = users.map(async (user) => {
      await otpService.sendEmailSetLink({
        phoneNumber: user.phoneNumber!,
        userDoc: user as unknown as IUserDoc,
        reminderNumber: 1,
        expiry: 168 * 60,
      });
      return await updateUserReminder(new mongoose.Types.ObjectId(user._id));
    });
    return (await Promise.all(promises)) as any;
  }

  return;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryUsers = async (
  filter: Record<string, any>,
  options: IOptions,
  userType?: IUserType,
  skipPopulate?: boolean
): Promise<QueryResult> => {
  const users = await User.paginate(
    { ...filter, userType: filter['userType'] ?? { $ne: 'admin' }, isDeleted: { $ne: true } },
    {
      ...options,
      ...(skipPopulate ? {} : { populate: 'apartmentComplex,towCompanyId~~towCompany' }),
      projectBy: '-password',
    }
  );

  const userResults = users.results;
  // console.log(userResults, "userResultsXXXX")

  // 1. Get Apartment Complexes for owners
  const apartmentOwnerUsers = userResults.filter((user: any) => user.userType === 'apartment-complex-owner');

  const apartmentComplexesData = await Promise.all(
    apartmentOwnerUsers.map((user: any) => apartmentComplexService.getMyApartmentComplexes(user._id))
  );

  const apartmentOwnerMap = new Map(
    apartmentOwnerUsers.map((user: any, index: number) => [user._id.toString(), apartmentComplexesData[index]])
  );

  // 2. Get Tow Company employees and managers
  const towOwnerUsers = userResults.filter((user: any) => user.userType === 'tow-company-owner');
  // console.log(towOwnerUsers, "towOwnerUsersXXXX")
  const towOwnerData = await Promise.all(
    towOwnerUsers.map(async (user: any) => {
      const employees = await getUsersByIds(user?.towCompany?.employees);
      let managers: any = [];
      if (userType === 'admin' || userType === 'tow-company-owner' || userType === 'tow-company-manager') {
        managers = await getUsersByIds(user?.towCompany?.managers);
      }
      return {
        _id: user._id.toString(),
        employees,
        managers,
      };
    })
  );
  // console.log(towOwnerData, "towOwnerDataXXXX")

  const towOwnerMap = new Map(
    towOwnerData.map((item) => [item._id, { employees: item.employees, managers: item.managers }])
  );

  // 3. Merge all into user objects
  const usersWithData = userResults.map((user: any) => {
    const userObj = user.toObject();

    const apartmentComplexes = apartmentOwnerMap.get(user._id.toString());
    const towData = towOwnerMap.get(user._id.toString());

    return {
      ...userObj,
      ...(apartmentComplexes ? { apartmentComplexes } : {}),
      ...(towData ? { employees: towData.employees, managers: towData.managers } : {}),
    };
  });

  // console.log(usersWithData, "usersWithDataXXXX")

  return {
    ...users,
    results: usersWithData,
  };
};

/**
 * Query for users
 * @returns {Promise<IUserDoc[]>}
 */
export const listAllUsers = async (userType: IUserType | 'ALL', country?: string): Promise<IUserDoc[]> => {
  const users = await User.aggregate([
    {
      $match: {
        ...(country ? { country } : {}),
        ...(userType !== 'ALL' ? { userType } : {}),
      },
    }, // Filter users by userType
    {
      $project: {
        country: 1,
        firstName: 1,
        lastName: 1,
        fullName: 1,
        userType: 1,
        phoneNumber: 1, // by appdev-cts
        id: 1,
        email: 1,
        businessCount: { $size: '$business' }, // Calculate the size of the business array
        isSuspended: 1, // by appdev-cts
        isArchived: 1, // by appdev-cts
      },
    },
    { $sort: { firstName: 1 } },
  ]).exec();
  return users;
};

/**
 * Get user by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserById = async (id: mongoose.Types.ObjectId): Promise<IUserDoc | null> => User.findById(id);

/**
 * Get user by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserByIdByUserType = async (
  _id: mongoose.Types.ObjectId,
  loggedInUser: IUserDoc
): Promise<IUserDoc | null> => {
  if (loggedInUser.userType === 'admin') {
    return User.findOne({ _id });
  } else if (loggedInUser.userType.includes('tow-company')) {
    if (loggedInUser.userType === 'tow-company-owner') {
      return User.findOne({ _id, towCompanyId: new mongoose.Types.ObjectId(loggedInUser.id) });
    } else {
      return User.findOne({ _id, towCompanyId: new mongoose.Types.ObjectId(loggedInUser.towCompanyId) });
    }
  }
  throw new ApiError(httpStatus.BAD_REQUEST, "You don't have permission to view this user");
};

/**
 * Get users by ids
 * @param {mongoose.Types.ObjectId[]} ids
 * @returns {Promise<IUserDoc[]>}
 */
export const getUsersByIds = async (ids: mongoose.Types.ObjectId[]): Promise<IUserDoc[]> => {
  return User.find({ _id: { $in: ids } });
};
/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserByEmail = async (email: string): Promise<IUserDoc | null> => {
  return User.findOne({ email, isDeleted: { $ne: true } });
};
export const getUserByEmailAndPhone = async (email: string, phoneNumber: string): Promise<IUserDoc | null> =>
  User.findOne({ email: email.toLowerCase(), phoneNumber });

export const getUserByPhone = async (phoneNumber: string, userType?: string): Promise<IUserDoc | null> => {
  return User.findOne({
    phoneNumber: phoneNumber,
    ...(userType && { userType }),
  });
};

/**
 * Get user by Stripe customer ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @returns {Promise<IUserDoc | null>}
 */
export const getUserByStripeCustomerId = async (stripeCustomerId: string): Promise<IUserDoc | null> => {
  return User.findOne({ stripeCustomerId });
};

export const updateUserReminder = async (userId: mongoose.Types.ObjectId) => {
  return User.findByIdAndUpdate(
    { _id: userId },
    { $push: { emailVerificationReminders: { sentAt: new Date().toISOString() } } },
    { new: true }
  );
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const updateUserById = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody & { companyName?: string },
  language: string = 'english',
  options?:{
    skipEmailVerificationLinkGeneration?: boolean,
  }
): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (updateBody.email) {
      updateBody.email = updateBody.email.toLowerCase();
      if (await User.isEmailTaken(updateBody.email, userId)) {
        throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Email already registered. Try another Email');
      }

      if (user.userType === 'admin') {
        throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Admin email cannot be updated');
      }
      if (updateBody.email.toLowerCase() !== user?.email?.toLocaleLowerCase()) {
        updateBody.isVerified = false;
      }
    }

    if (updateBody.phoneNumber && (await User.isPhoneNumberTaken(updateBody.phoneNumber, user.userType, userId))) {
      // throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Phone number in use. Try another number');
      throw new ApiError(httpStatus.NOT_ACCEPTABLE, Message.business.phoneAlreadyExist[language]);
    }

    // if (user.userType === 'superadmin' && !updateBody.lastLogin) {
    //   throw new ApiError(httpStatus.FORBIDDEN, 'Super admin cannot be updated');
    // }
    const ownerId = await getOwnerIdByUserId(user.id || user._id);

    if (updateBody.isSuspended !== undefined && user.email) {
      if (updateBody.isSuspended) {
        await logService.createLog({
          ownerId,
          user: { ...user.toObject(), email: updateBody?.email ? updateBody?.email : user?.email },
          event: ALL_EVENTS.UserManagementEvents.accountSuspend(user as unknown as IUserDoc),
          eventEnum: 'UME',
        });
        updateBody.suspendReason = '';
        await sendSuspensionEmail(user);
      } else {
        if (
          user.isSuspended &&
          (user.userType === 'apartment-complex-employee' || user.userType === 'tow-company-employee')
        ) {
          if (user.suspendReason) {
            updateBody.isSuspended = true;
            updateBody.suspendReason = 'All employees suspended due to manager suspension.';
          } else if (!user.suspendReason) {
            // throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'User is suspended due to manager account and cannot be unsuspended');
          }
        } else {
          updateBody.suspendReason = '';
        }

        await logService.createLog({
          user,
          ownerId,
          event: ALL_EVENTS.UserManagementEvents.accountResumed(user as unknown as IUserDoc),
          eventEnum: 'UME',
        });

        await sendResumeEmail({ ...user.toObject(), email: updateBody?.email ? updateBody?.email : user?.email } as any);
      }
    }

    if (updateBody.isArchived !== undefined && user.email) {
      if (updateBody.isArchived) {
        await logService.createLog({
          user: { ...user.toObject(), email: updateBody?.email ? updateBody?.email : user?.email },
          ownerId,
          event: ALL_EVENTS.UserManagementEvents.accountBlock(user as unknown as IUserDoc),
          eventEnum: 'UME',
        });
        updateBody.archiveReason = '';
        await sendArchiveEmail(user);
      } else {
        if (
          user.isArchived &&
          (user.userType === 'apartment-complex-employee' || user.userType === 'tow-company-employee')
        ) {
          if (user.archiveReason) {
            updateBody.isArchived = true;
            updateBody.archiveReason = 'All employees archived due to manager suspension.';
          } else if (!user.archiveReason) {
            // throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'User is archived due to manager account and cannot be unsuspended');
          }
        } else {
          updateBody.archiveReason = '';
        }
        await logService.createLog({
          user,
          ownerId,

          event: ALL_EVENTS.UserManagementEvents.accountUnblock(user as unknown as IUserDoc),
          eventEnum: 'UME',
        });
        await sendRetrieveEmail(user);
      }
    }

    // if (updateBody.phoneNumber) {
    //   const formattedPhoneNumber = formatPhoneNumber(updateBody.phoneNumber);
    //   updateBody.phoneNumber = formattedPhoneNumber;
    // }

  if (updateBody.companyName) {
    if (user.userType === 'apartment-complex-owner') {
      updateBody.company = {
        ...user.toObject().company,
        companyName: updateBody.companyName,
      };
    } else if (user.userType === 'tow-company-owner') {
      updateBody.towCompany = {
        ...user.toObject().towCompany,
        companyName: updateBody.companyName,
      };
    }
    delete updateBody.companyName;
  }

  // Handle passkey update for parking-space-provider-owner
  if (updateBody.passkey && user.userType === 'parking-spaces-provider-owner' && user.towCompanyId) {
    try {
      await passkeyService.createPasskey({
        pspId: user.id || user._id,
        towCompanyId: user.towCompanyId,
        passkey: updateBody.passkey,
      });
    } catch (error) {
      console.error('Error updating passkey:', error);
      // Don't fail user update if passkey update fails
    }
    delete updateBody.passkey; // Remove from user update since it's handled separately
  }

    if (updateBody.email && !options?.skipEmailVerificationLinkGeneration) {
      if (updateBody.email.toLowerCase() !== user?.email?.toLowerCase()) {
        const resetPasswordToken = await tokenService.generateResetPasswordToken(user?.email!, 30);
        await sendAccountEmailChanged(updateBody.email!, resetPasswordToken, user.fullName!, user);

        await logService.createLog({
          user,
          ownerId,

          event: ALL_EVENTS.UserManagementEvents.accountDeactivated({
            ...updateBody,
            fullName: user.fullName,
          } as unknown as IUserDoc),
          eventEnum: 'UME',
        });
      }
    }

    // Update tow requests if email is being updated from dummy to real email
    if (updateBody.email && user.email?.toLowerCase().includes('dummy') && !updateBody.email.toLowerCase().includes('dummy')) {
      const userIdToMatch = user.id || user._id;
      
      if (user.userType === 'tow-requester') {
        // Update all tow requests created by this tow-requester
        await TowRequest.updateMany(
          { requestCreatedBy: userIdToMatch },
          { $set: { requesterEmail: updateBody.email } }
        );
        console.log(`Updated requesterEmail for tow requests created by user ${userIdToMatch}`);
      } else if (user.userType?.includes('parking-spaces-provider')) {
        // Update all tow requests created by this PSP user
        await TowRequest.updateMany(
          { requestCreatedBy: userIdToMatch },
          { $set: { requesterEmail: updateBody.email } }
        );
        console.log(`Updated requesterEmail for tow requests created by PSP user ${userIdToMatch}`);
      }
    }

    Object.assign(user, updateBody);
    await user.save();
    // const [userImage] = user.image ? await getSignedUrl(user.image) : user.image;
    // user.image = userImage;
    return user;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, e.message);
  }
};
/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<IUserDoc | null>}
 */
export const promoteDemoteUser = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    let companyName = '';

    if (user.userType.includes('apartment-complex')) {
      user.userType =
        user.userType === 'apartment-complex-employee' ? 'apartment-complex-manager' : 'apartment-complex-employee';
      const apartmentComplexId = user.apartmentComplex;
      const apartmentComplex = await apartmentComplexService.promoteDemoteUser(
        apartmentComplexId as any,
        userId,
        user.userType
      );
      companyName = apartmentComplex?.apartmentComplexName as string;
    }

    if (user.userType.includes('tow-company')) {
      user.userType = user.userType === 'tow-company-employee' ? 'tow-company-manager' : 'tow-company-employee';
      const towCompany = await promoteDemoteAtTowCompany(user.towCompanyId, userId, user.userType);
      companyName = towCompany?.towCompany?.companyName as string;
    }

    const isPromoted = user.userType.includes('manager');
    // await sendPromotionDemotionEmail({
    //   companyName: companyName,
    //   newStatus: isPromoted ? 'promoted' : 'demoted',
    //   user,
    // });
    const notification = {
      status: isPromoted ? 'success' : ('error' as any), // 'error' should ideally be a more specific type if possible
      html: '',
      text: isPromoted
        ? `Congratulations! You've been successfully promoted to Manager at ${companyName}! In this new role, you'll have expanded responsibilities and the ability to perform a wider range of actions, similar to an owner. We're excited for your increased leadership and contribution.`
        : `Your role has been updated. You are now an Employee at ${companyName}. While managers have broader administrative capabilities, employees are the essential backbone of our operations, and your contributions remain vital to the company's success.`,
    };

    user.notifications.push(notification);

    await user.save();
    return user;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, e.message);
  }
};

export const promoteDemoteAtTowCompany = async (
  towCompanyId: string,
  userId: mongoose.Types.ObjectId,
  userType: IUserType
) => {
  const owner = await User.findById(new mongoose.Types.ObjectId(towCompanyId));
  if (!owner?.towCompany) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Company not found');
  }
  if (userType === 'tow-company-employee') {
    if (!owner.towCompany.employees) {
      owner.towCompany.employees = [];
    }
    if (!owner.towCompany.employees.includes(userId)) {
      owner.towCompany.employees.push(userId);
    }
    if (owner.towCompany.managers) {
      owner.towCompany.managers = owner.towCompany.managers.filter((id) => !id.equals(userId));
    }
  }
  if (userType === 'tow-company-manager') {
    if (!owner.towCompany.managers) {
      owner.towCompany.managers = [];
    }
    if (!owner.towCompany.managers.includes(userId)) {
      owner.towCompany.managers.push(userId);
    }
    if (owner.towCompany.employees) {
      owner.towCompany.employees = owner.towCompany.employees.filter((id) => !id.equals(userId));
    }
  }
  await owner.save();
  return owner;
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const updateProfile = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody
): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    Object.assign(user, updateBody);
    await user.save();
    // const [userImage] = user.image ? await getSignedUrl(user.image) : user.image;
    // user.image = userImage;
    return user;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, e.message);
  }
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const updatePersonalEmail = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody & { companyName?: string }
): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    const ownerId = await getOwnerIdByUserId(user.id || user._id);
    if (updateBody.email) {
      updateBody.email = updateBody.email.toLowerCase();
      if (await User.isEmailTaken(updateBody.email, userId)) {
        throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Email already registered. Try another Email');
      }
      if (user.userType === 'admin') {
        // throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Admin email cannot be updated');
      }
    }

    if (updateBody.email) {
      if (updateBody.email.toLowerCase() !== user?.email?.toLowerCase()) {
        await sendEmailChangedConfirmation(updateBody.email!, user.fullName!, user);

        await logService.createLog({
          user,
          ownerId,

          event: ALL_EVENTS.UserManagementEvents.emailChangesConfirmed(updateBody as unknown as IUserDoc, user),
          eventEnum: 'UME',
        });
      }
    }

    if (await User.isPhoneNumberTaken(updateBody.phoneNumber!)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already registered. Try another Phone number');
    }

    Object.assign(user, updateBody);
    await user.save();
    // const [userImage] = user.image ? await getSignedUrl(user.image) : user.image;
    // user.image = userImage;
    return user;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, e.message);
  }
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const suspendNonVerifiedUser = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (user.isVerified) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User is verified');
    }
    const ownerId = await getOwnerIdByUserId(user.id || user._id);
    await logService.createLog({
      user,
      ownerId,

      event: ALL_EVENTS.ManagementEvents.SystemUserSuspend(
        user.fullName!,
        'after ignoring three account verification alerts. User account is still not verified.'
      ),
      eventEnum: 'MaE',
    });
    await otpService.sendSuspendedAccountAlert({ phoneNumber: user.phoneNumber!, userDoc: user as unknown as IUserDoc });
    Object.assign(user, { isSuspended: true });

    await user.save();
    return user;
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
};

/**
 * Update user by id
 * @returns {Promise<IUserDoc | null>}
 */
export const getFilters = async () => {
  try {
    const filters = await User.aggregate([
      {
        $facet: {
          userTypes: [{ $group: { _id: '$userType' } }],
          countries: [{ $group: { _id: '$country' } }],
          businessStatuses: [{ $unwind: '$business' }, { $group: { _id: '$business.businessStatus' } }],
          businessTypes: [{ $unwind: '$business' }, { $group: { _id: '$business.businessType' } }],
          methodNames: [{ $unwind: '$business' }, { $group: { _id: '$business.methodName' } }],
          suspendedMenustatus: [{ $unwind: '$business' }, { $group: { _id: '$business.isSuspended' } }],
          temporaryBlocked: [{ $group: { _id: '$isTemporaryBlocked' } }],
          suspendedUsers: [{ $group: { _id: '$isSuspended' } }],
          archivedUsers: [{ $group: { _id: '$isArchived' } }],
          verifiedUsers: [{ $group: { _id: '$isVerified' } }],
        },
      },
    ]);

    const extractedFilters: any = filters[0];
    Object.keys(extractedFilters).forEach((key) => {
      extractedFilters[key] = extractedFilters[key]
        .map((item: { _id: string }) => item?._id)
        .sort((a: any, b: any) => (typeof a === 'string' ? a.localeCompare(b) : a - b));
    });
    // console.log(extractedFilters?.userTypes, 'extractedFilters?.userTypes');
    const countriesFilter = await User.aggregate([
      {
        $match: {
          userType: { $in: extractedFilters?.userTypes }, // Match documents with user types from the provided array
        },
      },
      {
        $group: {
          _id: '$userType',
          countries: { $addToSet: '$country' }, // Collect unique countries per userType
        },
      },
      {
        $project: {
          userType: '$_id', // Rename _id to userType in the output
          countries: '$countries',
          _id: 0, // Exclude _id field from the output
        },
      },
    ]);

    return { ...extractedFilters, countriesFilter };
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<IUserDoc | null>}
 */
export const recoverUserById = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    sendRetrieveEmail(user);

    Object.assign(user, { isTemporaryBlocked: false, temporaryBlockedTill: '' });

    await user.save();
    return user;
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} user
 * @param {UpdateUserBody} updateBody
 * @returns {Promise<IUserDoc | null>}
 */
export const temporaryBlockFor24AfterBruteForceLogin = async (userId: mongoose.Types.ObjectId): Promise<void> => {
  try {
    const user = await getUserById(userId);
    const currentDate = new Date();
    if (!user?.temporaryBlockedTill) {
      Object.assign(user!, {
        temporaryBlockedTill: new Date(currentDate.setHours(currentDate.getHours() + 24)).toISOString(),
      });
      await user?.save();
      const resetPasswordToken = await tokenService.generateResetPasswordToken(user?.email!);
      await sendTBFor24Email(user!, resetPasswordToken);

      handleOtherEmails(user!);
    }
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
};

/**
 * Delete business by siteId
 * @param {string} userId
 */
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<boolean> => {
  const user = await getUserById(userId);
  if (!user) {
    // Business not found
    throw new ApiError(httpStatus.NOT_FOUND, 'User does not exists');
    return false;
  }
  if (user.userType === 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Super admin cannot deleted');
  }
  await user.deleteOne();
  return true;
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {mongoose.Types.ObjectId} apartmentComplexId
 * @returns {Promise<IUserDoc | null>}
 */
export const deleteNotification = async (
  userId: mongoose.Types.ObjectId,
  notificationId: mongoose.Types.ObjectId
): Promise<IUserDoc | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    user.notifications = user.notifications.filter(
      (notification) => notification?._id?.toString() !== notificationId?.toString()
    );
    await user.save();
    return user;
  } catch (error) {
    console.log(error);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Something went wrong');
  }
};

/**
 * Update user by id
 * @param {mongoose.Types.ObjectId} userId
 * @param {mongoose.Types.ObjectId} apartmentComplexId
 * @returns {Promise<IUserDoc | null>}
 */
export const updateApartmentComplexIdToUser = async (
  userId: mongoose.Types.ObjectId,
  apartmentComplexId: mongoose.Types.ObjectId
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.apartmentComplexes.push(apartmentComplexId);
  await user.save();
  return user;
};

/**
 * Update tow company with user id
 * @param {mongoose.Types.ObjectId} userId
 * @param {mongoose.Types.ObjectId} towCompanyId
 * @returns {Promise<IUserDoc | null>}
 */
export const updateTowCompanyWithUserId = async (
  towCompanyId: mongoose.Types.ObjectId,
  newId: mongoose.Types.ObjectId,
  userType: IUserType
): Promise<IUserDoc | null> => {
  const user = await getUserById(towCompanyId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.towCompany) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is not associated with a tow company');
  }

  if (userType === 'tow-company-employee') {
    if (!user.towCompany.employees) {
      user.towCompany.employees = [];
    }

    if (!user.towCompany.employees.includes(towCompanyId)) {
      user.towCompany.employees.push(newId);
    }
  }

  if (userType === 'tow-company-manager') {
    if (!user.towCompany.managers) {
      user.towCompany.managers = [];
    }

    if (!user.towCompany.managers.includes(towCompanyId)) {
      user.towCompany.managers.push(newId);
    }
  }

  await user.save();
  return user;
};

export const staticUserBody = (userBody: Partial<IUser>) => {
  return {
    email: userBody.email,
    phoneNumber: userBody?.phoneNumber,
    firstName: userBody?.firstName as string,
    lastName: userBody?.lastName,
    isVerified: userBody.isVerified ? true : config.serverType === Constants.demoServer ? true : false,
    isDefaultPassword: true,
    accountApproval: {
      isApproved: true,
    },
    password: Array.from({ length: 8 }, (_, index) => {
      if (index === 0) {
        const charCode = Math.floor(Math.random() * 26) + 65; // Uppercase letter
        return String.fromCharCode(charCode);
      }
      if (index === 1) {
        return Math.floor(Math.random() * 10).toString(); // Digit
      }
      const charCode = Math.floor(Math.random() * 26) + 97; // Lowercase letter
      return String.fromCharCode(charCode);
    }).join(''),
    country: 'USA',
    isArchived: false,
    isSuspended: false,
    preferredLanguage: 'en',
  };
};

export const bulkUpdateUserStatus = async (
  userIds: string[],
  updatePayload: Pick<IUser, 'isSuspended' | 'isArchived' | 'archiveReason' | 'suspendReason'>,
  loggedInUser: IUserDoc,
  ownerId: mongoose.Types.ObjectId
) => {
  let conditions = {};

  if (updatePayload.isSuspended === true) {
    conditions = {
      // statusReason: { $ne: !previousStatus },
      isSuspended: false,
    };
  }

  if (updatePayload.isArchived === true) {
    conditions = {
      isArchived: false,
    };
  }

  if (updatePayload.isSuspended === false) {
    updatePayload.suspendReason = '';
    conditions = {
      suspendReason: { $ne: '' },
      isSuspended: true,
    };
  }

  if (updatePayload.isArchived === false) {
    updatePayload.archiveReason = '';
    conditions = {
      archiveReason: { $ne: '' },
      isArchived: true,
    };
  }
  const users = await User.updateMany(
    {
      _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
      ...conditions,
    },
    { $set: updatePayload },
    { new: true }
  );

  await logService.createLog({
    user: loggedInUser,
    userType: loggedInUser.userType,
    eventEnum: 'UME',
    ownerId,
    event: ALL_EVENTS.UserManagementEvents.bulkUpdateUserStatus({
      userIds,
      updatePayload,
    }),
  });

  return users;
};

export const getEmployeesByIds = async (ids: string[]) => {
  return await User.find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } });
};

export const myTowCompanyEmployees = async (id: mongoose.Types.ObjectId, skipPopulate?: boolean) => {
  const data = await User.aggregate([
    {
      $match: {
        id,
      },
    },
    ...(skipPopulate
      ? []
      : [
          {
            $lookup: {
              from: 'users',
              localField: 'towCompany.employees',
              foreignField: '_id',
              as: 'employees',
            },
          },
          {
            $project: {
              'employees.password': 0,
            },
          },
        ]),
  ]);
  return data;
};

export const updateTowAccounts = async () => {
  const allTowCompanies = await User.find().exec();
  await Promise.all(
    allTowCompanies.map(async (user) => {
      const towCompanyId = user.id || user._id;
      const allEMployeesAndManagers = (user?.towCompany?.employees || []).concat(user?.towCompany?.managers || []);
      await User.updateMany(
        {
          _id: { $in: allEMployeesAndManagers },
        },
        {
          towCompanyId,
        }
      );
    })
  );
};

export const employeesAndManagersFilterHelper = async (loggedInUser: IUserDoc, userType: IUserType) => {
  let orFilterAdvance: any = [];
  if (loggedInUser.userType === 'apartment-complex-owner') {
    // filter.userId = loggedInUser.id;
    const apartmentComplexUsers = await apartmentComplexService.getMyApartmentComplexes(
      new mongoose.Types.ObjectId(loggedInUser.id),
      { skipPopulate: true }
    );
    const ids = apartmentComplexUsers
      ?.map((apartment) =>
        userType === 'apartment-complex-employee' ? [...(apartment.employees || [])] : [...(apartment.managers || [])]
      )
      .flat();
    // if (flow === 'log') {
    orFilterAdvance.push({
      _id: {
        $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id)), new mongoose.Types.ObjectId(loggedInUser.id)],
      },
    });
    // orFilterAdvance.push({ userId: new mongoose.Types.ObjectId(loggedInUser.id) });

    // affectedUser = JSON.stringify(ids);
  }

  if (loggedInUser.userType === 'tow-company-owner') {
    const ids =
      userType === 'tow-company-employee'
        ? [...(loggedInUser?.towCompany?.employees || [])]
        : [...(loggedInUser?.towCompany?.managers || [])];
    orFilterAdvance.push({
      _id: {
        $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id)), new mongoose.Types.ObjectId(loggedInUser.id)],
      },
    });
  }

  return orFilterAdvance;
};

export const promoteDemoteUseryManagerHelper = async (loggedInUser: IUserDoc, user: IUserDoc, comments?: any) => {
  try {
    let owner;
    if (loggedInUser.userType === 'apartment-complex-manager') {
      const apartmentComplex = await apartmentComplexService.findApartmentComplexById(
        new mongoose.Types.ObjectId(loggedInUser.apartmentComplex)
      );
      owner = await User.findById(apartmentComplex?.user);
      if (!apartmentComplex?.managers?.includes(user?.id) && !apartmentComplex?.employees?.includes(user?.id)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to promte or demote other users');
      }
    }
    if (loggedInUser.userType === 'tow-company-manager') {
      const towCompany = loggedInUser.towCompany;
      owner = await User.findById(loggedInUser.towCompany);
      if (!towCompany?.managers?.includes(user?.id) && !towCompany?.employees?.includes(user?.id)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to promte or demote other users');
      }
    }

    const promteDemoteToken = await tokenService.generatePromteDemoteToken(user.email!, 60 * 24 * 7, {
      requestCreatedBy: loggedInUser.id,
    }); // valid for 7 days

    const content = await promoteDemoteUserRequest(owner?.email!, promteDemoteToken, owner?.fullName!, user, {
      comments,
      toUpdateUser: user,
      requestCreatedBy: loggedInUser,
    });

    const isPromoted = user?.userType.includes('employee');
    const notification = {
      status: 'success' as any,
      html: content,
      text: isPromoted ? 'Promotion request' : 'Demotion request',
    };

    owner?.notifications?.push(notification);
    await owner?.save();
    await logService.createLog({
      user: loggedInUser,
      affectedUser: owner?.id || owner?._id,
      ownerId: owner?.id || owner?._id,
      event: ALL_EVENTS.UserManagementEvents.requestPromoteDemote(
        loggedInUser,
        user,
        user?.userType.includes('manager') ? 'Demote' : 'Promote'
      ),
      eventEnum: 'UME',
    });
    if (user?.password) delete (user as any)?.password;
    return {
      user,
    };
  } catch (e) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error promoting or demoting user' + e);
  }
};

export const acceptRejectPromoteDemoteUser = async ({
  status,
  token,
  loggedInUser,
}: {
  status: string;
  token: string;
  loggedInUser: IUserDoc;
}) => {
  // try {
  let response: any = {};
  if (typeof token !== 'string' || (token !== 'reject' && token !== 'accept')) {
    if (loggedInUser.userType !== 'admin' && !loggedInUser.userType.includes('owner')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to promote or demote user');
    }
    const promoteDemoteTokenDoc = await verifyToken(token, tokenTypes.PROMTE_DEMOTE_USER);
    const toUpdateUser = await getUserById(new mongoose.Types.ObjectId(promoteDemoteTokenDoc.user));
    const promoterId = await (promoteDemoteTokenDoc.additionalInfo as any)?.requestCreatedBy;
    const promoter = await getUserById(new mongoose.Types.ObjectId(promoterId));
    if (!promoter) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Invalid token or user not found');
    }
    if (!toUpdateUser?.id) {
      throw new ApiError(httpStatus.NOT_FOUND, 'The user you are trying to update does not exist.');
    }

    if (!toUpdateUser?.userType.includes('employee') && !toUpdateUser?.userType.includes('manager')) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Only Managers and Employees can be promoted or demoted');
    }

    const ownerId = await getOwnerIdByUserId(toUpdateUser.id || toUpdateUser._id);
    const promoteDemoteStatus = toUpdateUser.userType.includes('employee') ? 'Promote' : 'Demote';
    if (status == 'reject') {
      await logService.createLog({
        ownerId,
        user: loggedInUser,
        affectedUser: toUpdateUser.id,
        event: ALL_EVENTS.UserManagementEvents.rejectRejectedPromoteDemote(
          loggedInUser,
          toUpdateUser,
          promoteDemoteStatus,
          promoter,
          false
        ),
        eventEnum: 'UME',
      });
      response = {
        decision: 'rejected',
        status: 200,
        message: `The request has been rejected. The user remain at the current position`,
      };
    } else if (status == 'accept') {
      await promoteDemoteUser(new mongoose.Types.ObjectId(toUpdateUser.id));

      await logService.createLog({
        user: loggedInUser,
        ownerId,

        affectedUser: toUpdateUser.id,
        event: ALL_EVENTS.UserManagementEvents.rejectRejectedPromoteDemote(
          loggedInUser,
          toUpdateUser,
          promoteDemoteStatus,
          promoter,
          true
        ),
        eventEnum: 'UME',
      });

      response = {
        status: 200,
        decision: 'accepted',
        message: `The request has been accepted. The user is ${promoteDemoteStatus} successfully.`,
      };
    }

    const html = await acceptRejectPromoteDemoteEmail(
      promoter?.email!,
      promoter.fullName!,
      promoter,
      {
        toUpdateUser: toUpdateUser,
        requestCreatedBy: promoter,
      },
      response.decision
    );

    const notification = {
      status: 'success' as any, // 'error' should ideally be a more specific type if possible
      html,
      text: promoteDemoteStatus + ' request has been ' + response.decision,
    };

    promoter.notifications.push(notification);
    promoter.save();
  }

  await tokenService.inValidateEmailSetToken(token);

  return response;
  // } catch (error) {
  // console.log(error, 'error is here');
  // throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  // }
};

const handleOtherEmails = async (user: IUserDoc) => {
  try {
    //owners should be sent to admins only
    let emails: any = [];

    const admins = await User.find({ userType: 'admin' });
    if (user?.userType.includes('owner') || user.userType === 'renter') {
      emails = admins?.map((admin) => ({ email: admin.email!, name: admin.fullName! }));
    }

    // if aparment complex manager
    if (user?.userType === 'apartment-complex-manager') {
      const recepient = await apartmentComplexService.getApartmentRoleEmails(user?.apartmentComplex!, { user: true });
      emails = [recepient?.[0]?.user!];
    }
    //handle apartment complex employee
    if (user?.userType === 'apartment-complex-employee') {
      const recepient = await apartmentComplexService.getApartmentRoleEmails(user?.apartmentComplex!, {
        user: true,
        managers: true,
      });

      emails = [recepient?.[0]?.user!, ...(recepient?.[0]?.managerEmails ?? [])!];
    }

    // if tow company manager
    if (user?.userType === 'tow-company-manager') {
      const recepient = await getTowCompanyRoleEmails(user?.towCompanyId!, {});
      emails = [recepient?.[0]?.user!];
    }
    //handle apartment complex employee
    if (user?.userType === 'tow-company-employee') {
      const recepient = await getTowCompanyRoleEmails(user?.towCompanyId!, { managers: true });
      console.dir(recepient?.[0]?.managerEmails ?? [], { depth: null });
      emails = [recepient?.[0]?.user!, ...(recepient?.[0]?.managerEmails ?? [])!];
    }
    if (user?.userType === 'renter') {
      // const recepient = await apartmentComplexService.getApartmentRoleEmails(user?.apartmentComplex!, {
      //   user: true,
      //   managers: true,
      //   employees: true,
      // });
      // emails = [
      //   recepient?.[0]?.user!,
      //   ...(recepient?.[0]?.managerEmails ?? [])!,
      //   ...(recepient?.[0]?.employeeEmails ?? [])!,
      // ];
    }
    admins.forEach(async (admin: any) => {
      const mlEmail = notifyOwnerManagerOfBlockedUser(admin.fullName!, user);
      const html: any = await emailTemplate({
        title: mlEmail.subject,
        content: mlEmail.body,
      });
      const notification = {
        status: 'success' as any, // 'error' should ideally be a more specific
        text: mlEmail.subject,
        html,
      };
      admin.notifications.push(notification);
      await admin.save();
    });

    emails.map((email: any) => {
      sendNotificationToOwnerManagerOfBlockedUser(email.name, user, email.email);
    });
  } catch (error) {
    console.log(error, 'error while sending email on brute force blocking');
  }
};

export const getTowCompanyRoleEmails = async (
  towCompanyId: string,
  options: any = { managers: false, employees: false }
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
        _id: new mongoose.Types.ObjectId(towCompanyId),
      },
    },
  ];

  if (options.managers) {
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'towCompany.managers',
        foreignField: '_id',
        as: 'managers',
      },
    });
  }

  if (options.employees) {
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'towCompany.employees',
        foreignField: '_id',
        as: 'employees',
      },
    });
  }

  const projectStage: any = { _id: 0 };

  projectStage.user = {
    email: '$email',
    name: '$fullName',
  };

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

  const result = await User.aggregate(pipeline);
  return result;
};

export const getOwnerIdByUserId = async (userId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId | null> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.userType.includes('owner') || user.userType === 'renter') {
    return user._id || user.id; // Admin is the owner of their own account
  }

  if (user.userType === 'apartment-complex-manager' || user.userType === 'apartment-complex-employee') {
    const apartmentComplex = await ApartmentComplex.findById(user.apartmentComplex);
    return apartmentComplex?.user as mongoose.Types.ObjectId;
  } else if (user.userType === 'tow-company-manager' || user.userType === 'tow-company-employee') {
    const towCompany = await User.findById(user.towCompanyId);
    return towCompany?._id;
  }
  return null;
};

export const getRenterOwnerIdByUserId = async (
  apartmentComplexId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId | null> => {
  const apartmentComplex = await ApartmentComplex.findById(apartmentComplexId);
  return apartmentComplex?.user as mongoose.Types.ObjectId;
};
export const createOccupant = async (
  ownerId: mongoose.Types.ObjectId,
  occupant: IOccupant,
  options?: { isExisting: boolean; occupantId: mongoose.Types.ObjectId }
): Promise<IUserDoc> => {
  const renter = await User.findById(ownerId);
  const thisRenterOccupantsForThisApartment =
    renter?.occupants.filter((occ) => occ?.apartmentId?.toString() === occupant?.apartmentId?.toString()) ?? [];
  const apartmentComplex = await ApartmentComplex.findById(new mongoose.Types.ObjectId(occupant.apartmentComplex));
  if (!apartmentComplex) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Apartment Complex not found');
  }
  let thisApartment: any;
  if (apartmentComplex) {
    thisApartment = apartmentComplex?.apartments?.find(
      (apartment) => apartment._id?.toString() === occupant.apartmentId?.toString()
    );
    if (!thisApartment._id) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Apartment number not found');
    }

    if (thisRenterOccupantsForThisApartment?.length >= (thisApartment?.maxOccupantsAllowed || 0)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Apartment is full');
    }
  }
  if (!renter) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Renter not found');
  }
  if (!options?.isExisting) {
    renter.occupants.push(occupant);

    await renter.save();
  } else {
    occupant = renter.occupants.find((occ) => options?.occupantId?.toString() === occ?._id?.toString()) as IOccupant;
  }

  emailService.sendOccupantCreateAndDeleteEmails(
    {
      apartmentComplexName: apartmentComplex?.apartmentComplexName!,
      apartmentNumber: thisApartment.apartmentNumber,
      reason: options?.isExisting ? 'occupant-attached' : 'occupant-added',
    },
    renter,
    pick(occupant, 'lastName', 'firstName', 'email', 'phoneNumber') as any
  );
  return renter;
};

export const updateOccupant = async (
  ownerId: mongoose.Types.ObjectId,
  occupantId: mongoose.Types.ObjectId,
  update: IOccupant
): Promise<IUserDoc> => {
  const renter = await User.findById(ownerId);
  if (!renter) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Renter not found');
  }

  const index = renter.occupants.findIndex((o) => o?._id?.toString() === occupantId?.toString());
  if (index === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Occupant not found');
  }

  if (renter.occupants?.[index]) {
    Object.entries(update).forEach(([key, value]) => {
      if (value !== undefined) {
        (renter.occupants[index] as any)[key] = value;
      }
    });
  }
  return await renter.save();
};

export const attachOccupantToApartment = async (
  ownerId: mongoose.Types.ObjectId,
  occupantId: mongoose.Types.ObjectId,
  update: IOccupant
): Promise<IUserDoc> => {
  await createOccupant(ownerId, update, { isExisting: true, occupantId });
  const renter = await updateOccupant(ownerId, occupantId, update);
  return renter;
};

export const attachRenterToApartment = async ({
  renterId,
  apartmentComplex,
  apartmentId,
}: {
  renterId: mongoose.Types.ObjectId;
  apartmentComplex: mongoose.Types.ObjectId;
  apartmentId: mongoose.Types.ObjectId;
}) => {
  const renter = await User.findById(renterId);
  renter?.apartment?.push({ apartmentComplex, apartmentId } as any);
  return renter?.save();
};

export const deleteOccupant = async (
  ownerId: mongoose.Types.ObjectId,
  occupantId: mongoose.Types.ObjectId,
  type: 'permanent' | 'detached'
): Promise<{ updatedRenter: IUserDoc; impactedOccupant: IOccupant }> => {
  const renter = await User.findById(ownerId);
  if (!renter) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Renter not found');
  }

  let impactedOccupant: any;

  const index = renter.occupants.findIndex((o) => o?._id?.toString() === occupantId?.toString());
  if (index === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Occupant not found');
  }

  impactedOccupant = renter.occupants[index];
  if (type === 'permanent') {
    renter.occupants.splice(index, 1);
  } else {
    // if (renter?.occupants?.[index]?.apartmentComplex) {
    //   renter!.occupants![index]!.apartmentComplex = null;
    // }
    if (renter?.occupants?.[index]?.apartmentId) {
      renter!.occupants![index]!.apartmentId = null;
    }
  }

  sendOccupantCreateAndDeleteEmails(
    {
      apartmentComplexName: impactedOccupant.apartmentComplex,
      apartmentNumber: impactedOccupant.apartmentId,
      reason: type === 'permanent' ? 'occupant-removed' : 'occupant-detached',
    },
    renter,
    pick(renter.occupants[index], 'firstName', 'lastName', 'email', 'phoneNumber') as any
  );

  const updatedRenter = await renter.save();
  return {
    updatedRenter,
    impactedOccupant,
  };
};

export const updateSuperAdmin = async ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (user.isSuperAdmin !== isSuperAdmin) {
      user.isSuperAdmin = isSuperAdmin;
      await user.save();

      const superAdminEmails = (await User.find({ isSuperAdmin: true, _id: { $ne: user._id } }, { email: 1, _id: 0 })).map(
        (u) => u.email
      );
      emailService.notifyAllSuperadminsOfNewSuperAdmin(superAdminEmails as any, user);
      emailService.sendSuperadminRoleNotification(user.email!, user.fullName!, user);
    }

    return user;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  }
};

export const getAllAdmins = (loggedInUser?: IUserDoc) => {
  return User.find({
    userType: 'admin',
    ...(loggedInUser?._id ? { _id: { $ne: new mongoose.Types.ObjectId(loggedInUser._id) } } : {}),
  });
};

export const consolodatedSearchHelper = async (loggedInUser: IUserDoc, filter: any, search: any) => {
  let orFilterAdvance: any = [];

  if (loggedInUser.userType === 'admin' && search?.search) {
    let allOwnerIds = [];
    let allCompaniesManagersAndEmployees: any = [];
    if (filter.userType.includes('owner')) {
      allCompaniesManagersAndEmployees = await queryUsers(
        {
          userType: {
            $in:
              filter?.userType === 'apartment-complex-owner'
                ? ['apartment-complex-manager', 'apartment-complex-employee']
                : ['tow-company-manager', 'tow-company-employee'],
          },
        },
        {
          ...{
            limit: 100000,
            page: 1,
          },
          ...(search?.search
            ? {
                search: `${decodeURIComponent(
                  search?.search
                )}#firstName,lastName,phoneNumber,email,fullName,towCompany.companyName,company.companyName`,
              }
            : {}),
          timeImplementation: 'currentLogin',
        },
        undefined,
        true
      );
      if (filter?.userType === 'apartment-complex-owner') {
        const apartmentComplexIDsByUser = allCompaniesManagersAndEmployees?.results?.map(
          (user: any) => user.apartmentComplex
        );

        const searchedComplexes = await apartmentComplexService.justPaginateApartmentComplexes(
          {},
          {
            ...{ limit: 100000, page: 1 },
            ...(search?.search && {
              search: `${decodeURIComponent(
                search.search
              )}#apartmentComplexName,licensePlates.stateShort,licensePlates.plate,apartments.licensePlates.stateShort,apartments.licensePlates.plate,apartments.apartmentNumber`,
            }),
          }
        );

        const complexesByIds = await apartmentComplexService.getApartmentComplexesByIds(apartmentComplexIDsByUser);
        allOwnerIds = uniq([
          ...(searchedComplexes?.results?.map((complex) => complex?.toObject()?.user?.toString()) ?? []),
          ...complexesByIds?.map((complex) => complex.user?.toString()),
        ]);
      } else {
        allOwnerIds = uniq(allCompaniesManagersAndEmployees?.results?.map((user: any) => user.towCompanyId));
      }

      // orFilterAdvance.push({
      //   _id: {
      //     //To be decided whether to show logs of owner being carried out by the admin or not
      //     // $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id))],
      //     $in: [...allOwnerIds?.map((id) => new mongoose.Types.ObjectId(id))],
      //   },
      // });

      orFilterAdvance = allOwnerIds?.map((id) => id?.toString());
    }
  }

  return orFilterAdvance;
};

export const getTowManagersByTowCompanyId = async (towCompanyId: string) => {
  return await User.find({
    $or: [
      { towCompanyId: towCompanyId, userType: 'tow-company-manager' },
      { _id: towCompanyId, userType: 'tow-company-owner' },
    ],
  });
};

export const getPSPManagerByPSPId = async (pspCompanyId: string) => {
  return await User.find({
    $or: [
      { pspCompanyId: pspCompanyId, userType: 'parking-spaces-provider-manager' },
      { _id: pspCompanyId, userType: 'parking-spaces-provider-owner' },
    ],
  });
};

export const getMyTowCompanyParkingSpacesProviders = async (towCompanyId: string) => {
  return await User.find({
    towCompanyId: new mongoose.Types.ObjectId(towCompanyId),
    userType: 'parking-spaces-provider-owner',
  });
};

/**
 * Get apartment complexes
 * @param {ObjectId} [userId]
 * @returns {Promise<IApartmentComplexDoc[]>}
 */
export const listTowCompanies = async (): Promise<Partial<IUserDoc>[]> => {
  try {
    const data = await User.find({ userType: 'tow-company-owner' });

    return data.map((user) => {
      return pick(user, 'id', 'email', 'fullName', 'phoneNumber', 'towCompany', 'userType', 'isArchived', 'isSuspended');
    });
  } catch (error) {
    console.error('Error fetching apartment complexes:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error fetching apartment complexes');
  }
};

export const syncLocation = async (userId: string, manualPosition: any) => {
  return await User.findByIdAndUpdate(new mongoose.Types.ObjectId(userId), { manualPosition });
};

/**
 * Search users by name, email, or phone number.
 * Strips sensitive fields from the response.
 */
export const searchUsers = async ({ searchTerm, userType, towCompanyId }: SearchUsersOptions) => {
  function escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // For tow-requester, we want to search across all tow companies (no towCompanyId filter)
  // For PSP users, filter by towCompanyId
  const filter: any = {
    isDeleted: { $ne: true },
    userType,
    $or: [
      { firstName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { lastName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { fullName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { email: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { phoneNumber: { $regex: escapeRegex(searchTerm), $options: 'i' } },
      { 'company.companyName': { $regex: escapeRegex(searchTerm), $options: 'i' } },
    ],
  };
  
  // Handle towCompanyId filter based on user types
  if (userType && typeof userType === 'object' && userType.$in) {
    const hasTowRequester = userType.$in.includes('tow-requester');
    const hasPSP = userType.$in.some((type: string) => type.includes('parking-spaces-provider'));
    
    if (hasTowRequester && hasPSP) {
      // Both types: PSP filtered by towCompanyId, tow-requester visible to all
      filter.$and = [
        { userType },
        {
          $or: [
            { userType: { $in: userType.$in.filter((t: string) => t.includes('parking-spaces-provider')) }, towCompanyId },
            { userType: 'tow-requester' },
          ],
        },
      ];
      delete filter.towCompanyId;
    } else if (hasPSP && !hasTowRequester) {
      // Only PSP users - filter by towCompanyId
      filter.towCompanyId = towCompanyId;
    }
    // If only tow-requester, don't add towCompanyId filter (all companies see them)
  } else if (towCompanyId && (!userType || (typeof userType === 'string' && userType !== 'tow-requester'))) {
    // Single userType that's not tow-requester - filter by towCompanyId
    filter.towCompanyId = towCompanyId;
  }

  const projection = {
    password: 0,
    loggedInDevices: 0,
    deviceToken: 0,
    deviceType: 0,
    socketId: 0,
    webToken: 0,
    suspendReason: 0,
    archiveReason: 0,
    emailVerificationReminders: 0,
    notifications: 0,
  };

  const myUsers = await User.find(filter, projection).sort({ createdAt: -1 }).populate('pspCompanyId');
  // const otherUsers = searchTerm
  //   ? await User.find({ ...omit(filter, 'towCompanyId'), towCompanyId: { $ne: towCompanyId } }, projection).sort({
  //       createdAt: -1,
  //     })
  //   : [];
  return { myUsers };
};

export const getTowCompanyNameById = async (userId: string) => {
  const projection = {
    'towCompany.name': 1,
  };

  const result = await User.findById(userId, projection);
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result.towCompany?.companyName;
};

export const approveParkingSpacesProviderEmployee = async (userId: string) => {
  await User.findByIdAndUpdate(userId, { accountApproval: { isApproved: true } });
};

export const updateAllManagersAndEmployeesOfPSPToNewTowCompany = async (
  pspCompanyId: mongoose.Types.ObjectId,
  towCompanyId: mongoose.Types.ObjectId
) => {
  await User.findByIdAndUpdate(pspCompanyId, { towCompanyId });
  await User.updateMany({ pspCompanyId }, { towCompanyId });
};

export const postTransferPSPAccount = async (user: IUserDoc, referer: IUserDoc) => {
  user.towCompanyId === referer?.towCompanyId;
  await updateAllManagersAndEmployeesOfPSPToNewTowCompany(user._id || user.id, referer?.towCompanyId);

  const oldCompanyManagers = await getTowManagersByTowCompanyId(user.towCompanyId);
  const newCompanyManagers = await getTowManagersByTowCompanyId(referer?.towCompanyId);

  // Notify all parties
  await emailService.successfulTransferEmails.notifyOldCompanyOnCrossCompanyTransfer(oldCompanyManagers, user, referer!);
  await emailService.successfulTransferEmails.notifyNewCompanyOnCrossCompanyTransfer(referer!, newCompanyManagers, user);
  await emailService.successfulTransferEmails.notifyTargetUserOnCrossCompanyTransfer(user, oldCompanyManagers[0]!, referer!);
};


export const postDiscardTransferPSPAccount = async (user: IUserDoc, referer: IUserDoc) => {

  const oldCompanyManagers = await getTowManagersByTowCompanyId(user.towCompanyId);
  const newCompanyManagers = await getTowManagersByTowCompanyId(referer?.towCompanyId);

  // Notify all parties
  await emailService.discardTransferEmails.notifyOldCompanyOnCrossCompanyTransfer(oldCompanyManagers, user, referer!);
  await emailService.discardTransferEmails.notifyNewCompanyOnCrossCompanyTransfer(referer!, newCompanyManagers, user);
  await emailService.discardTransferEmails.notifyTargetUserOnCrossCompanyTransfer(user, oldCompanyManagers[0]!, referer!);
};

/**
 * Get all users under a specific owner's company
 */
export const getUsersByOwnerId = async (ownerId: mongoose.Types.ObjectId): Promise<IUserDoc[]> => {
  const users = await User.find({
    $or: [
      { _id: ownerId }, // Include the owner themselves
      { apartmentComplexId: ownerId }, // Apartment complex users
      { towCompanyId: ownerId }, // Tow company users
      { pspCompanyId: ownerId }, // Parking spaces provider users
    ],
  }).lean();
  
  return users as IUserDoc[];
};
