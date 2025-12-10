import { SMSDeliveryStatus, SMSMessage, SendOneTimeLinkSMS } from './sms.interfaces';

import { IUserDoc } from '../user/user.interfaces';
import config from '../../config/config';
import { logService } from '../logs';
import twilio from 'twilio';
import { userService } from '../user';

// Initialize Twilio client

/**
 * Send SMS message using Twilio
 */
export const sendSMS = async (message: SMSMessage, user?: IUserDoc, receiverName?: string): Promise<SMSDeliveryStatus> => {
  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);

    const twilioMessage = await client.messages.create({
      body: message.body,
      from: config.twilio.fromNumber,
      to: message.to,
    });

    const deliveryStatus: SMSDeliveryStatus = {
      messageId: twilioMessage.sid,
      status: twilioMessage.status as any,
      timestamp: new Date(),
    };

    // Log communication if user is provided
    if (user?._id || user?.id) {
      let ownerId: any;
      if (user?.userType.includes('employee') || user?.userType?.includes('manager')) {
        ownerId = await userService.getOwnerIdByUserId(user._id || user.id);
      }

      await logService.createCommunicationLog({
        user,
        ...(ownerId ? { ownerId } : {}),
        event: 'SMS Sent',
        receiverDetails: {
          content: message.body,
          sentTo: message.to,
          name: receiverName || 'Unknown',
          type: 'phoneNumber',
        },
      });
    }

    return deliveryStatus;
  } catch (error: any) {
    console.error('SMS sending failed:', error);

    const errorStatus: SMSDeliveryStatus = {
      messageId: '',
      status: 'failed',
      errorCode: error.code?.toString(),
      errorMessage: error.message,
      timestamp: new Date(),
    };

    return errorStatus;
  }
};

/**
 * Send one-time link via SMS
 */
export const sendOneTimeLinkSMS = async (smsData: SendOneTimeLinkSMS, user?: IUserDoc): Promise<SMSDeliveryStatus> => {
  const { phoneNumber, link, linkTitle, receiverName, expirationTime, purpose } = smsData;

  // Format phone number (ensure it starts with +)
  const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  // Create SMS message with one-time link
  const messageBody = createOneTimeLinkMessage({
    link,
    linkTitle,
    ...(receiverName && { receiverName }),
    ...(expirationTime && { expirationTime }),
    ...(purpose && { purpose }),
  });

  const message: SMSMessage = {
    to: formattedPhoneNumber,
    body: messageBody,
  };

  return await sendSMS(message, user, receiverName);
};

/**
 * Create formatted message for one-time link
 */
const createOneTimeLinkMessage = (data: {
  link: string;
  linkTitle: string;
  receiverName?: string;
  expirationTime?: string;
  purpose?: string;
}): string => {
  const { link, linkTitle, receiverName, expirationTime, purpose } = data;

  let message = '';

  if (receiverName) {
    message += `Hi ${receiverName},\n\n`;
  }

  // Add purpose-specific message
  switch (purpose) {
    case 'password-reset':
      message += 'You requested a password reset. Click the link below to reset your password:\n\n';
      break;
    case 'account-verification':
      message += 'Please verify your account by clicking the link below:\n\n';
      break;
    case 'tow-invite':
      message += 'You have been invited to creat a tow request. Click the link below to view details:\n\n';
      break;
    default:
      message += 'You have received a one-time link. Click the link below:\n\n';
  }

  message += `${linkTitle}: ${link}\n\n`;

  if (expirationTime) {
    message += `This link expires at: ${expirationTime}\n\n`;
  }

  message += 'If you did not request this, please ignore this message.';

  return message;
};

/**
 * Send templated SMS (for future use)
 */
export const sendTemplatedSMS = async (
  templateData: {
    phoneNumber: string;
    template: string;
    data: Record<string, any>;
    receiverName?: string;
  },
  user?: IUserDoc
): Promise<SMSDeliveryStatus> => {
  const { phoneNumber, template, data, receiverName } = templateData;

  // Format phone number
  const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  // Create message from template
  let messageBody = template;

  // Replace template variables
  Object.keys(data).forEach((key) => {
    const placeholder = `{{${key}}}`;
    messageBody = messageBody.replace(new RegExp(placeholder, 'g'), data[key]);
  });

  const message: SMSMessage = {
    to: formattedPhoneNumber,
    body: messageBody,
  };

  return await sendSMS(message, user, receiverName);
};

/**
 * Send account setup link via SMS
 */
export const sendAccountSetupLinkSMS = async (
  smsData: {
    phoneNumber: string;
    link: string;
    linkTitle: string;
    receiverName?: string;
    purpose?: string;
  },
  user?: IUserDoc
): Promise<SMSDeliveryStatus> => {
  const { phoneNumber, link,  receiverName } = smsData;

  // Format phone number
  const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  const messageBody = `Hi ${receiverName || 'there'}, your tow request has been completed! Complete your account setup: ${link}`;

  const message: SMSMessage = {
    to: formattedPhoneNumber,
    body: messageBody,
  };

  return await sendSMS(message, user, receiverName);
};

/**
 * Send tow request status update via SMS
 */
export const sendTowRequestStatusUpdateSMS = async (
  smsData: {
    phoneNumber: string;
    status: string;
    towRequestId: string;
    receiverName?: string;
    location?: any;
  },
  loggedInUser: IUserDoc
): Promise<SMSDeliveryStatus> => {
  const { phoneNumber, status, towRequestId, receiverName, location } = smsData;

  // Format phone number
  const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

  const locationText = location?.address ? ` at ${location.address}` : '';
  const messageBody = `Hi ${receiverName || 'there'}, your tow request ${towRequestId} is now ${status}${locationText}. View: ${config.clientUrl}/tow-requests/${towRequestId}`;

  const message: SMSMessage = {
    to: formattedPhoneNumber,
    body: messageBody,
  };

  return await sendSMS(message, loggedInUser, receiverName);
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Basic phone number validation (can be enhanced)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
};

/**
 * Format phone number for Twilio
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // If it doesn't start with +, add it
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
};

/**
 * Get SMS delivery status from Twilio
 */
export const getSMSStatus = async (messageId: string): Promise<SMSDeliveryStatus | null> => {
  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);

    const message = await client.messages(messageId).fetch();

    return {
      messageId: message.sid,
      status: message.status as any,
      errorCode: message.errorCode?.toString(),
      errorMessage: message.errorMessage,
      timestamp: message.dateCreated,
    };
  } catch (error) {
    console.error('Failed to get SMS status:', error);
    return null;
  }
};
