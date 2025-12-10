import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface ICharges {
  unloadedEnrouteMileage: number;
  loadedHookedMileage: number;
  impoundFee: number;
  privatePropertyTowFee: number;
  notificationFee: number;
  dailyImpoundRate: number;
}

export interface IJurisdiction {
  name: string;
  description?: string;
  lat: number;
  lng: number;
  charges: ICharges;
  city: string;
  state: string;
  zip: string;
  county: string;
  chargesUpdatedAt?: Date;
  isVerified?: boolean;
}

export interface IJurisdictionDoc extends IJurisdiction, Document {}

export interface IJurisdictionModel extends Model<IJurisdictionDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type NewCreatedJurisdiction = IJurisdiction;
export type UpdateJurisdictionBody = Partial<IJurisdiction>;
