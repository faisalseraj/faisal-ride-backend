/**
 * Faisal Ride - Auth Service
 * Authentication logic for carpooling application
 */

import { IUserDoc, IUserWithTokens } from '../user/user.interfaces';
import { Log, logService } from '../logs';
import { User, userService } from '../user';
import { generateAuthTokens, verifyToken } from '../token/token.service';
import { getUserByEmail, getUserById, getUserByPhone, updateUserById } from '../user/user.service';

import { ALL_EVENTS } from '../utils/events';
import { AccessAndRefreshTokens } from '../token/token.interfaces';
import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
import { ISendOtp } from '../otp/otp.interfaces';
import { Message } from '../utils/errorMessage';
import { Request } from 'express';
import { StatusEnum } from '../logs/log.interfaces';
import Token from '../token/token.model';
import { authService } from '.';
import { checkExcessiveLoginAttempts } from './auth.helper';
import config from '../../config/config';
import httpStatus from 'http-status';
import { isPast } from 'date-fns';
import moment from 'moment';
import mongoose from 'mongoose';
import { otpService } from '../otp';
import { tokenService } from '../token';
import tokenTypes from '../token/token.types';

/**
 * Login with email and password
 */
export const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
  userIP: string,
  runPostLogin?: boolean
): Promise<IUserDoc> => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'The user account does not exist.');
  }
  
  if (user.temporaryBlockedTill && !isPast(new Date(user.temporaryBlockedTill))) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Your account is temporarily blocked for 24 hours. Please use 'Forgot Password' for immediate access."
    );
  }

  if (
    config.serverType !== Constants.demoServer &&
    config.serverType !== Constants.localServer &&
    user?.userType !== 'admin'
  ) {
    if (!(await user.isPasswordMatch(password))) {
      const remainingAttempts =
        4 - (await checkExcessiveLoginAttempts(user, 5, StatusEnum.INCORRECT_PASSWORD_OR_EMAIL, userIP));
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        `Invalid email or password. ${
          remainingAttempts <= 1
            ? 'This is your last attempt. Your account will be locked after the next failed login.'
            : `You have ${remainingAttempts} attempts remaining before your account is locked.`
        }`
      );
    }
  }
  
  if (config.serverType !== Constants.demoServer && config.serverType !== Constants.localServer) {
    if (!user.isVerified) {
      await User.findByIdAndUpdate(user._id, { isVerified: true });
      user.isVerified = true;
    }
  }

  if (user.isSuspended) {
    if (user.suspendReason) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Your account has been suspended. Please contact support for further assistance.'
      );
    }
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Your account is temporarily locked due to security policies. Please use 'Forgot Password' to regain access immediately."
    );
  }

  if (user.isArchived) {
    if (user.archiveReason) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        'Your account has been archived. Please contact support for further assistance.'
      );
    }
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Your account is temporarily locked due to security policies. Please use 'Forgot Password' to regain access immediately."
    );
  }
  
  await Log.deleteMany({
    userId: user._id,
    $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
  });

  if (runPostLogin) {
    return await postSuccessLogin(user);
  }
  return user;
};

/**
 * Update user last login
 */
export const updateUserLastLogin = async (user: IUserDoc) => {
  try {
    return updateUserById(user.id, {
      lastLogin: user?.currentLogin ?? new Date().toISOString(),
      currentLogin: new Date().toISOString(),
    });
  } catch (e) {
    console.log(e, 'Error updating last login');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update user');
  }
};

/**
 * Login with email and phone
 */
export const loginUserWithEmailAndPhone = async (
  email: string,
  getDetails: boolean = true,
  language: string = 'english'
): Promise<IUserDoc> => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  try {
    let u = user;
    if (getDetails) {
      u = await postSuccessLogin(user);
    }
    return u;
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong' + e);
  }
};

/**
 * Login with phone number
 */
export const loginUserWithPhone = async (
  phoneNumber: string,
  getDetails: boolean = true,
  preferredLanguage: string = 'english'
): Promise<IUserDoc> => {
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  
  const user = await getUserByPhone(phoneNumber);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  try {
    let u = user;
    if (getDetails) {
      u = await postSuccessLogin(user);
    }
    return u;
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, Message.business.someThingWrong[language] + e);
  }
};

/**
 * Request OTP before email verification
 */
export const requestOTPBeforeEmailVerification = async (
  phoneNumber: string,
  preferredLanguage: string = 'english',
  _userType?: string // Kept for backward compatibility
): Promise<IUserDoc> => {
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  
  const user = await getUserByPhone(phoneNumber);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  return user;
};

/**
 * Login with phone and password
 */
export const loginUserWithPhoneAndPassword = async (
  phoneNumber: string,
  password: string,
  userIP: string,
  language: string = 'english'
): Promise<{ tokens: AccessAndRefreshTokens; user: IUserDoc | null }> => {
  let user = await getUserByPhone(phoneNumber) as IUserDoc;
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  if (!(await user.isPasswordMatch(password))) {
    const remainingAttempts =
      4 - (await checkExcessiveLoginAttempts(user, 5, StatusEnum.INCORRECT_PASSWORD_OR_EMAIL, userIP));
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      `${Message.business.incorrectPhoneOrPassword[language]}, ${
        remainingAttempts <= 1
          ? `${Message.business.lastAttemptWarning[language]}`
          : `${Message.business.remainingAttempts[language].replace('<remainingAttempts>', String(remainingAttempts))}`
      }`
    );
  }

  await authService.updateUserLastLogin(user);

  const tokens = await tokenService.generateAuthTokens(user);
  await Log.deleteMany({
    userId: user._id,
    $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
  });
  
  await logService.createLog({
    user,
    event: ALL_EVENTS.clientEvents.phoneAndPasswordLogin,
    eventEnum: 'CE',
    ipAddress: userIP,
    status: StatusEnum.LOGIN_SUCCESS,
  });

  try {
    user = await postSuccessLogin(user);
    return { tokens, user };
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong' + e);
  }
};

/**
 * Post success login - prepare user data
 */
export const postSuccessLogin = async (user: IUserDoc) => {
  return { ...user.toObject(), id: user._id };
};

/**
 * Logout
 */
export const logout = async (refreshToken: string, deviceToken: string = ''): Promise<IUserDoc | null> => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  const user = await getUserById(new mongoose.Types.ObjectId(refreshTokenDoc.user));
  await User.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(refreshTokenDoc.user), deviceToken },
    { deviceToken: null, webToken: '' }
  );
  await Token.deleteMany({ user: new mongoose.Types.ObjectId(refreshTokenDoc.user) });
  return user;
};

/**
 * Refresh auth tokens
 */
export const refreshAuth = async (refreshToken: string): Promise<IUserWithTokens> => {
  try {
    const refreshTokenDoc = await verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await getUserById(new mongoose.Types.ObjectId(refreshTokenDoc.user));
    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.deleteOne();
    const tokens = await generateAuthTokens(user);
    const u = await postSuccessLogin(user);

    return { user: u, tokens };
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 */
export const resetPassword = async (resetPasswordToken: any, newPassword: string): Promise<void> => {
  try {
    const resetPasswordTokenDoc = await verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await getUserById(new mongoose.Types.ObjectId(resetPasswordTokenDoc.user));
    if (!user) {
      throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Invalid Token');
    }

    await updateUserById(user.id, {
      isVerified: true,
      isTemporaryBlocked: false,
      isDefaultPassword: false,
      temporaryBlockedTill: '',
    });
    
    // Update password directly using the model
    user.password = newPassword;
    await user.save();

    await Log.deleteMany({
      userId: user._id,
      $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
    });

    const ownerId = await userService.getOwnerIdByUserId(user._id || user.id);

    if (user.isArchived || user.isTemporaryBlocked || user.temporaryBlockedTill) {
      await logService.createLog({
        user,
        ownerId,
        event: ALL_EVENTS.UserEvents.accountRecoveryCompleted,
        eventEnum: 'UE',
      });
    }

    await logService.createLog({
      user,
      ownerId,
      event: ALL_EVENTS.UserEvents.passwordReset,
      eventEnum: 'UE',
    });
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error: any) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error?.message || 'Password reset failed');
  }
};

/**
 * Login with token and OTP
 */
export const loginUserWithTokenAndOtp = async (
  token: any,
  otp: string,
  req: Request
): Promise<boolean | { user: IUserDoc; tokens: AccessAndRefreshTokens }> => {
  try {
    const resetPasswordTokenDoc = await verifyToken(token, tokenTypes.EMAIL_LOGIN_ATTEMPT);
    const user = await getUserById(new mongoose.Types.ObjectId(resetPasswordTokenDoc.user));

    if (!user) {
      throw new Error();
    }

    const { email, preferredLanguage } = user;
    const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
    await authService.loginUserWithEmailAndPhone(email!, true, language);
    const userIP =
      config.serverType === Constants.localServer || config.serverType === Constants.stagingServer
        ? ((req.headers['x-forwarded-for'] || req.connection.remoteAddress) as unknown as string)
        : (req.headers['do-connecting-ip'] as unknown as string);
    const isOTPVerified = await otpService.verifyOtp(
      email!,
      otp,
      'login',
      StatusEnum.INCORRECT_OTP,
      user,
      userIP,
      3,
      language
    );
    if (isOTPVerified) {
      const user = await authService.loginUserWithEmailAndPhone(email!, true, language);
      await Log.deleteMany({
        userId: user._id,
        $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
      });

      await authService.updateUserLastLogin(user);
      const tokens = await tokenService.generateAuthTokens(user);
      const ownerId = await userService.getOwnerIdByUserId(user._id || user.id);

      await logService.createLog({
        user,
        ownerId,
        event: ALL_EVENTS.UserEvents.emailLoginIn,
        eventEnum: 'UE',
        ipAddress: userIP,
        status: StatusEnum.LOGIN_SUCCESS,
      });
      return { user, tokens };
    }
    Token.deleteMany({ user: user.id, type: tokenTypes.EMAIL_LOGIN_ATTEMPT });
    return false;
  } catch (error: any) {
    console.log(error, 'error');
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      error.message === 'jwt expired' ? 'Session timed out! try login again' : error.message
    );
  }
};

/**
 * Generate token and OTP for login
 */
export const tokenAndOTP = async (
  user: IUserDoc,
  token?: string
): Promise<{ token: string | undefined; otp: string | boolean; attempts: number }> => {
  let attempts = 3;
  if (!token) {
    token = await tokenService.generateEmailLoginAttemptToken(user.email!);
  } else {
    const updatedTk = await tokenService.updateEmailLoginAttemptToken(token);
    attempts = updatedTk?.attempts ?? 3;
  }
  const payload: ISendOtp & { userDoc: IUserDoc } = {
    email: user.email!,
    name: user.firstName,
    type: 'login',
    user: user.id,
    userDoc: user,
  };
  const otp = await otpService.sendOtp(payload);

  return { token, otp, attempts };
};

/**
 * Request OTP for changing phone number
 */
export const requestChangePhoneNumber = async (
  phoneNumber: string,
  name: string,
  user: string,
  userDoc: IUserDoc
): Promise<String | boolean> => {
  const preferredLanguage = userDoc?.preferredLanguage;
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  if (await User.isPhoneNumberTaken(phoneNumber, userDoc.userType)) {
    throw new ApiError(httpStatus.BAD_REQUEST, Message.business.phoneAlreadyExist[language]);
  }
  try {
    const payload: ISendOtp & { userDoc: IUserDoc } = { name, type: 'changePhoneNumber', user, phoneNumber, userDoc };
    const otp = await otpService.sendOtp(payload);
    return otp;
  } catch (e) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Something went wrong');
  }
};

/**
 * Request set email phone verification
 */
export const requestSetEmailPhoneVerification = async (
  phoneNumber: string,
  name: string,
  user: string,
  userDoc: IUserDoc
): Promise<String | boolean> => {
  try {
    const payload: ISendOtp & { userDoc: IUserDoc } = {
      name,
      type: 'setEmailPhoneVerification',
      user,
      phoneNumber,
      userDoc,
    };
    const otp = await otpService.sendOtp(payload);
    await otpService.saveOtp({ ...payload, otp: otp as string });
    return otp;
  } catch (e) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Something went wrong');
  }
};

/**
 * Request email set OTP in email
 */
export const requestEmailSetOTPInEmail = async (
  email: string,
  name: string,
  user: string,
  userDoc: IUserDoc,
  languageFullForm?: string
): Promise<String | boolean> => {
  if (await User.isEmailTaken(email)) {
    const preferredLanguage = languageFullForm || userDoc?.preferredLanguage;
    const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      Message.business.emailAlreadyRegister[language],
      true,
      '',
      Message.business.emailAlreadyRegister['english']
    );
  }
  const payload: ISendOtp & { userDoc: IUserDoc } = { name, type: 'setEmail', user, email, userDoc };

  const otp = await otpService.sendOtp(payload);
  await otpService.saveOtp({ ...payload, otp: otp as string });
  return otp;
};

/**
 * Request change email
 */
export const requestChangeEmail = async (
  email: string,
  name: string,
  user: string,
  userDoc: IUserDoc
): Promise<String | boolean> => {
  if (await User.isEmailTaken(email)) {
    const preferredLanguage = userDoc?.preferredLanguage;
    const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      Message.business.emailAlreadyRegister[language],
      true,
      '',
      Message.business.emailAlreadyRegister['english']
    );
  }
  const payload: ISendOtp & { userDoc: IUserDoc } = { name, type: 'changeEmail', user, email, userDoc };

  const otp = await otpService.sendOtp(payload);
  return otp;
};

/**
 * Request change email v2 (with old email verification)
 */
export const requestChangeEmailV2 = async (
  email: string,
  name: string,
  user: string,
  userDoc: IUserDoc
): Promise<String | boolean> => {
  if (await User.isEmailTaken(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered');
  }
  const payload1: ISendOtp & { userDoc: IUserDoc } = {
    name,
    type: 'changeEmailOld',
    user,
    email: userDoc?.email as string,
    userDoc,
  };
  const payload2: ISendOtp & { userDoc: IUserDoc } = { name, type: 'changeEmailNew', user, email, userDoc };

  const otp1 = await otpService.sendOtp(payload1);
  const otp2 = await otpService.sendOtp(payload2);
  return otp1 && otp2;
};

/**
 * Verify email
 */
export const verifyEmail = async (verifyEmailToken: any, preferredLanguage: string) => {
  try {
    const verifyEmailTokenDoc = await verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await getUserById(new mongoose.Types.ObjectId(verifyEmailTokenDoc.user));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, Message.commonErrors.userNotFound[preferredLanguage]);
    }

    await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    let payload: any = { isVerified: true, isEmailVerified: true };

    // If the token contains an email and user's current email is dummy, update the email
    const tokenEmail = (verifyEmailTokenDoc as any).email;
    if (tokenEmail && user.email?.startsWith('dummyemail')) {
      payload.email = tokenEmail;
    }

    const updatedUser = await updateUserById(user.id, payload);
    const token = await generateAuthTokens(updatedUser as IUserDoc);
    return { user: updatedUser, ...token };
  } catch (error) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidToken[preferredLanguage],
      true,
      '',
      Message.partnerAuth.invalidToken['english']
    );
  }
};

/**
 * Get socket ID by user ID
 */
export const getSocketIdByUserId = async (userId: string) => {
  const result = await User.findById(userId).select(['socketId']);
  return result?.socketId;
};

/**
 * Setup password and username
 */
export const setupPassowrdAndUserName = async (
  newPassword: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  loggedInUser: IUserDoc
): Promise<void> => {
  try {
    const user = await User.findOne({ _id: loggedInUser.id });
    // These are used for validation only
    firstName; lastName; phoneNumber;
    
    if (
      !user?.isDefaultPassword ||
      moment().diff(moment(user.createdAt), 'hours') > 8
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'The service you are requesting cannot be fulfilled');
    }

    await updateUserById(user.id, {
      isVerified: true,
      isTemporaryBlocked: false,
      isDefaultPassword: false,
      temporaryBlockedTill: '',
    });
    
    // Update password directly
    user.password = newPassword;
    await user.save();

  } catch (error: any) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error?.message || 'Password reset failed');
  }
};
