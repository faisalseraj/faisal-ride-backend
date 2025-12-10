import mongoose, { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface IPasskey {
  _id: mongoose.Types.ObjectId;
  pspId: mongoose.Types.ObjectId; // Reference to Parking Space Provider company
  towCompanyId: mongoose.Types.ObjectId; // Reference to Tow Company
  passkey: string; // 4-digit passkey
  createdAt: Date;
  updatedAt: Date;
}

export interface IPasskeyDoc extends IPasskey, Document {
  _id: mongoose.Types.ObjectId;
}

export interface IPasskeyModel extends Model<IPasskeyDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

// Service method interfaces
export interface CreatePasskeyData {
  pspId: string;
  towCompanyId: string;
  passkey: string;
}

export interface ValidatePasskeyData {
  pspId: string;
  towCompanyId: string;
  passkey: string;
}

// Response interfaces
export interface PasskeyResponse {
  id: string;
  pspId: string;
  towCompanyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidatePasskeyResponse {
  isValid: boolean;
}

export interface PasskeyRequirementResponse {
  requiresPasskey: boolean;
}

// Query interfaces
export interface GetPasskeyQuery {
  pspId: string;
  towCompanyId: string;
}

export interface CheckPasskeyRequirementParams {
  pspId: string;
}

export interface CheckPasskeyRequirementQuery {
  towCompanyId: string;
}
