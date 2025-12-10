import { IUserDoc, IUserWithTokens } from '../user/user.interfaces';
import { Log, logService } from '../logs';
import { User, userService } from '../user';
import { generateAuthTokens, verifyToken } from '../token/token.service';
import { getUserByEmail, getUserById, getUserByPhone, updateUserById } from '../user/user.service';

import { ALL_EVENTS } from '../utils/events';
import { AccessAndRefreshTokens } from '../token/token.interfaces';
import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
// import { Docs } from '../docs/docs.model';
import { ISendOtp } from '../otp/otp.interfaces';
import { Message } from '../utils/errorMessage';
import { Request } from 'express';
import { StatusEnum } from '../logs/log.interfaces';
import Token from '../token/token.model';
import { apartmentsForRenters } from '../apartmentComplex/apartmentComplex.service';
import { authService } from '.';
import { checkExcessiveLoginAttempts } from './auth.helper';
import config from '../../config/config';
import { emailService } from '../email';
// import { getSignedUrl } from '../upload/upload.service';
import httpStatus from 'http-status';
import { isPast } from 'date-fns';
import moment from 'moment';
import mongoose from 'mongoose';
import { otpService } from '../otp';
import { tokenService } from '../token';
import tokenTypes from '../token/token.types';

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<IUserDoc>}
 */
export const loginUserWithEmailAndPassword = async (
  email: string,
  password: string,
  userIP: string,
  runPostLogin?: boolean
  // userType?: IUserType
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
        "Your account has been suspended due to your manager's account being suspended. Please contact your manager or our support team for further assistance."
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
        "Your account has been Archived due to your manager's account being Archived. Please contact your manager or our support team for further assistance."
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
 * @param {IUserDoc} email
 */
export const updateUserLastLogin = async (user: IUserDoc) => {
  try {
    return updateUserById(user.id, {
      lastLogin: user?.currentLogin ?? new Date().toISOString(),
      currentLogin: new Date().toISOString(),
    });
  } catch (e) {
    console.log(e, 'errrrrrrrrrrooooooorrrrrr');
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update user');
  }
};

/**
 * Login with username and password
 * @param {string} phoneNumber
 * @returns {Promise<IUserDoc>}
 */
export const loginUserWithEmailAndPhone = async (
  email: string,
  // phoneNumber: string,
  getDetails: boolean = true,
  language: string = 'english'
): Promise<IUserDoc> => {
  // try {
  let user = await getUserByEmail(email);
  if (!user) {
    // throw new ApiError(httpStatus.NOT_FOUND, "User doesn't exist");
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  // await accountStatusCheck(user);

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
 * Login with username and password
 * @param {string} phoneNumber
 * @returns {Promise<IUserDoc>}
 */
export const loginUserWithPhone = async (
  phoneNumber: string,
  getDetails: boolean = true,
  preferredLanguage: string = 'english',
  userType?: string
): Promise<IUserDoc> => {
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  // try {
  let user = await getUserByPhone(phoneNumber, userType);
  if (!user) {
    // throw new ApiError(httpStatus.NOT_FOUND, "User doesn't exist");
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }
  // await accountStatusCheck(user, userType as IUserType, language);

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
 * Login with username and password
 * @param {string} phoneNumber
 * @returns {Promise<IUserDoc>}
 */
export const requestOTPBeforeEmailVerification = async (
  phoneNumber: string,
  preferredLanguage: string = 'english',
  userType?: string
): Promise<IUserDoc> => {
  // try {
  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;
  let user = await getUserByPhone(phoneNumber, userType);
  if (!user) {
    // throw new ApiError(httpStatus.NOT_FOUND, "User doesn't exist");
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  try {
    let u = user;

    return u;
  } catch (e) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, Message.business.someThingWrong[language] + e);
  }
};

/**
 * Login with username and password
 * @param {string} phoneNumber
 * @returns {Promise<IUserDoc>}
 */
export const loginUserWithPhoneAndPassword = async (
  phoneNumber: string,
  password: string,
  userIP: string,
  language: string = 'english',
  userType?: string
): Promise<{ tokens: AccessAndRefreshTokens; user: IUserDoc | null }> => {
  // try {
  let user = (await getUserByPhone(phoneNumber, userType)) as IUserDoc;
  if (!user) {
    // throw new ApiError(httpStatus.NOT_FOUND, "User doesn't exist");
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.userDoesntExist[language]);
  }

  if (!(await user.isPasswordMatch(password))) {
    //throw new ApiError(httpStatus.NOT_FOUND, 'Phone number or password is incorrect.');
    const remainingAttempts =
      4 - (await checkExcessiveLoginAttempts(user, 5, StatusEnum.INCORRECT_PASSWORD_OR_EMAIL, userIP));
    // throw new ApiError(
    //   httpStatus.UNAUTHORIZED,
    //   `Incorrect phone number or password, ${remainingAttempts <= 1
    //     ? `Last Attempt!!! Your account will be locked after last incorrect OTP `
    //     : `You have ${remainingAttempts} tries remaining before your account is locked.`
    //   }   `
    // );
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      `${Message.business.incorrectPhoneOrPassword[language]}, ${
        remainingAttempts <= 1
          ? `${Message.business.lastAttemptWarning[language]}`
          : `${Message.business.remainingAttempts[language].replace('<remainingAttempts>', remainingAttempts)}`
      }   `
    );
  }

  // await accountStatusCheck(user);
  await authService.updateUserLastLogin(user);

  const tokens = await tokenService.generateAuthTokens(user);
  await Log.deleteMany({
    userId: user._id,
    $or: [{ status: StatusEnum.INCORRECT_OTP }, { status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL }],
  });
  // await checkUnusualIP(req, user);
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

export const postSuccessLogin = async (user: IUserDoc) => {
  // try{

  if (user?.image) {
    // const [userImage] = await getSignedUrl(user.image);
    // user.image = userImage;
  }
  let myApartment = null;
  if (user.userType === 'renter' && user.apartment && user.apartment.length > 0) {
    const aparment = await apartmentsForRenters(user.apartment as any, user._id);
    myApartment = aparment;
  }

  return { ...user.toObject(), id: user._id, myApartment };
  // }catch(e){
  //   console.log(e, "error is here")
  //   throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong' + e);
  // }
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise<void>}
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
  // cts end
  await Token.deleteMany({ user: new mongoose.Types.ObjectId(refreshTokenDoc.user) });
  return user;
  // await refreshTokenDoc.deleteOne();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<IUserWithTokens>}
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
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export const resetPassword = async (resetPasswordToken: any, newPassword: string): Promise<void> => {
  try {
    const resetPasswordTokenDoc = await verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await getUserById(new mongoose.Types.ObjectId(resetPasswordTokenDoc.user));
    if (!user) {
      throw new ApiError(httpStatus.NOT_ACCEPTABLE, 'Invalid Token');
      await logService.createCustomerLog({
        event: ALL_EVENTS.UserEvents.PasswordResetFailure,
      });
      await logService.createCustomerLog({
        event: ALL_EVENTS.UserEvents.accountRecoveryFailed,
      });
    }
    //this is the first time verification so renter gets renter attachment email
    if (user?.isDefaultPassword && user.userType === 'renter') {
      const aparments = await apartmentsForRenters(user.apartment as any, user._id);
      aparments.map((aparment) => {
        if (aparment?.apartmentComplexName && aparment?.apartment?.apartmentNumber) {
          emailService.sendRenterOnboardAndOffboardEmails(
            {
              apartmentComplexName: aparment?.apartmentComplexName,
              apartmentNumber: aparment?.apartment?.apartmentNumber,
              reason: 'attached',
            },
            user
          );
        }
      });
    }
    await updateUserById(user.id, {
      password: newPassword,
      isVerified: true,
      isTemporaryBlocked: false,
      isDefaultPassword: false,
      temporaryBlockedTill: '',
    });

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
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
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
      // await checkUnusualIP(req, user);

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
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
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
 * request an otp for changing a phone number
 * @param {phoneNumber} phoneNumber
 * @returns {Promise<Otp>}
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
    // throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number in use. Try another number');
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
 * request an otp for changing a phone number
 * @param {phoneNumber} phoneNumber
 * @returns {Promise<Otp>}
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
 * request an otp for changing a phone number
 * @param {phoneNumber} email
 * @param {name} name
 * @returns {Promise<Otp>}
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
 * request an otp for changing a phone number
 * @param {phoneNumber} email
 * @param {name} name
 * @returns {Promise<Otp>}
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
 * request an otp for changing a phone number
 * @param {phoneNumber} email
 * @param {name} name
 * @returns {Promise<Otp>}
 */
export const requestChangeEmailV2 = async (
  email: string,
  name: string,
  user: string,
  userDoc: IUserDoc
): Promise<String | boolean> => {
  if (await User.isEmailTaken(email)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Email already registered'
    );
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
 * @param {string} verifyEmailToken
 * @returns {Promise<IUserDoc | null>}
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

    const updatedUser = await updateUserById(user.id, payload, preferredLanguage);
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

export const getSocketIdByUserId = async (userId: string) => {
  const result = await User.findById(userId).select(['socketId']);
  console.log('result?.socketId :', result?.socketId);
  return result?.socketId;
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise<void>}
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
    firstName; lastName;
    phoneNumber;
    if (
      !user?.isDefaultPassword ||
      // (user.firstName !== '-' && user.lastName !== '-') ||
      moment().diff(moment(user.createdAt), 'hours') > 8
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'The service you are requesting cannot be fulfilled');
    }

    // if (firstName === '-' || lastName === '-') {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'First Name and Last name must be valid');
    // }
    //this is the first time verification so renter gets renter attachment email

    await updateUserById(user.id, {
      password: newPassword,
      isVerified: true,
      // phoneNumber,
      isTemporaryBlocked: false,
      isDefaultPassword: false,
      temporaryBlockedTill: '',
      // firstName,
      // lastName,
    });

    // TODO logs
  } catch (error: any) {
    throw new ApiError(httpStatus.UNAUTHORIZED, error?.message || 'Password reset failed');
  }
};
