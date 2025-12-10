import { EVENTS_ENUM, GPTDetails, ILogDoc, ILogModel, IReceiverDetails, LogCounts, StatusEnum } from './log.interfaces';

import { USER_TYPE } from '../user/user.interfaces';
import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

const receiverDetailsSchema = new mongoose.Schema<IReceiverDetails>({
  content: { type: String, required: true },
  name: { type: String, required: false },
  sentTo: { type: String, required: true },
  isFailed: { type: Boolean, required: false, default: false },
  type: { type: String, enum: ['email', 'phoneNumber'], required: true },
});

const gptDetailsSchema = new mongoose.Schema<GPTDetails>({
  charactersLength: { type: String, required: false },
  model: { type: String, required: false },
  prompt: { type: String, required: false },
  response: { type: String, required: false },
  tokensUsage: { type: String, required: false },
  type: { type: String, required: false },
  language: { type: String, required: false },
  inputTokens: { type: Number, required: false },
  outputTokens: { type: Number, required: false },
  totalTokens: { type: Number, required: false },
  additionalParams: {
    businessName: { type: String, required: false },
    itemName: { type: String, required: false },
    serviceName: { type: String, required: false },
    previousMessage: { type: String, required: false },
    additionalData: { type: String, required: false },
  },
});

const logSchema = new mongoose.Schema<ILogDoc, ILogModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // the name of the referenced collection
    },

    affectedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // the name of the referenced collection
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
    },
    event: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: [...USER_TYPE, 'external'],
      default: 'admin',
    },
    eventEnum: {
      type: String,
      enum: EVENTS_ENUM,
      default: 'UE',
    },
    date: {
      type: String,
      default: new Date().toISOString(),
    },
    country: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    apiKey: {
      type: String,
    },
    ownerId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(StatusEnum), // Ensure the field only accepts values from the enum
      required: false,
    },
    receiverDetails: {
      type: receiverDetailsSchema,
      required: false,
    },
    GPTDetails: {
      type: gptDetailsSchema,
      required: false,
    },
    enhancedMetadata: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
logSchema.plugin(toJSON);
logSchema.plugin(paginate);

/**
 * Check if number is taken
 * @returns {Promise<LogCounts>}
 */

logSchema.static('getCounts', async function (): Promise<LogCounts> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 1, 0);

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 0);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  thisWeekStart.setHours(0, 0, 1, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 1, 0);

  const thisYearStart = new Date();
  thisYearStart.setMonth(0, 1);
  thisYearStart.setHours(0, 0, 1, 0);
  const todayCount = await this.countDocuments({
    date: { $gte: todayStart.toISOString() },
    eventEnum: { $nin: ['ComE', 'MeLS', 'GPTE'] },
  });
  const thisWeekCount = await this.countDocuments({
    date: { $gte: thisWeekStart.toISOString() },
    eventEnum: { $nin: ['ComE', 'MeLS', 'GPTE'] },
  });
  const thisMonthCount = await this.countDocuments({
    date: { $gte: thisMonthStart.toISOString() },
    eventEnum: { $nin: ['ComE', 'MeLS', 'GPTE'] },
  });
  const thisYearCount = await this.countDocuments({
    date: { $gte: thisYearStart.toISOString() },
    eventEnum: { $nin: ['ComE', 'MeLS', 'GPTE'] },
  });

  return {
    todayCount,
    thisWeekCount,
    thisMonthCount,
    thisYearCount,
  };
});

/**
 * Check if number is taken
 * @returns {Promise<LogCounts>}
 */

logSchema.static('getEmailCounts', async function (): Promise<LogCounts> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 1, 0);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  thisWeekStart.setHours(0, 0, 1, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 1, 0);

  const thisYearStart = new Date();
  thisYearStart.setMonth(0, 1);
  thisYearStart.setHours(0, 0, 1, 0);

  const todayCount = await this.countDocuments({
    date: { $gte: todayStart.toISOString() },
    eventEnum: { $eq: 'ComE' },
    'receiverDetails.type': 'email',
  });
  const thisWeekCount = await this.countDocuments({
    date: { $gte: thisWeekStart.toISOString() },
    eventEnum: { $eq: 'ComE' },
    'receiverDetails.type': 'email',
  });
  const thisMonthCount = await this.countDocuments({
    date: { $gte: thisMonthStart.toISOString() },
    eventEnum: { $eq: 'ComE' },
    'receiverDetails.type': 'email',
  });
  const thisYearCount = await this.countDocuments({
    date: { $gte: thisYearStart.toISOString() },
    eventEnum: { $eq: 'ComE' },
    'receiverDetails.type': 'email',
  });

  return {
    todayCount,
    thisWeekCount,
    thisMonthCount,
    thisYearCount,
  };
});

/**
 * Check if number is taken
 * @returns {Promise<LogCounts>}
 */

logSchema.static('getSMSCounts', async function (): Promise<LogCounts> {
  const todayStart = new Date();
  // todayStart.setHours(0, 0, 1, 0);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  // thisWeekStart.setHours(0, 0, 1, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  // thisMonthStart.setHours(0, 0, 1, 0);

  const thisYearStart = new Date();
  thisYearStart.setMonth(0, 1);
  // thisYearStart.setHours(0, 0, 1, 0);

  const todayCount = await this.countDocuments({
    date: { $gte: `${todayStart.toISOString().split('T')[0]}T00:00:00Z` },
    eventEnum: { $in: ['ComE', 'MeLS'] },
    'receiverDetails.type': 'phoneNumber',
  });
  const thisWeekCount = await this.countDocuments({
    date: { $gte: `${thisWeekStart.toISOString().split('T')[0]}T00:00:00Z` },
    eventEnum: { $in: ['ComE', 'MeLS'] },
    'receiverDetails.type': 'phoneNumber',
  });
  const thisMonthCount = await this.countDocuments({
    date: { $gte: `${thisMonthStart.toISOString().split('T')[0]}T00:00:00Z` },
    eventEnum: { $in: ['ComE', 'MeLS'] },
    'receiverDetails.type': 'phoneNumber',
  });
  const thisYearCount = await this.countDocuments({
    date: { $gte: `${thisYearStart.toISOString().split('T')[0]}T00:00:00Z` },
    eventEnum: { $in: ['ComE', 'MeLS'] },
    'receiverDetails.type': 'phoneNumber',
  });

  return {
    todayCount,
    thisWeekCount,
    thisMonthCount,
    thisYearCount,
  };
});

/**
 * Check if number is taken
 * @returns {Promise<LogCounts>}
 */

logSchema.static('getAICounts', async function (): Promise<LogCounts> {
  const todayStart = new Date();
  todayStart.setHours(5, 0, 0, 0);

  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  thisWeekStart.setHours(0, 0, 1, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(5, 0, 0, 0);

  const thisYearStart = new Date();
  thisYearStart.setMonth(0, 1);
  thisYearStart.setHours(5, 0, 0, 0);

  const todayCount = await this.countDocuments({
    date: { $gte: todayStart.toISOString() },
    eventEnum: { $eq: 'GPTE' },
  });
  const thisWeekCount = await this.countDocuments({
    date: { $gte: thisWeekStart.toISOString() },
    eventEnum: { $eq: 'GPTE' },
  });
  const thisMonthCount = await this.countDocuments({
    date: { $gte: thisMonthStart.toISOString() },
    eventEnum: { $eq: 'GPTE' },
  });
  const thisYearCount = await this.countDocuments({
    date: { $gte: thisYearStart.toISOString() },
    eventEnum: { $eq: 'GPTE' },
  });

  return {
    todayCount,
    thisWeekCount,
    thisMonthCount,
    thisYearCount,
  };
});

const User = mongoose.model<ILogDoc, ILogModel>('Log', logSchema);

export default User;
