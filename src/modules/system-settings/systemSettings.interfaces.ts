import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';

export interface ISystemSettings {
  mainOCRTool: 'google' | 'azure';
  reasoningTool: 'chatgpt' | 'gemini' | 'xai';
  secondaryOCRTool: 'chatgpt' | 'gemini' | 'xai';
  modifiedBy: IUserDoc['_id'];
}

export interface ISystemSettingsDoc extends ISystemSettings, Document {}

export interface ISystemSettingsModel extends Model<ISystemSettingsDoc> {}

export type UpdateSystemSettingsBody = Partial<Omit<ISystemSettings, ''>>;

export type NewCreatedClientDetails = Omit<ISystemSettings, ''>;
