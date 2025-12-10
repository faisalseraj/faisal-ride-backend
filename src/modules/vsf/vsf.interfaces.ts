import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';
import mongoose from 'mongoose';

export interface IVSF extends Document {
  _id: string;
  companyName: string;
  name: string;
  mcrNumber: string;
  city: string;
  state: string;
  zipcode: string;
  ownerOfficer: string;
  phone: string;
  physicalAddress: string;
  status: string;
  carrierType: 'vsf' | 'tow';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lat: number;
  lng: number;
  distance?: number; // Added for closest VSF queries
}

export interface NewCreatedVSF {
  companyName: string;
  name: string;
  mcrNumber: string;
  city: string;
  state: string;
  zipcode: string;
  ownerOfficer: string;
  phone: string;
  physicalAddress: string;
  status: string;
  carrierType: 'vsf' | 'tow';
  isActive?: boolean;
  lat?: number;
  lng?: number;
}

export interface IVSFUpdate {
  companyName?: string;
  name?: string;
  mcrNumber?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  ownerOfficer?: string;
  phone?: string;
  physicalAddress?: string;
  status?: string;
  carrierType?: 'vsf' | 'tow';
  isActive?: boolean;
  lat?: number;
  lng?: number;
}

export interface IVSFQuery {
  city?: string;
  state?: string;
  zipcode?: string;
  carrierType?: 'vsf' | 'tow';
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchVSFsOptions {
  city?: string;
  state?: string;
  zipcode?: string;
  carrierType?: 'vsf' | 'tow';
  isActive?: boolean;
  companyName?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  lat?: number;
  lng?: number;
}

export interface IVSFScrapeRequest {
  zipcodes: string[];
  carrierType?: 'vsf' | 'tow';
  delay?: number;
}

export interface IVSFScrapeResponse {
  success: boolean;
  message: string;
  totalCompanies: number;
  zipcodesProcessed: number;
  created: number;
  skipped: number;
  carrierType: string;
  companies: NewCreatedVSF[];
  errors: string[];
}

export interface IVSFStats {
  totalVSFs: number;
  activeVSFs: number;
  inactiveVSFs: number;
  byCarrierType: {
    vsf: number;
    tow: number;
  };
  byState: Record<string, number>;
  byCity: Record<string, number>;
  recentlyScraped: number;
}

export interface IVSFBulkCreate {
  companies: NewCreatedVSF[];
}

export interface IVSFBulkUpdate {
  ids: string[];
  updates: IVSFUpdate;
}

export interface IVSFBulkDelete {
  ids: string[];
}

export interface IVSFModel extends Model<IVSF> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
  isMcrNumberTaken(mcrNumber: string, excludeVsfId?: mongoose.Types.ObjectId): Promise<boolean>;
}