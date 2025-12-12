import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';
import mongoose from 'mongoose';

export interface IRevenue {
  subscriptionId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  tierId: mongoose.Types.ObjectId;
  amount: number;
  billingInterval: 'day' | 'week' | 'month' | 'year';
  paymentDate: Date;
  stripeInvoiceId: string;
  stripePaymentIntentId?: string;
  status: 'succeeded' | 'failed' | 'refunded';
  currency: string;
  metadata?: {
    periodStart: Date;
    periodEnd: Date;
    tierName: string;
    companyName: string;
    changeType?: 'same-interval-upgrade' | 'cross-interval-upgrade' | 'downgrade' | 'same-price';
    oldTierName?: string;
    oldBillingInterval?: 'day' | 'week' | 'month' | 'year';
    newTierName?: string;
  };
}

export interface IRevenueDoc extends IRevenue, Document {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRevenueModel extends Model<IRevenueDoc> {
  paginate(filter: Record<string, any>, options: any): Promise<QueryResult>;
}

export type NewRevenueBody = Omit<IRevenue, 'createdAt' | 'updatedAt'>;

export type UpdateRevenueBody = Partial<IRevenue>;
