import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';
import { QueryResult } from '../paginate/paginate';

// New interfaces for nested documents
export interface ILocation {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: string | null;
  lng?: string | null;
  distance?: string | null;
  county?: string | null;
}

export interface IChargeItem {
  quantity?: number | null;
  price?: number | null;
}

export interface ICharges {
  unloadedEnrouteMileage?: IChargeItem;
  loadedHookedMileage?: IChargeItem;
  impoundFee?: IChargeItem;
  privatePropertyTowFee?: IChargeItem;
  notificationFee?: IChargeItem;
  dailyImpoundRate?: IChargeItem;
  // Consent-based tow fee (manually adjustable, only used for Consent tow type)
  consentTowFee?: number;
  subTotal?: number | null;
}

export interface ITowRequest {
  requestCreatedBy: IUserDoc['_id'];
  requesterName: string;
  requesterEmail: string;
  reminders?: string[];
  sentTo?: IUserDoc['_id'][];

  licensePlates: {
    plateText: string;
    croppedImage: string;
    completeImage: string;
  }[];

  requesterPhoneNumber: string;
  vehicleYear?: string; // switched to string
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleType?: string;
  driveType?: string;
  vin: string; // required
  odometer?: string; // switched to string
  stockNumber?: string;
  hasKeys?: boolean;
  keysLocation?: string;

  towType: 'PPI' | 'Consent';
  invoiceNumber?: string;
  jurisdiction?: string;
  driverBadgeNumber?: string;
  truckNumber?: string;
  eta?: string; // ISO string
  impoundDate?: string;
  inventoryDate?: string;
  vehicleSecuredDate?: string;
  accountNotes?: string;
  impoundNotes?: string;
  gateCode?: string;

  charges?: ICharges;

  location: ILocation;
  destination: ILocation;
  towOperatorLocation?: ILocation; // <-- Added
  liveLocation?: ILocation; // Real-time location when accepted

  towCompanyId: IUserDoc['_id'];
  pspCompanyId: IUserDoc['_id'];
  assignedTo?: IUserDoc['_id'];
  assignedToEmail?: string;
  assignedToName?: string;
  assignedBy?: IUserDoc['_id'];
  assignedByEmail?: string;
  assignedByName?: string;
  towAssignedAt?: Date; // Timestamp when tow was assigned to operator
  status: TowRequestStatus;
  referer?: IUserDoc['_id'];
  refererEmail?: string;
  refererName?: string;
  isVehiclePickedUp?: boolean;
  createdAt?: string;
  completedAt?: Date;
}
export type TowRequestStatus =
  | 'PENDING_PSP_APPROVAL'
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export const TowRequestStatuses = [
  'PENDING_PSP_APPROVAL',
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
export interface ITowRequestDoc extends ITowRequest, Document {}

export interface ITowRequestModel extends Model<ITowRequestDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateTowRequestBody = ITowRequest;

export type NewCreatedTowRequest = Pick<
  ITowRequest,
  | 'requesterPhoneNumber'
  | 'vehicleYear'
  | 'vehicleMake'
  | 'vehicleModel'
  | 'vehicleColor'
  | 'driveType'
  | 'towType'
  | 'accountNotes'
  | 'gateCode'
  | 'hasKeys'
  | 'keysLocation'
  | 'vin'
  | 'vehicleType'
  | 'odometer'
  | 'stockNumber'
  | 'impoundDate'
  | 'invoiceNumber'
  | 'jurisdiction'
  | 'driverBadgeNumber'
  | 'inventoryDate'
  | 'vehicleSecuredDate'
  | 'eta'
  | 'truckNumber'
  | 'impoundNotes'
  | 'charges'
  | 'location'
  | 'destination'
  | 'licensePlates'
  | 'towOperatorLocation'
  | 'requesterEmail'
  | 'requesterName'
  | 'referer'
>;
