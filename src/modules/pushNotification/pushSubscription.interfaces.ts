import { Document, Model, Types } from "mongoose";

import { QueryResult } from "../paginate/paginate";

export interface ISubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscription {
  user: Types.ObjectId; // link to User
  endpoint: string;
  expirationTime?: number | null;
  keys: ISubscriptionKeys;
}

export interface IPushSubscriptionDoc extends IPushSubscription, Document {}

export interface IPushSubscriptionModel extends Model<IPushSubscriptionDoc> {
  paginate(
    filter: Record<string, any>,
    options: Record<string, any>
  ): Promise<QueryResult>;
}

export type NewCreatedPushSubscription = IPushSubscription;
export type UpdatePushSubscriptionBody = Partial<IPushSubscription>;
