import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';
import config from '../../config/config';

export interface IGemini {}
export const OpenAIChatModel = Object.freeze({
  GPT_4O_MINI: config.freeGPTModal, // Newly added model
  GPT_4_TURBO: config.paidGPTModal,
});

export interface IGeminiDoc extends IGemini, Document {}

export interface IGeminiModel extends Model<IGeminiDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateIGeminiBody = Partial<Omit<IGemini, ''>>;

export type NewCreatedIGemini = Omit<IGemini, ''>;
