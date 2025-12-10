import { subscriptionController, subscriptionValidation } from './';

import { auth } from '../auth';
import express from 'express';
import { validate } from '../validate';

const router = express.Router();

router
  .route('/')
  .post(auth('manageSubscriptions'), validate(subscriptionValidation.createSubscription), subscriptionController.createSubscription)
  .get(auth('manageSubscriptions'), validate(subscriptionValidation.getSubscriptions), subscriptionController.getSubscriptions);

router.route('/company/:companyId').get(auth('getSubscriptions'), validate(subscriptionValidation.getCompanySubscription), subscriptionController.getCompanySubscription);

router.route('/company/:companyId/history').get(auth('getSubscriptions'), validate(subscriptionValidation.getCompanySubscription), subscriptionController.getCompanySubscriptionHistory);

router
  .route('/:subscriptionId')
  .get(auth('getSubscriptions'), validate(subscriptionValidation.getSubscription), subscriptionController.getSubscription)
  .patch(auth('manageSubscriptions'), validate(subscriptionValidation.updateSubscription), subscriptionController.updateSubscription);

router.route('/:subscriptionId/cancel').patch(auth('manageSubscriptions'), validate(subscriptionValidation.cancelSubscription), subscriptionController.cancelSubscription);

router.route('/:subscriptionId/renew').patch(auth('manageSubscriptions'), validate(subscriptionValidation.renewSubscription), subscriptionController.renewSubscription);

router.route('/:subscriptionId/reactivate').patch(auth('manageSubscriptions'), validate(subscriptionValidation.cancelSubscription), subscriptionController.reactivateSubscription);

router.route('/:subscriptionId/change-tier').patch(auth('manageSubscriptions'), validate(subscriptionValidation.changeSubscriptionTier), subscriptionController.changeSubscriptionTier);

router.route('/:subscriptionId/cancel-at-period-end').patch(auth('manageSubscriptions'), subscriptionController.cancelSubscriptionAtPeriodEnd);

router.route('/expired').get(auth('manageSubscriptions'), subscriptionController.getExpiredSubscriptions);

router.route('/mark-expired').patch(auth('manageSubscriptions'), subscriptionController.markExpiredSubscriptions);

export default router;
