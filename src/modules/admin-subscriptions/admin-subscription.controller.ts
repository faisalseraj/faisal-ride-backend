import * as adminSubscriptionService from './admin-subscription.service';

import { Request, Response } from 'express';

import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

export const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const filter = {
    ...(req.query['status'] && { status: req.query['status'] }),
    ...(req.query['tierId'] && { tierId: req.query['tierId'] }),
    ...(req.query['companyId'] && { companyId: req.query['companyId'] }),
    ...(req.query['search'] && {
      $or: [
        { 'companyId.firstName': { $regex: req.query['search'], $options: 'i' } },
        { 'companyId.lastName': { $regex: req.query['search'], $options: 'i' } },
        { 'companyId.email': { $regex: req.query['search'], $options: 'i' } },
        { 'companyId.company.companyName': { $regex: req.query['search'], $options: 'i' } },
        { 'companyId.towCompany.companyName': { $regex: req.query['search'], $options: 'i' } },
      ]
    })
  };
  
  const options: IOptions = {
    ...req.query,
    populate: 'tierId,companyId'
  };
  
  const result = await adminSubscriptionService.queryAllSubscriptions(filter, options);
  res.send(result);
});

export const getSubscriptionStats = catchAsync(async (_: Request, res: Response) => {
  const stats = await adminSubscriptionService.getSubscriptionStats();
  res.send(stats);
});

export const getCompanySubscriptions = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['companyId'] === 'string') {
    const subscriptions = await adminSubscriptionService.getCompanySubscriptionsWithDetails(
      new mongoose.Types.ObjectId(req.params['companyId'])
    );
    res.send(subscriptions);
  }
});

export const getTierSubscriptions = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['tierId'] === 'string') {
    const subscriptions = await adminSubscriptionService.getTierSubscriptionsWithDetails(
      new mongoose.Types.ObjectId(req.params['tierId'])
    );
    res.send(subscriptions);
  }
});

export const getSubscriptionDetails = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await adminSubscriptionService.getSubscriptionWithFullDetails(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    if (!subscription) {
      res.status(httpStatus.NOT_FOUND).send();
      return;
    }
    res.send(subscription);
  }
});

export const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const subscription = await adminSubscriptionService.createSubscriptionForCompany(req.body);
  res.status(httpStatus.CREATED).send(subscription);
});

export const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await adminSubscriptionService.updateSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId']),
      req.body
    );
    res.send(subscription);
  }
});

export const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await adminSubscriptionService.cancelSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send(subscription);
  }
});

export const reactivateSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    const subscription = await adminSubscriptionService.reactivateSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.send(subscription);
  }
});

export const extendSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string' && req.body.days) {
    const subscription = await adminSubscriptionService.extendSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId']),
      req.body.days
    );
    res.send(subscription);
  } else {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'days is required' });
  }
});

export const changeSubscriptionTier = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string' && req.body.tierId) {
    const subscription = await adminSubscriptionService.changeSubscriptionTierById(
      new mongoose.Types.ObjectId(req.params['subscriptionId']),
      new mongoose.Types.ObjectId(req.body.tierId)
    );
    res.send(subscription);
  } else {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'tierId is required' });
  }
});

export const getExpiringSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const days = parseInt(req.query['days'] as string) || 7;
  const subscriptions = await adminSubscriptionService.getExpiringSubscriptions(days);
  res.send(subscriptions);
});

export const getSubscriptionAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'startDate and endDate are required' });
    return;
  }

  const analytics = await adminSubscriptionService.getSubscriptionAnalytics(
    new Date(startDate as string),
    new Date(endDate as string)
  );
  res.send(analytics);
});

export const bulkUpdateSubscriptionStatus = catchAsync(async (req: Request, res: Response) => {
  const { subscriptionIds, status } = req.body;
  
  if (!subscriptionIds || !Array.isArray(subscriptionIds) || !status) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'subscriptionIds array and status are required' });
    return;
  }

  const modifiedCount = await adminSubscriptionService.bulkUpdateSubscriptionStatus(subscriptionIds, status);
  res.send({ message: `${modifiedCount} subscriptions updated successfully` });
});

export const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['subscriptionId'] === 'string') {
    await adminSubscriptionService.deleteSubscriptionById(
      new mongoose.Types.ObjectId(req.params['subscriptionId'])
    );
    res.status(httpStatus.NO_CONTENT).send();
  }
});
