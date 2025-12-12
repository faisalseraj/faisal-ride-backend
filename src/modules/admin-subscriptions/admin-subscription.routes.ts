import * as adminSubscriptionController from './admin-subscription.controller';
import * as adminSubscriptionValidation from './admin-subscription.validation';

import { auth } from '../auth';
import express from 'express';
import { validate } from '../validate';

const router = express.Router();

// Get all subscriptions with filtering and pagination
router
  .route('/')
  .get(auth('manageSubscriptions'), validate(adminSubscriptionValidation.getAllSubscriptions), adminSubscriptionController.getAllSubscriptions)
  .post(auth('manageSubscriptions'), validate(adminSubscriptionValidation.createSubscription), adminSubscriptionController.createSubscription);

// Get subscription statistics
router.route('/stats').get(auth('manageSubscriptions'), adminSubscriptionController.getSubscriptionStats);

// Get subscriptions by company
router.route('/company/:companyId').get(auth('getSubscriptions'), validate(adminSubscriptionValidation.getCompanySubscriptions), adminSubscriptionController.getCompanySubscriptions);

// Get subscriptions by tier
router.route('/tier/:tierId').get(auth('manageSubscriptions'), validate(adminSubscriptionValidation.getTierSubscriptions), adminSubscriptionController.getTierSubscriptions);

// Get expiring subscriptions
router.route('/expiring').get(auth('manageSubscriptions'), validate(adminSubscriptionValidation.getExpiringSubscriptions), adminSubscriptionController.getExpiringSubscriptions);

// Get subscription analytics
router.route('/analytics').get(auth('manageSubscriptions'), validate(adminSubscriptionValidation.getSubscriptionAnalytics), adminSubscriptionController.getSubscriptionAnalytics);

// Bulk update subscription status
router.route('/bulk-update').patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.bulkUpdateSubscriptionStatus), adminSubscriptionController.bulkUpdateSubscriptionStatus);

// Individual subscription management
router
  .route('/:subscriptionId')
  .get(auth('manageSubscriptions'), validate(adminSubscriptionValidation.getSubscriptionDetails), adminSubscriptionController.getSubscriptionDetails)
  .patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.updateSubscription), adminSubscriptionController.updateSubscription)
  .delete(auth('manageSubscriptions'), validate(adminSubscriptionValidation.deleteSubscription), adminSubscriptionController.deleteSubscription);

// Subscription actions
router.route('/:subscriptionId/cancel').patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.cancelSubscription), adminSubscriptionController.cancelSubscription);

router.route('/:subscriptionId/reactivate').patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.reactivateSubscription), adminSubscriptionController.reactivateSubscription);

router.route('/:subscriptionId/extend').patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.extendSubscription), adminSubscriptionController.extendSubscription);

router.route('/:subscriptionId/change-tier').patch(auth('manageSubscriptions'), validate(adminSubscriptionValidation.changeSubscriptionTier), adminSubscriptionController.changeSubscriptionTier);

export default router;
