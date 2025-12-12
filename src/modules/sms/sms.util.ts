import * as smsService from './sms.service';
import { SendOneTimeLinkSMS } from './sms.interfaces';

/**
 * Utility functions for SMS operations
 */

/**
 * Send password reset link via SMS
 */
export const sendPasswordResetSMS = async (
  phoneNumber: string,
  resetLink: string,
  receiverName?: string,
  user?: any
) => {
  const smsData: SendOneTimeLinkSMS = {
    phoneNumber,
    link: resetLink,
    linkTitle: 'Password Reset Link',
    ...(receiverName && { receiverName }),
    purpose: 'password-reset',
    expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
  };

  return await smsService.sendOneTimeLinkSMS(smsData, user);
};

/**
 * Send account verification link via SMS
 */
export const sendAccountVerificationSMS = async (
  phoneNumber: string,
  verificationLink: string,
  receiverName?: string,
  user?: any
) => {
  const smsData: SendOneTimeLinkSMS = {
    phoneNumber,
    link: verificationLink,
    linkTitle: 'Account Verification Link',
    ...(receiverName && { receiverName }),
    purpose: 'account-verification',
    expirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
  };

  return await smsService.sendOneTimeLinkSMS(smsData, user);
};

/**
 * Send tow request invite link via SMS
 */
export const sendTowRequestInviteSMS = async (
  phoneNumber: string,
  inviteLink: string,
  receiverName?: string,
  user?: any
) => {
  const smsData: SendOneTimeLinkSMS = {
    phoneNumber,
    link: inviteLink,
    linkTitle: 'Tow Request Invite',
    ...(receiverName && { receiverName }),
    purpose: 'tow-invite',
    expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  return await smsService.sendOneTimeLinkSMS(smsData, user);
};

/**
 * Send custom one-time link via SMS
 */
export const sendCustomOneTimeLinkSMS = async (
  phoneNumber: string,
  link: string,
  linkTitle: string,
  receiverName?: string,
  purpose?: string,
  expirationMinutes: number = 60,
  user?: any
) => {
  const smsData: SendOneTimeLinkSMS = {
    phoneNumber,
    link,
    linkTitle,
    ...(receiverName && { receiverName }),
    purpose: purpose || 'general',
    expirationTime: new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString(),
  };

  return await smsService.sendOneTimeLinkSMS(smsData, user);
};

/**
 * Validate and format phone number for SMS
 */
export const preparePhoneNumberForSMS = (phoneNumber: string): string | null => {
  if (!smsService.validatePhoneNumber(phoneNumber)) {
    return null;
  }
  return smsService.formatPhoneNumber(phoneNumber);
};
