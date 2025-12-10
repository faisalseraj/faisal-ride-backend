import { Document, Model } from 'mongoose';

import { QueryResult } from '../paginate/paginate';

export interface IChatGPT {}
export const OpenAIChatModel = Object.freeze({
  GPT_4O_MINI: 'gpt-4o-mini', // Newly added model
  GPT_4_TURBO: 'chatgpt-4o-latest',
});

export interface IChatGPTDoc extends IChatGPT, Document {}

export interface IChatGPTModel extends Model<IChatGPTDoc> {
  paginate(filter: Record<string, any>, options: Record<string, any>): Promise<QueryResult>;
}

export type UpdateChatGPTBody = Partial<Omit<IChatGPT, ''>>;

export type NewCreatedChatGPT = Omit<IChatGPT, ''>;

export type ImageBuffer = { buffer: string; id: string };
export type LicensePlateResult = { image_id: string; license_plate: string | null };
export type LicensePlateResultWithBuffer = LicensePlateResult & { buffer: any };

export interface LicensePlateResultAfterScan {
  imageId: string;
  text: string;
  scoring: number;
  case: 'positive' | 'negative';
  plateNumber: string | null;
  existsIn: 'Apartment' | 'LicensePool' | null;
}

export interface LicensePlateResultWithBufferAfterScan extends LicensePlateResult {
  buffer: any;
}

export interface GPTDetails {
  buffers: any[];
  response: LicensePlateResultWithBuffer[];
  charactersLength: string;
  model: string;
  tokensUsage: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
