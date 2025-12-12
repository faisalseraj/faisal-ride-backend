import { ISystemSettingsDoc, ISystemSettingsModel } from './systemSettings.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const systemSettingSchema = new mongoose.Schema<ISystemSettingsDoc, ISystemSettingsModel>(
  {
    mainOCRTool: {
      type: String,
      enum: ['google', 'azure'],
      required: true,
    },
    reasoningTool: {
      type: String,
      enum: ['chatgpt', 'gemini', 'xai'],
      required: true,
    },
    secondaryOCRTool: {
      type: String,
      enum: ['chatgpt', 'gemini', 'xai'],
      required: true,
    },

    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// add plugin that converts mongoose to json
systemSettingSchema.plugin(toJSON);
systemSettingSchema.plugin(paginate);

const AccessPoint = mongoose.model<ISystemSettingsDoc, ISystemSettingsModel>('SystemSetting', systemSettingSchema);

export default AccessPoint;

