import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface IXAI {}
export const OpenAIChatModel = Object.freeze({
  GPT_4O_MINI: 'gpt-4o-mini', // Newly added model
  GPT_4_TURBO: 'XAI-4o-latest',
});

export interface IXAIDoc extends IXAI, Document {}

export interface IXAIModel extends Model<IXAIDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateXAIBody = Partial<Omit<IXAI, ''>>;

export type NewCreatedXAI = Omit<IXAI, ''>;

export type ImageBuffer = { buffer: string; id: string };
export type LicensePlateResult = { image_id: string; license_plate: string | null };
export type LicensePlateResultWithBuffer = LicensePlateResult & { buffer: string };

