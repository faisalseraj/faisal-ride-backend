import { IAPIKeyDoc, IAPIKeyModel } from './apiKeys.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const apiKeySchema = new mongoose.Schema<IAPIKeyDoc, IAPIKeyModel>(
  {
    apiKey: { type: String, required: true },
    allowedUsage: { type: Number, required: true, default: 1000000 * 100 },
    currentUsage: { type: Number, required: true, current: 0 },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
apiKeySchema.plugin(toJSON);
apiKeySchema.plugin(paginate);

const AccessPoint = mongoose.model<IAPIKeyDoc, IAPIKeyModel>('ApiKey', apiKeySchema);

export default AccessPoint;
