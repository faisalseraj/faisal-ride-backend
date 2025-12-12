import * as subscriptionService from './subscription.service';

import { Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { IOptions } from '../paginate/paginate';
import Tier from '../tiers/tier.model';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

export const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const subscriptionBody = {
    ...req.body,
    companyId: new mongoose.Types.ObjectId(req.body.companyId),
    tierId: new mongoose.Types.ObjectId(req.body.tierId),
  };
  const subscription = await subscriptionService.createSubscription(subscriptionBody);
  res.status(httpStatus.CREATED).send(subscription);
});

export const getSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const filter = {}; // Add filtering logic if needed
  const options: IOptions = req.query;
  const result = await subscriptionService.querySubscriptions(filter, options);
  res.send(result);
});

export const getSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await subscriptionService.getSubscriptionByIdWithDetails(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    if (!subscription) {
      res.status(httpStatus.NOT_FOUND).send();
      return;
    }
    res.send(subscription);
  }
});

export const getCompanySubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['companyId'] !== 'string') {
    return res.status(httpStatus.BAD_REQUEST).send({
      message: 'Invalid company ID',
      code: httpStatus.BAD_REQUEST,
    });
  }

  const subscription = await subscriptionService.getCompanySubscription(
    new mongoose.Types.ObjectId(req.params['companyId'])
  );

  // Always return a proper response, even if subscription is null
  // Return 200 with null to avoid caching issues (304 Not Modified)
  return res.status(httpStatus.OK).send(subscription);
});

export const getCompanySubscriptionHistory = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['companyId'] === 'string') {
    const subscriptions = await subscriptionService.getCompanySubscriptionHistory(
      new mongoose.Types.ObjectId(req.params['companyId'])
    );
    res.send(subscriptions);
  }
});

export const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await subscriptionService.updateSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId']),
      req.body
    );
    res.send(subscription);
  }
});

export const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await subscriptionService.cancelSubscription(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send(subscription);
  }
});

export const renewSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await subscriptionService.renewSubscription(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send(subscription);
  }
});

export const reactivateSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await subscriptionService.reactivateSubscription(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send(subscription);
  }
});

export const changeSubscriptionTier = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string' && req.body.tierId) {
    // Get current subscription with tier details
    const currentSubscription = await subscriptionService.getSubscriptionByIdWithDetails(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
          
    if (!currentSubscription) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Get current and new tier details
    const currentTier = currentSubscription.tierId as any;
    const newTier = await Tier.findById(new mongoose.Types.ObjectId(req.body.tierId));
    if (!currentTier || !newTier) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
    }

    // Check if it's the same tier
    if (currentTier._id.toString() === newTier._id.toString()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Subscription is already on this tier');
    }

    // Determine if it's an upgrade or downgrade based on price
    const currentPrice = currentTier.price || 0;
    const newPrice = newTier.price || 0;
    const isUpgrade = newPrice > currentPrice;
    const isDowngrade = newPrice < currentPrice;

    // Route to appropriate handler
    if (isUpgrade) {
      // Upgrade: handles both same-interval and cross-interval internally
      const result = await subscriptionService.upgradeSubscription(
        new mongoose.Types.ObjectId(req.params['subscriptionId']),
        new mongoose.Types.ObjectId(req.body.tierId)
      );
      res.send(result);
    } else if (isDowngrade) {
      // Downgrade: marks as pending, applies at period end
      const result = await subscriptionService.downgradeSubscription(
        new mongoose.Types.ObjectId(req.params['subscriptionId']),
        new mongoose.Types.ObjectId(req.body.tierId)
      );
      res.send(result);
    } else {
      // Same price but different tier - treat as same-interval upgrade (no price change)
      // This handles edge cases where tiers have same price but different features
      const result = await subscriptionService.upgradeSubscription(
        new mongoose.Types.ObjectId(req.params['subscriptionId']),
        new mongoose.Types.ObjectId(req.body.tierId)
      );
      res.send(result);
    }
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'tierId is required');
  }
});

export const getExpiredSubscriptions = catchAsync(async (_: Request, res: Response) => {
  const subscriptions = await subscriptionService.getExpiredSubscriptions();
  res.send(subscriptions);
});

export const markExpiredSubscriptions = catchAsync(async (_: Request, res: Response) => {
  const count = await subscriptionService.markExpiredSubscriptions();
  res.send({ message: `${count} subscriptions marked as expired` });
});

export const cancelSubscriptionAtPeriodEnd = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    await subscriptionService.cancelSubscriptionAtPeriodEnd(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send({ message: 'Subscription will be cancelled at period end' });
  }
});
