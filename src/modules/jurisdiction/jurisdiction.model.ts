import { IJurisdictionDoc, IJurisdictionModel } from './jurisdiction.interfaces';
import mongoose, { Schema } from 'mongoose';

import { paginate } from '../paginate';

const ChargesSchema = new Schema(
  {
    unloadedEnrouteMileage: { type: Number, required: true },
    loadedHookedMileage: { type: Number, required: true },
    impoundFee: { type: Number, required: true },
    privatePropertyTowFee: { type: Number, required: true },
    notificationFee: { type: Number, required: true },
    dailyImpoundRate: { type: Number, required: true },
  },
  { _id: false }
);

const jurisdictionSchema = new Schema<IJurisdictionDoc, IJurisdictionModel>(
  {
    name: { type: String, required: true }, // no duplicate names
    description: { type: String, default: null },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    county: { type: String },
    charges: { type: ChargesSchema, required: true },
    chargesUpdatedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

jurisdictionSchema.plugin(paginate);

const Jurisdiction = mongoose.model<IJurisdictionDoc, IJurisdictionModel>('Jurisdiction', jurisdictionSchema);

export default Jurisdiction;
