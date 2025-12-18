import { AccessAndRefreshTokens, ITokenDoc } from './token.interfaces';
import moment, { Moment } from 'moment';

import ApiError from '../errors/ApiError';
import { IUserDoc } from '../user/user.interfaces';
import { Message } from '../utils/errorMessage';
import Token from './token.model';
import config from '../../config/config';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { tokenService } from '.';
import tokenTypes from './token.types';
import { userService } from '../user';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate token
 * @param {mongoose.Types.ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
export const generateToken = (
  userId: mongoose.Types.ObjectId,
  expires: Moment,
  type: string,
  secret: string = config.jwt.secret,
  additionalPayload?: any
): string => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
    ...additionalPayload,
  };
  return jwt.sign(payload, secret);
};

/**
 * Generate token
 * @param {string} phoneNumber
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
export const generateURLToken = (
  details: { phoneNumber: string; siteId: string },
  expires: Moment,
  type: string,
  secret: string = config.jwt.secret
): string => {
  const payload = {
    sub: details,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Generate token
 * @param {string} phoneNumber
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
export const generateURLTokenForLink = (
  details: { phoneNumber: string; linkId: string },
  expires: Moment,
  type: string,
  secret: string = config.jwt.secret
): string => {
  const payload = {
    sub: details,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Generate token
 * @param {string} phoneNumber
 * @param {Moment} expires
 * @param {string} type
 * @param {string} [secret]
 * @returns {string}
 */
export const generateUnsubToken = (
  details: { contactInfo: string; source: 'EMAIL_API' | 'SMS_SHARING_API' },
  expires: Moment,
  type: 'EMAIL' | 'SMS'
): string => {
  const secret: string = config.jwt.secret;
  const payload = {
    sub: details,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a token
 * @param {string} token
 * @param {mongoose.Types.ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<ITokenDoc>}
 */
export const saveURLToken = async (
  token: string,
  expires: Moment,
  type: string,
  blacklisted: boolean = false,
  attempts: number = 3
): Promise<ITokenDoc> => {
  const tokenDoc = await Token.create({
    token,
    user: new mongoose.Types.ObjectId('6554bc5ebfa21da4c7d1a6f1'),
    expires: expires.toDate(),
    type,
    blacklisted,
    attempts,
  });
  return tokenDoc;
};

/**
 * Save a token
 * @param {string} token
 * @param {mongoose.Types.ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<ITokenDoc>}
 */
export const saveToken = async (
  token: string,
  userId: mongoose.Types.ObjectId,
  expires: Moment,
  type: string,
  blacklisted: boolean = false,
  attempts: number = 3,
  additionalInfo: Object = {}
): Promise<ITokenDoc> => {
  const tokenDoc = await Token.create({
    token,
    user: userId,
    expires: expires.toDate(),
    type,
    blacklisted,
    attempts,
    additionalInfo,
  });
  return tokenDoc;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<ITokenDoc>}
 */
export const verifyToken = async (token: string, type: string): Promise<ITokenDoc & { email?: string }> => {
  // try {
  const payload = jwt.verify(token, config.jwt.secret);
  if (typeof payload.sub !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'bad user');
  }

  const tokenDoc = await Token.findOne({
    token,
    type,
    user: payload.sub,
    blacklisted: false,
  });
  if (!tokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Token not found or expired');
  }

  if (tokenDoc?.attempts === 0) {
    throw new ApiError(httpStatus.FORBIDDEN, 'No attempts left for the token.');
  }
  return { ...tokenDoc.toObject(), email: (payload as any)?.email } as any;
  // } catch (e: any) {
  //   console.log(e);
  //   throw new ApiError(
  //     httpStatus.INTERNAL_SERVER_ERROR,
  //     e?.message === 'jwt expired'
  //       ? 'Token has been expired, kindly request a new one'
  //       : e?.message || 'Verification timedout'
  //   );
  // }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<ITokenDoc>}
 */
export const decodeToken = async (token: string): Promise<any> => {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const tokenDoc = await Token.findOne({
      token,
      type: tokenTypes.UNIQUE_URL_TOKEN,
      blacklisted: false,
    });
    if (!tokenDoc) {
      return false;
    }
    // await Token.updateOne({ token }, { blacklisted: true });
    return payload;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.EXPECTATION_FAILED, e.message === 'jwt expired' ? 'Unique Url Expired' : e.message);
  }
};

/**
 * Generate auth tokens
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const generateAuthTokens = async (user: IUserDoc): Promise<AccessAndRefreshTokens> => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: {
      token: accessToken,
      expires: new Date(accessTokenExpires.toDate()).toISOString(),
    },
    refresh: {
      token: refreshToken,
      expires: new Date(refreshTokenExpires.toDate()).toISOString(),
    },
  };
};

/**
 * Generate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const generateEmailSetToken = async (user: IUserDoc, expiresIn: number): Promise<string> => {
  const emailSetTokenExpires = moment().add(expiresIn ?? 168 * 60, 'minutes');
  const token = `${uuidv4()}`;
  await Token.updateMany(
    {
      $and: [
        { user: user?.id },
        { type: tokenTypes.EMAIL_SET_TOKEN },
        { blacklisted: false }, // Check if the token is not blacklisted
      ],
    },
    { blacklisted: true }
  );
  await saveToken(token, user.id, emailSetTokenExpires, tokenTypes.EMAIL_SET_TOKEN);

  return token;
};

/**
 * validate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const validateEmailSetToken = async (token: string, language: string): Promise<ITokenDoc> => {
  try {
    const tokenDetails = await Token.findOne({
      $and: [{ token }],
    });
    if (!tokenDetails?.user) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        Message.partnerAuth.invalidToken[language],
        true,
        '',
        Message.partnerAuth.invalidToken['english']
      );
    }
    const user = await userService.getUserById(new mongoose.Types.ObjectId(tokenDetails?.user));
    if (user?.isVerified) {
      return tokenDetails as any;
    }

    if (tokenDetails?.attempts <= 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        Message.partnerAuth.invalidTokenAndExpired[language],
        true,
        '',
        Message.partnerAuth.invalidTokenAndExpired['english']
      );
    }

    const createdAt = new Date((tokenDetails as any)?.createdAt);

    createdAt.setMinutes(createdAt.getMinutes() + 10080);
    if (new Date() > createdAt) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        Message.partnerAuth.invalidTokenAndExpired[language],
        true,
        '',
        Message.partnerAuth.invalidTokenAndExpired['english']
      );
    }

    return tokenDetails;
  } catch (E) {
    console.log(E);
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidTokenAndExpired[language],
      true,
      '',
      Message.partnerAuth.invalidTokenAndExpired['english']
    );
  }
};

/**
 * Generate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const generateEmailSetTokenPrePhoneVerified = async (user: IUserDoc, expiresIn: number): Promise<string> => {
  const emailSetTokenExpires = moment().add(expiresIn ?? 168 * 60, 'minutes');

  await Token.updateMany(
    {
      $and: [
        { user: user?.id },
        { type: tokenTypes.EMAIL_SET_TOKEN_PRE_PHONE_VERIFIED },
        { blacklisted: false }, // Check if the token is not blacklisted
      ],
    },
    { blacklisted: true }
  );

  await Token.updateMany(
    {
      $and: [
        { user: user?.id },
        { type: tokenTypes.VERIFY_EMAIL },
        { blacklisted: false }, // Check if the token is not blacklisted
      ],
    },
    { blacklisted: true }
  );
  const token = `${uuidv4()}`;

  await saveToken(token, user.id, emailSetTokenExpires, tokenTypes.EMAIL_SET_TOKEN_PRE_PHONE_VERIFIED);

  return token;
};

/**
 * validate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const validateEmailSetTokenPrePhoneOTP = async (token: string, preferredLanguage: string): Promise<ITokenDoc> => {
  const tokenDetails = await Token.findOne({
    $and: [{ token }, { type: tokenTypes?.EMAIL_SET_TOKEN_PRE_PHONE_VERIFIED }],
  });

  if (!tokenDetails?.user || tokenDetails?.type !== tokenTypes?.EMAIL_SET_TOKEN_PRE_PHONE_VERIFIED) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidToken[preferredLanguage],
      true,
      '',
      Message.partnerAuth.invalidToken['english']
    );
  }

  // if a verification link is already sent so we return the token details and show the user a success message to check their email
  const verificationTokenDetails = await tokenService.getLatestVerificationLink(tokenDetails?._id);
  if (verificationTokenDetails?.user) {
    return tokenDetails as any;
  }

  // checking if user is already verified
  const user = await userService.getUserById(new mongoose.Types.ObjectId(tokenDetails?.user));
  if (user?.isVerified) {
    return tokenDetails as any;
  }

  if (tokenDetails?.attempts <= 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidTokenAndExpired[preferredLanguage],
      true,
      '',
      Message.partnerAuth.invalidTokenAndExpired['english']
    );
  }

  const createdAt = new Date((tokenDetails as any).createdAt);
  createdAt.setMinutes(createdAt.getMinutes() + 10);
  // checking 10 minutes
  if (new Date() > createdAt) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidTokenAndExpired[preferredLanguage],
      true,
      '',
      Message.partnerAuth.invalidTokenAndExpired['english']
    );
  }

  if (tokenDetails?.blacklisted) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      Message.partnerAuth.invalidToken[preferredLanguage],
      true,
      '',
      Message.partnerAuth.invalidToken['english']
    );
  }

  return tokenDetails;
};

/**
 * validate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const decreaseTokenAttempt = async (token: string) => {
  return await Token.findOneAndUpdate(
    {
      token,
    },
    {
      $inc: { attempts: -1 }, // Decrement numberField by 1
    }
  );
};

/**
 * validate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const getLatestVerificationLink = async (user: string): Promise<any> => {
  const tokenDetails = await Token.findOne({
    $and: [{ user }, { type: tokenTypes.VERIFY_EMAIL }, { blacklisted: false }],
  });

  return tokenDetails;
};

/**
 * validate token for setting email
 * @param {IUserDoc} user
 * @returns {Promise<AccessAndRefreshTokens>}
 */
export const inValidateEmailSetToken = async (token: string): Promise<any> => {
  return await Token.findOneAndUpdate(
    {
      $and: [
        { token },
        { expires: { $gt: new Date().toISOString() } }, // Check if expiration time is in the future
        { blacklisted: false }, // Check if the token is not blacklisted
      ],
    },
    { blacklisted: true }
  );
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
export const generateEmailLoginAttemptToken = async (email: string): Promise<string> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }
  await Token.deleteMany({ user: user.id, type: tokenTypes.EMAIL_LOGIN_ATTEMPT });

  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const emailLoginAttemptToken = generateToken(user.id, expires, tokenTypes.EMAIL_LOGIN_ATTEMPT);
  await saveToken(emailLoginAttemptToken, user.id, expires, tokenTypes.EMAIL_LOGIN_ATTEMPT);
  return emailLoginAttemptToken;
};

/**
 * Generate One time  unique URL
 * @param {string} phonenumber
 * @returns {Promise<string>}
 */
export const generateOneTimeUniqueURLToken = async (details: { phoneNumber: string; siteId: string }): Promise<string> => {
  const expires = moment().add(24, 'hours');
  const oneTimeUniqueURLToken = generateURLToken(details, expires, tokenTypes.UNIQUE_URL_TOKEN);
  await saveURLToken(oneTimeUniqueURLToken, expires, tokenTypes.UNIQUE_URL_TOKEN);
  return oneTimeUniqueURLToken;
};

/**
 * Generate One time  unique URL for Link
 * @param {string} phonenumber
 * @returns {Promise<string>}
 */
export const generateOneTimeUniqueURLTokenForLink = async (details: {
  phoneNumber: string;
  linkId: string;
}): Promise<string> => {
  const expires = moment().add(24, 'hours');
  const oneTimeUniqueURLToken = generateURLTokenForLink(details, expires, tokenTypes.UNIQUE_URL_TOKEN);
  await saveURLToken(oneTimeUniqueURLToken, expires, tokenTypes.UNIQUE_URL_TOKEN);
  return oneTimeUniqueURLToken;
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
export const updateEmailLoginAttemptToken = async (token: string): Promise<ITokenDoc | null> => {
  return await Token.findOneAndUpdate({ token }, { $inc: { attempts: -1 } });
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
export const generateResetPasswordToken = async (email: string, expiry?: number): Promise<string> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }
  const expires = moment().add(expiry || config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate reset password token
 * @param {string} email
 * @returns {Promise<string>}
 */
export const generatePromteDemoteToken = async (
  email: string,
  expiry?: number,
  additionalInfo?: Object
): Promise<string> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }
  const expires = moment().add(expiry || config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const existingToken = await Token.findOne({
    user: user.id,
    type: tokenTypes.PROMTE_DEMOTE_USER,
    blacklisted: false, // Check if the token is not blacklisted
    expires: { $gt: new Date() }, // Check if expiration time is in the
  });
  if (existingToken) {
    return existingToken.token;
  }
  const promoteDemoteToken = generateToken(user.id, expires, tokenTypes.PROMTE_DEMOTE_USER);
  await saveToken(promoteDemoteToken, user.id, expires, tokenTypes.PROMTE_DEMOTE_USER, false, 1, additionalInfo);
  return promoteDemoteToken;
};

/**
 * Generate reset password token
 * @param {string} phoneNumber
 * @returns {Promise<string>}
 */
export const generateResetPasswordTokenByPhone = async (phoneNumber: string, _: string): Promise<string> => {
  const user = await userService.getUserByPhone(phoneNumber);
  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetPasswordToken = generateToken(user.id, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetPasswordToken, user.id, expires, tokenTypes.RESET_PASSWORD);
  return resetPasswordToken;
};

/**
 * Generate verify email token
 * @param {IUserDoc} user
 * @returns {Promise<string>}
 */
export const generateVerifyEmailToken = async (user: IUserDoc, email: string): Promise<string> => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.id, expires, tokenTypes.VERIFY_EMAIL, config.jwt.secret, { email });
  await saveToken(verifyEmailToken, user.id, expires, tokenTypes.VERIFY_EMAIL);
  return verifyEmailToken;
};

/**
 * Generate account setup token (for one-time setup link)
 * Token is valid until the user completes account setup (no expiry by default)
 * @param {IUserDoc} user
 * @param {number} expiryDays - Number of days until token expires (default: 365 days)
 * @returns {Promise<string>}
 */
export const generateAccountSetupToken = async (user: IUserDoc, expiryDays: number = 365): Promise<string> => {
  // Check if an active account setup token already exists for this user
  const existingToken = await Token.findOne({
    user: user.id,
    type: tokenTypes.ACCOUNT_SETUP,
    expires: { $gt: new Date() },
    blacklisted: false,
  });
  
  if (existingToken) {
    return existingToken.token;
  }
  
  const expires = moment().add(expiryDays, 'days');
  const accountSetupToken = generateToken(user.id, expires, tokenTypes.ACCOUNT_SETUP);
  await saveToken(accountSetupToken, user.id, expires, tokenTypes.ACCOUNT_SETUP);
  return accountSetupToken;
};

/**
 * Verify account setup token
 * @param {string} token
 * @returns {Promise<IUserDoc>}
 */
export const verifyAccountSetupToken = async (token: string): Promise<IUserDoc> => {
  const tokenDoc = await verifyToken(token, tokenTypes.ACCOUNT_SETUP);
  const user = await userService.getUserById(new mongoose.Types.ObjectId(tokenDoc.user));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

/**
 * Invalidate account setup token after successful setup
 * @param {string} token
 */
export const invalidateAccountSetupToken = async (token: string): Promise<void> => {
  await Token.updateOne(
    { token, type: tokenTypes.ACCOUNT_SETUP },
    { blacklisted: true }
  );
};

export const inviteUser = async (
  email: string,
  towCompanyId: string,
  userId: string,
  otherInfo: any,
  phoneNumber: string,
  contactMethod: 'email' | 'phone' = 'email',
  inviterDetails?: { inviterName?: string; towCompanyName?: string }
): Promise<{ token: string; expires: string }> => {
  // Validate that both email and phone number are provided
  if (!email || !phoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Both email and phone number are required');
  }

  // ✅ Check if an active invite already exists for this email or phone number
  const existingInvite = await Token.findOne({
    type: tokenTypes.TOW_REQUEST_INVITE,
    expires: { $gt: new Date() }, // not expired
    blacklisted: false,
    $or: [{ 'additionalInfo.email': email }, { 'additionalInfo.phoneNumber': phoneNumber }],
  });
  if (existingInvite) {
    // throw new ApiError(
    //   httpStatus.CONFLICT,
    //   `An invite has already been sent to ${email} or ${phoneNumber}. Please wait until it expires (1 Hour) before sending another.`
    // );

    return {
      token: existingInvite.token,
      expires: existingInvite.expires,
    }
  }

  // generate a 4-char token
  const token = uuidv4().slice(0, 4).toUpperCase();
  const expires = moment().add(1, 'hour'); // ⬅️ same as 24*7 hours

  await Token.create({
    token,
    user: userId,
    type: tokenTypes.TOW_REQUEST_INVITE,
    expires: expires.toDate(),
    blacklisted: false,
    attempts: 1,
    additionalInfo: { 
      email, 
      phoneNumber, 
      towCompanyId, 
      userId,
      contactMethod,
      ...(inviterDetails?.inviterName && { inviterName: inviterDetails.inviterName }),
      ...(inviterDetails?.towCompanyName && { towCompanyName: inviterDetails.towCompanyName }),
      ...(otherInfo?.firstName ? { ...otherInfo } : {}) 
    },
  });

  return { token, expires: expires.toDate().toISOString() };
};


/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<ITokenDoc>}
 */
export const fetchAndInvalidateInviteUserToken = async (token: string): Promise<any> => {
  try {
    const tokenDoc = await Token.findOne({
      token,
      type: tokenTypes.TOW_REQUEST_INVITE,
      blacklisted: false,
    });
    if (!tokenDoc) {
      return false;
    }
    await Token.updateOne({ token }, { blacklisted: true });
    return tokenDoc;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.EXPECTATION_FAILED, e.message === 'jwt expired' ? 'link expired' : e.message);
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<ITokenDoc>}
 */
export const fetchInviteUserTokenDetails = async (token: string) => {
  try {
    const tokenDoc = await Token.findOne({
      token,
      type: tokenTypes.TOW_REQUEST_INVITE,
    });

    // await Token.updateOne({ token }, { blacklisted: true });
    return tokenDoc;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.EXPECTATION_FAILED, e.message === 'jwt expired' ? 'link expired' : e.message);
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<ITokenDoc>}
 */
export const markTokenAsDiscarded = async (token: string) => {
  try {
    const tokenDoc = await Token.findOne({
      token,
      type: tokenTypes.TOW_REQUEST_INVITE,
    });

    await Token.updateOne({ token }, { blacklisted: true });
    return tokenDoc;
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.EXPECTATION_FAILED, e.message === 'jwt expired' ? 'link expired' : e.message);
  }
};
