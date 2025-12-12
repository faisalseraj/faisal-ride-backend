import { ITokenDoc, ITokenModel } from './token.interfaces';

import mongoose from 'mongoose';
import toJSON from '../toJSON/toJSON';
import tokenTypes from './token.types';

const tokenSchema = new mongoose.Schema<ITokenDoc, ITokenModel>(
  {
    token: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        tokenTypes.REFRESH,
        tokenTypes.RESET_PASSWORD,
        tokenTypes.VERIFY_EMAIL,
        tokenTypes.IMPERSONATED,
        tokenTypes.EMAIL_LOGIN_ATTEMPT,
        tokenTypes.EMAIL_SET_TOKEN,
        tokenTypes.UNIQUE_URL_TOKEN,
        tokenTypes.EMAIL_SET_TOKEN_PRE_PHONE_VERIFIED,
        tokenTypes.PROMTE_DEMOTE_USER,
        tokenTypes.TOW_REQUEST_INVITE,
        tokenTypes.ACCOUNT_SETUP,
      ],
      required: true,
    },
    expires: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 3,
    },
    blacklisted: {
      type: Boolean,
      default: false,
    },
    additionalInfo: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
tokenSchema.plugin(toJSON);

const Token = mongoose.model<ITokenDoc, ITokenModel>('Token', tokenSchema);

export default Token;
