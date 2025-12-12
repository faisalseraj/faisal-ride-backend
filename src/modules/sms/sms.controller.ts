import * as smsService from './sms.service';

import { NextFunction, Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { SendOneTimeLinkSMS } from './sms.interfaces';
import httpStatus from 'http-status';

/**
 * Send SMS message
 */
export const sendSMS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, body } = req.body;
    const user = req.user;

    const result = await smsService.sendSMS(
      { to, body,  },
      user,
      user?.fullName || user?.firstName + ' ' + user?.lastName
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: 'SMS sent successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send one-time link via SMS
 */
export const sendOneTimeLinkSMS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const smsData: SendOneTimeLinkSMS = req.body;
    const user = req.user;

    // Validate phone number format
    if (!smsService.validatePhoneNumber(smsData.phoneNumber)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
    }

    // Format phone number
    smsData.phoneNumber = smsService.formatPhoneNumber(smsData.phoneNumber);

    const result = await smsService.sendOneTimeLinkSMS(smsData, user);

    res.status(httpStatus.OK).json({
      success: true,
      message: 'One-time link SMS sent successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send templated SMS
 */
export const sendTemplatedSMS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, template, data, receiverName } = req.body;
    const user = req.user;

    // Validate phone number format
    if (!smsService.validatePhoneNumber(phoneNumber)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
    }

    const formattedPhoneNumber = smsService.formatPhoneNumber(phoneNumber);

    const result = await smsService.sendTemplatedSMS(
      {
        phoneNumber: formattedPhoneNumber,
        template,
        data,
        receiverName,
      },
      user
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Templated SMS sent successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get SMS delivery status
 */
export const getSMSStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Message ID is required');
    }

    const result = await smsService.getSMSStatus(messageId);

    if (!result) {
      throw new ApiError(httpStatus.NOT_FOUND, 'SMS message not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: 'SMS status retrieved successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate phone number
 */
export const validatePhoneNumber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
    }

    const isValid = smsService.validatePhoneNumber(phoneNumber);
    const formatted = isValid ? smsService.formatPhoneNumber(phoneNumber) : null;

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Phone number validation completed',
      data: {
        isValid,
        formatted,
        original: phoneNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};
