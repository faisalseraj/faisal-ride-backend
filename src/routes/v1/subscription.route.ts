import { subscriptionController, subscriptionValidation } from '../../modules/subscriptions';

import { auth } from '../../modules/auth';
import express from 'express';
import { validate } from '../../modules/validate';

const router = express.Router();

router
  .route('/')
  .post(auth('changeSubscription'), validate(subscriptionValidation.createSubscription), subscriptionController.createSubscription)
  .get(auth('manageSubscriptions'), validate(subscriptionValidation.getSubscriptions), subscriptionController.getSubscriptions);

router.route('/company/:companyId').get(auth('getSubscriptions'), validate(subscriptionValidation.getCompanySubscription), subscriptionController.getCompanySubscription);

router.route('/company/:companyId/history').get(auth('getSubscriptions'), validate(subscriptionValidation.getCompanySubscription), subscriptionController.getCompanySubscriptionHistory);

router
  .route('/:subscriptionId')
  .get(auth('getSubscriptions'), validate(subscriptionValidation.getSubscription), subscriptionController.getSubscription)
  .patch(auth('changeSubscription'), validate(subscriptionValidation.updateSubscription), subscriptionController.updateSubscription);

router.route('/:subscriptionId/cancel').patch(auth('changeSubscription'), validate(subscriptionValidation.cancelSubscription), subscriptionController.cancelSubscription);

router.route('/:subscriptionId/renew').patch(auth('changeSubscription'), validate(subscriptionValidation.renewSubscription), subscriptionController.renewSubscription);

router.route('/:subscriptionId/reactivate').patch(auth('changeSubscription'), validate(subscriptionValidation.cancelSubscription), subscriptionController.reactivateSubscription);

router.route('/:subscriptionId/change-tier').patch(auth('changeSubscription'), validate(subscriptionValidation.changeSubscriptionTier), subscriptionController.changeSubscriptionTier);

router.route('/expired').get(auth('changeSubscription'), subscriptionController.getExpiredSubscriptions);

router.route('/mark-expired').patch(auth('changeSubscription'), subscriptionController.markExpiredSubscriptions);

export default router;
