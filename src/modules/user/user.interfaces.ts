import mongoose, { Document, Model } from 'mongoose';

import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { QueryResult } from '../paginate/paginate';

/**
 * Faisal Ride User Types
 * - admin: System administrators
 * - rider: Users who can post trips or find trips for carpooling
 */
export type IUserType = 'admin' | 'rider';

export enum UserEnum {
  'admin',
  'rider',
}

export const USER_TYPE = ['admin', 'rider'];

export type Type_USER_TYPE = 'admin' | 'rider';

/**
 * Vehicle information for riders
 */
export interface IVehicle {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  seats?: number; // Total passenger seats available
}

/**
 * User preferences for ride matching
 */
export interface IRidePreferences {
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  musicAllowed?: boolean;
  chatPreference?: 'quiet' | 'friendly' | 'any';
  genderPreference?: 'male' | 'female' | 'any';
}

export interface IUser {
  // Basic Info
  firstName: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  userType: IUserType;
  
  // Profile
  image?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  
  // Location
  address?: string;
  city?: string;
  country?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  
  // Authentication & Status
  lastLogin: string;
  currentLogin: string;
  isVerified: boolean;
  isEmailVerified?: boolean;
  isPhoneNumberVerified?: boolean;
  isSuspended?: boolean;
  isArchived?: boolean;
  isTemporaryBlocked?: boolean;
  temporaryBlockedTill?: string;
  isDefaultPassword?: boolean;
  isSuperAdmin?: boolean;
  
  // Device & Notifications
  preferredLanguage?: string;
  deviceToken?: string;
  deviceType?: string;
  socketId?: string;
  webToken?: string;
  isOnline?: boolean;
  loggedInDevices: [];
  
  // Rider Specific
  vehicle?: IVehicle;
  ridePreferences?: IRidePreferences;
  avgRating?: number;
  totalRides?: number;
  totalTripsPosted?: number;
  
  // Verification & Trust
  isDriverVerified?: boolean;
  driversLicense?: {
    number?: string;
    expiryDate?: string;
    isVerified?: boolean;
  };
  
  // Account Status
  suspendReason?: string;
  archiveReason?: string;
  isDeleted?: boolean;
  
  // Notifications
  notifications: {
    status: 'warning' | 'error' | 'success' | 'info';
    text: string;
    html?: string;
    _id?: string;
    read?: boolean;
    createdAt?: Date;
  }[];
  
  // Payment
  stripeCustomerId?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export interface IUserDoc extends IUser, Document {
  isPasswordMatch(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken(email: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  isPhoneNumberTaken(phoneNumber: string, userType?: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateUserBody = Partial<Omit<IUser, 'password' | 'socketId'>>;

export type NewRegisteredUser = Omit<IUser, 'isEmailVerified' | 'lastLogin' | 'currentLogin' | 'loggedInDevices'>;

export type NewCreatedUser = Omit<IUser, 'isEmailVerified' | 'lastLogin' | 'currentLogin' | 'isOnline'>;

export interface IUserWithTokens {
  user: IUserDoc;
  tokens: AccessAndRefreshTokens;
}

export interface SearchUsersOptions {
  searchTerm: string;
  userType?: IUserType;
  city?: string;
}
