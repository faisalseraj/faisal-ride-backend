import { EventsEnum, ILogDoc, StatusEnum } from '../logs/log.interfaces';

import { createEnhancedLog } from '../logs/enhanced-log.service';
import mongoose from 'mongoose';

export interface StripeWebhookLogData {
  eventId: string;
  eventType: string;
  livemode: boolean;
  created: number;
  requestId: string;
  processingTimeMs?: number;
  error?: string;
  errorType?: string;
  signature?: string;
  bodyLength?: number;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  contentType?: string | undefined;
  contentLength?: string | undefined;
}

/**
 * Create a Stripe webhook log using enhanced logging
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @param {string} event - Event description
 * @param {StatusEnum} status - Event status
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookLog = async ({
  logData,
  event,
  status = StatusEnum.NA,
}: {
  logData: StripeWebhookLogData;
  event: string;
  status?: StatusEnum;
}): Promise<ILogDoc> => {
  // Determine priority based on event content
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (event.toLowerCase().includes('error') || event.toLowerCase().includes('failed')) {
    priority = 'critical';
  } else if (event.toLowerCase().includes('success') || event.toLowerCase().includes('processed')) {
    priority = 'low';
  }

  // Determine category and action based on event type
  let category = 'payment';
  let action = 'stripe_event';

  // Categorize based on event type
  switch (logData.eventType) {
    case 'checkout.session.verify':
      category = 'checkout_verification';
      action = 'verify_checkout_session';
      break;
    case 'checkout.session.completed':
      category = 'checkout_completion';
      action = 'checkout_completed';
      break;
    case 'invoice.payment_succeeded':
      category = 'payment_success';
      action = 'payment_succeeded';
      break;
    case 'invoice.payment_failed':
      category = 'payment_failure';
      action = 'payment_failed';
      break;
    case 'customer.subscription.deleted':
      category = 'subscription_cancellation';
      action = 'subscription_deleted';
      break;
    case 'customer.subscription.updated':
      category = 'subscription_update';
      action = 'subscription_updated';
      break;
    default:
      // For webhook events, determine category from event content
      if (event.toLowerCase().includes('webhook')) {
        category = 'webhook_processing';
        if (event.toLowerCase().includes('signature verification failed')) {
          action = 'signature_verification_failed';
        } else if (event.toLowerCase().includes('processed successfully')) {
          action = 'webhook_processed';
        } else if (event.toLowerCase().includes('processing error')) {
          action = 'webhook_processing_error';
        } else if (event.toLowerCase().includes('missing signature')) {
          action = 'missing_signature';
        } else {
          action = 'webhook_received';
        }
      }
  }

  return createEnhancedLog({
    user: {
      _id: new mongoose.Types.ObjectId('000000000000000000000000'), // System user ID for Stripe events
      id: new mongoose.Types.ObjectId('000000000000000000000000'), // System user ID for Stripe events
      firstName: 'Stripe',
      lastName: 'System',
      fullName: 'Stripe System',
      userType: 'admin' as any, // External system logs use admin type
      country: 'Global',
    },
    event,
    eventEnum: 'STE' as EventsEnum,
    category,
    action,
    priority,
    status,
    metadata: {
      requestId: logData.requestId,
      eventId: logData.eventId,
      eventType: logData.eventType,
      livemode: logData.livemode,
      created: logData.created,
      processingTimeMs: logData.processingTimeMs,
      error: logData.error,
      errorType: logData.errorType,
      signature: logData.signature,
      bodyLength: logData.bodyLength,
      userAgent: logData.userAgent,
      ipAddress: logData.ipAddress,
      contentType: logData.contentType,
      contentLength: logData.contentLength,
    },
  });
};

/**
 * Create a Stripe webhook received log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookReceivedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook request received - ${logData.eventType}`,
    status: StatusEnum.NA,
  });
};

/**
 * Create a Stripe webhook signature verification failed log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookSignatureFailedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook signature verification failed - ${logData.error}`,
    status: StatusEnum.NA,
  });
};

/**
 * Create a Stripe webhook event constructed log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookEventConstructedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Stripe event constructed successfully - ${logData.eventType}`,
    status: StatusEnum.NA,
  });
};

/**
 * Create a Stripe webhook processing started log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookProcessingStartedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook processing started - ${logData.eventType}`,
    status: StatusEnum.NA,
  });
};

/**
 * Create a Stripe webhook processed successfully log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookProcessedSuccessfullyLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook processed successfully - ${logData.eventType}`,
    status: StatusEnum.LOGIN_SUCCESS,
  });
};

/**
 * Create a Stripe webhook processing error log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookProcessingErrorLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook processing error - ${logData.error}`,
    status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL,
  });
};

/**
 * Create a Stripe webhook missing signature log
 * @param {StripeWebhookLogData} logData - Stripe webhook log data
 * @returns {Promise<ILogDoc>}
 */
export const createStripeWebhookMissingSignatureLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: 'Webhook request missing Stripe signature',
    status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL,
  });
};
