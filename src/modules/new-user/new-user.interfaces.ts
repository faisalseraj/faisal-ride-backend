import { Document, Model } from 'mongoose';

import { AccessAndRefreshTokens } from '../token/token.interfaces';
import { IUserType } from '../user/user.interfaces';
import { QueryResult } from '../paginate/paginate';

export interface INewUser {
  firstName: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  userType: IUserType;
  requestCreatedBy?: string;
  towCompanyId?: string;
  company: {
    companyName: string;  
  };
  passkey?: string;
}

export interface INewUserDoc extends INewUser, Document {}

export interface INewUserModel extends Model<INewUserDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateNewUserBody = INewUser;

export type NewNewRegisteredUser = INewUser;

export type NewNewCreatedUser = INewUser;

export interface IUserWithTokens {
  user: INewUserDoc;
  tokens: AccessAndRefreshTokens;
}
