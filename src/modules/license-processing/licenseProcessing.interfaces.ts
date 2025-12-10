import { Document, Model } from 'mongoose';

import { IUserDoc } from '../user/user.interfaces';

export interface ILicenseProcessing {
  user: IUserDoc['_id'];
  reasongTool: 'chatgpt' | 'gemini' | 'xai';
  reasoningTokens: number;
  rounds: number;
  mainOcr: 'azure' | 'google';
  secondaryOcr: 'azure' | 'google';
  mainOpenAIOcr: 'chatgpt' | 'gemini' | 'xai';
  numberOfPics: number;
  numberOfLicensesProcessed: number;
  positiveCases: number;
  negativeCases: number;
  secondaryOCRRecord: {
    totalImagesProcessed: number;
    aiOCRTokensConsumed: number;
    secondaryOCR: 'chatgpt' | 'gemini' | 'xai';
  };
}

export interface ILicenseProcessingDoc extends ILicenseProcessing, Document {}

export interface ILicenseProcessingModel extends Model<ILicenseProcessingDoc> {}

export type UpdateLicenseProcessingBody = Partial<Omit<ILicenseProcessing, ''>>;

export type NewCreatedClientDetails = Omit<ILicenseProcessing, ''>;

export interface ReasoningTokensSummary {
  tool: 'chatgpt' | 'gemini' | 'xai';
  totalTokens: number;
}

export interface OpenAIOCRSummary {
  ocrType: 'chatgpt' | 'gemini' | 'xai';
  totalImagesProcessed: number;
  totalTokensConsumed: number;
}

export interface CaseSummary {
  positiveCases: number;
  negativeCases: number;
}

export interface ImageProcessingSummary {
  totalPics: number;
  totalLicensesProcessed: number;
}

export interface CompleteDashboardSummary {
  reasoningTokens: ReasoningTokensSummary[];
  openAIOCRSummary: OpenAIOCRSummary[];
  caseSummary: CaseSummary;
  imageProcessingSummary: ImageProcessingSummary;
}

export interface LicenseProcessingExtremes {
  highest: {
    reasoningTool: { tool: string; value: number };
    ocr: { ocrType: string; value: number };
    positiveCases: { user: string; value: number };
    negativeCases: { user: string; value: number };
  };
  lowest: {
    reasoningTool: { tool: string; value: number };
    ocr: { ocrType: string; value: number };
    positiveCases: { user: string; value: number };
    negativeCases: { user: string; value: number };
  };
}
