/**
 * Faisal Ride - Stripe Log Service
 * Simple logging for Stripe webhook events
 */

import { ILogDoc, LogStatus } from '../logs/log.interfaces';

import { logService } from '../logs';

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
 * Create a Stripe webhook log
 */
export const createStripeWebhookLog = async ({
  logData,
  event,
  status = LogStatus.SUCCESS,
}: {
  logData: StripeWebhookLogData;
  event: string;
  status?: LogStatus;
}): Promise<ILogDoc> => {
  return logService.logPayment(null, event, {
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
      ipAddress: logData.ipAddress,
    },
  });
};

/**
 * Log webhook received
 */
export const createStripeWebhookReceivedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook received: ${logData.eventType}`,
    status: LogStatus.SUCCESS,
  });
};

/**
 * Log signature verification failure
 */
export const createStripeWebhookSignatureFailedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook signature failed: ${logData.error}`,
    status: LogStatus.FAILED,
  });
};

/**
 * Log processing started
 */
export const createStripeWebhookProcessingStartedLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook processing started: ${logData.eventType}`,
    status: LogStatus.PENDING,
  });
};

/**
 * Log successful processing
 */
export const createStripeWebhookProcessedSuccessfullyLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook processed: ${logData.eventType}`,
    status: LogStatus.SUCCESS,
  });
};

/**
 * Log processing error
 */
export const createStripeWebhookProcessingErrorLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: `Webhook error: ${logData.error}`,
    status: LogStatus.FAILED,
  });
};

/**
 * Log missing signature
 */
export const createStripeWebhookMissingSignatureLog = async (logData: StripeWebhookLogData): Promise<ILogDoc> => {
  return createStripeWebhookLog({
    logData,
    event: 'Webhook missing signature',
    status: LogStatus.FAILED,
  });
};
