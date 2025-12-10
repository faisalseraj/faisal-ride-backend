import { IVSF, IVSFModel } from './vsf.interfaces';
import mongoose, { Schema } from 'mongoose';

import paginate from '../paginate/paginate';

const vsfSchema = new Schema<IVSF, IVSFModel>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mcrNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    zipcode: {
      type: String,
      required: true,
      trim: true,
    },
    ownerOfficer: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    physicalAddress: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: false,
      trim: true,
      default: 'Active',
    },
    carrierType: {
      type: String,
      enum: ['vsf', 'tow', ''],
      required: true,
      default: 'vsf',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Add plugin that converts mongoose to json
vsfSchema.index({ mcrNumber: 1 }, { unique: true });
vsfSchema.index({ companyName: 1 });
vsfSchema.index({ city: 1 });
vsfSchema.index({ state: 1 });
vsfSchema.index({ zipcode: 1 });
vsfSchema.index({ carrierType: 1 });
vsfSchema.index({ isActive: 1 });
vsfSchema.index({ createdAt: -1 });

// Geospatial index for location-based queries using lat/lng
vsfSchema.index({ lat: 1, lng: 1 });

// Compound indexes
vsfSchema.index({ city: 1, state: 1, carrierType: 1 });
vsfSchema.index({ carrierType: 1, isActive: 1 });


// Add static method for checking MCR number
vsfSchema.statics['isMcrNumberTaken'] = async function (mcrNumber: string, excludeVsfId?: mongoose.Types.ObjectId): Promise<boolean> {
  const vsf = await this.findOne({ mcrNumber, _id: { $ne: excludeVsfId } });
  return !!vsf;
};

// Apply paginate plugin
vsfSchema.plugin(paginate);

export const VSF = mongoose.model<IVSF, IVSFModel>('VSF', vsfSchema);