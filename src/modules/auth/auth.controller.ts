import * as authService from './auth.service';

import { Request, Response } from 'express';
import { User, userService } from '../user';
import { checkUnusualIP, getIpFromHeader, localesFullForm } from './auth.helper';
import { tokenService, tokenTypes } from '../token';

import { ALL_EVENTS } from '../utils/events';
import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { ApiError } from '../errors';
import { Constants } from '../utils/Constants';
import { ISendOtp } from '../otp/otp.interfaces';
import { IUserDoc } from '../user/user.interfaces';
import { Message } from '../utils/errorMessage';
import { StatusEnum } from '../logs/log.interfaces';
// TowRequest removed - Faisal Ride refactor
// import TowRequest from '../tow-request/tow-request.model';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
// import crypto from 'crypto';
import { emailService } from '../email';
import { getUserById } from '../user/user.service';
import httpStatus from 'http-status';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { otpService } from '../otp';
import { verifyToken } from '../token/token.service';

// export const register = catchAsync(async (req: Request, res: Response) => {
//   const user = await userService.registerUser(req.body);
//   const tokens = await tokenService.generateAuthTokens(user);
//   // await authService.updateUserLastLogin(user)
//   res.status(httpStatus.CREATED).send({ user, tokens });
// });

// used for new login
export const emailLoginAttempt = catchAsync(async (req: Request, res: Response) => {
  try {
    const {
      email,
      password: encryptedPassword,
      uniqueIdentifier,
      deviceOS,
      deviceName = 'PC',
      preferredLanguage = 'english',
    } = req.body;
    // const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
    const userIP = getIpFromHeader(req);
    // const password = (crypto as any)
    //   .privateDecrypt(
    //     {
    //       key: config.decryptionKey.replace(/\\n/g, '\n'),
    //       padding: (crypto as any).constants.RSA_PKCS1_PADDING,
    //       oaepHash: 'sha256',
    //     },
    //     Buffer.from(encryptedPassword, 'base64')
    //   )
    //   .toString('utf-8');

    const user = await authService.loginUserWithEmailAndPassword(email, encryptedPassword, userIP, false);
    if (user.userType === 'admin') {
      const { token, attempts, otp } = await authService.tokenAndOTP(user);
      res.send({
        token,
        attempts,
        otp: config.serverType === Constants.testServer || config.serverType === Constants.localServer ? otp : '',
      });
    } else {
      const tokens = await tokenService.generateAuthTokens(user);

      const loggedInDevices = {
        uniqueIdentifier: uniqueIdentifier ?? userIP, // as per discussion with ron, if no unique identifier then the IP will be unique identifier
        deviceOS,
        deviceName,
        lastLoggedIn: new Date().toISOString(),
      };

      if (
        (await User.find({ _id: user.id, 'loggedInDevices.uniqueIdentifier': loggedInDevices.uniqueIdentifier })).length == 0
      ) {
        if (loggedInDevices.uniqueIdentifier) {
          await User.findByIdAndUpdate(user.id, {
            $push: { loggedInDevices: loggedInDevices },
          });
        }
      }
      await User.findByIdAndUpdate(user.id, { preferredLanguage });
      res.send({ user: { ...user.toObject(), preferredLanguage }, tokens });
    }
  } catch (error) {
    console.log(error, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, '' + error);
  }
});

// used by mobile application
export const emailLoginAttemptForApplications = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const userIP = getIpFromHeader(req);

  const user = await authService.loginUserWithEmailAndPassword(email, password, userIP, false);

  // await authService.updateUserLastLogin(user);
  const { token, attempts, otp } = await authService.tokenAndOTP(user);
  res.send({ token, attempts, otp: config.serverType === Constants.productionServer ? '' : otp });
});

export const verifymailLoginAttempt = catchAsync(async (req: Request, res: Response) => {
  const {
    otp,
    token,
    deviceToken = '',
    deviceType = '',
    uniqueIdentifier,
    deviceOS,
    deviceName = 'PC',
    preferredLanguage = 'english',
  } = req.body;
  const userIP = getIpFromHeader(req);

  const response = await authService.loginUserWithTokenAndOtp(token, otp, req);
  if (response) {
    const { user, tokens } = response as unknown as { user: IUserDoc; tokens: AccessAndRefreshTokens };
    const loggedInDevices = {
      uniqueIdentifier: uniqueIdentifier ?? userIP, // as per discussion with ron, if no unique identifier then the IP will be unique identifier
      deviceOS,
      deviceName,
      lastLoggedIn: new Date().toISOString(),
    };

    if (
      (await User.find({ _id: user.id, 'loggedInDevices.uniqueIdentifier': loggedInDevices.uniqueIdentifier })).length == 0
    ) {
      if (loggedInDevices.uniqueIdentifier) {
        await User.findByIdAndUpdate(user.id, {
          $push: { loggedInDevices: loggedInDevices },
        });
      }
    }
    await User.findByIdAndUpdate(user.id, { deviceToken, deviceType, preferredLanguage });
    res.send({ user: { ...user, deviceToken, deviceType, preferredLanguage }, tokens });
  }
});

export const resendEmailLoginOTP = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body;
  // const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  const emailLoginTokenDoc = await verifyToken(token, tokenTypes.EMAIL_LOGIN_ATTEMPT);
  if (emailLoginTokenDoc.attempts === 0) {
    // throw new ApiError(httpStatus.FORBIDDEN, 'No more attempts to resend OTP. Please go to login page.');
    throw new ApiError(httpStatus.FORBIDDEN, 'You have no more attempts left');
  }
  const user = await getUserById(new mongoose.Types.ObjectId(emailLoginTokenDoc.user));
  if (!user || !user.phoneNumber) {
    // throw new ApiError(httpStatus.NOT_FOUND, 'User not Found');
    throw new ApiError(httpStatus.NOT_FOUND, 'User Not found');
  }

  const { attempts, otp } = await authService.tokenAndOTP(user, token);
  res.send({ token, attempts: attempts - 1, otp: config.serverType === Constants.productionServer ? '' : otp });
});

// used for login without OTP
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const userIP = getIpFromHeader(req);

  const user = await authService.loginUserWithEmailAndPassword(email, password, userIP);
  await checkUnusualIP(req, user);
  await authService.updateUserLastLogin(user);
  const tokens = await tokenService.generateAuthTokens(user);
  const owner = await userService.getOwnerIdByUserId(user.id);
  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.emailLoginIn,
    eventEnum: 'UE',
    ipAddress: userIP,
  });
  res.send({ user, tokens });
});

export const requestOTPBeforeEmailVerification = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, preferredLanguage, userType } = req.body;

  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  const user = await authService.requestOTPBeforeEmailVerification(phoneNumber, language, userType);
  // await accountStatusCheckForVerification(user, language);
  // if (user) {
  const payload: ISendOtp & { userDoc: IUserDoc } = {
    phoneNumber,
    name: user.firstName,
    email: user.email!,
    type: 'phoneVerificationBeforeEmailSet',
    user: user.id,
    userDoc: user,
  };
  const owner = await userService.getOwnerIdByUserId(user.id);

  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.requestedOtpForEmailSetOnly?.replace('<user>', `${user?.fullName}`),
    eventEnum: 'UE',
  });

  const otp = await otpService.sendOtp(payload);
  res.send({
    status: 200,
    // message: `An otp has been sent to your phone number please check and provide the OTP  ${config.serverType === Constants.productionServer ? '' : otp
    message: `${Message.business.otpSentMessage[language]}  ${config.serverType === Constants.productionServer ? '' : otp}`,
  });
});

// export const requestOtpForPhoneChange = catchAsync(async (req: Request, res: Response) => {
//   const user = req.user;
//   const { phoneNumber } = req.body;
//   const otp = await authService.requestChangePhoneNumber(phoneNumber, user.firstName, user.id, user);
//   await logService.createLog({ user, event: ALL_EVENTS.UserEvents.requestedOtpForPhoneChange, eventEnum: 'UE' });
//   const preferredLanguage = user?.preferredLanguage;
//   const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
//   res.send({
//     status: 200,
//     // message: `An otp has been sent to your phone number please check and provide the OTP  ${config.serverType === Constants.productionServer ? '' : otp
//     message: `${Message.business.otpSentMessage[language]}  ${config.serverType === Constants.productionServer ? '' : otp}`,
//   });
// });

export const requestOtpForEmailChange = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { email } = req.body;
  const otp = await authService.requestChangeEmail(email, user.firstName, user.id, user);
  const owner = await userService.getOwnerIdByUserId(user.id);

  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.requestedOtpForEmailChange,
    eventEnum: 'UE',
  });
  res.send({
    status: 200,
    message: `An otp has been sent to your email please check and provide the OTP  ${
      config.serverType === Constants.productionServer ? '' : otp
    }`,
  });
});

export const requestOtpForEmailChangeV2 = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const { email } = req.body;
  const otp = await authService.requestChangeEmailV2(email, user.firstName, user.id, user);
  if (!otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please check your email and provide correct OTP');
  }
  const owner = await userService.getOwnerIdByUserId(user.id);

  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.requestedOtpForEmailChange,
    eventEnum: 'UE',
  });
  res.send({
    status: 200,
    message: `OTPs have been sent to your old and new emails, please check and provide the OTP `,
  });
});

// export const impersonateUser = catchAsync(async (req: Request, res: Response) => {
//   const user = req.user;
//   const { userId } = req.body;
//   const impersonatedUser = await userService.getUserById(new mongoose.Types.ObjectId(userId));
//   if (!impersonatedUser) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
//   }
//   const { fullName, userType } = user;
//   await logService.createLog({
//     user,
//     event: ALL_EVENTS.ManagementEvents.impersonate(
//       `${fullName}`,
//       `${impersonatedUser?.firstName} ${impersonatedUser?.lastName}`,
//       impersonatedUser?.userType!,
//       userType
//     ),
//     eventEnum: 'MaE',
//   });
//   const tokens = await tokenService.generateAuthTokens(impersonatedUser);
//   res.send({ user: impersonatedUser, tokens, isImpersonated: true });
// });

// export const phoneLogin = catchAsync(async (req: Request, res: Response) => {
//   const {
//     phoneNumber,
//     otp,
//     deviceToken,
//     deviceType,
//     preferredLanguage,
//     uniqueIdentifier,
//     deviceOS,
//     deviceName = 'PC',
//     userType,
//     preventUpdatingPreferredLanguage
//   } = req.body;

//   const user = await authService.loginUserWithPhone(phoneNumber, true, preferredLanguage, userType);
//   const userIP = getIpFromHeader(req);

//   const isOTPVerified = await otpService.verifyOtp(
//     phoneNumber,
//     otp,
//     'login',
//     StatusEnum.INCORRECT_OTP,
//     user,
//     userIP,
//     3,
//     preferredLanguage
//   );
//   if (isOTPVerified) {
//     await authService.updateUserLastLogin(user);

//     const tokens = await tokenService.generateAuthTokens(user);

//     await checkUnusualIP(req, user);

//     await logService.createLog({ user, event: ALL_EVENTS.UserEvents.phoneLogin, eventEnum: 'UE', ipAddress: userIP });
//     // await User.findByIdAndUpdate(user.id, { deviceToken, deviceType });
//     let updateData: any = {
//       deviceType,
//       deviceToken,
//     };

//     await Log.deleteMany({
//       userId: user._id,
//       $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
//     });

//     if (preferredLanguage && !preventUpdatingPreferredLanguage) {
//       updateData.preferredLanguage = preferredLanguage;
//     }

//     await User.findByIdAndUpdate(user.id, updateData);
//     const loggedInDevices = {
//       uniqueIdentifier: uniqueIdentifier ?? userIP, // as per discussion with ron, if no unique identifier then the IP will be unique identifier
//       deviceOS,
//       deviceName,
//       lastLoggedIn: new Date().toISOString(),
//     };

//     if (
//       (await User.find({ _id: user.id, 'loggedInDevices.uniqueIdentifier': loggedInDevices?.uniqueIdentifier })).length == 0
//     ) {
//       if (loggedInDevices?.uniqueIdentifier) {
//         await User.findByIdAndUpdate(user.id, {
//           $push: { loggedInDevices: loggedInDevices },
//         });
//       }
//     }

//     // end by cts

//     res.send({
//       user: { ...user, deviceToken, deviceType, ...(preferredLanguage && { preferredLanguage }) },
//       tokens,
//       otp: config.serverType === Constants.productionServer ? '' : otp
//     });
//   }
// });

export const verifyOTPBeforeEmailVerification = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, otp, preferredLanguage, userType } = req.body;
  const user = await authService.requestOTPBeforeEmailVerification(phoneNumber, preferredLanguage, userType);
  if (user.isVerified) {
    // throw new ApiError(httpStatus.FORBIDDEN, 'You are not allowed to connect to this interface');
    throw new ApiError(200, Message.partnerAuth.accountAlreadyVerified[preferredLanguage]);
  }
  const userIP = getIpFromHeader(req);

  const isOTPVerified = await otpService.verifyOtp(
    phoneNumber,
    otp,
    'phoneVerificationBeforeEmailSet',
    StatusEnum.INCORRECT_OTP,
    user,
    userIP,
    3,
    preferredLanguage
  );
  if (isOTPVerified) {
    const token = await tokenService.generateEmailSetTokenPrePhoneVerified(user, 10);
    const owner = await userService.getOwnerIdByUserId(user.id);

    await logService.createLog({
      user,
      ownerId: owner,
      event: ALL_EVENTS.UserEvents.verfiedPhoneForEmailSet.replace('<user>', `${user?.fullName}`),
      eventEnum: 'UE',
    });
    // await User.findByIdAndUpdate(user.id, { deviceToken, deviceType });
    res.send({
      token,
    });
  }
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const deviceToken = req.body.deviceToken ? req.body.deviceToken : '';
  const user = await authService.logout(req.body.refreshToken, deviceToken);
  if (user) {
    const owner = await userService.getOwnerIdByUserId(user.id);

    await logService.createLog({
      user,
      ownerId: owner,
      event: ALL_EVENTS.UserEvents.userLogout,
      eventEnum: 'UE',
    });
  }
  res.status(httpStatus.NO_CONTENT).send();
});

export const refreshTokens = catchAsync(async (req: Request, res: Response) => {
  const userWithTokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...userWithTokens });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const preferredLanguage = req.body.preferredLanguage;
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  const user = await userService.getUserByEmail(req.body.email);
  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  const owner = await userService.getOwnerIdByUserId(user.id);
  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.PasswordResetRequest,
    eventEnum: 'UE',
  });
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken, user.fullName!, user);

  res
    .status(200)
    // .send({ code: 200, message: 'An email has been sent to you with reset password link. Please check your email. ' });
    .send({ code: 200, message: Message.business.resetPasswordEmailSent[language] });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.resetPassword(req.query['token'], req.body.password);
  res.send({ code: 200, message: 'Password successfully reset' });
});

export const sendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
  if (req.user.email) {
    const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user!, req?.user?.email);
    await emailService.sendVerificationEmail(req?.user?.email, verifyEmailToken, req.user.firstName, req.user);
  }
  res.send({ code: 200, message: 'Verification email sent successfully' });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const preferredLanguage = (req.query['preferredLanguage'] as string) || 'en';
  const languageFullFOrm = (localesFullForm as any)[preferredLanguage] || 'english';
  await authService.verifyEmail(req.query['token'], languageFullFOrm);
  res.send({
    code: 200,
    message: Message.partnerAuth.emailVerified[languageFullFOrm],
    error: Message.partnerAuth.emailVerified['english'],
  });
});

export const setupPasswordAndName = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user;
  const { firstName, lastName, password, phoneNumber } = req.body;

  await authService.setupPassowrdAndUserName(password, firstName, lastName,phoneNumber, loggedInUser);

  res.send({
    message: 'Account successfuly updated',
  });
});

/**
 * Setup email and password for users with dummy email
 * This is for users who were created with only a phone number
 */
export const setupEmailAndPassword = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const { email, password } = req.body;

  // Check if user has a dummy email
  if (!loggedInUser.email?.startsWith('dummyemail')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This endpoint is only for users with dummy emails. Use the regular email change flow.');
  }

  // Check if email is already in use by another user
  const existingUser = await userService.getUserByEmail(email);
  if (existingUser && existingUser.id !== loggedInUser.id) {
    throw new ApiError(httpStatus.CONFLICT, 'This email is already registered to another account');
  }

  // Update user's email and password, set isVerified to false
  await userService.updateUserById(
    loggedInUser.id,
    {
      email,
      isVerified: false,
      isDefaultPassword: false,
    }
  );
  
  // Update password directly using the model
  const userToUpdate = await userService.getUserById(loggedInUser.id);
  if (userToUpdate) {
    userToUpdate.password = password;
    await userToUpdate.save();
  }

  // Generate verification token and send email
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(loggedInUser, email);
  await emailService.sendVerificationEmail(email, verifyEmailToken, loggedInUser.firstName || 'User', loggedInUser);

  res.send({
    message: 'Account updated. Please check your email to verify your new email address.',
  });
});

/**
 * Setup phone number and password for users with dummy phone
 * This is for users who were created with only an email
 */
export const setupPhoneAndPassword = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const { phoneNumber, password } = req.body;

  // Check if user has a dummy phone number (starts with +1000000)
  if (!loggedInUser.phoneNumber?.startsWith('+1000000')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This endpoint is only for users with dummy phone numbers.');
  }

  // Check if phone number is already in use by another user
  const existingUser = await userService.getUserByPhone(phoneNumber);
  if (existingUser && existingUser.id !== loggedInUser.id) {
    throw new ApiError(httpStatus.CONFLICT, 'This phone number is already registered to another account');
  }

  // Update user's phone number and password
  await userService.updateUserById(
    loggedInUser.id,
    {
      phoneNumber,
      isPhoneNumberVerified: false,
      isDefaultPassword: false,
    }
  );
  
  // Update password directly
  const userToUpdate = await userService.getUserById(loggedInUser.id);
  if (userToUpdate) {
    userToUpdate.password = password;
    await userToUpdate.save();
  }

  // Send OTP to the new phone number
  const otp = await otpService.sendPhoneVerificationOtp(phoneNumber, loggedInUser);

  res.send({
    message: 'Account updated. Please verify your phone number with the OTP sent.',
    otp: config.serverType === Constants.productionServer ? '' : otp,
  });
});

/**
 * Send OTP for phone number verification
 */
export const sendPhoneVerificationOTP = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const { phoneNumber } = req.body;

  // If no phone number provided, use the user's current phone number
  const targetPhoneNumber = phoneNumber || loggedInUser.phoneNumber;

  if (!targetPhoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
  }

  // Check if the phone number is a dummy phone number
  if (targetPhoneNumber.startsWith('+1000000')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Please provide a valid phone number to verify');
  }

  // If user is trying to verify a different phone number, check if it's already in use
  if (phoneNumber && phoneNumber !== loggedInUser.phoneNumber) {
    const existingUser = await userService.getUserByPhone(phoneNumber);
    if (existingUser && existingUser.id !== loggedInUser.id) {
      throw new ApiError(httpStatus.CONFLICT, 'This phone number is already registered to another account');
    }

    // Update the user's phone number (unverified)
    await userService.updateUserById(
      loggedInUser.id,
      {
        phoneNumber,
        isPhoneNumberVerified: false,
      }
    );
  }

  // Send OTP
  const otp = await otpService.sendPhoneVerificationOtp(targetPhoneNumber, loggedInUser);

  res.send({
    message: 'OTP sent to your phone number. Please verify within 5 minutes.',
    otp: config.serverType === Constants.productionServer ? '' : otp,
  });
});

/**
 * Verify phone number with OTP
 */
export const verifyPhoneNumber = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const { phoneNumber, otp } = req.body;

  // If no phone number provided, use the user's current phone number
  const targetPhoneNumber = phoneNumber || loggedInUser.phoneNumber;

  if (!targetPhoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
  }

  // Verify the OTP
  await otpService.verifyPhoneNumberOtp(targetPhoneNumber, otp, loggedInUser);

  // Update user's phone verification status
  await userService.updateUserById(
    loggedInUser.id,
    {
      phoneNumber: targetPhoneNumber,
      isPhoneNumberVerified: true,
    }
  );

  // TowRequest update removed - Faisal Ride refactor
  // Previously updated requesterPhoneNumber in tow requests

  res.send({
    message: 'Phone number verified successfully!',
  });
});

/**
 * Verify account setup token and return user info
 * This is used for the one-time setup link sent in invitation emails
 */
export const verifyAccountSetupToken = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Token is required');
  }

  // Verify the token and get the user
  const user = await tokenService.verifyAccountSetupToken(token);

  // Check if account setup is already complete
  const hasDummyEmail = user.email?.startsWith('dummyemail') ?? false;
  const hasDummyPhone = user.phoneNumber?.startsWith('+1000000') ?? false;
  const isSetupComplete = !user.isDefaultPassword && !hasDummyEmail && !hasDummyPhone;

  if (isSetupComplete) {
    // Invalidate the token since setup is complete
    await tokenService.invalidateAccountSetupToken(token);
  }

  // Generate auth tokens for the user
  const tokens = await tokenService.generateAuthTokens(user);

  res.send({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      isDefaultPassword: user.isDefaultPassword,
      hasDummyEmail,
      hasDummyPhone,
      isSetupComplete,
    },
    tokens,
  });
});
