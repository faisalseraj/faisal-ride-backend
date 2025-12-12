import * as revenueService from '../revenue/revenue.service';

import {
  StripeWebhookLogData,
  createStripeWebhookProcessedSuccessfullyLog,
  createStripeWebhookProcessingErrorLog,
  createStripeWebhookProcessingStartedLog,
  createStripeWebhookReceivedLog,
} from './stripe-log.service';
import {
  sendSubscriptionPaymentFailedEmail,
  sendSubscriptionPaymentSuccessEmail,
  sendSubscriptionUpdatedEmail
} from '../email/email.service';

import { ApiError } from '../errors';
import Stripe from 'stripe';
import Subscription from '../subscriptions/subscription.model';
import Tier from '../tiers/tier.model';
import User from '../user/user.model';
import config from '../../config/config';
import httpStatus from 'http-status';
import mongoose from 'mongoose';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-09-30.clover',
});



export interface CreateCheckoutSessionParams {
  userId: mongoose.Types.ObjectId;
  tierId: mongoose.Types.ObjectId;
  termsAccepted: boolean;
}

export interface WebhookEventData {
  id: string;
  type: string;
  livemode: boolean;
  created: number;
  data: {
    object: any;
  };
}

/**
 * Create or get Stripe customer for a user
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<string>} Stripe customer ID
 */
export const createOrGetStripeCustomer = async (userId: mongoose.Types.ObjectId): Promise<string> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Check if user already has a Stripe customer ID
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email: user.email!,
    name: user.fullName!,
    metadata: {
      userId: userId.toString(),
    },
  });

  // Update user with Stripe customer ID
  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

/**
 * Create Stripe Price ID for a tier
 * @param {any} tierData - Tier data with name, price, billingInterval, etc.
 * @returns {Promise<string>} Stripe Price ID
 */
export const createStripePriceId = async (tierData: any): Promise<string> => {
  try {
    // First, create a Stripe Product
    const product = await stripe.products.create({
      name: tierData.name,
      description: tierData.description || `Subscription plan: ${tierData.name}`,
      metadata: {
        tierId: tierData._id?.toString() || 'temp',
        type: 'subscription_tier',
      },
    });

    // Use the new price and billingInterval fields
    const priceAmount = tierData.price;
    const billingInterval = tierData.billingInterval;

    // Then create a Price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(priceAmount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: billingInterval,
      },
      metadata: {
        tierId: tierData._id?.toString() || 'temp',
        tierName: tierData.name,
        billingInterval: billingInterval,
      },
    });

    return price.id;
  } catch (error) {
    console.error('Error creating Stripe Price ID:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create Stripe Price ID');
  }
};

/**
 * Verify Stripe checkout session and get subscription details
 * @param {string} sessionId - Stripe checkout session ID
 * @returns {Promise<any>} Subscription details
 */
export const verifyCheckoutSession = async (sessionId: string): Promise<any> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // Create base log data for verification
  const baseLogData: StripeWebhookLogData = {
    eventId: `verify-${sessionId}`,
    eventType: 'checkout.session.verify',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    // Log verification started
    await createStripeWebhookProcessingStartedLog(baseLogData);
    
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: 'Checkout session not found',
        errorType: 'NotFoundError',
      });
      throw new ApiError(httpStatus.NOT_FOUND, 'Checkout session not found');
    }

    console.log("session ::: xxxx", session)
    if (session.payment_status !== 'paid') {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: `Payment not completed, status: ${session.payment_status}`,
        errorType: 'PaymentNotCompletedError',
      });
      throw new ApiError(httpStatus.BAD_REQUEST, 'Payment not completed');
    }

    // Get subscription details
    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: 'No subscription found in session',
        errorType: 'NoSubscriptionError',
      });
      throw new ApiError(httpStatus.BAD_REQUEST, 'No subscription found in session');
    }

    // Get tier details from our database using metadata
    const tierId = session.metadata?.['tierId'];
    if (!tierId) {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: 'Tier ID not found in session metadata',
        errorType: 'MissingMetadataError',
      });
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tier ID not found in session metadata');
    }
    console.log("tier ::: xxxxx", tierId)

    const tier = await Tier.findById(tierId);
    if (!tier) {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: `Tier not found: ${tierId}`,
        errorType: 'TierNotFoundError',
      });
      throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
    }

    // Check if subscription exists in our database (created by webhook)
    const dbSubscription = await Subscription.findOne({
      stripeSubscriptionId: subscription.id,
    });

    if (!dbSubscription) {
      // Subscription not yet created by webhook, return basic info
      // The webhook will handle the actual subscription creation
      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        tierId: tierId,
        message: 'Subscription created successfully. Webhook will process the details.',
      };
    }

    const processingTime = Date.now() - startTime;

    // Log successful verification
    await createStripeWebhookProcessedSuccessfullyLog({
      ...baseLogData,
      processingTimeMs: processingTime,
    });
    console.log("no subscription ::: xxxxx", dbSubscription)

    return {
      subscription: {
        id: dbSubscription._id,
        status: dbSubscription.status,
        tierName: tier.name,
        price: tier.price,
        billingInterval: tier.billingInterval,
        startDate: dbSubscription.startDate,
        endDate: dbSubscription.endDate,
        currentPeriodStart: dbSubscription.currentPeriodStart,
        currentPeriodEnd: dbSubscription.currentPeriodEnd,
      },
      session: {
        id: session.id,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
      },
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Log verification error
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      processingTimeMs: processingTime,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify checkout session' + error);
  }
};

/**
 * Create Stripe checkout session for subscription
 * @param {CreateCheckoutSessionParams} params
 * @returns {Promise<string>} Checkout session URL
 */
export const createCheckoutSession = async (params: CreateCheckoutSessionParams): Promise<string> => {
  // try {
    const { userId, tierId, termsAccepted } = params;

    // Validate terms acceptance
    if (!termsAccepted) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You must accept the terms and conditions to proceed with subscription');
    }

    // Get tier details
    const tier = await Tier.findById(tierId);
    if (!tier) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Tier not found');
    }

    if (!tier.stripePriceId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Tier does not have a Stripe price ID configured');
    }

    // Create or get Stripe customer
    const customerId = await createOrGetStripeCustomer(userId);

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      companyId: userId,
      status: 'active',
    });

    if (existingSubscription) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User already has an active subscription');
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: tier.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${config.stripe.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.stripe.frontendUrl}/subscription/cancel`,
      metadata: {
        userId: userId.toString(),
        tierId: tierId.toString(),
        termsAccepted: 'true',
      },
      consent_collection: {
        terms_of_service: 'required',
      },
    });

    if (!session.url) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
    }

    return session.url;
  // } catch (error) {
  //   console.error('Create checkout session error:', error);
  //   throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create checkout session');
  // }
};

/**
 * Create Stripe customer portal session
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<string>} Portal session URL
 */
export const createCustomerPortalSession = async (userId: mongoose.Types.ObjectId): Promise<string> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.stripeCustomerId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User does not have a Stripe customer ID');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${config.clientUrl}/dashboard`,
  });

  return session.url;
};

/**
 * Handle Stripe webhook events
 * @param {WebhookEventData} event
 */
export const handleWebhookEvent = async (event: WebhookEventData): Promise<void> => {
  const { type, data } = event;
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Create base log data for webhook
  const baseLogData: StripeWebhookLogData = {
    eventId: event.id || 'unknown',
    eventType: type,
    livemode: event.livemode || false,
    created: event.created || Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    console.log(`[Webhook-${requestId}] Processing Stripe webhook event: ${type}`);
    
    // Log webhook received
    await createStripeWebhookReceivedLog(baseLogData);
    
    switch (type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(data.object, requestId);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(data.object, requestId);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(data.object, requestId);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data.object, requestId);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data.object, requestId);
        break;
      default:
        console.log(`[Webhook-${requestId}] Unhandled event type: ${type}`);
    }

    // Log successful processing
    const processingTime = Date.now() - startTime;
    const successLogData: StripeWebhookLogData = {
      ...baseLogData,
      processingTimeMs: processingTime,
    };
    await createStripeWebhookProcessedSuccessfullyLog(successLogData);
    
    console.log(`[Webhook-${requestId}] Webhook processed successfully in ${processingTime}ms`);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[Webhook-${requestId}] Error processing webhook event ${type}:`, error);
    
    // Log processing error
    const errorLogData: StripeWebhookLogData = {
      ...baseLogData,
      processingTimeMs: processingTime,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    };
    await createStripeWebhookProcessingErrorLog(errorLogData);
    
    // Don't throw the error to prevent webhook retries
    // The webhook will be logged as failed but won't crash the server
  }
};

/**
 * Handle checkout session completed event
 * @param {any} session
 * @param {string} requestId
 */
const handleCheckoutSessionCompleted = async (session: any, requestId: string): Promise<void> => {
  const baseLogData: StripeWebhookLogData = {
    eventId: session.id,
    eventType: 'checkout.session.completed',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    const { metadata } = session;
    const { userId, tierId } = metadata;

    if (!userId || !tierId) {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: 'Missing metadata in checkout session',
        errorType: 'MissingMetadataError',
      });
      return;
    }

    // Check if subscription already exists to prevent duplicates
    const existingSubscription = await Subscription.findOne({
      stripeSubscriptionId: session.subscription,
    });

    if (existingSubscription) {
      await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
      return;
    }

    // Get subscription details from Stripe
    const stripeSubscription = (await stripe.subscriptions.retrieve(session.subscription)) as Stripe.Subscription;

    // Get tier details for email
    const tier = await Tier.findById(tierId);
    const user = await User.findById(userId);

    // Update user with stripeCustomerId
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || '';
    if (user && stripeCustomerId) {
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    // Get period information from Stripe subscription
    const currentPeriodStart = (stripeSubscription as any).current_period_start;
    const currentPeriodEnd = (stripeSubscription as any).current_period_end;

    // Create subscription record using actual Stripe period information
    await Subscription.create({
      companyId: new mongoose.Types.ObjectId(userId),
      tierId: new mongoose.Types.ObjectId(tierId),
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      startDate: new Date(currentPeriodStart * 1000),
      endDate: new Date(currentPeriodEnd * 1000),
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      autoRenew: true,
    });

    // Ensure invoice is finalized and PDF is available
    try {
      const invoices = await stripe.invoices.list({
        subscription: session.subscription,
        limit: 1,
      });
      
      if (invoices.data.length > 0) {
        const invoice = invoices.data?.[0];
        // Finalize invoice if it's not already finalized
        if (invoice?.status === 'draft' || invoice?.status === 'open') {
          await stripe.invoices.finalizeInvoice(invoice?.id);
        }
        // Mark invoice as paid if payment succeeded
        if (invoice?.status === 'open' && invoice?.amount_due === 0) {
          await stripe.invoices.pay(invoice?.id);
        }
      }
    } catch (invoiceError) {
      console.error('Error ensuring invoice is finalized:', invoiceError);
      // Don't fail the whole process if invoice finalization fails
    }

    // Send payment success email using actual period end
    if (user && tier) {
      const nextBillingDate = new Date(currentPeriodEnd * 1000).toLocaleDateString();
      await sendSubscriptionPaymentSuccessEmail(user, tier.name, tier.price, nextBillingDate);
    }

    // Admin notification is now handled in the email service

    await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
  } catch (error) {
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    // Don't throw error to prevent webhook crashes
  }
};

/**
 * Handle invoice payment succeeded event
 * @param {any} invoice
 * @param {string} requestId
 */
const handleInvoicePaymentSucceeded = async (invoice: any, requestId: string): Promise<void> => {
  const baseLogData: StripeWebhookLogData = {
    eventId: invoice.id,
    eventType: 'invoice.payment_succeeded',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    if (invoice.subscription) {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: invoice.subscription,
      });

      if (subscription) {
        // Update subscription period dates using actual Stripe period information
        const stripeSubscription = (await stripe.subscriptions.retrieve(invoice.subscription)) as Stripe.Subscription;
        const currentPeriodStart = (stripeSubscription as any).current_period_start;
        const currentPeriodEnd = (stripeSubscription as any).current_period_end;
        
        subscription.currentPeriodStart = new Date(currentPeriodStart * 1000);
        subscription.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
        subscription.status = stripeSubscription.status;
        await subscription.save();

        // Send payment success email for recurring payments using actual period end
        const user = await User.findById(subscription.companyId);
        const tier = await Tier.findById(subscription.tierId);
        if (user && tier) {
          const amount = invoice.amount_paid / 100; // Convert from cents
          
          // Record revenue
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
              periodStart: new Date(currentPeriodStart * 1000),
              periodEnd: new Date(currentPeriodEnd * 1000),
              tierName: tier.name,
              companyName: (user as any).companyName || `${user.firstName} ${user.lastName}`,
            },
          });
          
          const nextBillingDate = new Date(currentPeriodEnd * 1000).toLocaleDateString();
          await sendSubscriptionPaymentSuccessEmail(user, tier.name, amount, nextBillingDate);
        }

        // Admin notification is now handled in the email service

        await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
      } else {
        await createStripeWebhookProcessingErrorLog({
          ...baseLogData,
          error: `Subscription not found for invoice: ${invoice.subscription}`,
          errorType: 'SubscriptionNotFoundError',
        });
      }
    }
  } catch (error) {
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    // Don't throw ApiError in webhook handlers to prevent server crashes
  }
};

/**
 * Handle invoice payment failed event
 * @param {any} invoice
 * @param {string} requestId
 */
const handleInvoicePaymentFailed = async (invoice: any, requestId: string): Promise<void> => {
  const baseLogData: StripeWebhookLogData = {
    eventId: invoice.id,
    eventType: 'invoice.payment_failed',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    if (invoice.subscription) {
      const subscription = await Subscription.findOne({
        stripeSubscriptionId: invoice.subscription,
      });

      if (subscription) {
        // Get user and tier details
        const user = await User.findById(subscription.companyId);
        const tier = await Tier.findById(subscription.tierId);

        // Send payment failed email to user
        if (user && tier) {
          const retryDate = new Date(invoice.next_payment_attempt * 1000).toLocaleDateString();
          await sendSubscriptionPaymentFailedEmail(user, tier.name, retryDate);
        }

        // Admin notification is now handled in the email service

        await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
      } else {
        await createStripeWebhookProcessingErrorLog({
          ...baseLogData,
          error: `Subscription not found for failed invoice: ${invoice.subscription}`,
          errorType: 'SubscriptionNotFoundError',
        });
      }
    }
  } catch (error) {
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    // Don't throw ApiError in webhook handlers to prevent server crashes
  }
};

/**
 * Handle subscription deleted event
 * @param {any} stripeSubscription
 * @param {string} requestId
 */
const handleSubscriptionDeleted = async (stripeSubscription: any, requestId: string): Promise<void> => {
  const baseLogData: StripeWebhookLogData = {
    eventId: stripeSubscription.id,
    eventType: 'customer.subscription.deleted',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      subscription.status = 'canceled';
      subscription.autoRenew = false;
      await subscription.save();

      // Send cancellation completed email
      const user = await User.findById(new mongoose.Types.ObjectId(subscription.companyId));
      const tier = await Tier.findById(new mongoose.Types.ObjectId(subscription.tierId));
      if (user && tier) {
        const cancelDate = new Date().toLocaleDateString();
        const { sendSubscriptionCancellationCompletedEmail } = require('../email/email.service');
        await sendSubscriptionCancellationCompletedEmail(user, tier.name, cancelDate);
      }

      // Admin notification is now handled in the email service

      await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
    } else {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: `Subscription not found for deletion: ${stripeSubscription.id}`,
        errorType: 'SubscriptionNotFoundError',
      });
    }
  } catch (error) {
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    // Don't throw ApiError in webhook handlers to prevent server crashes
  }
};

/**
 * Handle subscription updated event
 * @param {any} stripeSubscription
 * @param {string} requestId
 */
const handleSubscriptionUpdated = async (stripeSubscription: any, requestId: string): Promise<void> => {
  const baseLogData: StripeWebhookLogData = {
    eventId: stripeSubscription.id,
    eventType: 'customer.subscription.updated',
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    requestId,
  };

  try {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      const oldStatus = subscription.status;
      subscription.status = stripeSubscription.status;
      subscription.currentPeriodStart = new Date(stripeSubscription.start_date * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.start_date * 1000 + 30 * 24 * 60 * 60 * 1000); // 30 days from start
      await subscription.save();

      // Send update email if status changed significantly
      const user = await User.findById(subscription.companyId);
      const tier = await Tier.findById(subscription.tierId);
      if (user && tier && oldStatus !== stripeSubscription.status) {
        await sendSubscriptionUpdatedEmail(user, tier.name, tier.name, tier.price);
      }

      // Admin notification is now handled in the email service

      await createStripeWebhookProcessedSuccessfullyLog(baseLogData);
    } else {
      await createStripeWebhookProcessingErrorLog({
        ...baseLogData,
        error: `Subscription not found for update: ${stripeSubscription.id}`,
        errorType: 'SubscriptionNotFoundError',
      });
    }
  } catch (error) {
    await createStripeWebhookProcessingErrorLog({
      ...baseLogData,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    // Don't throw ApiError in webhook handlers to prevent server crashes
  }
};

/**
 * Cancel Stripe subscription
 * @param {string} stripeSubscriptionId
 * @param {boolean} immediately - Whether to cancel immediately or at period end
 * @returns {Promise<void>}
 */
export const cancelStripeSubscription = async (stripeSubscriptionId: string, immediately: boolean = true): Promise<void> => {
  try {
    if (immediately) {
      // Cancel immediately
      await stripe.subscriptions.cancel(stripeSubscriptionId);
      console.log(`Stripe subscription ${stripeSubscriptionId} canceled immediately`);
    } else {
      // Cancel at period end
      await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      console.log(`Stripe subscription ${stripeSubscriptionId} will be canceled at period end`);
    }
  } catch (error) {
    console.error(`Failed to cancel Stripe subscription ${stripeSubscriptionId}:`, error);
    throw error;
  }
};

/**
 * Get Stripe subscription details
 * @param {string} stripeSubscriptionId
 * @returns {Promise<Stripe.Subscription>}
 */
export const getStripeSubscription = async (stripeSubscriptionId: string): Promise<Stripe.Subscription> => {
  return stripe.subscriptions.retrieve(stripeSubscriptionId);
};

/**
 * Get all active Stripe subscriptions for a customer
 * @param {string} customerId
 * @returns {Promise<Stripe.Subscription[]>}
 */
export const getActiveStripeSubscriptions = async (customerId: string): Promise<Stripe.Subscription[]> => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 100,
  });
  return subscriptions.data;
};

/**
 * Cancel all active Stripe subscriptions for a customer
 * @param {string} customerId
 * @returns {Promise<{ canceled: string[], failed: string[] }>}
 */
export const cancelAllActiveStripeSubscriptions = async (customerId: string): Promise<{ canceled: string[], failed: string[] }> => {
  const subscriptions = await getActiveStripeSubscriptions(customerId);
  const canceled: string[] = [];
  const failed: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await cancelStripeSubscription(subscription.id, true);
      canceled.push(subscription.id);
      console.log(`Canceled Stripe subscription: ${subscription.id}`);
    } catch (error) {
      failed.push(subscription.id);
      console.error(`Failed to cancel Stripe subscription ${subscription.id}:`, error);
    }
  }

  return { canceled, failed };
};

/**
 * Get customer's payment methods
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<any[]>} List of payment methods
 */
export const getCustomerPaymentMethods = async (userId: mongoose.Types.ObjectId): Promise<any[]> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!user.stripeCustomerId) {
      return [];
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    const defaultPaymentMethodId = customer.deleted ? null : customer.invoice_settings?.default_payment_method;

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      },
      isDefault: pm.id === defaultPaymentMethodId,
    }));
  } catch (error) {
    console.error('Get payment methods error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch payment methods');
  }
};

/**
 * Create setup intent for adding new payment method
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<any>} Setup intent
 */
export const createSetupIntent = async (userId: mongoose.Types.ObjectId): Promise<any> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const customerId = await createOrGetStripeCustomer(userId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return {
      clientSecret: setupIntent.client_secret,
      id: setupIntent.id,
    };
  } catch (error) {
    console.error('Create setup intent error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create setup intent');
  }
};

/**
 * Set default payment method for customer
 * @param {mongoose.Types.ObjectId} userId
 * @param {string} paymentMethodId
 * @returns {Promise<void>}
 */
export const setDefaultPaymentMethod = async (userId: mongoose.Types.ObjectId, paymentMethodId: string): Promise<void> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!user.stripeCustomerId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No Stripe customer found for this user');
    }

    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  } catch (error) {
    console.error('Set default payment method error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to set default payment method');
  }
};

/**
 * Delete a payment method
 * @param {string} paymentMethodId
 * @returns {Promise<void>}
 */
export const deletePaymentMethod = async (paymentMethodId: string): Promise<void> => {
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch (error) {
    console.error('Delete payment method error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete payment method');
  }
};

/**
 * Get invoices for a customer
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<any[]>} List of invoices
 */
export const getCustomerInvoices = async (userId: mongoose.Types.ObjectId): Promise<any[]> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    if (!user.stripeCustomerId) {
      return [];
    }

    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number || null,
      amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
      currency: invoice.currency ? invoice.currency.toUpperCase() : 'USD',
      status: invoice.status || 'draft',
      invoicePdf: invoice.invoice_pdf || null,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      created: invoice.created ? new Date(invoice.created * 1000).toISOString() : new Date().toISOString(),
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
      description: invoice.description || invoice.lines?.data[0]?.description || 'Subscription payment',
    }));
  } catch (error) {
    console.error('Get customer invoices error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch invoices');
  }
};

/**
 * Get invoice PDF download URL
 * @param {string} invoiceId
 * @returns {Promise<string>} PDF URL
 */
export const getInvoicePdfUrl = async (invoiceId: string): Promise<string> => {
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoice.invoice_pdf) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Invoice PDF not available');
    }
    return invoice.invoice_pdf;
  } catch (error) {
    console.error('Get invoice PDF error:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get invoice PDF');
  }
};
