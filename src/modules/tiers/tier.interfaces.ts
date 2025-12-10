import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface ITier {
  name: string;
  description?: string;
  price: number;
  billingInterval: 'day' | 'week' | 'month' | 'year';
  freeTowRequests: number;
  additionalTowCost: number;
  features?: string[];
  isActive: boolean;
  stripePriceId?: string;
}

export interface ITierDoc extends ITier, Document {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITierModel extends Model<ITierDoc> {
  paginate(filter: Record<string, any>, options: any): Promise<QueryResult>;
}

export interface NewCreatedTier {
  name: string;
  description?: string;
  price: number;
  billingInterval: 'day' | 'week' | 'month' | 'year';
  freeTowRequests?: number;
  additionalTowCost: number;
  features?: string[];
  isActive?: boolean;
}

export interface TierQueryOptions {
  sortBy?: string;
  limit?: number;
  page?: number;
  populate?: string;
}
