import { IOtpDoc, IOtpType, ISendOtp, NewOtp } from './otp.interfaces';
import { checkExcessiveLoginAttempts, localesShortForm } from '../auth/auth.helper';
import { partnerAccountCreation, postSuspensionMessage, reminder, verificationLinkToPhone } from './otp.util';
import { sendChangeEmail, sendChangeEmailNew, sendChangeEmailOld, sendLoginOtp, sendSetEmail } from '../email/email.service';

import { ALL_EVENTS } from '../utils/events';
import { ApiError } from '../errors';
import FormData from 'form-data';
import { IUserDoc } from '../user/user.interfaces';
import { Message } from '../utils/errorMessage';
import Otp from './otp.model';
import { StatusEnum } from '../logs/log.interfaces';
// import { User } from '../user';
import config from '../../config/config';
// Using built-in fetch (Node.js 18+)
import formatPhoneNumber from '../utils/phoneNumberUtil';
import { getCountryCodeFromPhonenumber } from '../validate/custom.validation';
import { getUserLanguage } from '../utils/languageUtil';
import httpStatus from 'http-status';
import { logService } from '../logs';
import moment from 'moment';
import mongoose from 'mongoose';
import otpGenerate from 'otp-generator';
import { sendSMS } from '../sms/sms.service';
import { tokenService } from '../token';

/**
 * Save a token
 * @param {string} otp
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @param {mongoose.ObjectId} user
 * @returns {Promise<IOtpDoc>}
 */
export const saveOtp = async (data: NewOtp & { type: IOtpType; expires?: number }): Promise<IOtpDoc> => {
  const { phoneNumber, otp, type, user, email } = data;
  await Otp.deleteMany({
    user: new mongoose.Types.ObjectId(user),
    type,
  });

  const otpDoc = await Otp.create({
    otp,
    phoneNumber: phoneNumber ? formatPhoneNumber(phoneNumber) : phoneNumber,
    user,
    email,
    expires: new Date(
      moment()
        .add(60 * (data?.expires || 5), 'seconds')
        .toDate()
    ).toISOString(),
    blacklisted: false,
    type,
  });
  return otpDoc;
};

function isOtpExpired(expiresAt: string) {
  const otpExpirationTime = moment(expiresAt); // assuming OTP expires in 5 minutes
  const now = moment();
  return now.isAfter(otpExpirationTime);
}

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} phoneNumber
 * @param {string} otp
 * @returns {Promise<IOtpDoc>}
 */
export const verifyOtp = async (
  email: string,
  otp: string,
  type: IOtpType,
  status?: StatusEnum,
  user?: IUserDoc,
  userIP?: string,
  maxAttempts?: number,
  userLanguage?: string
): Promise<boolean> => {
  const preferredLanguage = userLanguage ?? user?.preferredLanguage;

  const logFailedEvent = async () => {
    if (user && maxAttempts && userIP && status) {
      return await checkExcessiveLoginAttempts(user, maxAttempts, status, userIP, preferredLanguage);
    }
    return 0;
  };
  const otpDoc = await Otp.findOne({
    otp,
    // phoneNumber,
    blacklisted: false,
    type,
    ...(type === 'changeEmail' || type === 'changeEmailNew' || type === 'changeEmailOld' ? { email } : { email }),
  });

  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;

  if (!otpDoc) {
    if (type !== 'login' && type !== 'phoneVerificationBeforeEmailSet') {
      // throw new ApiError(httpStatus.NOT_FOUND, `Invalid OTP, Process failed `);
      throw new ApiError(httpStatus.NOT_FOUND, Message.business.invalidOTPProcessFailed[language]);
    } else {
      const remainingAttempts = 2 - (await logFailedEvent());
      // throw new ApiError(
      //   httpStatus.NOT_FOUND,
      //   `Invalid OTP, ${remainingAttempts <= 1
      //     ? `Last Attempt!!! Your account will be locked after last incorrect OTP `
      //     : `You have ${remainingAttempts - 1} tries remaining before your account is locked.`
      //   }   `
      // );

      throw new ApiError(
        httpStatus.NOT_FOUND,
        `${Message.business.invalidOTP[language]}, ${
          remainingAttempts <= 1
            ? `${Message.business.lastAttemptWarning[language]}`
            : `${Message.business.remainingAttempts[language].replace('<remainingAttempts>', remainingAttempts)}`
        }   `
      );
    }

    return false;
  }
  if (isOtpExpired(otpDoc.expires)) {
    if (type !== 'verifyAccount') {
      await logService.createLog({ user: user!, event: ALL_EVENTS.clientEvents.notVerifiedOtp, eventEnum: 'CE' });
    } else {
      await logFailedEvent();
    }
    // throw new Error('Otp expired request new otp');
    // throw new Error(Message.business.otpExpiredRequestNewOTP[language]);
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.otpExpiredRequestNewOTP[language]);

    return false;
  }
  await otpDoc.updateOne({ blacklisted: true });
  return true;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} phoneNumber
 * @param {string} otp
 * @returns {Promise<IOtpDoc>}
 */
export const verifyOtpV2 = async (
  email: string,
  otp: string,
  type: IOtpType,
  status?: StatusEnum,
  user?: IUserDoc,
  userIP?: string,
  maxAttempts?: number,
  userLanguage?: string
): Promise<boolean> => {
  const preferredLanguage = userLanguage ?? user?.preferredLanguage;

  const logFailedEvent = async () => {
    if (user && maxAttempts && userIP && status) {
      return await checkExcessiveLoginAttempts(user, maxAttempts, status, userIP, preferredLanguage);
    }
    return 0;
  };
  const otpDoc = await Otp.findOne({
    otp,
    // phoneNumber,
    blacklisted: false,
    type,
    ...(type === 'changeEmail' || type === 'changeEmailNew' || type === 'changeEmailOld' ? { email } : { email }),
  });

  const language: string = !preferredLanguage || preferredLanguage == 'false' ? 'english' : preferredLanguage;

  if (!otpDoc) {
    if (type !== 'login' && type !== 'phoneVerificationBeforeEmailSet') {
      // throw new ApiError(httpStatus.NOT_FOUND, `Invalid OTP, Process failed `);
      throw new ApiError(httpStatus.NOT_FOUND, Message.business.invalidOTPProcessFailed[language]);
    } else {
      const remainingAttempts = 2 - (await logFailedEvent());
      // throw new ApiError(
      //   httpStatus.NOT_FOUND,
      //   `Invalid OTP, ${remainingAttempts <= 1
      //     ? `Last Attempt!!! Your account will be locked after last incorrect OTP `
      //     : `You have ${remainingAttempts - 1} tries remaining before your account is locked.`
      //   }   `
      // );

      throw new ApiError(
        httpStatus.NOT_FOUND,
        `${Message.business.invalidOTP[language]}, ${
          remainingAttempts <= 1
            ? `${Message.business.lastAttemptWarning[language]}`
            : `${Message.business.remainingAttempts[language].replace('<remainingAttempts>', remainingAttempts)}`
        }   `
      );
    }

    return false;
  }
  if (isOtpExpired(otpDoc.expires)) {
    if (type !== 'verifyAccount') {
      await logService.createLog({ user: user!, event: ALL_EVENTS.clientEvents.notVerifiedOtp, eventEnum: 'CE' });
    } else {
      await logFailedEvent();
    }
    // throw new Error('Otp expired request new otp');
    // throw new Error(Message.business.otpExpiredRequestNewOTP[language]);
    throw new ApiError(httpStatus.NOT_FOUND, Message.business.otpExpiredRequestNewOTP[language]);

    return false;
  }
  return true;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} phoneNumber
 * @param {string} otp
 * @returns {Promise<IOtpDoc>}
 */
export const blackListOTP = async (email: string, otp: string, type: IOtpType): Promise<boolean> => {
  const otpDoc = await Otp.findOne({
    otp,
    // phoneNumber,
    blacklisted: false,
    type,
    ...(type === 'changeEmail' || type === 'changeEmailNew' || type === 'changeEmailOld' ? { email } : { email }),
  });

  if (!otpDoc) {
    return false;
  }

  await otpDoc.updateOne({ blacklisted: true });
  return true;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} phoneNumber
 * @param {string} otp
 * @returns {Promise<IOtpDoc>}
 */
export const verifyPhoneTokenOtp = async (phoneNumber: string, otp: string, type: IOtpType): Promise<boolean> => {
  const otpDoc = await Otp.findOne({
    otp,
    // phoneNumber,
    blacklisted: false,
    type,
    ...(type === 'setEmail' ? { email: phoneNumber } : { phoneNumber: formatPhoneNumber(phoneNumber) }),
  });

  if (!otpDoc) {
    return false;
  }

  if (isOtpExpired(otpDoc.expires)) {
    return false;
  }

  await otpDoc.updateOne({ blacklisted: true });

  return true;
};

/**
 * Send OTP for phone number verification via SMS
 * @param {string} phoneNumber - The phone number to send OTP to
 * @param {IUserDoc} userDoc - The user document
 * @returns {Promise<string>} - The generated OTP
 */
export const sendPhoneVerificationOtp = async (phoneNumber: string, userDoc: IUserDoc): Promise<string> => {
  const otp = otpGenerate.generate(4, {
    digits: true,
    lowerCaseAlphabets: false,
    specialChars: false,
    upperCaseAlphabets: false,
  });

  // Delete any existing OTPs for this user and type
  await Otp.deleteMany({
    user: new mongoose.Types.ObjectId(userDoc.id || userDoc._id),
    type: 'phoneNumberVerification',
  });

  // Save the new OTP with 5 minute expiration
  await Otp.create({
    otp,
    phoneNumber: formatPhoneNumber(phoneNumber),
    user: userDoc.id || userDoc._id,
    expires: new Date(moment().add(5, 'minutes').toDate()).toISOString(),
    blacklisted: false,
    type: 'phoneNumberVerification',
  });

  // Send OTP via SMS using Twilio
  const userName = userDoc.fullName || userDoc.firstName || 'there';
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  const message = `Hi ${userName}, ${otp} is your Phone Number Verification code: 

This code will expire in 5 minutes.

If you did not request this code, please ignore this message.

Thank you for using HITS Towing Manager!`;

  await sendSMS({ to: formattedPhone, body: message }, userDoc, userName);

  console.log('Phone verification OTP sent:', otp);
  return otp;
};

/**
 * Verify phone number OTP
 * @param {string} phoneNumber - The phone number to verify
 * @param {string} otp - The OTP to verify
 * @param {IUserDoc} userDoc - The user document
 * @returns {Promise<boolean>} - Whether the OTP is valid
 */
export const verifyPhoneNumberOtp = async (phoneNumber: string, otp: string, userDoc: IUserDoc): Promise<boolean> => {
  const otpDoc = await Otp.findOne({
    otp,
    phoneNumber: formatPhoneNumber(phoneNumber),
    user: new mongoose.Types.ObjectId(userDoc.id || userDoc._id),
    blacklisted: false,
    type: 'phoneNumberVerification',
  });

  if (!otpDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Invalid OTP. Please try again.');
  }

  // Check if OTP has expired
  const otpExpirationTime = moment(otpDoc.expires);
  const now = moment();
  if (now.isAfter(otpExpirationTime)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'OTP has expired. Please request a new one.');
  }

  // Blacklist the OTP so it can't be used again
  await otpDoc.updateOne({ blacklisted: true });

  return true;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendOtp = async (data: ISendOtp & { userDoc: IUserDoc }): Promise<boolean | string> => {
  const { type, email, userDoc } = data;

  let otp = '';

  otp = otpGenerate.generate(4, {
    digits: true,
    lowerCaseAlphabets: false,
    specialChars: false,
    upperCaseAlphabets: false,
  });

  if (type === 'changeEmailOld') {
    await sendChangeEmailOld(email!, otp, data.name!, userDoc);
  } else if (type === 'changeEmailNew') {
    await sendChangeEmailNew(email!, otp, data.name!, userDoc);
  } else if (type === 'changeEmail') {
    await sendChangeEmail(email!, otp, data.name!, userDoc);
  } else if (type === 'setEmail') {
    await sendSetEmail(email!, otp, data.name!, userDoc);
  } else {
    // if (!phoneNumber) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
    // }
    // let message = generalOTP(language.fullForm, otp).content;
    // if (type === 'verifyAccount') {
    //   message = ClientVerification(otp, language.fullForm);
    // }

    // if (type === 'setEmailPhoneVerification') {
    //   message = ClientVerification(otp, language.fullForm);
    // }
    // if (type === 'phoneVerificationBeforeEmailSet') {
    //   message = PartnerVerification(otp, language.fullForm);
    // }

    await sendLoginOtp(email!, otp, data.name!, userDoc);

    // if (!isMessageSent) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'System is not able to deliver otp at this moment. please try again later');
    // }
    if (type === 'changePhoneNumber') {
      // await logService.createCommunicationLog({
      //   user: userDoc!,
      //   event: ALL_EVENTS.userCommunication.sms[type],
      //   receiverDetails: {
      //     content: message,
      //     sentTo: phoneNumber,
      //     type: 'phoneNumber',
      //     name: userDoc.fullName!,
      //   },
      // });
    } else if (type === 'setEmailPhoneVerification') {
      // await logService.createCommunicationLog({
      //   user: userDoc!,
      //   event: ALL_EVENTS.userCommunication.sms.accountVerificationSMSOTP,
      //   receiverDetails: {
      //     content: message,
      //     sentTo: phoneNumber,
      //     type: 'phoneNumber',
      //     name: userDoc.fullName!,
      //   },
      // });
    }
  }

  if (data?.name) delete data.name;

  await saveOtp({ ...data, otp, expires: type === 'phoneVerificationBeforeEmailSet' ? 10 : 5 });
  console.log('the otp is ', otp);
  return otp;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendEmailSetLink = async (
  data: { phoneNumber: string; reminderNumber: number; expiry: number } & { userDoc: IUserDoc }
) => {
  const { phoneNumber, userDoc, reminderNumber, expiry } = data;
  const token = await tokenService.generateEmailSetToken(userDoc, expiry);
  const languageShortForm = (localesShortForm as any)[data?.userDoc?.preferredLanguage || 'english'] || 'en';

  const verificationLink = `${config.clientUrl}/set-email/${token}?lang=${languageShortForm}`;
  const language = await getUserLanguage(data.userDoc);

  if (phoneNumber) {
    const message = reminder(language.fullForm, reminderNumber, verificationLink)?.content;
    const isMessageSent = await sendMessage(phoneNumber, message);

    if (isMessageSent) {
      // await logService.createCommunicationLog({
      //   user: userDoc!,
      //   event: ALL_EVENTS.userCommunication.sms.emailSetLink,
      //   receiverDetails: {
      //     content: message,
      //     sentTo: phoneNumber,
      //     type: 'phoneNumber',
      //     name: userDoc.fullName!,
      //   },
      // });
    }
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendEmailSetLinkViaPhone = async (
  data: { phoneNumber: string; reminderNumber: number; expiry: number } & { userDoc: IUserDoc }
) => {
  const { phoneNumber, userDoc, reminderNumber, expiry } = data;
  const token = await tokenService.generateEmailSetToken(userDoc, expiry);
  const languageShortForm = (localesShortForm as any)[data?.userDoc?.preferredLanguage || 'english'] || 'en';

  const verificationLink = `${config.clientUrl}/set-email/${token}?lang=${languageShortForm}`;
  const language = await getUserLanguage(data.userDoc);

  if (phoneNumber) {
    const message = verificationLinkToPhone(language.fullForm, reminderNumber, verificationLink)?.content;
    const isMessageSent = await sendMessage(phoneNumber, message);

    if (isMessageSent) {
      // await logService.createCommunicationLog({
      //   user: userDoc!,
      //   event: ALL_EVENTS.userCommunication.sms.emailSetLinkRequest,
      //   receiverDetails: {
      //     content: message,
      //     sentTo: phoneNumber,
      //     type: 'phoneNumber',
      //     name: userDoc.fullName!,
      //   },
      // });
    }
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendPartnerAccountCreation = async (
  data: { phoneNumber: string; reminderNumber: number; expiry: number } & { userDoc: IUserDoc }
) => {
  const { phoneNumber, userDoc, expiry } = data;
  const token = await tokenService.generateEmailSetToken(userDoc, expiry);
  const language = await getUserLanguage(data.userDoc);
  const languageShortForm = (localesShortForm as any)[data?.userDoc?.preferredLanguage || 'english'] || 'en';
  const verificationLink = `${config.clientUrl}/set-email/${token}?lang=${languageShortForm}`;
  if (phoneNumber) {
    const message = ` ${partnerAccountCreation(language.fullForm)?.content}
    ${verificationLink} ${` `}
    `;
    await sendMessage(phoneNumber, message);
  }
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendSuspendedAccountAlert = async (data: { phoneNumber: string; userDoc: IUserDoc }) => {
  const { phoneNumber, userDoc } = data;
  const language = await getUserLanguage(data.userDoc);

  if (phoneNumber) {
    const message = postSuspensionMessage(userDoc.fullName!, language.fullForm);
    const isMessageSent = await sendMessage(phoneNumber, message);

    if (isMessageSent) {
      // await logService.createCommunicationLog({
      //   user: userDoc!,
      //   event: ALL_EVENTS.userCommunication.sms.accountSuspendingSMS,
      //   receiverDetails: {
      //     content: message,
      //     sentTo: phoneNumber,
      //     type: 'phoneNumber',
      //     name: userDoc.fullName!,
      //   },
      // });
    }
  }
};

/**
 * Send SMS message to a phone number
 * @param {string} phoneNumber - The phone number to send the message to
 * @param {string} message - The message body
 * @returns {Promise<boolean>} - True if message was sent successfully
 */
export const sendMessage = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!phoneNumber || !message) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number and message body is required');
  }

  // Check if SMS host URL is properly configured
  if (!config.smsHostUrl || !config.smsHostUrl.startsWith('http')) {
    console.warn('[SMS] SMS host URL not configured. Skipping SMS send. Message:', message, 'Phone:', phoneNumber);
    // In development, return true to allow flow to continue
    // In production, you might want to throw an error instead
    return true;
  }

  try {
    const formData = new FormData();
    const phoneNUmber = phoneNumber?.replace('+', '');
    formData.append('phone_number', `+${phoneNUmber}`);
    const countryCode = getCountryCodeFromPhonenumber(`+${phoneNUmber}`);
    formData.append('country_code', countryCode);

    formData.append('message', message);
    const response = await fetch(`${config.smsHostUrl}`, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
        // 'x-api-key': config.arubaAPIKey, // Add your API key here
      },
    });

    const res = (await response.json()) as any;
    if (res?.success !== 'true') {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'System is not able to send you message at this moment. please try again later'
      );
      return false;
    }
  } catch (e) {
    console.log(e, 'error');
    // throw new ApiError(httpStatus.BAD_REQUEST, "Unable to send OTP ATM")
    return false;
  }
  return true;
};

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string email or phoneNumber} phoneNumber
 * @param {name} name
 * @returns {Promise<IOtpDoc>}
 */
export const sendOTPExternalAPIRequest = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!phoneNumber || !message) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number and message body is required');
  }

  const formData = new FormData();
  const phoneNUmber = phoneNumber?.replace('+', '');
  formData.append('phone_number', `+${phoneNUmber}`);
  const countryCode = getCountryCodeFromPhonenumber(`+${phoneNUmber}`);
  formData.append('country_code', countryCode);

  formData.append('message', message);
  const response = await fetch(`${config.smsHostUrl}`, {
    method: 'POST',
    body: formData,
    headers: {
      ...formData.getHeaders(),
      // 'x-api-key': config.arubaAPIKey, // Add your API key here
    },
  });

  const res = (await response.json()) as any;
  if (res?.success !== 'true') {
    throw new ApiError(res?.code, res?.message);
    return false;
  }

  return true;
};

// Testing purposes only not to  be used  in any API

// export const testingAllOTPs = async () => {
//   const userDoc = await User.findOne({ phoneNumber: '+923479728070', userType: 'partner' });
//   if (userDoc?.id) {
//     const country = await Country.findOne({ countryName: userDoc.country });

//     // login OTP
//     await sendOtp({
//       phoneNumber: userDoc.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'login',
//       user: userDoc.id,
//       userDoc,
//     });

//     //verify account
//     await sendOtp({
//       phoneNumber: userDoc.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'verifyAccount',
//       user: userDoc.id,
//       userDoc,
//     });

//     // set email
//     await sendOtp({
//       phoneNumber: userDoc.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'setEmailPhoneVerification',
//       user: userDoc.id,
//       userDoc,
//     });

//     // phone verification before email set
//     await sendOtp({
//       phoneNumber: userDoc.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'phoneVerificationBeforeEmailSet',
//       user: userDoc.id,
//       userDoc,
//     });

//     await sendSuspendedAccountAlert({ phoneNumber: userDoc.phoneNumber!, userDoc: userDoc as unknown as IUserDoc });

//     await sendPartnerAccountCreation({
//       phoneNumber: userDoc.phoneNumber!,
//       userDoc: userDoc as unknown as IUserDoc,
//       reminderNumber: 1,
//       expiry: 168 * 60,
//       country,
//     });
//   }

//   const userDoc2 = await User.findOne({ phoneNumber: '+923479728070', userType: 'admin' });
//   if (userDoc2?.id) {
//     // login OTP
//     await sendOtp({
//       phoneNumber: userDoc2.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'login',
//       user: userDoc2.id,
//       userDoc: userDoc2,
//     });

//     //verify account
//     await sendOtp({
//       phoneNumber: userDoc2.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'verifyAccount',
//       user: userDoc2.id,
//       userDoc: userDoc2,
//     });

//     // set email
//     await sendOtp({
//       phoneNumber: userDoc2.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'setEmailPhoneVerification',
//       user: userDoc2.id,
//       userDoc: userDoc2,
//     });

//     // phone verification before email set
//     await sendOtp({
//       phoneNumber: userDoc2.phoneNumber!,
//       name: 'Faisal seraj',
//       type: 'phoneVerificationBeforeEmailSet',
//       user: userDoc2.id,
//       userDoc: userDoc2,
//     });
//   }
// };
