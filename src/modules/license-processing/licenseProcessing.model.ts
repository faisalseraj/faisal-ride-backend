import { Schema, model } from 'mongoose';

import { ILicenseProcessingDoc } from './licenseProcessing.interfaces';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const licenseProcessingSchema = new Schema<ILicenseProcessingDoc>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reasongTool: {
      type: String,
      enum: ['chatgpt', 'gemini', 'xai'],
      required: true,
    },
    reasoningTokens: {
      type: Number,
      required: true,
    },
    rounds: {
      type: Number,
      required: true,
    },
    mainOcr: {
      type: String,
      enum: ['azure', 'google'],
      required: true,
    },
    secondaryOcr: {
      type: String,
      enum: ['azure', 'google'],
      required: true,
    },
    mainOpenAIOcr: {
      type: String,
      enum: ['chatgpt', 'gemini', 'xai'],
      required: true,
    },
    numberOfPics: {
      type: Number,
      required: true,
    },
    numberOfLicensesProcessed: {
      type: Number,
      required: true,
    },

    positiveCases: {
      type: Number,
      required: true,
    },
    negativeCases: {
      type: Number,
      required: true,
    },
    secondaryOCRRecord: {
      type: {
        totalImagesProcessed: {
          type: Number,
          required: true,
        },
        aiOCRTokensConsumed: {
          type: Number,
          required: true,
        },
        secondaryOCR: {
          type: String,
          enum: ['chatgpt', 'gemini', 'xai'],
          required: true,
        },
      },
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

licenseProcessingSchema.plugin(toJSON);
licenseProcessingSchema.plugin(paginate);

const LicenseProcessingModel = model<ILicenseProcessingDoc>('LicenseProcessing', licenseProcessingSchema);

export default LicenseProcessingModel;
