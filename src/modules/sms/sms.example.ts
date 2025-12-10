/**
 * Example integration of SMS functionality with existing auth system
 * This file demonstrates how to add SMS support to existing features
 */

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import ApiError from '../errors/ApiError';
import { userService } from '../user';
import { tokenService } from '../token';
import { logService } from '../logs';
import { emailService } from '../email';
import * as smsUtil from './sms.util';
import * as smsService from './sms.service';
import { ALL_EVENTS } from '../utils/events';

/**
 * Example: Enhanced forgot password that supports both email and SMS
 * This can be added to the auth controller
 */
export const forgotPasswordWithSMS = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  // Find user by email or phone number
  let user;
  if (email) {
    user = await userService.getUserByEmail(email);
  } else if (phoneNumber) {
    // Assuming you have a getUserByPhoneNumber function
    // user = await userService.getUserByPhoneNumber(phoneNumber);
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number lookup not implemented yet');
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Either email or phone number is required');
  }

  if (!user) {
    throw new ApiError(httpStatus.NO_CONTENT, '');
  }

  const resetPasswordToken = await tokenService.generateResetPasswordToken(email || phoneNumber);
  const owner = await userService.getOwnerIdByUserId(user.id);
  
  await logService.createLog({
    user,
    ownerId: owner,
    event: ALL_EVENTS.UserEvents.PasswordResetRequest,
    eventEnum: 'UE',
  });

  // Send reset link via both email and SMS if both are available
  const promises = [];

  if (user.email) {
    promises.push(
      emailService.sendResetPasswordEmail(user.email, resetPasswordToken, user.fullName!, user)
    );
  }

  if (user.phoneNumber) {
    promises.push(
      smsUtil.sendPasswordResetSMS(user.phoneNumber, resetPasswordToken, user.fullName!, user)
    );
  }

  if (promises.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No contact method available for user');
  }

  await Promise.all(promises);

  res.status(200).json({
    code: 200,
    message: 'Reset password link has been sent to your registered contact methods',
    methods: {
      email: !!user.email,
      sms: !!user.phoneNumber,
    },
  });
};

/**
 * Example: Send tow request invite via SMS
 * This can be integrated into tow request functionality
 */
export const sendTowRequestInviteViaSMS = async (req: Request, res: Response) => {
  const { towRequestId, phoneNumber, receiverName } = req.body;
  const user = req.user;

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Generate invite link
  const inviteLink = `${process.env['CLIENT_URL']}/tow-request/${towRequestId}`;

  try {
    const result = await smsUtil.sendTowRequestInviteSMS(
      phoneNumber,
      inviteLink,
      receiverName || 'User',
      user
    );

    res.status(200).json({
      success: true,
      message: 'Tow request invite sent via SMS',
      data: result,
    });
  } catch (error: any) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Failed to send SMS: ${error.message}`);
  }
};

/**
 * Example: Send account verification via SMS
 * This can be integrated into user registration
 */
export const sendAccountVerificationViaSMS = async (req: Request, res: Response) => {
  const { phoneNumber, receiverName } = req.body;
  const user = req.user;

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Generate verification token
  if (!user.email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User email is required for verification');
  }
  const verificationToken = await tokenService.generateVerifyEmailToken(user, user.email);
  const verificationLink = `${process.env['CLIENT_URL']}/auth/verify-email?token=${verificationToken}`;

  try {
    const result = await smsUtil.sendAccountVerificationSMS(
      phoneNumber,
      verificationLink,
      receiverName || user.fullName || 'User',
      user
    );

    res.status(200).json({
      success: true,
      message: 'Account verification link sent via SMS',
      data: result,
    });
  } catch (error: any) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Failed to send SMS: ${error.message}`);
  }
};

/**
 * Example: Bulk SMS sending for notifications
 * This can be used for system-wide notifications
 */
export const sendBulkNotificationSMS = async (req: Request, res: Response) => {
  const { phoneNumbers, message, link, linkTitle } = req.body;
  const user = req.user;

  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone numbers array is required');
  }

  const results = [];
  const errors = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      let result;
      
      if (link && linkTitle) {
        // Send with one-time link
        result = await smsUtil.sendCustomOneTimeLinkSMS(
          phoneNumber,
          link,
          linkTitle,
          'User',
          'notification',
          60, // 1 hour expiration
          user
        );
      } else {
        // Send simple message
        result = await smsService.sendSMS({
          to: phoneNumber,
          body: message,
        }, user, 'User');
      }

      results.push({ phoneNumber, success: true, result });
    } catch (error: any) {
      errors.push({ phoneNumber, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `SMS sent to ${results.length} recipients`,
    data: {
      successful: results,
      failed: errors,
      total: phoneNumbers.length,
    },
  });
};
