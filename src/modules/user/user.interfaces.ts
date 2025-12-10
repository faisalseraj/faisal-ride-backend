import mongoose, { Document, Model } from 'mongoose';

import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { IApartmentComplexDoc } from '../apartmentComplex/apartmentComplex.interfaces';
import { QueryResult } from '../paginate/paginate';

export type IUserType =
  | 'admin'
  | 'apartment-complex-owner'
  | 'tow-company-owner'
  | 'tow-company-employee'
  | 'apartment-complex-employee'
  | 'tow-company-manager'
  | 'apartment-complex-manager'
  | 'renter'
  | 'parking-spaces-provider-manager'
  | 'parking-spaces-provider-owner'
  | 'parking-spaces-provider-employee'
  | 'tow-requester';

export enum UserEnum {
  'admin',
  'apartment-complex-owner',
  'tow-company-owner',
  'tow-company-employee',
  'apartment-complex-employee',
  'tow-company-manager',
  'apartment-complex-manager',
  'renter',
  'parking-spaces-provider-owner',
  'parking-spaces-provider-manager',
  'parking-spaces-provider-employee',
}

export const USER_TYPE = [
  'admin',
  'apartment-complex-owner',
  'tow-company-owner',
  'tow-company-employee',
  'apartment-complex-employee',
  'tow-company-manager',
  'apartment-complex-manager',
  'renter',
  'parking-spaces-provider-owner',
  'parking-spaces-provider-manager',
  'parking-spaces-provider-employee',
  'tow-requester',
];
export type Type_USER_TYPE =
  | 'admin'
  | 'apartment-complex-owner'
  | 'tow-company-owner'
  | 'tow-company-employee'
  | 'apartment-complex-employee'
  | 'tow-company-manager'
  | 'apartment-complex-manager'
  | 'renter'
  | 'parking-spaces-provider-owner'
  | 'parking-spaces-provider-manager'
  | 'parking-spaces-provider-employee'
  | 'tow-requester';

export interface IUser {
  firstName: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password: string;
  userType: IUserType;
  lastLogin: string;
  currentLogin: string;
  isVerified: boolean;
  isEmailVerified?: boolean;
  isPhoneNumberVerified?: boolean;
  isSuspended?: boolean;
  isArchived?: boolean;
  isTemporaryBlocked?: boolean;
  image?: string;
  temporaryBlockedTill?: string;
  country?: string;
  district?: string;
  address?: string;

  emailVerificationReminders?: {
    sentAt: string;
  }[];

  // applicable for client
  manualPosition?: {
    latitude: string | number;
    longitude: string | number;
  };
  preferredLanguage?: string;
  deviceToken?: string;
  deviceType?: string;
  socketId?: string;
  webToken?: string;
  isOnline?: boolean;
  avgRating?: string;
  company?: {
    companyName: string;
    businessPhoneNumber?: string;
    businessEmail?: string;
    businessAddress?: string;
  };
  towCompany?: {
    companyName: string;
    employees?: IUserDoc['_id'][];
    managers?: IUserDoc['_id'][];
  };
  apartmentComplex?: string;
  apartment?: {
    apartmentComplex?: string;
    apartmentId?: string;
  }[];
  loggedInDevices: [];
  isDefaultPassword?: boolean;
  apartmentComplexes?: IApartmentComplexDoc['_id'];
  towCompanyId?: IUserDoc['_id'];
  suspendReason?: string;
  archiveReason?: string;
  isSuperAdmin?: boolean;
  accountApproval?: {
    approvedBy?: IUserDoc['_id'],
    isApproved?: boolean
  }

  notifications: {
    status: 'warning' | 'error' | 'success';
    text: string;
    html: string;
    _id?: string;
  }[];
  isDeleted?: boolean;
  occupants: IOccupant[];
  licensePlates: {
    plate: string;
    stateShort: string;
    apartmentComplex: IApartmentComplexDoc['_id'];
  }[];
  isPaidParkingSpaceProvider?: boolean;
  isTowOperator?: boolean;
  driverBadgeNumber?: string;

  //parking space provider paid fields
  parkingDetails?: {
    charges: number;
    unit: 'hour';
    totalSpaces?: number;
    availabilityTimes?: [
      {
        from?: string;
        to?: string;
        day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
      }
    ];
  };
  createdAt?: string;
  passkey?: string; // 4-digit passkey for PSP owners

  //required for psp manager and employee
  pspCompanyId?: IUserDoc['_id'];

  // Stripe integration
  stripeCustomerId?: string;
}

export interface IOccupant {
  firstName: string;
  lastName: string;
  dob?: string;
  relation?: string;
  apartmentComplex?: IApartmentComplexDoc['_id'];
  _id?: string;
  apartmentId: IApartmentComplexDoc['_id'];
}
export interface IUserDoc extends IUser, Document {
  isPasswordMatch(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDoc> {
  isEmailTaken(email: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;
  isPhoneNumberTaken(phoneNumber: string, userType?: string, excludeUserId?: mongoose.Types.ObjectId): Promise<boolean>;

  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateUserBody = Partial<Omit<IUser, 'business' | 'favouriteLocations' | 'favouriteItems' | 'socketId'>>;

export type NewRegisteredUser = Omit<IUser, 'role' | 'isEmailVerified' | 'lastLogin' | 'currentLogin' | 'loggedInDevices'>;

export const SWITCH_STATUS = ['Pending', 'Approved', 'Disapproved'];

export type NewCreatedUser = Omit<IUser, 'role' | 'isEmailVerified' | 'lastLogin' | 'currentLogin' | 'isOnline'>;

export interface IUserWithTokens {
  user: IUserDoc;
  tokens: AccessAndRefreshTokens;
}

export interface SearchUsersOptions {
  searchTerm: string;
  userType: any;
  towCompanyId: string;
}
