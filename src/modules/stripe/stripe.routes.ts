import {
  createCheckoutSessionController,
  createCustomerPortalSessionController,
  createSetupIntentController,
  deletePaymentMethodController,
  getCustomerInvoicesController,
  getInvoicePdfUrlController,
  getPaymentMethodsController,
  setDefaultPaymentMethodController,
  verifyCheckoutSessionController
} from './stripe.controller';

import { auth } from '../auth';
// import { auth } from '../auth';
import express from 'express';

const router = express.Router();

// Webhook endpoint (no auth required)
// router.post('/webhook', handleWebhookController);

// Protected routes
// router.use(auth());

// Create checkout session
router.route('/create-checkout-session/:tierId').post(auth(), createCheckoutSessionController);

// Create customer portal session
router.route('/create-portal-session').post(auth(), createCustomerPortalSessionController);

// Verify checkout session (no auth required for success page)
router.route('/verify-session').get(auth(), verifyCheckoutSessionController);

// Payment method management routes
router.route('/payment-methods').get(auth(), getPaymentMethodsController);
router.route('/setup-intent').post(auth(), createSetupIntentController);
router.route('/set-default-payment-method').put(auth(), setDefaultPaymentMethodController);
router.route('/payment-methods/:paymentMethodId').delete(auth(), deletePaymentMethodController);

// Invoice routes
router.route('/invoices').get(auth(), getCustomerInvoicesController);
router.route('/invoices/:invoiceId/pdf').get(auth(), getInvoicePdfUrlController);

export default router;
