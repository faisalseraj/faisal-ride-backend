import * as revenueService from '../revenue/revenue.service';

import { IOptions, QueryResult } from '../paginate/paginate';
import { ISubscriptionDoc, NewCreatedSubscription, UpdateSubscriptionBody } from '../subscriptions/subscription.interfaces';

import { ApiError } from '../errors';
import Subscription from '../subscriptions/subscription.model';
import { cancelStripeSubscription } from '../stripe/stripe.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

/**
 * Query for all subscriptions with advanced filtering and sorting
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryAllSubscriptions = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Subscription.paginate(filter, options);
};

/**
 * Get subscription statistics for admin dashboard
 * @returns {Promise<Object>}
 */
export const getSubscriptionStats = async () => {
  const totalSubscriptions = await Subscription.countDocuments();
  const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
  const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
  const canceledSubscriptions = await Subscription.countDocuments({ status: 'canceled' });

  // Get subscriptions expiring in the next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const expiringSoon = await Subscription.countDocuments({
    status: 'active',
    endDate: { $lte: sevenDaysFromNow }
  });

  // Get revenue statistics from the revenue service
  const revenueStats = await revenueService.getRevenueStats();

  return {
    totalSubscriptions,
    activeSubscriptions,
    expiredSubscriptions,
    canceledSubscriptions,
    expiringSoon,
    revenue: revenueStats
  };
};

/**
 * Get subscriptions by company with details
 * @param {mongoose.Types.ObjectId} companyId
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getCompanySubscriptionsWithDetails = async (companyId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc[]> => {
  return Subscription.find({ companyId })
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features')
    .populate('companyId', 'firstName lastName email company towCompany userType')
    .sort({ createdAt: -1 });
};

/**
 * Get subscriptions by tier with details
 * @param {mongoose.Types.ObjectId} tierId
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getTierSubscriptionsWithDetails = async (tierId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc[]> => {
  return Subscription.find({ tierId })
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features')
    .populate('companyId', 'firstName lastName email company towCompany userType')
    .sort({ createdAt: -1 });
};

/**
 * Get subscription by id with full details
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const getSubscriptionWithFullDetails = async (id: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  return Subscription.findById(id)
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features isActive')
    .populate('companyId', 'firstName lastName email company towCompany userType isSuspended isArchived');
};

/**
 * Create subscription for a company (admin only)
 * @param {NewCreatedSubscription} subscriptionBody
 * @returns {Promise<ISubscriptionDoc>}
 */
export const createSubscriptionForCompany = async (subscriptionBody: NewCreatedSubscription): Promise<ISubscriptionDoc> => {
  // Check if company already has an active subscription
  const existingSubscription = await Subscription.findOne({
    companyId: subscriptionBody.companyId,
    status: 'active',
  });

  if (existingSubscription) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Company already has an active subscription');
  }

  // Set end date to 30 days from start date if not provided
  if (!subscriptionBody.endDate) {
    const startDate = subscriptionBody.startDate || new Date();
    subscriptionBody.endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  return Subscription.create(subscriptionBody);
};

/**
 * Update subscription by id (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @param {UpdateSubscriptionBody} updateBody
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const updateSubscriptionById = async (
  subscriptionId: mongoose.Types.ObjectId,
  updateBody: UpdateSubscriptionBody
): Promise<ISubscriptionDoc | null> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  Object.assign(subscription, updateBody);
  await subscription.save();
  return subscription;
};

/**
 * Cancel subscription by id (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const cancelSubscriptionById = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  // Cancel Stripe subscription if it exists
  if (subscription.stripeSubscriptionId) {
    try {
      await cancelStripeSubscription(subscription.stripeSubscriptionId, true); // Cancel immediately
      console.log(`Successfully canceled Stripe subscription: ${subscription.stripeSubscriptionId}`);
    } catch (error) {
      console.error(`Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}:`, error);
      // Continue with local cancellation even if Stripe fails
      // This ensures the subscription is marked as canceled in our system
    }
  } else {
    console.log(`No Stripe subscription ID found for subscription ${subscriptionId}, skipping Stripe cancellation`);
  }
  
  subscription.status = 'canceled';
  subscription.autoRenew = false;
  await subscription.save();
  return subscription;
};

/**
 * Reactivate subscription by id (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const reactivateSubscriptionById = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  subscription.status = 'active';
  await subscription.save();
  return subscription;
};

/**
 * Extend subscription by id (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @param {number} days - Number of days to extend
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const extendSubscriptionById = async (
  subscriptionId: mongoose.Types.ObjectId,
  days: number
): Promise<ISubscriptionDoc | null> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  const currentEndDate = new Date(subscription.endDate);
  subscription.endDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
  subscription.status = 'active';
  await subscription.save();
  return subscription;
};

/**
 * Change subscription tier (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @param {mongoose.Types.ObjectId} newTierId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const changeSubscriptionTierById = async (
  subscriptionId: mongoose.Types.ObjectId,
  newTierId: mongoose.Types.ObjectId
): Promise<ISubscriptionDoc | null> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  subscription.tierId = newTierId;
  await subscription.save();
  return subscription;
};

/**
 * Get subscriptions expiring soon
 * @param {number} days - Number of days ahead to check
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getExpiringSubscriptions = async (days: number = 7): Promise<ISubscriptionDoc[]> => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return Subscription.find({
    status: 'active',
    endDate: { $lte: futureDate }
  })
    .populate('tierId', 'name price billingInterval')
    .populate('companyId', 'firstName lastName email company towCompany')
    .sort({ endDate: 1 });
};

/**
 * Get subscription analytics by date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
export const getSubscriptionAnalytics = async (startDate: Date, endDate: Date) => {
  const subscriptions = await Subscription.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .populate('tierId', 'name price billingInterval')
    .populate('companyId', 'userType');

  const analytics = {
    totalCreated: subscriptions.length,
    byTier: {} as Record<string, number>,
    byUserType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    totalRevenue: 0
  };

  subscriptions.forEach(sub => {
    const tierName = (sub.tierId as any)?.name || 'Unknown';
    const userType = (sub.companyId as any)?.userType || 'Unknown';
    const price = (sub.tierId as any)?.price || 0;

    analytics.byTier[tierName] = (analytics.byTier[tierName] || 0) + 1;
    analytics.byUserType[userType] = (analytics.byUserType[userType] || 0) + 1;
    analytics.byStatus[sub.status || 'unknown'] = (analytics.byStatus[sub.status || 'unknown'] || 0) + 1;
    analytics.totalRevenue += price;
  });

  return analytics;
};

/**
 * Bulk update subscription status
 * @param {string[]} subscriptionIds
 * @param {string} status
 * @returns {Promise<number>}
 */
export const bulkUpdateSubscriptionStatus = async (subscriptionIds: string[], status: string): Promise<number> => {
  const result = await Subscription.updateMany(
    { _id: { $in: subscriptionIds } },
    { status, autoRenew: status === 'active' }
  );
  return result.modifiedCount;
};

/**
 * Delete subscription by id (admin only)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<void>}
 */
export const deleteSubscriptionById = async (subscriptionId: mongoose.Types.ObjectId): Promise<void> => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  await Subscription.findByIdAndDelete(subscriptionId);
};
