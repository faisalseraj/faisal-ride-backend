import { ISubscriptionDoc, ISubscriptionModel } from './subscription.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const subscriptionSchema = new mongoose.Schema<ISubscriptionDoc>(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'canceled', 'past_due', 'incomplete'],
      default: 'active',
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    // Stripe fields
    stripeCustomerId: {
      type: String,
      required: false,
    },
    stripeSubscriptionId: {
      type: String,
      required: false,
    },
    currentPeriodStart: {
      type: Date,
      required: false,
    },
    currentPeriodEnd: {
      type: Date,
      required: false,
    },
    // Pending subscription fields for downgrades
    pendingTierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: false,
    },
    upgradeType: {
      type: String,
      enum: ['immediate', 'delayed'],
      required: false,
    },
    effectiveDate: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
subscriptionSchema.index({ companyId: 1, status: 1 });
subscriptionSchema.index({ tierId: 1 });
subscriptionSchema.index({ endDate: 1 });

// add plugin that converts mongoose to json
subscriptionSchema.plugin(toJSON);
subscriptionSchema.plugin(paginate);

const Subscription = mongoose.model<ISubscriptionDoc, ISubscriptionModel>('Subscription', subscriptionSchema);

export default Subscription;
