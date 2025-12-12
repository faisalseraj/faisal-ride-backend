import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';
import { JwtPayload } from 'jsonwebtoken';

export type IOtpType =
  | 'login'
  | 'changePhoneNumber'
  | 'changeEmail'
  | 'changeEmailOld'
  | 'changeEmailNew'
  | 'verifyAccount'
  | 'forgotPassword'
  | 'setEmailPhoneVerification'
  | 'setEmail'
  | 'phoneVerificationBeforeEmailSet'
  | 'phoneNumberVerification';

export const OTP_TYPE = [
  'login',
  'changePhoneNumber',
  'changeEmail',
  'verifyAccount',
  'forgotPassword',
  'setEmailPhoneVerification',
  'setEmail',
  'phoneVerificationBeforeEmailSet',
  'changeEmailOld',
  'changeEmailNew',
  'phoneNumberVerification',
];
export interface IOtp {
  otp: string;
  phoneNumber?: string;
  email?: string;
  user: IUserDoc['_id'];
  expires: string;
  blacklisted: boolean;
  type: IOtpType;
}

export type NewOtp = Omit<IOtp, 'blacklisted' | 'type' | 'expires'>;

export interface IOtpDoc extends IOtp, Document {}

export interface IOtpModel extends Model<IOtpDoc> {}

export type ISendOtp = Omit<IOtp, 'blacklisted' | 'expires' | 'otp'> & { name?: string };

export interface IPayload extends JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  type: string;
}

export interface OtpPayload {
  token: string;
  expires: string;
}
