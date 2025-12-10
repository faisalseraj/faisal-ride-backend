import { Document, Model } from 'mongoose';
import { IUser, IUserDoc } from '../user/user.interfaces';

import { QueryResult } from '../paginate/paginate';

export interface IApartmentComplex {
  apartmentComplexName: string;
  user: IUserDoc['_id']; // the apartment complex manager id
  location: {
    lat: string;
    lng: string;
  };
  totalParkingSpaces?: number;
  maxApartments?: number;
  availableParkingSpaces?: number;
  employees?: IUserDoc['_id'][];
  managers?: IUserDoc['_id'][];
  users?: {
    id: IUserDoc['_id'];
    slotNumber: number;
    slotId: number;
  };
  licensePlates?: {
    plate: string;
    // stateFull: string;
    stateShort: string;
  }[];
  allowApartments?: 'on' | 'off';
  apartments?: IApartment[];
  licensePlateLimitPerRenter?: number;
  renewalContractTime?: string;
}

export interface IApartment {
  id?: string;
  _id?: string;
  apartmentNumber: string;
  maxOccupantsAllowed?: number;
  maxRentersAllowed?: number;
  licensePlates: {
    plate: string;
    // stateFull: string;
    stateShort: string;
    renterId: IUserDoc['_id'];
  }[];
  renters?: IUserDoc['_id'][];
}

export interface IApartmentComplexDoc extends IApartmentComplex, Document {}
export interface NewApartmentComplexPayload extends IApartmentComplex {
  user: Partial<IUser>;
}

export type NewApartmentComplexBody = Omit<
  NewApartmentComplexPayload,
  'user' | 'users' | 'employees' | 'availableParkingSpaces'
>;

export interface IApartmentComplexModel extends Model<IApartmentComplexDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateApartmentComplexBody = Partial<IApartmentComplex>;
