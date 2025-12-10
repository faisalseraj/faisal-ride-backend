import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';
import { QueryResult } from '../paginate/paginate';

export interface IBookParking {
  parkingProviderId: IUserDoc['_id'];
  bookedById: IUserDoc['_id'];
  parkingStartTime: string;
  parkingEndTime?: string;
  parkingTime: number;
  payableCharges?: number;
  status: 'ONGOING' | 'COMPLETED';
  licensePlate: string;
  parkingDetails?: {
    charges?: number;
    unit?: string;
  };
  parkingCompletedAt?: string;
  reminderSent?: boolean;
  isOcrScanner: boolean;
  state?: string;
  previousBookingIds?: IBookParkingDoc['_id'][];
  nextBookingId?: IBookParkingDoc['_id'];
}

export interface IBookParkingDoc extends IBookParking, Document {}

export interface IBookParkingModel extends Model<IBookParkingDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateBookParkingBody = IBookParking;

export type NewCreatedBookParking = Pick<
  IBookParking,
  'parkingProviderId' | 'parkingTime' | 'licensePlate' | 'isOcrScanner' | 'state'
>;
