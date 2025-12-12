import { Document, Model } from 'mongoose';

export interface IAPIKey {
  apiKey: string;
  allowedUsage: number;
  currentUsage: number;
}

export interface IAPIKeyDoc extends IAPIKey, Document {}

export interface IAPIKeyModel extends Model<IAPIKeyDoc> {}

export type UpdateAPIKeyBody = Partial<Omit<IAPIKey, ''>>;

export type NewCreatedClientDetails = Omit<IAPIKey, ''>;
