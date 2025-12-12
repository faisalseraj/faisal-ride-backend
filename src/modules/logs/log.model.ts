/**
 * Faisal Ride - Log Model
 * Simplified MongoDB schema for logging
 */

import { ILogDoc, ILogModel, LOG_CATEGORIES, LOG_LEVELS, LogStatus } from './log.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const logSchema = new mongoose.Schema<ILogDoc, ILogModel>(
  {
    // User info
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      default: 'System',
    },
    userType: {
      type: String,
      default: 'system',
    },

    // Event details
    event: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: LOG_CATEGORIES,
      default: 'system',
      index: true,
    },
    level: {
      type: String,
      enum: LOG_LEVELS,
      default: 'info',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(LogStatus),
      default: LogStatus.SUCCESS,
    },

    // Context
    ipAddress: {
      type: String,
    },
    country: {
      type: String,
    },

    // Flexible metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Communication specific
    recipient: {
      type: {
        type: String,
        enum: ['email', 'phone'],
      },
      value: String,
      content: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
logSchema.index({ createdAt: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ category: 1, createdAt: -1 });
logSchema.index({ level: 1, createdAt: -1 });

// Plugins
logSchema.plugin(toJSON);
logSchema.plugin(paginate);

const Log = mongoose.model<ILogDoc, ILogModel>('Log', logSchema);

export default Log;
