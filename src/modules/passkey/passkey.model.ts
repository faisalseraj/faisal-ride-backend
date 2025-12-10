import mongoose, { Schema } from 'mongoose';

import { IPasskeyDoc } from './passkey.interfaces';

const passkeySchema = new Schema<IPasskeyDoc>(
  {
    pspId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    towCompanyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    passkey: {
      type: String,
      required: true,
      validate: {
        validator: function(v: string) {
          return /^\d{4}$/.test(v);
        },
        message: 'Passkey must be exactly 4 digits',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique passkey per PSP-TowCompany pair
passkeySchema.index({ pspId: 1, towCompanyId: 1 }, { unique: true });

// Index for efficient querying
passkeySchema.index({ pspId: 1 });
passkeySchema.index({ towCompanyId: 1 });

export const Passkey = mongoose.model<IPasskeyDoc>('Passkey', passkeySchema);
