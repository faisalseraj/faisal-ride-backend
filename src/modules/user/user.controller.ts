import * as userService from './user.service';

import { IUserDoc, IUserType } from './user.interfaces';
import { Request, Response } from 'express';
import { createEnhancedLogAuto, createUserManagementLog } from '../logs/enhanced-log-migration.service';

import { ALL_EVENTS } from '../utils/events';
import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
import { IOptions } from '../paginate/paginate';
import { Message } from '../utils/errorMessage';
import QRCode from 'qrcode';
import { apartmentComplexService } from '../apartmentComplex';
import { authService } from '../auth';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import httpStatus from 'http-status';
import { localesFullForm } from '../auth/auth.helper';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { otpService } from '../otp';
import pick from '../utils/pick';
import { postSuccessLogin } from '../auth/auth.service';
import { tokenService } from '../token';
import { towRequestService } from '../tow-request';

// import { uploadService } from '../upload';

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  // const loggedInUser = req.user as unknown as IUserDoc;
  // const country = await Country.findOne({ countryName: req.body.country });
  const userHelper = await userService.createUserHelper(user);

  res.status(httpStatus.CREATED).send(userHelper);
});

/**
 * @api {post} /users Create Apartment Complex Manager
 * @apiName CreateApartmentComplexManager
 * @apiGroup User
 * @apiPermission admin
 *
 * @apiParam {String} email Email of the user
 * @apiParam {String} phoneNumber Phone number of the user
 * @apiParam {String} firstName First name of the user
 * @apiParam {String} lastName Last name of the user
 * @apiParam {String} companyName Company name of the apartment complex manager
 *
 * @apiSuccess {Object} user User object
 *
 * @apiError (Bad Request 400)  Validation Error
 * @apiError (Unauthorized 401)  Unauthorized
 * @apiError (Forbidden 403)    Forbidden
 */
export const createUserWithType = catchAsync(async (req: Request, res: Response) => {
  const userType = req.body.userType;
  const loggedInUserType = req.user.userType;
  if (loggedInUserType === 'apartment-complex-employee' && userType !== 'renter') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to create users');
  }

  if (userType === 'renter' && (!req.body.apartmentComplex || !req.body.apartmentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Renters are always attached to an aapartment');
  }

  if (userType === 'apartment-complex-owner' && loggedInUserType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admin can create apartment complex manager');
  }

  if (userType === 'tow-company-owner' && loggedInUserType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admin can create two company manager');
  }

  if (userType === 'parking-spaces-provider-owner' && loggedInUserType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admin can create parking space providers');
  }

  if (
    userType === 'apartment-complex-employee' &&
    loggedInUserType !== 'admin' &&
    loggedInUserType !== 'apartment-complex-manager' &&
    loggedInUserType !== 'apartment-complex-owner'
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only admin and apartment complex Owner and manager can create apartment complex employee'
    );
  }

  if (
    userType === 'tow-company-employee' &&
    loggedInUserType !== 'admin' &&
    loggedInUserType !== 'tow-company-owner' &&
    loggedInUserType !== 'tow-company-manager'
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admin and Tow company owner and manager can create tow company employee');
  }
  try {
    const company = await userService.createUserWithType(req.body, req.user);

    res.status(httpStatus.CREATED).send({ company });
  } catch (e) {
    console.log(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + e);
  }
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'userType', 'isVerified', 'isSuspended', 'isArchived', 'towCompanyId']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  const loggedInUser = req.user as IUserDoc;
  // let user = '';

  if (
    loggedInUser.userType.includes('parking-spaces-provider') &&
    loggedInUser.id.toString() !== filter['towCompanyId'] &&
    loggedInUser.towCompanyId.toString() !== filter['towCompanyId']
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to get other company users');
  }

  if (filter.userType.includes('tow-company')) {
    delete filter['towCompanyId'];
  }
  let orFilterAdvance: any = [];
  if (loggedInUser.userType === 'admin') {
    orFilterAdvance = await userService.consolodatedSearchHelper(loggedInUser, filter, search);
  }
  //enhancement on july 28 2025

  // Handle 'ALL' userType for admin users
  if (filter.userType === 'ALL') {
    if (loggedInUser.userType !== 'admin') {
      // throw new ApiError(httpStatus.FORBIDDEN, 'Only admin users can query all user types');
    }
    // Remove userType filter to get all users
    delete filter.userType;
  }

  // Only allow admin users to query other admin users
  if (filter.userType === 'admin' && loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to get admin users');
  }
  if (loggedInUser.userType === 'tow-company-owner') {
    if (filter.userType !== 'tow-company-owner') {
      filter.towCompanyId = new mongoose.Types.ObjectId(loggedInUser.id);
    } else {
      filter._id = loggedInUser.id;
    }
  }

  if (loggedInUser.userType === 'tow-company-manager') {
    // if (filter.userType === 'tow-company-manager') {
    //   throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to get users');
    // }

    if (filter.userType !== 'tow-company-owner') {
      filter.towCompanyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
    } else {
      filter._id = loggedInUser.towCompanyId;
    }
  }

  if (loggedInUser.userType === 'apartment-complex-owner') {
    const myApartmentComplexes = await apartmentComplexService.getMyApartmentComplexes(
      new mongoose.Types.ObjectId(loggedInUser.id),
      {
        skipPopulate: true,
      }
    );

    if (filter.userType !== 'apartment-complex-owner') {
      filter.apartmentComplex = {
        $in: myApartmentComplexes.map((apartmentComplex: any) => apartmentComplex._id),
      };
    } else {
      filter._id = loggedInUser.id;
    }
  }

  if (loggedInUser.userType === 'apartment-complex-manager') {
    // if (filter.userType === 'apartment-complex-manager') {
    //   throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to get users');
    // }
    filter.apartmentComplex = new mongoose.Types.ObjectId(loggedInUser.apartmentComplex);
  }

  if (loggedInUser.userType === 'apartment-complex-employee') {
    filter.apartmentComplex = new mongoose.Types.ObjectId(loggedInUser.apartmentComplex);
  }

  if (loggedInUser.userType === 'parking-spaces-provider-owner') {
    if (filter.userType !== 'parking-spaces-provider-owner') {
      filter.towCompanyId = new mongoose.Types.ObjectId(loggedInUser.id);
    } else {
      filter._id = loggedInUser.id;
    }
  }

  if (loggedInUser.userType === 'parking-spaces-provider-manager') {
    if (filter.userType !== 'parking-spaces-provider-owner') {
      filter.towCompanyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
    } else {
      filter._id = loggedInUser.towCompanyId;
    }
  }

  if (loggedInUser.userType === 'parking-spaces-provider-employee') {
    filter.towCompanyId = new mongoose.Types.ObjectId(loggedInUser.towCompanyId);
  }
  // console.dir(filter, { depth: null });
  // console.log('herex');
  const result = await userService.queryUsers(
    {
      _id: {
        ...(loggedInUser.userType.includes('onwer')
          ? {}
          : {
              $ne: new mongoose.Types.ObjectId(loggedInUser.id),
            }),

        ...(orFilterAdvance?.length > 0 ? { $in: orFilterAdvance?.map((id: any) => new mongoose.Types.ObjectId(id)) } : {}),
      },
      ...filter,
    },
    {
      ...options,
      // orFilterAdvance,

      ...(search?.search && orFilterAdvance?.length === 0
        ? {
            search: `${decodeURIComponent(
              search?.search
            )}#firstName,lastName,phoneNumber,email,userType,fullName,towCompany.companyName,company.companyName`,
          }
        : {}),
      timeImplementation: 'currentLogin',
    },
    loggedInUser.userType
  );

  // const loggedInUser = req.user as unknown as IUserDoc;
  // await logService.createLog({ user: loggedInUser, event: ALL_EVENTS.getAllUsers });
  res.send(result);
});

export const getApartmentComplexUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'userType', 'from', 'to', 'isVerified']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  const result = await userService.queryUsers(
    { ...filter, userType: 'apartment-complex-owner' },
    {
      ...options,
      ...(search?.search
        ? {
            search: `${decodeURIComponent(
              search?.search
            )}#firstName,lastName,phoneNumber,email,business.email,userType,fullName,business.name,business.sitedId`,
          }
        : {}),
      timeImplementation: 'currentLogin',
    }
  );

  // const loggedInUser = req.user as unknown as IUserDoc;
  // await logService.createLog({ user: loggedInUser, event: ALL_EVENTS.getAllUsers });
  res.send(result);
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['country']);
  if (!req.params['userType']) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User type is required');
  }
  const result = await userService.listAllUsers(
    req.params['userType'] as IUserType,
    filter?.country ? filter?.country : undefined
  );
  res.send(result);
});

export const listUsersByUserType = catchAsync(async (req: Request, res: Response) => {
  if (!req.query['userType']) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User type is required');
  }
  if ((req.query['userType'] as IUserType & 'regionalManagerAndAdmin') === 'regionalManagerAndAdmin') {
    const admins = await userService.listAllUsers('admin');
    res.send([...admins]);
  } else {
    const result = await userService.listAllUsers(req.query['userType'] as IUserType);
    res.send(result);
  }
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    const user = await userService.getUserByIdByUserType(new mongoose.Types.ObjectId(req.params['userId']), req.user);
    console.log(user, 'user is herexx');
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    res.send(user);
  }
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  try {
    if (typeof req.params['userId'] === 'string') {
      const loggedInUser = req.user as unknown as IUserDoc;
      const updatePayload = req.body;
      const toUpdateUser = await userService.getUserById(new mongoose.Types.ObjectId(req.params['userId']));
      if (loggedInUser.userType === 'apartment-complex-employee' && toUpdateUser?.userType !== 'renter') {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to create users');
      }
      if (!toUpdateUser?.id) {
        throw new ApiError(httpStatus.NOT_FOUND, 'The user you are trying to update does not exist.');
      }

      if (loggedInUser.userType === toUpdateUser.userType) {
        delete updatePayload.email;
        delete updatePayload.companyName;
      }

      await rulesHelper(loggedInUser, toUpdateUser);
      // admin cannot update another admin.
      if (loggedInUser.userType === toUpdateUser?.userType && !loggedInUser?.isSuperAdmin) {
        await createUserManagementLog({
          user: loggedInUser,
          event: ALL_EVENTS.attemptToUpdateAdminByAnAdmin(loggedInUser, toUpdateUser),
          affectedUser: req.params['userId'],
          customMetadata: {
            action: 'unauthorized_admin_update_attempt',
            targetUserType: toUpdateUser?.userType,
          },
        });
        throw new ApiError(
          httpStatus.FORBIDDEN,
          'No permission to update another admin. Only superadmin can perform this task.'
        );
      }
      const user = await userService.updateUserById(new mongoose.Types.ObjectId(req.params['userId']), req.body);
      const ownerId = await userService.getOwnerIdByUserId(user!._id || user!.id);

      await createUserManagementLog({
        user: loggedInUser,
        ownerId,
        affectedUser: user?.id,
        event: ALL_EVENTS.UserManagementEvents.accountModification(toUpdateUser, updatePayload),
        customMetadata: {
          action: 'account_modification',
          targetUserType: toUpdateUser?.userType,
          updateFields: Object.keys(updatePayload),
        },
      });

      res.send(user);
    }
  } catch (error) {
    console.log(error, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  }
});

export const promoteDemoteUser = catchAsync(async (req: Request, res: Response) => {
  try {
    if (typeof req.params['userId'] === 'string') {
      const loggedInUser = req.user as unknown as IUserDoc;
      if (loggedInUser.userType.includes('renter') || loggedInUser.userType.includes('employee')) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to promote or demote user');
      }

      const toUpdateUser = await userService.getUserById(new mongoose.Types.ObjectId(req.params['userId']));

      if (!toUpdateUser?.id) {
        throw new ApiError(httpStatus.NOT_FOUND, 'The user you are trying to update does not exist.');
      }

      if (!toUpdateUser?.userType.includes('employee') && !toUpdateUser?.userType.includes('manager')) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Only Managers and Employees can be promoted or demoted');
      }

      if (loggedInUser.userType.includes('manager')) {
        await userService.promoteDemoteUseryManagerHelper(loggedInUser, toUpdateUser, req.body.comments ?? '');

        res.status(httpStatus.OK).send({
          message:
            'Your request has been forwarded to the company owner for approval. Please wait for approval from the tow company owner, and we will notify you once the approval is done.',
        });
      } else {
        await rulesHelper(loggedInUser, toUpdateUser);

        const user = await userService.promoteDemoteUser(new mongoose.Types.ObjectId(req.params['userId']));
        await createUserManagementLog({
          user: loggedInUser,
          affectedUser: user?.id,
          event: ALL_EVENTS.UserManagementEvents.promoteDemote(user as IUserDoc),
          customMetadata: {
            action: 'promote_demote',
            targetUserType: user?.userType,
          },
        });

        res.send(user);
      }
    }
  } catch (error) {
    console.log(error, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ message: 'An error occurred while processing your request.' });
  }
});

export const acceptRejectPromoteDemoteUser = catchAsync(async (req: Request, res: Response) => {
  const status = req.query['status'] as string;
  const token = req.query['token'] as string;
  const loggedInUser = req.user as unknown as IUserDoc;
  const response = await userService.acceptRejectPromoteDemoteUser({ status, token, loggedInUser });

  res.send(response);
});

// export const recoverUser = catchAsync(async (req: Request, res: Response) => {
//   const user = await userService.recoverUserById(new mongoose.Types.ObjectId(req.body['userId']));
//   const ownerId = await userService.getOwnerIdByUserId(user!._id || user!.id);

//   const loggedInUser = req.user as unknown as IUserDoc;
//   await logService.createLog({
//     user: loggedInUser,
//     ownerId,
//     event: ALL_EVENTS.UserManagementEvents.accountRecovered(user!),
//     eventEnum: 'UME',
//   });
//   res.send(user);
// });

export const getFilters = catchAsync(async (_: Request, res: Response) => {
  const filters = await userService.getFilters();

  res.send(filters);
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const updatedUser = await userService.deleteNotification(
    new mongoose.Types.ObjectId(userId),
    new mongoose.Types.ObjectId(req.params['id'])
  );
  res.send(updatedUser);
});

export const suspendUser = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['userId'] === 'string') {
    await userService.deleteUserById(new mongoose.Types.ObjectId(req.params['userId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

// self

// export const updateProfile = catchAsync(async (req: Request, res: Response) => {
//   const { id } = req.user;
//   const isImpersonated = req.headers['x-impersonated'];
//   const impersonatedBy = req.headers['x-impersonated-by'] as string;
//   const { phoneNumber, otp, email } = req.body;
//   const formattedPhoneNumber = phoneNumber ? formatPhoneNumber(phoneNumber) : phoneNumber;
//   if (phoneNumber || email) {
//     if (isImpersonated) {
//       throw new ApiError(
//         httpStatus.BAD_REQUEST,
//         'It is not good to update the phone number or email of the user. User can loss access to this account'
//       );
//     }
//     if (!otp) {
//       throw new ApiError(httpStatus.BAD_REQUEST, 'Please provide otp');
//     }
//     await otpService.verifyOtp(formattedPhoneNumber ?? email, otp, phoneNumber ? 'changePhoneNumber' : 'changeEmail');
//     req.body.isVerified = true;
//   }
//   const user = await userService.updateUserById(new mongoose.Types.ObjectId(id), req.body);
//   const loggedInUser = req.user as unknown as IUserDoc;
//   if (impersonatedBy) {
//     const impersonatedByUser = await userService.getUserById(new mongoose.Types.ObjectId(impersonatedBy));
//     if (impersonatedByUser) {
//       const { fullName } = impersonatedByUser ?? {};
//       await logService.createLog({
//         user: impersonatedByUser,
//         event: ALL_EVENTS.ManagementEvents.updateProfile(
//           `${fullName}`,
//           `${user?.firstName} ${user?.lastName}`,
//           user?.userType!,
//           'Admin'
//         ),
//         affectedUser: id,
//         eventEnum: 'MaE',
//       });
//     }
//   } else {
//     await logService.createLog({
//       user: loggedInUser,
//       onlyAdmin: user?.userType?.includes('owner') || false,

//       event: ALL_EVENTS.UserEvents.updateUser(user as any),
//       eventEnum: 'UE',
//     });
//   }
//   res.send(user);
// });

export const updateProfileV2 = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const updatePayload = pick(req.body, ['firstName', 'lastName', 'phoneNumber', 'company', 'driverBadgeNumber']);

  const user = await userService.updateProfile(new mongoose.Types.ObjectId(id), updatePayload);
  const loggedInUser = req.user as unknown as IUserDoc;
  const ownerId = await userService.getOwnerIdByUserId(user!._id || user!.id);
  await logService.createLog({
    user: loggedInUser,
    ownerId,
    // onlyAdmin: user?.userType?.includes('owner') ?? false,
    event: ALL_EVENTS.UserEvents.updateUser(user as any),
    eventEnum: 'UE',
  });

  res.send(user);
});

export const validateEmailSetToken = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], 'english');

    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User Does not exists');
    }
    if (user.isVerified) {
      // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified['english'],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }
    res.send({ valid: true });
  }
});

export const validateEmailSetTokenPrePhoneOTP = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const validatedToken = await tokenService.validateEmailSetTokenPrePhoneOTP(req.params['token'], 'english');

    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User Does not exists');
    }
    if (user.isVerified) {
      // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified['english'],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }

    const verificationTokenDetails = await tokenService.getLatestVerificationLink(user?._id);
    if (verificationTokenDetails?.user) {
      res.send({ valid: true, verificationLinkSent: true });
    } else {
      res.send({ valid: true });
    }
  }
});

export const sendVerificationSMSToUsers = catchAsync(async (req: Request, res: Response) => {
  if (req.body['userIds'] && req.body['userIds']?.length > 0) {
    await userService.sendVerificationSMSToUsers(req.body['userIds']);
    res.send({ code: 200 });
  }
});

export const requestOTPSforEmailSet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const { language = 'en' } = req.body;
    const languageFullForm = (localesFullForm as any)[language];
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], languageFullForm);
    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));
    if (!user) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        Message.business.userDoesntExist[languageFullForm],
        true,
        '',
        Message.business.userDoesntExist['english']
      );
    }

    if (user.isVerified) {
      // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified[languageFullForm],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }
    const { email } = req.body;
    const emailOTP = await authService.requestEmailSetOTPInEmail(email, user.firstName, user.id, user, languageFullForm);

    const phoneOtp = await authService.requestSetEmailPhoneVerification(user.phoneNumber!, user.fullName!, user._id!, user);
    await createEnhancedLogAuto({
      user,
      event: ALL_EVENTS.UserEvents.requestedOtpForEmailSet,
      eventEnum: 'UE',
      customMetadata: {
        action: 'otp_request',
        type: 'email_set',
      },
    });

    res.send({
      code: 200,
      message: `${Message.business.otpsSentMessage[languageFullForm]}  ${
        config.serverType === Constants.productionServer ? '' : `phone: ${phoneOtp}, email: ${emailOTP}`
      }`,
    });
  }
});

export const requestOTPforEmailSet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const { language = 'en' } = req.body;
    const languageFullForm = (localesFullForm as any)[language];
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], languageFullForm);
    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));
    if (!user) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        Message.business.userDoesntExist[languageFullForm],
        true,
        '',
        Message.business.userDoesntExist['english']
      );
    }

    if (user.isVerified) {
      // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified[languageFullForm],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }

    const { email } = req.body;
    const emailOTP = await authService.requestEmailSetOTPInEmail(email, user.firstName, user.id, user, languageFullForm);

    await logService.createLog({
      user,
      event: ALL_EVENTS.UserEvents.requestedOtpForEmailSetOnlyEmail?.replace('<user>', `${user?.fullName}`),
      eventEnum: 'UE',
    });

    res.send({
      code: 200,
      message: `OTP sent to your Email please check and provide the OTP 
        ${config.serverType === Constants.productionServer ? '' : ` email otp: ${emailOTP}`}`,
    });
  }
});

export const setEmail = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const { language = 'en' } = req.body;
    const languageFullForm = (localesFullForm as any)[language];
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], languageFullForm);
    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));
    if (!user) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        Message.business.userDoesntExist[languageFullForm],
        true,
        '',
        Message.business.userDoesntExist['english']
      );
    }

    if (user.isVerified) {
      // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified[languageFullForm],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }

    const { email, phoneOtp, emailOtp } = req.body;
    const isEmailOTPValid = await otpService.verifyPhoneTokenOtp(email, emailOtp, 'setEmail');

    const isPhoneOTPValid = await otpService.verifyPhoneTokenOtp(user.phoneNumber!, phoneOtp, 'setEmailPhoneVerification');
    if (isEmailOTPValid && isPhoneOTPValid) {
      await userService.updateUserById(user._id, { isVerified: true, email, isSuspended: false });

      await tokenService.inValidateEmailSetToken(req.params['token']);
    } else {
      await tokenService.decreaseTokenAttempt(req.params['token']);

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        Message.business.invalidOTPProcessFailed[languageFullForm],
        true,
        '',
        Message.business.invalidOTPProcessFailed['english']
      );
    }

    await logService.createLog({
      user,
      event: ALL_EVENTS.UserEvents.emailSetupSuccessful?.replace('<user>', `${user?.fullName}`).replace('<email>', email),
      eventEnum: 'UE',
    });

    res.send({
      code: 200,
      message: Message.partnerAuth.emailVerified[languageFullForm],
      error: Message.partnerAuth.emailVerified['english'],
    });
  }
});

export const updateEmail = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const { email, otp } = req.body;

  const isOTPVerified = await otpService.verifyOtp(email, otp, 'changeEmail');
  if (isOTPVerified) {
    const prevUser = await userService.getUserById(new mongoose.Types.ObjectId(id));

    const user = await userService.updateUserById(new mongoose.Types.ObjectId(id), { email, isVerified: true });
    const loggedInUser = req.user as unknown as IUserDoc;
    await logService.createLog({
      user: loggedInUser,
      event: ALL_EVENTS.UserEvents.userEmailUpdate({ fromEmail: prevUser?.email, toEmail: email }),
      eventEnum: 'UE',
    });
    res.send(user);
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Otp Not verified');
  }
});

export const updateEmailV2 = catchAsync(async (req: Request, res: Response) => {
  const { id, email: emailOld } = req.user;
  const { email, otpOld, otpNew } = req.body;

  // Check if old email is a dummy email (skip OTP verification for dummy emails)
  const isDummyEmail = (emailOld as string)?.startsWith('dummyemail');
  
  // Only verify old email OTP if it's not a dummy email
  if (!isDummyEmail) {
    const isOTPVerifiedOld = await otpService.verifyOtpV2(emailOld as string, otpOld, 'changeEmailOld');
    if (!isOTPVerifiedOld) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Please check your old email and provide correct OTP');
    }
  }
  
  const isOTPVerifiedNew = await otpService.verifyOtpV2(email, otpNew, 'changeEmailNew');
  if (!isOTPVerifiedNew) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please check your new email and provide correct OTP');
  }
  const prevUser = await userService.getUserById(new mongoose.Types.ObjectId(id));
  const user = await userService.updatePersonalEmail(new mongoose.Types.ObjectId(id), { email, isVerified: true });
  const loggedInUser = req.user as unknown as IUserDoc;
  await logService.createLog({
    user: loggedInUser,
    event: ALL_EVENTS.UserEvents.userEmailUpdate({ fromEmail: prevUser?.email, toEmail: email }),
    eventEnum: 'UE',
  });
  
  // Only blacklist old email OTP if it's not a dummy email
  if (!isDummyEmail) {
    await otpService.blackListOTP(emailOld as string, otpOld, 'changeEmailOld');
  }
  await otpService.blackListOTP(email, otpNew, 'changeEmailNew');
  res.send(user);
});

export const resendVerificationLink = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.FORBIDDEN, 'This user has already verified their account');
  }

  await userService.resendEmailLink(user);
  res.status(200).json({ message: 'Verification link has been successfully dispatched' });
});

export const getSelf = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as unknown as IUserDoc;
  // to get signed url of users
  let user = await postSuccessLogin(req.user);
  if (loggedInUser?.userType !== 'admin') {
    // logic to create log based on the impersonation
    // const impersonatedBy = req.headers['x-impersonated-by'] as string;
    // const loggedInUser = req.user as unknown as IUserDoc;
    // if (impersonatedBy) {
    //   const impersonatedByUser = await userService.getUserById(new mongoose.Types.ObjectId(impersonatedBy));
    //   if (impersonatedByUser) {
    //     const { fullName } = impersonatedByUser ?? {};
    //     await logService.createLog({
    //       user: impersonatedByUser,
    //       event: ALL_EVENTS.ManagementEvents.fetchUserDetails(
    //         `${fullName}`,
    //         `${user?.firstName} ${user?.lastName}`,
    //         user.userType,
    //         'Admin'
    //       ),
    //       affectedUser: user.id,
    //       eventEnum: 'MaE',
    //     });
    //   }
    // } else {
    //   await logService.createLog({ user: loggedInUser, event: ALL_EVENTS.UserEvents.userFetchedSelf, eventEnum: 'UE' });
    // }
  }

  if (user.userType === 'apartment-complex-employee') {
    const apartmentComplex = await apartmentComplexService.findApartmentComplexById(
      new mongoose.Types.ObjectId(user.apartmentComplex)
    );

    Object.assign(user, { allowApartments: apartmentComplex?.allowApartments });
  }

  if (user.userType.includes('tow-company') || user.userType === 'parking-spaces-provider-owner') {
    const towRequests = await towRequestService.getTowRequestStatusCounts(user);

    Object.assign(user, { towRequests: towRequests });
  }

  delete user.password;
  res.send(user);
});
export const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const updatePayload = pick(req.body, ['isSuspended', 'isArchived']);

  const toUpdateUser = await userService.getUserById(new mongoose.Types.ObjectId(req.params['userId']));
  if (!toUpdateUser?.id) {
    throw new ApiError(httpStatus.NOT_FOUND, 'The user you are trying to update does not exist.');
  }

  await rulesHelper(loggedInUser, toUpdateUser);

  let employeesToUpdate: string[] = [];
  let statusReason = {};

  // ✅ Cascade update if target is an apartment-complex-owner
  if (toUpdateUser.userType === 'apartment-complex-owner') {
    const complexes = await apartmentComplexService.getMyApartmentComplexes(new mongoose.Types.ObjectId(toUpdateUser.id), {
      skipPopulate: true,
    });

    employeesToUpdate = complexes.flatMap((complex) => complex.employees ?? []);

    statusReason = {
      ...(updatePayload.isSuspended ? { suspendReason: 'All employees suspended due to manager suspension.' } : {}),
      ...(updatePayload.isArchived ? { archiveReason: 'All employees archived due to manager archive.' } : {}),
    };
  }

  // ✅ Cascade update if target is a tow-company-owner
  if (toUpdateUser.userType === 'tow-company-owner') {
    const towCompany = toUpdateUser.towCompany;
    employeesToUpdate = towCompany?.employees ?? [];
    statusReason = {
      ...(updatePayload.isSuspended ? { suspendReason: 'All employees suspended due to manager suspension.' } : {}),
      ...(updatePayload.isArchived ? { archiveReason: 'All employees archived due to manager archive.' } : {}),
    };
  }

  // 🚫 Prevent self-suspension or self-archive
  if (updatePayload.isSuspended !== undefined && toUpdateUser.id === loggedInUser.id) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot suspend/unsuspend your own account.');
  }
  if (updatePayload.isArchived !== undefined && toUpdateUser.id === loggedInUser.id) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot archive/activate your own account.');
  }

  const updatedUser = await userService.updateUserById(toUpdateUser.id, updatePayload);
  const ownerId = await userService.getOwnerIdByUserId(toUpdateUser!._id || toUpdateUser!.id);
  await logService.createLog({
    user: loggedInUser,
    affectedUser: toUpdateUser._id || toUpdateUser.id,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId,
    event: ALL_EVENTS.UserManagementEvents.updateUserStatus({
      userId: toUpdateUser.id,
      isSuspended: updatePayload.isSuspended,
      isArchived: updatePayload.isArchived,
    }),
  });

  if (employeesToUpdate.length > 0) {
    await userService.bulkUpdateUserStatus(employeesToUpdate, { ...updatePayload, ...statusReason }, loggedInUser, ownerId!);
  }

  res.send(updatedUser);
});

export const getTowCompanyEmployees = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const towCompanyEmployees = await userService.myTowCompanyEmployees(new mongoose.Types.ObjectId(loggedInUser.id));
  if (!towCompanyEmployees) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow company not found');
  }
  res.send({ results: towCompanyEmployees });
});

const rulesHelper = async (loggedInUser: IUserDoc, toUpdateUser: IUserDoc) => {
  const isTargetManager =
    toUpdateUser.userType === 'apartment-complex-owner' || toUpdateUser.userType === 'tow-company-owner';

  const isLoggedInManager =
    loggedInUser.userType === 'apartment-complex-owner' || loggedInUser.userType === 'tow-company-owner';
  // ✅ Rule: Admins can update anyone except other admins
  if (loggedInUser.userType === 'admin') {
    if (toUpdateUser.userType === 'admin' && !loggedInUser.isSuperAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Admins cannot update other admin accounts.');
    }
  }

  // ❌ Rule: Managers cannot update other managers
  if (isTargetManager && isLoggedInManager) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to update another manager’s account.');
  }

  // ✅ Rule: Managers can only update their own employees
  if (loggedInUser.userType === 'apartment-complex-owner') {
    const myComplexes = await apartmentComplexService.getMyApartmentComplexes(new mongoose.Types.ObjectId(loggedInUser.id), {
      skipPopulate: true,
    });
    const myEmployeeIds = myComplexes.flatMap((complex) => [...(complex?.employees ?? []), ...(complex?.managers ?? [])]);

    const toUpdateUserId = new mongoose.Types.ObjectId(toUpdateUser.id);
    if (!myEmployeeIds.some((id) => id.equals(toUpdateUserId))) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only update managers and employees who are part of your assigned apartment complex.'
      );
    }
  }

  if (loggedInUser.userType === 'tow-company-owner') {
    const towCompany = loggedInUser.towCompany;
    const myEmployeeIds = towCompany?.employees ?? [];
    const myManagersIds = towCompany?.managers ?? [];
    const myProviders = await userService.getMyTowCompanyParkingSpacesProviders(loggedInUser.id);
    const ids = [myEmployeeIds, myManagersIds, myProviders.map((pr) => new mongoose.Types.ObjectId(pr.id))].flat();

    const toUpdateUserId = new mongoose.Types.ObjectId(toUpdateUser.id);

    if (!ids.some((id) => id.equals(toUpdateUserId))) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'You can only update managers and employees who are part of your assigned tow company.'
      );
    }
  }

  // ✅ Cascade update if target is an apartment-complex-owner
};

export const createOccupant = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const renterId = req.body['renterId'];
  delete req.body['renterId'];
  const occupant = await userService.createOccupant(new mongoose.Types.ObjectId(renterId), req.body);
  await logService.createLog({
    user: loggedInUser,
    affectedUser: renterId,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId: renterId,
    event: ALL_EVENTS.apartmentComplexCrud.createOccupant(renterId, req.body),
  });
  res.send({ results: occupant });
});

export const attachOccupantToApartment = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const occupantId = req.body.occupantId;
  delete req.body.occupantId;
  const renterId = req.body['renterId'];
  delete req.body['renterId'];
  const occupant = await userService.attachOccupantToApartment(new mongoose.Types.ObjectId(renterId), occupantId, req.body);
  await logService.createLog({
    user: loggedInUser,
    affectedUser: renterId,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId: renterId,
    event: ALL_EVENTS.apartmentComplexCrud.attachOccupant(renterId, occupantId, req.body),
  });
  res.send({ results: occupant });
});
export const updateOccupant = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const occupantId = req.body._id;
  delete req.body._id;
  const renterId = req.body['renterId'];
  delete req.body['renterId'];
  const occupant = await userService.updateOccupant(new mongoose.Types.ObjectId(renterId), occupantId, req.body);
  await logService.createLog({
    user: loggedInUser,
    affectedUser: renterId,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId: renterId,
    event: ALL_EVENTS.apartmentComplexCrud.updateOccupant(renterId, occupantId, req.body),
  });
  res.send({ results: occupant });
});

export const deleteOccupant = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const occupantId = req.body.occupantId;
  delete req.body.occupantId;
  const renterId = req.body['renterId'];
  delete req.body['renterId'];
  const occupantDetails = await userService.deleteOccupant(
    new mongoose.Types.ObjectId(renterId),
    occupantId,
    req.body['type']
  );
  await logService.createLog({
    user: loggedInUser,
    affectedUser: renterId,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId: renterId,
    event:
      req.body['type'] === 'permanent'
        ? ALL_EVENTS.apartmentComplexCrud.deleteOccupant(
            renterId,
            occupantId,
            occupantDetails.impactedOccupant.apartmentComplex,
            occupantDetails.impactedOccupant.apartmentId
          )
        : ALL_EVENTS.apartmentComplexCrud.detachOccupant(
            renterId,
            occupantId,
            occupantDetails.impactedOccupant.apartmentComplex,
            occupantDetails.impactedOccupant.apartmentId
          ),
  });
  res.status(httpStatus.NO_CONTENT).send();
});

export const updateSuperAdmin = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user;
  if (req.user.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to update super admin');
  }

  const user = await userService.updateSuperAdmin({
    isSuperAdmin: req.body['isSuperAdmin'],
    userId: req.params['userId'] as string,
  });
  await logService.createLog({
    user: loggedInUser,
    affectedUser: user.id,
    eventEnum: 'UME',
    userType: loggedInUser.userType,
    // onlyAdmin: toUpdateUser?.userType?.includes('owner') || false,
    ownerId: loggedInUser.id,
    event: ALL_EVENTS.AdminEvents.updateAdmin(loggedInUser, user),
  });
  res.send({ message: 'User isSuperAdmin has been successfully updated', status: 'success', success: true });
});

export const createAdmin = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user;
    if (req.user.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to create super admin');
    }
    let user: any = req.body;
    if (!user.email) {
      user = {
        ...req.body,
        email: `${req?.body?.firstName?.[0]}${req?.body?.lastName}@hitsparkingmanager.com`.toLowerCase(),
      };
    }

    const newuser = await userService.createUserWithType({ ...user, userType: 'admin' }, loggedInUser);
    res.status(httpStatus.CREATED).send({ newuser });
  } catch (e) {
    console.error(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'internal server error' + e);
  }
});

export const getAllAdmins = catchAsync(async (req: Request, res: Response) => {
  try {
    const loggedInUser = req.user;
    if (req.user.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to create super admin');
    }
    const allAdmins = await userService.getAllAdmins(loggedInUser);
    res.send({ allAdmins, message: 'success', code: 200 });
  } catch (e) {
    console.error(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'internal server error' + e);
  }
});

export const generateQRCode = catchAsync(async (req: Request, res: Response) => {
  // try {

  if (typeof req.body['data'] === 'string') {
    const data = req.body['data'];

    let qrcode = await QRCode.toDataURL(data, { width: 300, margin: 1.5 });

    res.send(qrcode);
  } else {
    // } catch (error: any) {
    //   console.log(error);
    throw new ApiError(httpStatus.NOT_FOUND, 'Link Not found');
  }
  // }
});

export const syncLocation = catchAsync(async (req: Request, res: Response) => {
  await userService.syncLocation(req.user.id, req.body['manualPosition']);
  res.send({ message: 'Location updated' });
});

export const generateParkingQRCode = catchAsync(async (req: Request, res: Response) => {
  // try {

  if (typeof req.params['parkingId'] === 'string') {
    const parkingId = req.params['parkingId'];
    const psp = await userService.getUserById(new mongoose.Types.ObjectId(parkingId));
    const url = `${config.clientUrl}/book-parking/${psp?.id}`;
    let qrcode = await QRCode.toDataURL(url, { width: 600, margin: 1.5 });

    res.send({ qrcode });
  } else {
    throw new ApiError(httpStatus.NOT_FOUND, 'Link Not found');
  }
});

export const getMyTowCompanyEmployees = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;

  const result = await userService.queryUsers(
    {
      towCompanyId:
        loggedInUser.userType === 'tow-company-manager'
          ? new mongoose.Types.ObjectId(loggedInUser.towCompanyId)
          : new mongoose.Types.ObjectId(loggedInUser.id),
      userType: { $in: ['tow-company-employee', 'tow-company-manager'] },
      _id: { $ne: new mongoose.Types.ObjectId(loggedInUser.id) },
      isTowOperator: true,
    },
    {
      page: 1,
      limit: 1000000,
    }
  );
  res.send(result);
});

export const listTowCompanies = catchAsync(async (_: Request, res: Response) => {
  try {
    const towCompanies = await userService.listTowCompanies();
    res.send({ results: towCompanies });
  } catch (error) {
    console.error('Error listing apartment complexes:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ error: 'An error occurred while listing apartment complexes' });
  }
});

export const searchUsers = catchAsync(async (req: Request, res: Response) => {
  const { q, userTypeFilter } = req.query;
  const loggedInUser = req.user;
  const towCompanyId =
    loggedInUser.userType !== 'admin'
      ? loggedInUser.userType === 'tow-company-owner'
        ? loggedInUser.id
        : loggedInUser.towCompanyId
      : null;

  const users = await userService.searchUsers({
    userType:
      userTypeFilter === 'all'
        ? {
            $in: [
              'parking-spaces-provider-owner',
              'parking-spaces-provider-manager',
              'parking-spaces-provider-employee',
              'tow-requester',
            ],
          }
        : {
            $in: [userTypeFilter],
          },
    searchTerm: decodeURI(q as string),
    towCompanyId: towCompanyId,
  });

  res.send(users);
});
