import { IOtpDoc, IOtpModel, OTP_TYPE } from './otp.interfaces';

import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';

const tokenSchema = new mongoose.Schema<IOtpDoc, IOtpModel>(
  {
    otp: {
      type: String,
      required: true,
      index: true,
    },

    phoneNumber: {
      type: String,
      required: false,
    },
    
    email: {
      type: String,
      required: false,
    },

    expires: {
      type: String,
      required: true,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // the name of the referenced collection
    },
    type: {
      type: String,
      enum: OTP_TYPE,
      required: true,
      default: 'login'
    }
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
tokenSchema.plugin(toJSON);

const Otp = mongoose.model<IOtpDoc, IOtpModel>('Otp', tokenSchema);

export default Otp;
