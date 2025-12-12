import { Request, Response } from 'express';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  createSetupIntent,
  deletePaymentMethod,
  getCustomerInvoices,
  getCustomerPaymentMethods,
  getInvoicePdfUrl,
  setDefaultPaymentMethod,
  verifyCheckoutSession,
} from './stripe.service';

import { ApiError } from '../errors';
import { catchAsync } from '../utils';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Create checkout session for subscription
 * @param {Request} req
 * @param {Response} res
 */
export const createCheckoutSessionController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  // try {
  const { tierId } = req.params;
  const { termsAccepted } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(tierId!)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid tier ID');
  }

  if (!termsAccepted) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You must accept the terms and conditions to proceed');
  }

  const checkoutUrl = await createCheckoutSession({
    userId: new mongoose.Types.ObjectId(userId),
    tierId: new mongoose.Types.ObjectId(tierId),
    termsAccepted,
  });

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      checkoutUrl,
    },
  });
  // } catch (error) {
  //   console.error('Create checkout session error:', error);
  //   throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
  // }
});

/**
 * Create customer portal session
 * @param {Request} req
 * @param {Response} res
 */
export const createCustomerPortalSessionController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const portalUrl = await createCustomerPortalSession(new mongoose.Types.ObjectId(userId));

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      portalUrl,
    },
  });
});


/**
 * Verify checkout session and get subscription details
 * @param {Request} req
 * @param {Response} res
 */
export const verifyCheckoutSessionController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Session ID is required');
  }

  const result = await verifyCheckoutSession(sessionId);

  res.status(httpStatus.OK).json({
    success: true,
    data: result,
  });
});

/**
 * Get customer's payment methods
 * @param {Request} req
 * @param {Response} res
 */
export const getPaymentMethodsController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const paymentMethods = await getCustomerPaymentMethods(new mongoose.Types.ObjectId(userId));

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      paymentMethods,
    },
  });
});

/**
 * Create setup intent for adding new payment method
 * @param {Request} req
 * @param {Response} res
 */
export const createSetupIntentController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const setupIntent = await createSetupIntent(new mongoose.Types.ObjectId(userId));

  res.status(httpStatus.OK).json({
    success: true,
    data: setupIntent,
  });
});

/**
 * Set default payment method
 * @param {Request} req
 * @param {Response} res
 */
export const setDefaultPaymentMethodController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { paymentMethodId } = req.body;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  if (!paymentMethodId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Payment method ID is required');
  }

  await setDefaultPaymentMethod(new mongoose.Types.ObjectId(userId), paymentMethodId);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Default payment method updated successfully',
  });
});

/**
 * Delete payment method
 * @param {Request} req
 * @param {Response} res
 */
export const deletePaymentMethodController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { paymentMethodId } = req.params;

  if (!paymentMethodId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Payment method ID is required');
  }

  await deletePaymentMethod(paymentMethodId);

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Payment method deleted successfully',
  });
});

/**
 * Get customer invoices
 * @param {Request} req
 * @param {Response} res
 */
export const getCustomerInvoicesController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  const invoices = await getCustomerInvoices(new mongoose.Types.ObjectId(userId));

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      invoices,
    },
  });
});

/**
 * Get invoice PDF URL
 * @param {Request} req
 * @param {Response} res
 */
export const getInvoicePdfUrlController = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invoice ID is required');
  }

  const pdfUrl = await getInvoicePdfUrl(invoiceId);

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      pdfUrl,
    },
  });
});

