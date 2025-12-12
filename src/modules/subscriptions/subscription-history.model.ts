import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';

/**
 * Subscription History Schema
 * Tracks all subscription changes for audit purposes
 */
const subscriptionHistorySchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    oldTierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: false,
    },
    newTierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: true,
    },
    oldPlan: {
      name: String,
      price: Number,
      billingInterval: String,
    },
    newPlan: {
      name: String,
      price: Number,
      billingInterval: String,
    },
    priceDifference: {
      type: Number,
      required: false,
    },
    changeType: {
      type: String,
      enum: ['same-interval-upgrade', 'cross-interval-upgrade', 'downgrade', 'same-price'],
      required: true,
    },
    upgradeType: {
      type: String,
      enum: ['immediate', 'delayed'],
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
subscriptionHistorySchema.index({ subscriptionId: 1, timestamp: -1 });
subscriptionHistorySchema.index({ companyId: 1, timestamp: -1 });

subscriptionHistorySchema.plugin(toJSON);

const SubscriptionHistory = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);

export default SubscriptionHistory;

