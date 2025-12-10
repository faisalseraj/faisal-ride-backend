import { Document, Model } from 'mongoose';
import { IUserDoc, IUserType } from '../user/user.interfaces';

import { QueryResult } from '../paginate/paginate';

export interface LogCounts {
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
}

export type EventsEnum = 'UE' | 'MaE' | 'AE' | 'FE' | 'UME' | 'CE' | 'ComE' | 'SSE' | 'LE' | 'GPTE' | 'ACE' | 'TWE' | 'PBE' | 'SE' | 'STE' ; //MeLs = Menu link share LE = Links Events, TWE = Tow Events, PBE = Parking Booking Events, SE = Socket Events, STE = Stripe Events
export const EVENTS_ENUM = ['UE', 'MaE', 'AE', 'FE', 'UME', 'CE', 'ComE', 'SSE', 'LE', 'GPTE', 'ACE', 'TWE', 'PBE', 'SE', 'STE'];
export enum StatusEnum {
  'LOGIN_SUCCESS' = 'LOGIN_SUCCESS',
  'INCORRECT_PASSWORD_OR_EMAIL' = 'INCORRECT_PASSWORD_OR_EMAIL',
  'INCORRECT_OTP' = 'INCORRECT_OTP',
  'NA' = 'NA',
}

export interface ILog {
  country?: string;
  date?: string;
  siteId?: string;
  name: string;
  phoneNumber: string;
  event: string;
  eventType: IUserType | 'external';
  userId: IUserDoc['_id'];
  affectedUser?: IUserDoc['_id'];
  eventEnum: EventsEnum;
  ipAddress?: string;
  status?: StatusEnum;
  apiKey?: string;
  // applicable for SMS and EMAIL logs only
  receiverDetails?: IReceiverDetails;
  GPTDetails?: GPTDetails;
  ownerId?: IUserDoc['_id'];
  enhancedMetadata?: any;
}

export interface IReceiverDetails {
  name?: string;
  sentTo: string;
  isFailed?: boolean;
  type: 'email' | 'phoneNumber';
  content: string;
}

export interface GPTDetails {
  prompt?: string;
  buffers?: any;
  keywords?: string[];
  summary?: string;
  roles?: string[];
  response?: any;
  tokensUsage?: string;
  charactersLength?: string;
  model?: string;
  type?: string;
  language?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  isEmpty?: boolean;
  steps?: number;
  additionalParams?: {
    businessName?: string;
    itemName?: string;
    serviceName?: string;
    previousMessage?: string;
    additionalData?: string;
  };
}

export interface gptResponse {
  detectedLanguage: string;
  data: [{ priority: string; type: string; translatedType: string; categories: [string]; translatedCategories: [string] }];
}

export interface BusinessRecommendationsResponse {
  prompt?: string;
  response?: any;
  tokensUsage?: string;
  charactersLength?: string;
  model?: string;
  attempt?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ILogDoc extends ILog, Document {}

export interface ILogModel extends Model<ILogDoc> {
  getCounts(): Promise<LogCounts>;
  getEmailCounts(): Promise<LogCounts>;
  getAICounts(): Promise<LogCounts>;
  getSMSCounts(): Promise<LogCounts>;

  paginate(filter: Record<string, any>, options: Record<string, any>, orFilter?: any): Promise<QueryResult>;
}

export type UpdateLogBody = Partial<ILog>;

export type NewCreatedLog = ILog;

export type AnonymousSMSLog = {
  name: string;
  phoneNumber: string;
  apiKey: string;
  content: string;
  isFailed: boolean;
  event?: string;
};

export type AnonymousManagementLog = {
  name: string;
  phoneNumber?: string;
  apiKey: string;
  content: string;
  isFailed: boolean;
};
