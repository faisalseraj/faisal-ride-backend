import * as revenueService from '../revenue/revenue.service';

import { Request, Response } from 'express';
import {
  sendInvoiceCreatedEmail,
  sendInvoicePaidEmail,
  sendSubscriptionExpiryReminderEmail,
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionPaymentRetryEmail,
  sendSubscriptionPaymentSuccessEmail,
  sendSubscriptionRenewalEmail
} from '../email/email.service';

import { StatusEnum } from '../logs/log.interfaces';
import Stripe from 'stripe';
import config from '../../config/config';
import { createEnhancedLog } from '../logs/enhanced-log.service';
import mongoose from 'mongoose';
import { subscriptionService } from '../subscriptions';
import { tierService } from '../tiers';
import { userService } from '../user';

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-09-30.clover',
});

// Webhook endpoint secret for signature verification
const webhookSecret = config.stripe.webhookSecret;

/**
 * Calculate next billing date with fallback
 */
const calculateNextBillingDate = (periodEnd: number | undefined, tierInfo?: any): string => {
  if (periodEnd && typeof periodEnd === 'number') {
    return new Date(periodEnd * 1000).toLocaleDateString();
  }
  
  // Fallback: calculate based on tier billing interval or default to 30 days
  const now = new Date();
  let daysToAdd = 30; // Default fallback
  
  if (tierInfo?.billingInterval) {
    switch (tierInfo.billingInterval.toLowerCase()) {
      case 'monthly':
        daysToAdd = 30;
        break;
      case 'yearly':
      case 'annual':
        daysToAdd = 365;
        break;
      case 'weekly':
        daysToAdd = 7;
        break;
      case 'daily':
        daysToAdd = 1;
        break;
      default:
        daysToAdd = 30;
    }
  }
  
  const fallbackDate = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
  return fallbackDate.toLocaleDateString();
};

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(`Received webhook event: ${event.type}`);
  
  // Send detailed webhook alert (commented out - working as expected)
  // await sendWebhookCallAlertToMe({
  //   type: `WEBHOOK_RECEIVED_${event.type}`,
  //   timestamp: new Date().toISOString(),
  //   eventType: event.type,
  //   eventId: event.id,
  //   data: event.data
  // });

  try {
    // Handle the event
    // const eventTime = new Date().toISOString();
    // console.log(`Processing webhook event: ${event.type} at ${eventTime}`);
    // console.log('Event data:', JSON.stringify(event.data, null, 2));
    
    switch (event.type) {
      case 'checkout.session.completed':
        // console.log('Handling checkout.session.completed');
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        // console.log('Handling customer.subscription.created');
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.paid':
        console.log('Handling invoice.paid - adding delay to ensure subscription is created');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        console.log('Handling invoice.payment_succeeded - adding delay to ensure subscription is created');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.created':
        await handlePaymentIntentCreated(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }
};

/**
 * Handle checkout session completed event
 */
const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  try {
    console.log(`Checkout session completed: ${session.id}`);

    // This event is fired when checkout is completed
    // The subscription will be created by the customer.subscription.created webhook
    // We just log this for tracking purposes

    await createEnhancedLog({
      user: {
        _id: new mongoose.Types.ObjectId('000000000000000000000001'),
        id: new mongoose.Types.ObjectId('000000000000000000000001'),
        firstName: 'Stripe',
        lastName: 'Checkout',
        fullName: 'Stripe Checkout',
        userType: 'admin' as any,
        country: 'Global',
      },
      event: 'Checkout session completed',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'checkout_completed',
      action: 'webhook_checkout_completed',
      priority: 'medium',
      status: StatusEnum.LOGIN_SUCCESS,
      metadata: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
        subscriptionId: session.subscription,
      },
    });

    console.log(`Checkout session completed: ${session.id} - Payment: ${session.payment_status}`);
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
};

/**
 * Handle subscription created event
 */
const handleSubscriptionCreated = async (subscription: Stripe.Subscription) => {
  try {
    // console.log('=== SUBSCRIPTION CREATED WEBHOOK DEBUG ===');
    // console.log('Subscription ID:', subscription.id);
    // console.log('Customer ID:', subscription.customer);
    // console.log('Status:', subscription.status);
    
    const customerId = subscription.customer as string;
    const priceId = subscription.items.data[0]?.price.id;

    // console.log('Price ID from subscription items:', priceId);
    // console.log('Subscription items data:', JSON.stringify(subscription.items.data, null, 2));

    if (!priceId) {
      console.error('No price ID found in subscription');
      return;
    }

    // Get price details to find tier
    // console.log('Retrieving price details for:', priceId);
    const price = await stripe.prices.retrieve(priceId);
    // console.log('Retrieved price metadata:', price.metadata);
    
    const tierId = price.metadata?.['tierId'];
    // console.log('Extracted tier ID:', tierId);

    if (!tierId) {
      console.error('No tier ID found in price metadata');
      console.error('Available metadata keys:', Object.keys(price.metadata || {}));
      return;
    }

    // Find user by Stripe customer ID
    // console.log('Looking up user by Stripe customer ID:', customerId);
    const user = await userService.getUserByStripeCustomerId(customerId);
    // console.log('User found:', user ? `${user.email} (${user._id})` : 'NOT FOUND');
    
    if (!user) {
      console.error(`User not found for customer ID: ${customerId}`);
      return;
    }

    // Get period information from subscription items
    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) {
      console.error('No subscription item found in subscription');
      return;
    }
    
    const currentPeriodStart = subscriptionItem.current_period_start;
    const currentPeriodEnd = subscriptionItem.current_period_end;
    
    // console.log('Period information:', {
    //   currentPeriodStart,
    //   currentPeriodEnd,
    //   startDate: new Date(currentPeriodStart * 1000),
    //   endDate: new Date(currentPeriodEnd * 1000)
    // });

    // Create subscription record in our database
    const subscriptionData = {
      companyId: user._id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      tierId: new mongoose.Types.ObjectId(tierId),
      status: subscription.status,
      startDate: new Date(currentPeriodStart * 1000),
      endDate: new Date(currentPeriodEnd * 1000),
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      autoRenew: true, // Stripe subscriptions auto-renew by default
    };

    // console.log('Creating subscription with data:', JSON.stringify(subscriptionData, null, 2));
    
    let createdSubscription;
    try {
      createdSubscription = await subscriptionService.createSubscription(subscriptionData);
      // console.log('Subscription created successfully:', createdSubscription._id);
    } catch (createError: any) {
      console.error('Error creating subscription:', createError);
      console.error('Error message:', createError.message);
      console.error('Error status:', createError.statusCode);
      
      // If subscription already exists, try to get it instead
      if (createError.message && createError.message.includes('already has an active subscription')) {
        // console.log('Subscription already exists, attempting to retrieve existing subscription...');
        const existingSubscription = await subscriptionService.getSubscriptionByStripeId(subscription.id);
        if (existingSubscription) {
          // console.log('Found existing subscription:', existingSubscription._id);
          createdSubscription = existingSubscription;
        } else {
          throw createError;
        }
      } else {
        throw createError;
      }
    }

    // Get tier information for email using the created subscription
    const tier = await subscriptionService.getSubscriptionByIdWithDetails(createdSubscription._id);

    const tierInfo = tier?.tierId ? await tierService.getTierById(tier.tierId) : null;

    // Send subscription created email using existing service
    if (tierInfo) {
      const nextBillingDate = calculateNextBillingDate(currentPeriodEnd, tierInfo);
      
      if (!currentPeriodEnd) {
        console.warn('current_period_end not available, using fallback date:', nextBillingDate);
      }

      try {
        await sendSubscriptionPaymentSuccessEmail(user, tierInfo.name, tierInfo.price, nextBillingDate);
        // console.log('Subscription payment success email sent successfully');
      } catch (emailError) {
        console.error('Error sending subscription payment success email:', emailError);
      }
    } else {
      console.error('No tier info available for email sending');
    }

    // Log subscription creation
    await createEnhancedLog({
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        userType: user.userType,
        country: user.country || 'Unknown',
      },
      event: 'Subscription created via webhook',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'subscription_created',
      action: 'webhook_subscription_created',
      priority: 'medium',
      status: StatusEnum.LOGIN_SUCCESS,
      metadata: {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        tierId: tierId,
        status: subscription.status,
      },
    });

    // console.log(`Subscription created for user ${user.email}: ${subscription.id}`);
    // console.log('=== SUBSCRIPTION CREATED WEBHOOK COMPLETED ===');
    
    // Send success alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'SUBSCRIPTION_CREATED_SUCCESS',
    //   timestamp: new Date().toISOString(),
    //   message: `Subscription successfully created for user ${user.email}`,
    //   subscriptionId: subscription.id,
    //   userId: user._id,
    //   userEmail: user.email,
    //   tierId: tierId,
    //   status: subscription.status
    // });
  } catch (error) {
    console.error('Error handling subscription created:', error);
    // console.error('=== SUBSCRIPTION CREATED WEBHOOK FAILED ===');
    
    // Send failure alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'SUBSCRIPTION_CREATED_FAILED',
    //   timestamp: new Date().toISOString(),
    //   message: 'Failed to create subscription',
    //   error: error instanceof Error ? error.message : String(error),
    //   subscriptionId: subscription?.id,
    //   customerId: subscription?.customer
    // });
  }
};

/**
 * Handle subscription updated event
 */
const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  try {
    const stripeSubscriptionId = subscription.id;

    // Find existing subscription
    let existingSubscription = await subscriptionService.getSubscriptionByStripeId(stripeSubscriptionId);
    if (!existingSubscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`);
      return;
    }

    // Store old status and period for comparison
    const oldStatus = existingSubscription.status;
    const oldPeriodEnd = existingSubscription.currentPeriodEnd;

    // Get period information from subscription items
    const subscriptionItem = subscription.items.data[0];
    const currentPeriodStart = subscriptionItem?.current_period_start as number;
    const currentPeriodEnd = subscriptionItem?.current_period_end as number;

    // Check if this is a billing cycle renewal (period changed but status is still active)
    const isBillingCycleRenewal = subscription.status === 'active' && 
      oldStatus === 'active' && 
      oldPeriodEnd && 
      new Date(currentPeriodStart * 1000).getTime() === oldPeriodEnd.getTime();

    // Check if there's a pending downgrade that should be applied
    if (isBillingCycleRenewal && existingSubscription.pendingTierId && existingSubscription.upgradeType === 'delayed') {
      // Apply pending downgrade when billing period ends
      await subscriptionService.applyPendingDowngrade(existingSubscription._id);
      // Re-fetch subscription after applying downgrade
      const updatedSubscription = await subscriptionService.getSubscriptionByStripeId(stripeSubscriptionId);
      if (updatedSubscription) {
        existingSubscription = updatedSubscription;
      }
    }

    // Update subscription status and dates
    existingSubscription.status = subscription.status;
    existingSubscription.currentPeriodStart = new Date(currentPeriodStart * 1000);
    existingSubscription.currentPeriodEnd = new Date(currentPeriodEnd * 1000);

    if (subscription.status === 'active') {
      existingSubscription.startDate = new Date(currentPeriodStart * 1000);
      existingSubscription.endDate = new Date(currentPeriodEnd * 1000);
    }

    await existingSubscription.save();

    // Get user and tier information for email
    const user = await userService.getUserById(existingSubscription.companyId);
    const tierInfo = await tierService.getTierById(existingSubscription.tierId);

    // Send appropriate email based on status change or billing cycle renewal
    if (user && tierInfo && (oldStatus !== subscription.status || isBillingCycleRenewal)) {
      switch (subscription.status) {
        case 'active':
          if (oldStatus === 'past_due') {
            // Payment was successful after being past due
            const nextBillingDate = calculateNextBillingDate(currentPeriodEnd, tierInfo);
            
            if (!currentPeriodEnd) {
              console.warn('current_period_end not available in subscription update, using fallback date:', nextBillingDate);
            }
            
            await sendSubscriptionPaymentSuccessEmail(
              user,
              tierInfo.name,
              tierInfo.price,
              nextBillingDate
            );
          } else if (isBillingCycleRenewal) {
            // Billing cycle renewal - send renewal notification
            const nextBillingDate = calculateNextBillingDate(currentPeriodEnd, tierInfo);
            
            console.log('Billing cycle renewal detected, sending renewal email');
            await sendSubscriptionRenewalEmail(
              user,
              tierInfo.name,
              tierInfo.price,
              nextBillingDate
            );
          }
          break;
        case 'past_due':
          // Payment failed
          const retryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString();
          await sendSubscriptionPaymentRetryEmail(user, tierInfo.name, tierInfo.price, retryDate);
          break;
        case 'canceled':
          // Subscription was canceled
          const { sendSubscriptionCancellationCompletedEmail } = require('../email/email.service');
          await sendSubscriptionCancellationCompletedEmail(user, tierInfo.name, new Date().toLocaleDateString());
          break;
      }
    }

    // Log subscription update
    await createEnhancedLog({
      user: {
        _id: existingSubscription.companyId,
        id: existingSubscription.companyId,
        firstName: 'User',
        lastName: '',
        fullName: 'User',
        userType: 'tow-company-owner' as any,
        country: 'Unknown',
      },
      event: 'Subscription updated via webhook',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'subscription_updated',
      action: 'webhook_subscription_updated',
      priority: 'medium',
      status: StatusEnum.LOGIN_SUCCESS,
      metadata: {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        previousStatus: existingSubscription.status,
      },
    });

    console.log(`Subscription updated: ${stripeSubscriptionId} - Status: ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
};

/**
 * Handle subscription deleted event
 */
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const stripeSubscriptionId = subscription.id;
  try {

    // Find and update subscription
    const existingSubscription = await subscriptionService.getSubscriptionByStripeId(stripeSubscriptionId);
    if (!existingSubscription) {
      console.error(`Subscription not found: ${stripeSubscriptionId}`);
      return;
    }

    existingSubscription.status = 'canceled';
    await existingSubscription.save();

    // Get user and tier information for email
    const user = await userService.getUserById(existingSubscription.companyId);
    const tierInfo = await tierService.getTierById(existingSubscription.tierId);

    // Send subscription cancellation completed email using existing service
    if (user && tierInfo) {
      const cancelDate = new Date().toLocaleDateString();
      const { sendSubscriptionCancellationCompletedEmail } = require('../email/email.service');
      await sendSubscriptionCancellationCompletedEmail(user, tierInfo.name, cancelDate);
    }

    // Log subscription cancellation
    await createEnhancedLog({
      user: {
        _id: existingSubscription.companyId,
        id: existingSubscription.companyId,
        firstName: 'User',
        lastName: '',
        fullName: 'User',
        userType: 'tow-company-owner' as any,
        country: 'Unknown',
      },
      event: 'Subscription canceled via webhook',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'subscription_canceled',
      action: 'webhook_subscription_canceled',
      priority: 'high',
      status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL,
      metadata: {
        stripeSubscriptionId: subscription.id,
        canceledAt: new Date().toISOString(),
      },
    });

    // console.log(`Subscription canceled: ${stripeSubscriptionId}`);
    
    // Send cancellation alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'SUBSCRIPTION_CANCELED_ALERT',
    //   timestamp: new Date().toISOString(),
    //   message: `Subscription canceled for user ${user?.email || 'Unknown'}`,
    //   subscriptionId: stripeSubscriptionId,
    //   userId: existingSubscription.companyId,
    //   userEmail: user?.email,
    //   tierName: tierInfo?.name,
    //   cancelDate: new Date().toISOString()
    // });
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    
    // Send failure alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'SUBSCRIPTION_CANCELED_HANDLER_ERROR',
    //   timestamp: new Date().toISOString(),
    //   message: 'Failed to process subscription canceled event',
    //   error: error instanceof Error ? error.message : String(error),
    //   subscriptionId: stripeSubscriptionId
    // });
  }
};

/**
 * Handle successful invoice payment
 */
const handleInvoicePaymentSucceeded = async (invoice: Stripe.Invoice) => {
  try {
    // console.log('Processing invoice.payment_succeeded event:', invoice.id);
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) {
      // console.log('No subscription ID found in invoice');
      return;
    }

    // console.log('Looking for subscription:', subscriptionId);
    
    // Add a small delay to ensure subscription.created has completed
    // console.log('Waiting 2 seconds to ensure subscription is created...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get subscription with retry logic
    let subscription = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!subscription && retryCount < maxRetries) {
      // console.log(`Attempting to find subscription by Stripe ID (attempt ${retryCount + 1}/${maxRetries}):`, subscriptionId);
      subscription = await subscriptionService.getSubscriptionByStripeId(subscriptionId);
      
      if (!subscription) {
        retryCount++;
        if (retryCount < maxRetries) {
          // console.log(`Subscription not found, waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!subscription) {
      console.error(`Subscription not found for invoice after retries: ${invoice.id}`);
      
      // Send critical error alert (commented out - working as expected)
      // await sendWebhookCallAlertToMe({
      //   type: 'CRITICAL_ERROR_SUBSCRIPTION_NOT_FOUND_PAYMENT_SUCCEEDED',
      //   timestamp: new Date().toISOString(),
      //   message: 'Subscription not found after retries in payment.succeeded handler',
      //   subscriptionId: subscriptionId,
      //   invoiceId: invoice.id,
      //   retryCount: maxRetries
      // });
      return;
    }
    
    // console.log('Subscription found:', subscription._id);

    const user = await userService.getUserById(subscription.companyId);
    if (!user) {
      console.error(`User not found for subscription: ${subscriptionId}`);
      return;
    }
    
    // console.log('User found:', user.email);

    // Update subscription status to active
    subscription.status = 'active';
    subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
    subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
    await subscription.save();

    // Get tier information
    const tier = await tierService.getTierById(subscription.tierId);
    const amount = invoice.amount_paid / 100; // Convert from cents

    // Record revenue
    if (tier) {
      await revenueService.createRevenue({
        subscriptionId: new mongoose.Types.ObjectId(subscription._id),
        companyId: new mongoose.Types.ObjectId(subscription.companyId),
        tierId: new mongoose.Types.ObjectId(subscription.tierId),
        amount: amount,
        billingInterval: tier.billingInterval,
        paymentDate: new Date(),
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (invoice as any).payment_intent as string,
        status: 'succeeded',
        currency: invoice.currency || 'usd',
        metadata: {
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          tierName: tier.name,
          companyName: (user as any).companyName || `${user.firstName} ${user.lastName}`,
        },
      });
    }

    // Send success email using existing service
    const nextBillingDate = calculateNextBillingDate(invoice.period_end, tier);
    
    if (!invoice.period_end) {
      console.warn('period_end not available in invoice, using fallback date:', nextBillingDate);
    }
    
    if (tier) {
      await sendSubscriptionPaymentSuccessEmail(
        user,
        tier.name,
        amount,
        nextBillingDate
      );
    }

    // Log successful payment
    await createEnhancedLog({
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        userType: user.userType,
        country: user.country || 'Unknown',
      },
      event: 'Subscription payment succeeded',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'payment_success',
      action: 'webhook_payment_succeeded',
      priority: 'medium',
      status: StatusEnum.LOGIN_SUCCESS,
      metadata: {
        stripeSubscriptionId: subscriptionId,
        invoiceId: invoice.id,
        amount: amount,
        periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      },
    });

    // console.log(`Payment succeeded for subscription: ${subscriptionId}`);
    
    // Send success alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'PAYMENT_SUCCEEDED_SUCCESS',
    //   timestamp: new Date().toISOString(),
    //   message: `Payment succeeded for user ${user.email}`,
    //   subscriptionId: subscriptionId,
    //   userId: user._id,
    //   userEmail: user.email,
    //   amount: amount,
    //   tierName: tier.name
    // });
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
    
    // Send failure alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'PAYMENT_SUCCEEDED_FAILED',
    //   timestamp: new Date().toISOString(),
    //   message: 'Failed to process payment succeeded event',
    //   error: error instanceof Error ? error.message : String(error),
    //   subscriptionId: (invoice as any).subscription,
    //   invoiceId: invoice.id
    // });
  }
};

/**
 * Handle failed invoice payment
 */
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  try {
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const subscription = await subscriptionService.getSubscriptionByStripeId(subscriptionId);
    if (!subscription) {
      console.error(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }

    const user = await userService.getUserById(subscription.companyId);
    if (!user) {
      console.error(`User not found for subscription: ${subscriptionId}`);
      return;
    }

    // Update subscription status to past_due
    subscription.status = 'past_due';
    await subscription.save();

    // Get tier information
    const tier = await tierService.getTierById(subscription.tierId);
    const amount = invoice.amount_due / 100; // Convert from cents
    const retryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    // Send failure email using existing service
    if (tier) {
      await sendSubscriptionPaymentFailedEmail(user, tier.name, retryDate.toLocaleDateString());
    }

    // Log failed payment
    await createEnhancedLog({
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        userType: user.userType,
        country: user.country || 'Unknown',
      },
      event: 'Subscription payment failed',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'payment_failed',
      action: 'webhook_payment_failed',
      priority: 'high',
      status: StatusEnum.INCORRECT_PASSWORD_OR_EMAIL,
      metadata: {
        stripeSubscriptionId: subscriptionId,
        invoiceId: invoice.id,
        amount: amount,
        retryDate: retryDate.toISOString(),
      },
    });

    // console.log(`Payment failed for subscription: ${subscriptionId}`);
    
    // Send payment failed alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'PAYMENT_FAILED_ALERT',
    //   timestamp: new Date().toISOString(),
    //   message: `Payment failed for user ${user.email}`,
    //   subscriptionId: subscriptionId,
    //   userId: user._id,
    //   userEmail: user.email,
    //   amount: amount,
    //   tierName: tier.name,
    //   retryDate: retryDate.toISOString()
    // });
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
    
    // Send failure alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'PAYMENT_FAILED_HANDLER_ERROR',
    //   timestamp: new Date().toISOString(),
    //   message: 'Failed to process payment failed event',
    //   error: error instanceof Error ? error.message : String(error),
    //   subscriptionId: (invoice as any).subscription,
    //   invoiceId: invoice.id
    // });
  }
};

/**
 * Handle upcoming invoice (reminder)
 */
const handleInvoiceUpcoming = async (invoice: Stripe.Invoice) => {
  try {
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const subscription = await subscriptionService.getSubscriptionByStripeId(subscriptionId);
    if (!subscription) {
      console.error(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }

    const user = await userService.getUserById(subscription.companyId);
    if (!user) {
      console.error(`User not found for subscription: ${subscriptionId}`);
      return;
    }

    // Get tier information
    const tier = await tierService.getTierById(subscription.tierId);
    const amount = invoice.amount_due / 100; // Convert from cents
    const dueDate = new Date(invoice.period_end * 1000);
    const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    // Send reminder email using existing service (only if due in 7 days or less)
    if (daysUntilDue <= 7 && tier) {
      await sendSubscriptionExpiryReminderEmail(user, tier.name, amount, dueDate.toLocaleDateString(), daysUntilDue);

      // Log reminder sent
      await createEnhancedLog({
        user: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName || '',
          fullName: user.fullName || '',
          userType: user.userType,
          country: user.country || 'Unknown',
        },
        event: `Subscription reminder sent - ${daysUntilDue} days until renewal`,
        eventEnum: 'SUBSCRIPTION' as any,
        category: 'subscription_reminder',
        action: 'webhook_reminder_sent',
        priority: 'medium',
        status: StatusEnum.LOGIN_SUCCESS,
        metadata: {
          stripeSubscriptionId: subscriptionId,
          invoiceId: invoice.id,
          amount: amount,
          dueDate: dueDate.toISOString(),
          daysUntilDue,
        },
      });

      console.log(`Reminder sent for subscription: ${subscriptionId} - ${daysUntilDue} days until renewal`);
    }
  } catch (error) {
    console.error('Error handling invoice upcoming:', error);
  }
};

/**
 * Handle invoice created event
 */
const handleInvoiceCreated = async (invoice: Stripe.Invoice) => {
  try {
    console.log('Processing invoice.created event:', invoice.id);
    
    // Get user by customer ID
    const user = await userService.getUserByStripeCustomerId(invoice.customer as string);
    if (!user) {
      console.log('User not found for customer:', invoice.customer);
      return;
    }

    // Get subscription details
    const subscription = await subscriptionService.getSubscriptionByStripeId((invoice as any).subscription as string);
    if (!subscription) {
      console.log('Subscription not found:', (invoice as any).subscription);
      return;
    }

    // Get tier information
    const tier = await tierService.getTierById(subscription.tierId);
    const amount = invoice.amount_due / 100; // Convert from cents
    const nextBillingDate = calculateNextBillingDate(invoice.period_end, tier);

    console.log('Invoice created for user:', user.email, 'Amount:', amount, 'Next billing:', nextBillingDate);

    // Send invoice created email
    if (tier) {
      await sendInvoiceCreatedEmail(user, tier.name, amount, nextBillingDate);
    }

    // Log invoice creation
    await createEnhancedLog({
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName || '',
        fullName: user.fullName || '',
        userType: user.userType,
        country: user.country || 'Unknown',
      },
      event: 'Invoice created for subscription',
      eventEnum: 'SUBSCRIPTION' as any,
      category: 'invoice_created',
      action: 'webhook_invoice_created',
      priority: 'medium',
      status: StatusEnum.LOGIN_SUCCESS,
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: (invoice as any).subscription,
        amount: amount,
        periodEnd: new Date(invoice.period_end * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error handling invoice.created:', error);
    throw error;
  }
};

/**
 * Handle invoice finalized event
 */
const handleInvoiceFinalized = async (invoice: Stripe.Invoice) => {
  try {
    // console.log('Processing invoice.finalized event:', invoice.id);
    
    // Get user by customer ID
    const user = await userService.getUserByStripeCustomerId(invoice.customer as string);
    if (!user) {
      // console.log('User not found for customer:', invoice.customer);
      return;
    }

    // Get subscription details
    const subscription = await subscriptionService.getSubscriptionByStripeId((invoice as any).subscription as string);
    if (!subscription) {
      // console.log('Subscription not found:', (invoice as any).subscription);
      return;
    }

    // console.log('Invoice finalized for user:', user.email, 'Amount:', invoice.amount_due / 100);
  } catch (error) {
    console.error('Error handling invoice.finalized:', error);
    throw error;
  }
};

/**
 * Handle invoice paid event
 */
const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
  try {
    // console.log('Processing invoice.paid event:', invoice.id);
    // console.log('Invoice customer:', invoice.customer);
    // console.log('Invoice subscription:', (invoice as any).subscription);
    
    // Add a small delay to ensure subscription.created has completed
    // console.log('Waiting 2 seconds to ensure subscription is created...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get user by customer ID with retry logic
    let user = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!user && retryCount < maxRetries) {
      // console.log(`Attempting to find user by Stripe customer ID (attempt ${retryCount + 1}/${maxRetries}):`, invoice.customer);
      user = await userService.getUserByStripeCustomerId(invoice.customer as string);
      
      if (!user) {
        retryCount++;
        if (retryCount < maxRetries) {
          // console.log(`User not found, waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!user) {
      console.error('User not found for customer after retries:', invoice.customer);
      
      // Send critical error alert (commented out - working as expected)
      // await sendWebhookCallAlertToMe({
      //   type: 'CRITICAL_ERROR_USER_NOT_FOUND',
      //   timestamp: new Date().toISOString(),
      //   message: 'User not found after retries in invoice.paid handler',
      //   customerId: invoice.customer,
      //   invoiceId: invoice.id,
      //   subscriptionId: (invoice as any).subscription,
      //   retryCount: maxRetries
      // });
      return;
    }
    
    // console.log('User found:', user.email);

    // Get subscription details with retry logic
    let subscription = null;
    retryCount = 0;
    
    while (!subscription && retryCount < maxRetries) {
      // console.log(`Attempting to find subscription by Stripe ID (attempt ${retryCount + 1}/${maxRetries}):`, (invoice as any).subscription);
      subscription = await subscriptionService.getSubscriptionByStripeId((invoice as any).subscription as string);
      
      if (!subscription) {
        retryCount++;
        if (retryCount < maxRetries) {
          // console.log(`Subscription not found, waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!subscription) {
      console.error('Subscription not found after retries:', (invoice as any).subscription);
      
      // Send critical error alert (commented out - working as expected)
      // await sendWebhookCallAlertToMe({
      //   type: 'CRITICAL_ERROR_SUBSCRIPTION_NOT_FOUND',
      //   timestamp: new Date().toISOString(),
      //   message: 'Subscription not found after retries in invoice.paid handler',
      //   subscriptionId: (invoice as any).subscription,
      //   invoiceId: invoice.id,
      //   customerId: invoice.customer,
      //   retryCount: maxRetries
      // });
      return;
    }
    
    // console.log('Subscription found:', subscription._id);

    // Get tier information
    const tier = await tierService.getTierById(subscription.tierId);

    // Record revenue
    if (tier) {
      const amount = invoice.amount_paid / 100; // Convert from cents
      
      await revenueService.createRevenue({
        subscriptionId: new mongoose.Types.ObjectId(subscription._id),
        companyId: new mongoose.Types.ObjectId(subscription.companyId),
        tierId: new mongoose.Types.ObjectId(subscription.tierId),
        amount: amount,
        billingInterval: tier.billingInterval,
        paymentDate: new Date(),
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: (invoice as any).payment_intent as string,
        status: 'succeeded',
        currency: invoice.currency || 'usd',
        metadata: {
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          tierName: tier.name,
          companyName: (user as any).companyName || `${user.firstName} ${user.lastName}`,
        },
      });
    }

    // Send invoice paid email with PDF attachment
    if (tier) {
      await sendInvoicePaidEmail({
        to: user.email || 'user@example.com',
        firstName: user.firstName || 'User',
        subscriptionId: subscription._id.toString(),
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency.toUpperCase(),
        paymentDate: new Date((invoice.status_transitions.paid_at || Date.now() / 1000) * 1000),
        tierName: tier.name,
        billingInterval: tier.billingInterval,
        invoiceId: invoice.id,
        invoiceUrl: invoice.invoice_pdf || null
      });
    }

    // console.log('Invoice paid email sent successfully');
    // console.log('=== INVOICE PAID WEBHOOK COMPLETED ===');
    
    // Send success alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'INVOICE_PAID_SUCCESS',
    //   timestamp: new Date().toISOString(),
    //   message: `Invoice paid successfully for user ${user.email}`,
    //   invoiceId: invoice.id,
    //   subscriptionId: (invoice as any).subscription,
    //   userId: user._id,
    //   userEmail: user.email,
    //   amount: invoice.amount_paid / 100,
    //   currency: invoice.currency
    // });
  } catch (error) {
    console.error('Error handling invoice.paid:', error);
    // console.error('=== INVOICE PAID WEBHOOK FAILED ===');
    
    // Send failure alert (commented out - working as expected)
    // await sendWebhookCallAlertToMe({
    //   type: 'INVOICE_PAID_FAILED',
    //   timestamp: new Date().toISOString(),
    //   message: 'Failed to process invoice paid event',
    //   error: error instanceof Error ? error.message : String(error),
    //   invoiceId: invoice.id,
    //   subscriptionId: (invoice as any).subscription,
    //   customerId: invoice.customer
    // });
    
    throw error;
  }
};

/**
 * Handle payment intent created event
 */
const handlePaymentIntentCreated = async (_paymentIntent: Stripe.PaymentIntent) => {
  try {
    // console.log('Processing payment_intent.created event:', paymentIntent.id);
    // console.log('Payment intent amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
  } catch (error) {
    console.error('Error handling payment_intent.created:', error);
    throw error;
  }
};

/**
 * Handle payment intent succeeded event
 */
const handlePaymentIntentSucceeded = async (paymentIntent: Stripe.PaymentIntent) => {
  try {
    console.log('Processing payment_intent.succeeded event:', paymentIntent.id);
    console.log('Payment succeeded for amount:', paymentIntent.amount / 100, paymentIntent.currency.toUpperCase());
    
    // Check if this is a subscription payment (has invoice)
    if ((paymentIntent as any).invoice) {
      // This will be handled by invoice.payment_succeeded or invoice.paid
      console.log('Payment intent has invoice, skipping revenue recording (will be handled by invoice webhook)');
      return;
    }
    
    // For one-time payments, try to find user by customer ID
    if (paymentIntent.customer) {
      const user = await userService.getUserByStripeCustomerId(paymentIntent.customer as string);
      
      if (user) {
        // Create a generic revenue record for one-time payments
        await revenueService.createRevenue({
          subscriptionId: new mongoose.Types.ObjectId(), // Empty ObjectId for one-time payments
          companyId: new mongoose.Types.ObjectId(user._id),
          tierId: new mongoose.Types.ObjectId(), // Empty ObjectId for one-time payments
          amount: paymentIntent.amount / 100,
          billingInterval: 'month', // Default to monthly for one-time payments
          paymentDate: new Date(),
          stripeInvoiceId: (paymentIntent as any).invoice || `pi_${paymentIntent.id}`,
          stripePaymentIntentId: paymentIntent.id,
          status: 'succeeded',
          currency: paymentIntent.currency || 'usd',
          metadata: {
            periodStart: new Date(),
            periodEnd: new Date(),
            tierName: 'One-time Payment',
            companyName: (user as any).companyName || `${user.firstName} ${user.lastName}`,
          },
        });
        
        console.log('Revenue recorded for one-time payment:', paymentIntent.id);
      } else {
        console.log('User not found for payment intent customer:', paymentIntent.customer);
      }
    }
  } catch (error) {
    console.error('Error handling payment_intent.succeeded:', error);
    throw error;
  }
};

/**
 * Handle charge succeeded event
 */
const handleChargeSucceeded = async (charge: Stripe.Charge) => {
  try {
    console.log('Processing charge.succeeded event:', charge.id);
    console.log('Charge amount:', charge.amount / 100, charge.currency.toUpperCase());
    console.log('Customer:', charge.customer);
    
    // Check if this charge is already handled by a payment intent
    if (charge.payment_intent) {
      console.log('Charge has payment intent, skipping revenue recording (will be handled by payment_intent webhook)');
      return;
    }
    
    // For direct charges, try to find user by customer ID
    if (charge.customer) {
      const user = await userService.getUserByStripeCustomerId(charge.customer as string);
      
      if (user) {
        // Create a generic revenue record for direct charges
        await revenueService.createRevenue({
          subscriptionId: new mongoose.Types.ObjectId(), // Empty ObjectId for direct charges
          companyId: new mongoose.Types.ObjectId(user._id),
          tierId: new mongoose.Types.ObjectId(), // Empty ObjectId for direct charges
          amount: charge.amount / 100,
          billingInterval: 'month', // Default to monthly for direct charges
          paymentDate: new Date(),
          stripeInvoiceId: `ch_${charge.id}`,
          stripePaymentIntentId: charge.payment_intent as string || '',
          status: 'succeeded',
          currency: charge.currency || 'usd',
          metadata: {
            periodStart: new Date(),
            periodEnd: new Date(),
            tierName: 'Direct Charge',
            companyName: (user as any).companyName || `${user.firstName} ${user.lastName}`,
          },
        });
        
        console.log('Revenue recorded for direct charge:', charge.id);
      } else {
        console.log('User not found for charge customer:', charge.customer);
      }
    }
  } catch (error) {
    console.error('Error handling charge.succeeded:', error);
    throw error;
  }
};

/**
 * Handle payment method attached event
 */
const handlePaymentMethodAttached = async (paymentMethod: Stripe.PaymentMethod) => {
  try {
    // console.log('Processing payment_method.attached event:', paymentMethod.id);
    // console.log('Payment method type:', paymentMethod.type);
    // console.log('Customer:', paymentMethod.customer);
    
    if (paymentMethod.type === 'card' && paymentMethod.card) {
      // console.log('Card last 4 digits:', paymentMethod.card.last4);
      // console.log('Card brand:', paymentMethod.card.brand);
    }
  } catch (error) {
    console.error('Error handling payment_method.attached:', error);
    throw error;
  }
};
