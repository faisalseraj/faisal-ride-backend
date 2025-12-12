import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface IUnsub {
  contactType: 'EMAIL' | 'SMS';
  contactInfo: string;
  unsubscribedOn: string;
  source: 'EMAIL_API' | 'MENU_SHARING_SMS';
}

export interface IUnsubDoc extends IUnsub, Document {}

export interface IUnsubModel extends Model<IUnsubDoc> {
  isAlreadyUnsubscribed(UnsubName: string): Promise<boolean>;
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateUnsubBody = Partial<IUnsub>;

export type NewRegisteredUnsub = IUnsub;

export type NewCreatedUnsub = IUnsub;

export interface IUnsubWithTokens {
  serviceMenu: IUnsubDoc;
}
