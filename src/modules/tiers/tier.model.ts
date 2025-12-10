import { ITierDoc, ITierModel } from './tier.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const tierSchema = new mongoose.Schema<ITierDoc, ITierModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingInterval: {
      type: String,
      required: true,
      enum: ['day', 'week', 'month', 'year'],
      default: 'month',
    },
    freeTowRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
    additionalTowCost: {
      type: Number,
      required: true,
      min: 0,
    },
    features: [{
      type: String,
      trim: true,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    stripePriceId: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add plugin that converts mongoose to json
tierSchema.plugin(toJSON);
tierSchema.plugin(paginate);

const Tier = mongoose.model<ITierDoc, ITierModel>('Tier', tierSchema);

export default Tier;
