import * as revenueService from '../revenue/revenue.service';

import { IOptions, QueryResult } from '../paginate/paginate';
import { ISubscriptionDoc, NewCreatedSubscription, UpdateSubscriptionBody } from './subscription.interfaces';
import { sendSubscriptionDowngradeEmail, sendSubscriptionUpgradeEmail } from '../email/email.service';

import { ApiError } from '../errors';
import Stripe from 'stripe';
import Subscription from './subscription.model';
import SubscriptionHistory from './subscription-history.model';
import Tier from '../tiers/tier.model';
import User from '../user/user.model';
import config from '../../config/config';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-09-30.clover',
});

/**
 * Create a subscription
 * @param {NewCreatedSubscription} subscriptionBody
 * @returns {Promise<ISubscriptionDoc>}
 */
export const createSubscription = async (subscriptionBody: NewCreatedSubscription): Promise<ISubscriptionDoc> => {
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
 * Query for subscriptions
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const querySubscriptions = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  return Subscription.paginate(filter, options);
};

/**
 * Get subscription by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const getSubscriptionById = async (id: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  return Subscription.findById(id);
};

/**
 * Get subscription by id with populated details
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const getSubscriptionByIdWithDetails = async (id: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  return Subscription.findById(id)
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features')
    .populate('companyId', 'companyName');
};

/**
 * Get company's active subscription
 * @param {mongoose.Types.ObjectId} companyId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const getCompanySubscription = async (companyId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  return Subscription.findOne({
    companyId,
    status: {$ne: 'canceled'},
  })
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features')
    .populate('companyId', 'companyName');
};

/**
 * Get company's subscription history
 * @param {mongoose.Types.ObjectId} companyId
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getCompanySubscriptionHistory = async (companyId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc[]> => {
  return Subscription.find({ companyId })
    .populate('tierId', 'name description price billingInterval freeTowRequests additionalTowCost features')
    .populate('companyId', 'companyName')
    .sort({ createdAt: -1 });
};

/**
 * Update subscription by id
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @param {UpdateSubscriptionBody} updateBody
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const updateSubscriptionById = async (
  subscriptionId: mongoose.Types.ObjectId,
  updateBody: UpdateSubscriptionBody
): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  Object.assign(subscription, updateBody);
  await subscription.save();
  return subscription;
};

/**
 * Cancel subscription by id (schedules cancellation at period end)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const cancelSubscription = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(new mongoose.Types.ObjectId(subscriptionId));
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  // Schedule cancellation at period end in Stripe
  if (subscription.stripeSubscriptionId) {
    try {
      // Cancel at period end instead of immediately
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      console.log(`Successfully scheduled Stripe subscription cancellation at period end: ${subscription.stripeSubscriptionId}`);
    } catch (error) {
      console.error(`Failed to schedule Stripe subscription cancellation ${subscription.stripeSubscriptionId}:`, error);
      // Continue with local updates even if Stripe fails
      // This ensures the subscription is marked for cancellation in our system
    }
  } else {
    console.log(`No Stripe subscription ID found for subscription ${subscriptionId}, skipping Stripe cancellation`);
  }
  
  // Mark subscription as scheduled for cancellation (but keep it active until period end)
  subscription.autoRenew = false;
  await subscription.save();
  
  // Send cancellation email
  const user = await User.findById(subscription.companyId);
  const tier = await Tier.findById(subscription.tierId);

  if (user && tier && subscription.currentPeriodEnd) {
    const { sendSubscriptionCancelledEmail } = require('../email/email.service');
    await sendSubscriptionCancelledEmail(user, tier.name, subscription.currentPeriodEnd.toLocaleDateString());
  }
  
  return subscription;
};

/**
 * Renew subscription by id
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const renewSubscription = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  // Extend subscription by 30 days
  const currentEndDate = new Date(subscription.endDate);
  subscription.endDate = new Date(currentEndDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  subscription.status = 'active';
  await subscription.save();
  return subscription;
};

/**
 * Reactivate subscription by id (removes cancellation schedule)
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const reactivateSubscription = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(new mongoose.Types.ObjectId(subscriptionId));
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  // Check if subscription is scheduled for cancellation
  if (subscription.autoRenew === true) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Subscription is not scheduled for cancellation');
  }
  
  // Remove cancellation schedule from Stripe
  if (subscription.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      console.log(`Successfully reactivated Stripe subscription: ${subscription.stripeSubscriptionId}`);
    } catch (error) {
      console.error(`Failed to reactivate Stripe subscription ${subscription.stripeSubscriptionId}:`, error);
      // Continue with local updates even if Stripe fails
    }
  }
  
  // Update local subscription to reactivate
  subscription.autoRenew = true;
  subscription.status = 'active';
  await subscription.save();
  
  // Send reactivation email
  const user = await User.findById(subscription.companyId);
  const tier = await Tier.findById(subscription.tierId);
  
  if (user && tier && subscription.currentPeriodEnd) {
    const { sendSubscriptionReactivatedEmail } = require('../email/email.service');
    await sendSubscriptionReactivatedEmail(user, tier.name, subscription.currentPeriodEnd.toLocaleDateString());
  }
  
  return subscription;
};

/**
 * Change subscription tier
 * @param {mongoose.Types.ObjectId} subscriptionId
 * @param {mongoose.Types.ObjectId} newTierId
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const changeSubscriptionTier = async (
  subscriptionId: mongoose.Types.ObjectId,
  newTierId: mongoose.Types.ObjectId
): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }
  
  subscription.tierId = newTierId;
  await subscription.save();
  return subscription;
};


/**
 * Mark expired subscriptions
 * @returns {Promise<number>}
 */
export const markExpiredSubscriptions = async (): Promise<number> => {
  const result = await Subscription.updateMany(
    {
      endDate: { $lt: new Date() },
      status: 'active',
    },
    {
      status: 'expired',
    }
  );
  return result.modifiedCount;
};

/**
 * Get subscriptions by status
 * @param {string} status - Subscription status
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getSubscriptionsByStatus = async (status: string): Promise<ISubscriptionDoc[]> => {
  return Subscription.find({ status }).populate('tierId', 'name price billingInterval').populate('companyId', 'firstName lastName email');
};

/**
 * Get subscription by Stripe subscription ID
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @returns {Promise<ISubscriptionDoc | null>}
 */
export const getSubscriptionByStripeId = async (stripeSubscriptionId: string): Promise<ISubscriptionDoc | null> => {
  return Subscription.findOne({ stripeSubscriptionId });
};

/**
 * Get expired subscriptions
 * @returns {Promise<ISubscriptionDoc[]>}
 */
export const getExpiredSubscriptions = async (): Promise<ISubscriptionDoc[]> => {
  return Subscription.find({ 
    status: 'expired',
    autoRenew: true 
  }).populate('tierId', 'name price billingInterval').populate('companyId', 'firstName lastName email');
};

/**
 * Helper function to log subscription changes to history
 */
const logSubscriptionChange = async (
  subscriptionId: mongoose.Types.ObjectId,
  companyId: mongoose.Types.ObjectId,
  oldTier: any,
  newTier: any,
  changeType: 'same-interval-upgrade' | 'cross-interval-upgrade' | 'downgrade' | 'same-price',
  upgradeType: 'immediate' | 'delayed' | undefined,
  priceDifference: number | undefined,
  metadata?: Record<string, any>
) => {
  await SubscriptionHistory.create({
    subscriptionId,
    companyId,
    oldTierId: oldTier?._id,
    newTierId: newTier._id,
    oldPlan: oldTier ? {
      name: oldTier.name,
      price: oldTier.price,
      billingInterval: oldTier.billingInterval,
    } : undefined,
    newPlan: {
      name: newTier.name,
      price: newTier.price,
      billingInterval: newTier.billingInterval,
    },
    priceDifference,
    changeType,
    upgradeType,
    timestamp: new Date(),
    metadata: metadata || {},
  });
};

/**
 * Handle same-interval upgrade (e.g., daily→daily, weekly→weekly)
 * Charges only the difference between current and new plan
 */
const handleSameIntervalUpgrade = async (
  subscription: ISubscriptionDoc,
  currentTier: any,
  newTier: any,
  stripeSubscription: Stripe.Subscription
): Promise<{ subscription: ISubscriptionDoc; invoice?: Stripe.Invoice }> => {
  const subscriptionItemId = stripeSubscription.items.data[0]?.id;
  if (!subscriptionItemId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription item found');
  }

  if (!newTier.stripePriceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'New tier does not have a Stripe price ID');
  }

  // Update subscription with new price, keeping same billing cycle
  const updatedStripeSubscription = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId!,
    {
      items: [
        {
          id: subscriptionItemId,
          price: newTier.stripePriceId,
        },
      ],
      proration_behavior: 'create_prorations', // Charge only the difference
      billing_cycle_anchor: 'unchanged', // Keep same billing cycle
    }
  );

  // Update local subscription immediately
  subscription.tierId = newTier._id;
  subscription.upgradeType = 'immediate';
  subscription.effectiveDate = new Date();
  subscription.pendingTierId = undefined as any; // Clear any pending changes
  await subscription.save();

  // Create and pay invoice for the prorated difference
  let invoice: Stripe.Invoice | undefined;
  try {
    invoice = await stripe.invoices.create({
      customer: stripeSubscription.customer as string,
      subscription: stripeSubscription.id,
      auto_advance: true,
    });

    await stripe.invoices.finalizeInvoice(invoice.id);
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    // Record the prorated revenue
    if ((paidInvoice as any).paid && (paidInvoice as any).amount_paid > 0) {
      const user = await User.findById(subscription.companyId);
      const priceDifference = (paidInvoice as any).amount_paid / 100;
      
      await revenueService.createRevenue({
        subscriptionId: new mongoose.Types.ObjectId(subscription._id),
        companyId: new mongoose.Types.ObjectId(subscription.companyId),
        tierId: new mongoose.Types.ObjectId(newTier._id),
        amount: priceDifference,
        billingInterval: newTier.billingInterval,
        paymentDate: new Date(),
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (invoice as any).payment_intent as string,
        status: 'succeeded',
        currency: invoice.currency || 'usd',
        metadata: {
          periodStart: new Date((updatedStripeSubscription as any).current_period_start * 1000),
          periodEnd: new Date((updatedStripeSubscription as any).current_period_end * 1000),
          tierName: newTier.name,
          companyName: user ? ((user as any).companyName || `${user.firstName} ${user.lastName}`) : 'Unknown',
          changeType: 'same-interval-upgrade',
        },
      });

      // Log to history
      await logSubscriptionChange(
        subscription._id,
        subscription.companyId,
        currentTier,
        newTier,
        'same-interval-upgrade',
        'immediate',
        priceDifference,
        { invoiceId: invoice.id }
      );
    }
  } catch (invoiceError) {
    console.error('Error creating/finalizing invoice for same-interval upgrade:', invoiceError);
  }

  // Send email notification
  const user = await User.findById(subscription.companyId);
  if (user && subscription.currentPeriodEnd) {
    const proratedAmount = invoice ? ((invoice as any).amount_paid / 100) : 0;
    await sendSubscriptionUpgradeEmail(
      user,
      currentTier.name,
      newTier.name,
      currentTier.price,
      newTier.price,
      proratedAmount,
      subscription.currentPeriodEnd
    );
  }

  return invoice ? { subscription, invoice } : { subscription };
};

/**
 * Handle cross-interval upgrade (e.g., daily→weekly, weekly→monthly)
 * Cancels current subscription and starts new one immediately
 * Charges full price of new plan
 */
const handleCrossIntervalUpgrade = async (
  subscription: ISubscriptionDoc,
  currentTier: any,
  newTier: any,
  stripeSubscription: Stripe.Subscription
): Promise<{ subscription: ISubscriptionDoc; invoice?: Stripe.Invoice }> => {
  if (!newTier.stripePriceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'New tier does not have a Stripe price ID');
  }

  // Cancel current subscription immediately
  await stripe.subscriptions.cancel(subscription.stripeSubscriptionId!);

  // Create new subscription immediately with new plan
  const newStripeSubscription = await stripe.subscriptions.create({
    customer: stripeSubscription.customer as string,
    items: [
      {
        price: newTier.stripePriceId,
      },
    ],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  // Update local subscription
  subscription.tierId = newTier._id;
  subscription.stripeSubscriptionId = newStripeSubscription.id;
  subscription.upgradeType = 'immediate';
  subscription.effectiveDate = new Date();
  subscription.pendingTierId = undefined;
  
  // Update period dates from new subscription
  if ((newStripeSubscription as any).current_period_start) {
    subscription.currentPeriodStart = new Date((newStripeSubscription as any).current_period_start * 1000);
  }
  if ((newStripeSubscription as any).current_period_end) {
    subscription.currentPeriodEnd = new Date((newStripeSubscription as any).current_period_end * 1000);
    subscription.endDate = new Date((newStripeSubscription as any).current_period_end * 1000);
  }
  
  await subscription.save();

  // Create and pay invoice for the full new plan price
  let invoice: Stripe.Invoice | undefined;
  try {
    invoice = await stripe.invoices.create({
      customer: stripeSubscription.customer as string,
      subscription: newStripeSubscription.id,
      auto_advance: true,
    });

    await stripe.invoices.finalizeInvoice(invoice.id);
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    // Record the full revenue
    if ((paidInvoice as any).paid && (paidInvoice as any).amount_paid > 0) {
      const user = await User.findById(subscription.companyId);
      
      await revenueService.createRevenue({
        subscriptionId: new mongoose.Types.ObjectId(subscription._id),
        companyId: new mongoose.Types.ObjectId(subscription.companyId),
        tierId: new mongoose.Types.ObjectId(newTier._id),
        amount: (paidInvoice as any).amount_paid / 100,
        billingInterval: newTier.billingInterval,
        paymentDate: new Date(),
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (invoice as any).payment_intent as string,
        status: 'succeeded',
        currency: invoice.currency || 'usd',
        metadata: {
          periodStart: subscription.currentPeriodStart || new Date() as any,
          periodEnd: subscription.currentPeriodEnd || new Date() as any,
          tierName: newTier.name,
          companyName: user ? ((user as any).companyName || `${user.firstName} ${user.lastName}`) : 'Unknown',
          changeType: 'cross-interval-upgrade',
          oldTierName: currentTier.name,
          oldBillingInterval: currentTier.billingInterval,
        },
      });

      // Log to history
      const priceDifference = newTier.price - currentTier.price;
      await logSubscriptionChange(
        subscription._id,
        subscription.companyId,
        currentTier,
        newTier,
        'cross-interval-upgrade',
        'immediate',
        priceDifference,
        { 
          invoiceId: invoice.id,
          oldStripeSubscriptionId: stripeSubscription.id,
          newStripeSubscriptionId: newStripeSubscription.id,
        }
      );
    }
  } catch (invoiceError) {
    console.error('Error creating/finalizing invoice for cross-interval upgrade:', invoiceError);
  }

  // Send email notification
  const user = await User.findById(subscription.companyId);
  if (user && subscription.currentPeriodEnd) {
    await sendSubscriptionUpgradeEmail(
      user,
      currentTier.name,
      newTier.name,
      currentTier.price,
      newTier.price,
      newTier.price, // Full price charged
      subscription.currentPeriodEnd
    );
  }

  return invoice ? { subscription, invoice } : { subscription };
};

/**
 * Handle subscription upgrade (routes to same-interval or cross-interval handler)
 */
export const upgradeSubscription = async (
  subscriptionId: mongoose.Types.ObjectId,
  newTierId: mongoose.Types.ObjectId
): Promise<{ subscription: ISubscriptionDoc; invoice?: Stripe.Invoice }> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  if (!subscription.stripeSubscriptionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Subscription does not have a Stripe subscription ID');
  }

  // Get current and new tier details
  const currentTier = await Tier.findById(subscription.tierId);
  const newTier = await Tier.findById(newTierId);

  if (!currentTier || !newTier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
  }

  // Get Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

  // Determine if same-interval or cross-interval upgrade
  const isSameInterval = currentTier.billingInterval === newTier.billingInterval;

  if (isSameInterval) {
    // Same interval: charge only the difference
    return handleSameIntervalUpgrade(subscription, currentTier, newTier, stripeSubscription);
  } else {
    // Cross-interval: cancel old, create new, charge full price
    return handleCrossIntervalUpgrade(subscription, currentTier, newTier, stripeSubscription);
  }
};

/**
 * Handle subscription downgrade (any higher → lower plan)
 * Marks as pending and applies at period end - no immediate change or refund
 */
export const downgradeSubscription = async (
  subscriptionId: mongoose.Types.ObjectId,
  newTierId: mongoose.Types.ObjectId
): Promise<ISubscriptionDoc> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  if (!subscription.stripeSubscriptionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Subscription does not have a Stripe subscription ID');
  }

  // Get current and new tier details
  const currentTier = await Tier.findById(subscription.tierId);
  const newTier = await Tier.findById(newTierId);

  if (!currentTier || !newTier) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
  }

  // Mark downgrade as pending - do NOT change Stripe subscription immediately
  // The change will be applied when the current billing cycle ends
  subscription.pendingTierId = newTierId;
  subscription.upgradeType = 'delayed';
  subscription.effectiveDate = subscription.currentPeriodEnd || subscription.endDate; // Apply at period end
  await subscription.save();

  // Log to history
  const priceDifference = newTier.price - currentTier.price;
  await logSubscriptionChange(
    subscription._id,
    subscription.companyId,
    currentTier,
    newTier,
    'downgrade',
    'delayed',
    priceDifference,
    { 
      effectiveDate: subscription.effectiveDate,
      note: 'Downgrade scheduled for period end - no immediate change or refund',
    }
  );

  // Send email notification
  const user = await User.findById(subscription.companyId);
  if (user && subscription.currentPeriodEnd) {
    await sendSubscriptionDowngradeEmail(
      user,
      currentTier.name,
      newTier.name,
      currentTier.price,
      newTier.price,
      subscription.currentPeriodEnd
    );
  }

  return subscription;
};

/**
 * Apply pending downgrade when billing period ends
 * Called by webhook handler when subscription period ends
 */
export const applyPendingDowngrade = async (subscriptionId: mongoose.Types.ObjectId): Promise<ISubscriptionDoc | null> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    return null;
  }

  // Check if there's a pending downgrade
  if (!subscription.pendingTierId || subscription.upgradeType !== 'delayed') {
    return subscription; // No pending downgrade
  }

  if (!subscription.stripeSubscriptionId) {
    console.error(`Subscription ${subscriptionId} has pending downgrade but no Stripe subscription ID`);
    return subscription;
  }

  // Get pending tier details
  const pendingTier = await Tier.findById(subscription.pendingTierId);
  const currentTier = await Tier.findById(subscription.tierId);

  if (!pendingTier) {
    console.error(`Pending tier ${subscription.pendingTierId} not found`);
    return subscription;
  }

  if (!pendingTier.stripePriceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Pending tier does not have a Stripe price ID');
  }

  // Get Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

  // Get price item from subscription
  const subscriptionItemId = stripeSubscription.items.data[0]?.id;
  if (!subscriptionItemId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription item found');
  }

  // Update Stripe subscription to new tier (no proration, new billing cycle)
  await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [
        {
          id: subscriptionItemId,
          price: pendingTier.stripePriceId,
        },
      ],
      proration_behavior: 'none', // No refund for unused time
      billing_cycle_anchor: 'now', // Start new billing cycle immediately
    }
  );

  // Update local subscription
  subscription.tierId = subscription.pendingTierId;
  subscription.pendingTierId = undefined;
  subscription.upgradeType = undefined;
  subscription.effectiveDate = undefined;
  await subscription.save();

  // Log to history
  if (currentTier) {
    const priceDifference = pendingTier.price - currentTier.price;
    await logSubscriptionChange(
      subscription._id,
      subscription.companyId,
      currentTier,
      pendingTier,
      'downgrade',
      'immediate', // Now applied
      priceDifference,
      { 
        note: 'Pending downgrade applied at period end',
        appliedAt: new Date(),
      }
    );
  }

  return subscription;
};

/**
 * Cancel subscription at period end
 */
export const cancelSubscriptionAtPeriodEnd = async (subscriptionId: mongoose.Types.ObjectId): Promise<void> => {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  if (!subscription.stripeSubscriptionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Subscription does not have a Stripe subscription ID');
  }

  // Cancel at period end
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Update local subscription
  subscription.autoRenew = false;
  await subscription.save();

  // Get user and tier for email
  const user = await User.findById(subscription.companyId);
  const tier = await Tier.findById(subscription.tierId);

  if (user && tier && subscription.currentPeriodEnd) {
    const { sendSubscriptionCancelledEmail } = require('../email/email.service');
    await sendSubscriptionCancelledEmail(user, tier.name, subscription.currentPeriodEnd.toLocaleDateString());
  }
};
