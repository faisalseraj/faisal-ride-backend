import { Document, Model, Types } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface ISubscription {
  companyId: Types.ObjectId;
  tierId: Types.ObjectId;
  startDate?: Date;
  endDate: Date;
  status?: 'active' | 'expired' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'paused' | 'trialing' | 'unpaid';
  autoRenew?: boolean;
  paymentMethod?: string;
  // Stripe fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  // Pending subscription fields for downgrades
  pendingTierId?: any;
  upgradeType?: any;
  effectiveDate?: any;
}

export interface ISubscriptionDoc extends ISubscription, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionModel extends Model<ISubscriptionDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type NewCreatedSubscription = ISubscription;
export type UpdateSubscriptionBody = Partial<ISubscription>;

export interface ISubscriptionWithDetails extends ISubscriptionDoc {
  tier: {
    _id: Types.ObjectId;
    name: string;
    description?: string;
    price: number;
    billingInterval: string;
    freeTowRequests: number;
    additionalTowCost: number;
    features?: string[];
  };
  company: {
    _id: Types.ObjectId;
    companyName: string;
  };
}
