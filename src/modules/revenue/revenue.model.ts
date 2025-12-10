import { IRevenueDoc, IRevenueModel } from './revenue.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const revenueSchema = new mongoose.Schema<IRevenueDoc, IRevenueModel>(
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
    tierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tier',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    billingInterval: {
      type: String,
      required: true,
      enum: ['day', 'week', 'month', 'year'],
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      required: true,
      enum: ['succeeded', 'failed', 'refunded'],
      default: 'succeeded',
    },
    currency: {
      type: String,
      required: true,
      default: 'usd',
    },
    metadata: {
      periodStart: {
        type: Date,
        required: false,
      },
      periodEnd: {
        type: Date,
        required: false,
      },
      tierName: {
        type: String,
        required: false,
      },
      companyName: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
revenueSchema.index({ subscriptionId: 1 });
revenueSchema.index({ companyId: 1 });
revenueSchema.index({ tierId: 1 });
revenueSchema.index({ paymentDate: 1 });
revenueSchema.index({ billingInterval: 1 });
revenueSchema.index({ status: 1 });
revenueSchema.index({ stripeInvoiceId: 1 });

// Add plugin that converts mongoose to json
revenueSchema.plugin(toJSON);
revenueSchema.plugin(paginate);

const Revenue = mongoose.model<IRevenueDoc, IRevenueModel>('Revenue', revenueSchema);

export default Revenue;
