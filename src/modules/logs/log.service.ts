import {
  AnonymousSMSLog,
  EventsEnum,
  GPTDetails,
  ILogDoc,
  IReceiverDetails,
  LogCounts,
  NewCreatedLog,
  StatusEnum,
  UpdateLogBody,
} from './log.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import { IUserDoc, IUserType } from '../user/user.interfaces';
import { extractUserId, mapUserForLogging } from './user-mapping.util';

import { ALL_EVENTS } from '../utils/events';
import ApiError from '../errors/ApiError';
import Log from './log.model';
import formatPhoneNumber from '../utils/phoneNumberUtil';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { percentage } from '../utils/percentageUtils';
import pick from 'lodash/pick';
import { userService } from '../user';

/**
 * Create a Log
 * @param {IUserDoc} user
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createLog = async ({
  user,
  event,

  affectedUser,
  userType,
  eventEnum,
  ipAddress,
  status = StatusEnum.NA,
  ownerId = null,
}: {
  user: Partial<IUserDoc>;
  event: string;
  siteId?: string;
  affectedUser?: string;
  userType?: IUserType;
  eventEnum: EventsEnum;
  ipAddress?: string;
  status?: StatusEnum;
  ownerId?: mongoose.Types.ObjectId | null;
}): Promise<ILogDoc> => {
  // Use the dynamic user mapping utility to handle both Mongoose docs and plain objects
  const mappedUser = mapUserForLogging(user);

  let logBody: NewCreatedLog = {
    name: mappedUser.name,
    event,
    country: user?.country ?? 'Global',
    eventType: userType ?? (user?.userType as unknown as IUserType),
    phoneNumber: mappedUser.phoneNumber,
    userId: extractUserId(user),
    date: new Date().toISOString(),
    affectedUser,
    eventEnum,
    status,
    ownerId,
  };

  if (ipAddress) {
    logBody = { ...logBody, ipAddress };
  }

  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {IUserDoc} user
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createGPTLog = async ({
  user,
  event,
  siteId,
  userType,
  eventEnum,
  ipAddress,
  GPTDetails,
}: {
  user: Partial<IUserDoc>;
  event: string;
  siteId?: string;
  userType?: IUserType;
  eventEnum: EventsEnum;
  ipAddress?: string;
  GPTDetails: GPTDetails;
}): Promise<ILogDoc> => {
  // Use the dynamic user mapping utility to handle both Mongoose docs and plain objects
  const mappedUser = mapUserForLogging(user);

  let logBody: NewCreatedLog = {
    name: mappedUser.name,
    event,
    country: user?.country ?? '',
    eventType: userType ?? (user?.userType as unknown as IUserType),
    phoneNumber: mappedUser.phoneNumber,
    userId: extractUserId(user),
    date: new Date().toISOString(),
    siteId: siteId ?? '',
    eventEnum,
    GPTDetails,
  };

  if (ipAddress) {
    logBody = { ...logBody, ipAddress };
  }

  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {IUserDoc} user
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createCommunicationLog = async ({
  user,
  event,
  receiverDetails,
  eventEnum,
  country,
  pribibitPhoneChange,
  ownerId,
}: {
  user: Partial<IUserDoc>;
  event: string;
  status?: StatusEnum;
  receiverDetails: IReceiverDetails;
  eventEnum?: EventsEnum;
  country?: string;
  pribibitPhoneChange?: boolean;
  ownerId?: mongoose.Types.ObjectId | null;
}): Promise<ILogDoc> => {
  let logBody: NewCreatedLog = {
    name: user.firstName + ' ' + user.lastName,
    event,
    eventType: 'admin',
    phoneNumber: user.phoneNumber!,
    userId: user._id,
    date: new Date().toISOString(),
    eventEnum: eventEnum ?? 'ComE',
    status: StatusEnum.NA,
    country: country ?? user?.country ?? '',
    ownerId,
    receiverDetails: {
      ...receiverDetails,

      sentTo: pribibitPhoneChange
        ? receiverDetails.sentTo
        : receiverDetails.type === 'phoneNumber'
        ? formatPhoneNumber(receiverDetails.sentTo)
        : receiverDetails.sentTo,
    },
  };

  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {IUserDoc} user
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createReportEmailLog = async ({
  user,
  event,
  receiverDetails,
  country,
}: {
  user: Partial<IUserDoc>;
  event: string;
  status?: StatusEnum;
  receiverDetails: IReceiverDetails;
  eventEnum?: EventsEnum;
  country?: string;
}): Promise<ILogDoc> => {
  let logBody: NewCreatedLog = {
    name: 'Multi Users',
    event,
    eventType: 'admin',
    phoneNumber: '-----',
    userId: null,
    date: new Date().toISOString(),
    eventEnum: 'ComE',
    status: StatusEnum.NA,
    country: country ?? user?.country ?? '',
    receiverDetails: {
      ...receiverDetails,
      sentTo: receiverDetails.type === 'phoneNumber' ? formatPhoneNumber(receiverDetails.sentTo) : receiverDetails.sentTo,
    },
  };

  return Log.create(logBody);
};

// KEY based External end points
/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousEmailLog = async ({
  event,
  receiverDetails,
  name,
  apiKey,
}: {
  event: string;
  receiverDetails: IReceiverDetails;
  name: string;
  apiKey: string;
}): Promise<ILogDoc> => {
  const user = await userService.getUserByEmail(receiverDetails.sentTo);

  let logBody: NewCreatedLog = {
    name: user?.fullName ?? name ?? 'API User',
    apiKey,
    event,
    eventType: 'external',
    phoneNumber: '----------',
    userId: null,
    date: new Date().toISOString(),
    eventEnum: 'ComE',
    status: StatusEnum.NA,
    country: user?.country || 'Global',
    receiverDetails: {
      ...receiverDetails,
      name: user?.fullName ?? name ?? 'API User',
    },
  };

  return Log.create(logBody);
};

// KEY based External end points
/**
 * Create a Log
 * @param {IUserDoc} user
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousSMSLog = async ({
  name,
  phoneNumber,
  apiKey,
  isFailed = false,
  content,
  event,
}: AnonymousSMSLog): Promise<ILogDoc> => {
  // const countryNameOfReceiver = await countryService.getCountryNameFromPhoneNumber(phoneNumber);

  const user = await userService.getUserByPhone(formatPhoneNumber(phoneNumber));
  let logBody: NewCreatedLog = {
    name: user?.fullName ?? name ?? 'API User',
    event: event
      ? event
      : isFailed === true
      ? ALL_EVENTS.userCommunication.failedMessage
      : ALL_EVENTS.userCommunication.SMSSentViaKey,
    apiKey,
    eventType: 'external',
    phoneNumber,
    country: user?.country || 'Global',
    userId: null,
    date: new Date().toISOString(),
    eventEnum: 'ComE',
    status: StatusEnum.NA,
    receiverDetails: {
      content,
      sentTo: phoneNumber,
      type: 'phoneNumber',
      isFailed,
      name: user?.fullName ?? name ?? 'API User',
    },
  };

  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createCustomerLog = async ({ event }: { event: string }): Promise<ILogDoc> => {
  const logBody: NewCreatedLog = {
    name: 'Customer',
    country: 'Global',
    event,
    eventType: 'external',
    phoneNumber: '-------------',
    userId: null,
    eventEnum: 'CE',
    date: new Date().toISOString(),
  };
  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousUnsubLog = async ({ event, name }: { event: string; name: string }): Promise<ILogDoc> => {
  const logBody: NewCreatedLog = {
    name,
    event,
    eventType: 'external',
    country: 'Global',

    phoneNumber: '-------------',
    userId: null,
    eventEnum: 'UE',
    date: new Date().toISOString(),
  };
  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousManagementLog = async ({ event, name }: { event: string; name: string }): Promise<ILogDoc> => {
  const logBody: NewCreatedLog = {
    name,
    country: 'Global',
    event,
    eventType: 'external',

    phoneNumber: '-------------',
    userId: null,
    eventEnum: 'MaE',
    date: new Date().toISOString(),
  };
  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousSecurityLog = async ({
  name,
  phoneNumber,
}: {
  name: string;
  phoneNumber: string;
}): Promise<ILogDoc> => {
  const logBody: NewCreatedLog = {
    name,
    event: 'System has detected a bot attempt to signup multiple users from same IP Address',
    eventType: 'external',
    country: 'Global',

    phoneNumber: phoneNumber,
    userId: null,
    eventEnum: 'SSE',
    date: new Date().toISOString(),
  };
  return Log.create(logBody);
};

/**
 * Create a Log
 * @param {String} event
 * @returns {Promise<ILogDoc>}
 */
export const createAnonymousGPTLog = async ({
  event,
  GPTDetails,
  apiKey,
  eventEnum,
  ipAddress,
}: {
  event: string;
  GPTDetails: any;
  apiKey: string;
  eventEnum: EventsEnum;
  ipAddress: string;
}): Promise<ILogDoc> => {
  let logBody: NewCreatedLog = {
    name: 'App API Key - ',
    event,
    apiKey,
    country: 'Global',
    eventType: 'external',
    phoneNumber: '---',
    userId: null,
    date: new Date().toISOString(),
    siteId: '',
    eventEnum,
    GPTDetails,
  };

  if (ipAddress) {
    logBody = { ...logBody, ipAddress };
  }

  return Log.create(logBody);
};

/**
 * Query for Logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryLogs = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  try {
    const enumFilter = filter['eventEnum']
      ? {
          eventEnum: filter['eventEnum'],
        }
      : {
          eventEnum: { $nin: ['ComE', 'MeLS'] },
        };
    filter = {
      ...filter,
      ...enumFilter,
    };
    console.log(filter, 'filter');
    const Logs = await Log.paginate(filter, { ...options, ...{ populate: 'userId' } });
    // const groupedEventType = await Log.aggregate(
    //   [
    //     {
    //       $group: {
    //         _id: '$eventType',
    //       },
    //     },
    //   ],
    //   { allowDiskUse: true }
    // );
    // const groupedEventEnum = await Log.aggregate(
    //   [
    //     {
    //       $group: {
    //         _id: '$eventEnum',
    //       },
    //     },
    //   ],
    //   { allowDiskUse: true }
    // );
    // const eventTypes = groupedEventType.map((item) => item._id);
    // let notIncludedEventEnums = ['ComE', 'MeLS', 'GPTE'];
    // const eventEnums = groupedEventEnum.map((item) => item._id);
    // const result = eventEnums.filter((item) => !notIncludedEventEnums.includes(item));

    return {
      ...Logs,
      results: Logs.results?.map((log: any) =>
        log?.userId
          ? {
              ...log.toObject(),
              userId: log?.userId?._id,
              user: pick(log?.userId, [
                'fullName',
                'firstName',
                'lastName',
                'company',
                'towCompany',
                'email',
                'phoneNumber',
                '_id',
              ]),
            }
          : log
      ),
      // ...(filter['siteId'] && { eventTypes, eventEnums: result }),
    };
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, e.message);
  }
};

/**
 * Query for Logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const getUserCurrentMonthLogsCount = async (siteId: string): Promise<Number> => {
  const today = new Date();

  let startDate, endDate;
  startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  endDate = new Date();
  const userCounts = await Log.aggregate([
    {
      $match: {
        date: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(), // current date
        },
        siteId,
      },
    },
  ]);
  return userCounts.length ?? 0;
};

/**
 * Query for Logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryEmailLogs = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  try {
    filter = {
      ...filter,
      eventEnum: { $eq: 'ComE' },
      'receiverDetails.type': 'email',
    };
    const Logs = await Log.paginate(filter, { ...options, ...{ populate: 'userId' } });

    return {
      ...Logs,
      results: Logs.results?.map((log: any) =>
        log?.userId
          ? {
              ...log.toObject(),
              userId: log?.userId?._id,
              user: pick(log?.userId, [
                'fullName',
                'firstName',
                'lastName',
                'company',
                'towCompany',
                'email',
                'phoneNumber',
                '_id',
              ]),
            }
          : log
      ),
      // ...(filter['siteId'] && { eventTypes, eventEnums: result }),
    };
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, e.message);
  }
};
/**
 * Query for Logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryAILogs = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  filter = {
    ...filter,
    eventEnum: { $eq: 'GPTE' },
  };
  const Logs = await Log.paginate(filter, options);
  return Logs;
};

/**
 * Query for Logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const querySMSLogs = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  filter = {
    ...filter,
    eventEnum: { $in: ['ComE', 'MeLS'] },
    'receiverDetails.type': 'phoneNumber',
  };
  const Logs = await Log.paginate(filter, options);
  return Logs;
};

/**
 * Query for Logs
 * @returns {Promise<LogCounts>}
 */
export const getCounts = async (): Promise<LogCounts> => {
  const Logs = await Log.getCounts();
  return Logs;
};

/**
 * Query for Logs
 * @returns {Promise<LogCounts>}
 */
export const getEmailCounts = async (): Promise<LogCounts> => {
  const Logs = await Log.getEmailCounts();
  return Logs;
};

/**
 * Query for Logs
 * @returns {Promise<LogCounts>}
 */
export const getAICounts = async (): Promise<LogCounts> => {
  const Logs = await Log.getAICounts();
  return Logs;
};

/**
 * Query for Logs
 * @returns {Promise<LogCounts>}
 */
export const getSMSCounts = async (): Promise<LogCounts> => {
  const Logs = await Log.getSMSCounts();
  return Logs;
};

/**
 * Get Log by id
 * @param {mongoose.Types.ObjectId} id
 * @returns {Promise<ILogDoc | null>}
 */
export const getLogById = async (id: mongoose.Types.ObjectId): Promise<ILogDoc | null> => Log.findById(id);

/**
 * Update Log by id
 * @param {mongoose.Types.ObjectId} LogId
 * @param {UpdateLogBody} updateBody
 * @returns {Promise<ILogDoc | null>}
 */
export const updateLogById = async (LogId: mongoose.Types.ObjectId, updateBody: UpdateLogBody): Promise<ILogDoc | null> => {
  const Log = await getLogById(LogId);
  if (!Log) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Log not found');
  }
  Object.assign(Log, updateBody);
  await Log.save();
  return Log;
};

/**
 * Delete Log by id
 * @param {mongoose.Types.ObjectId} LogId
 * @returns {Promise<ILogDoc | null>}
 */
export const deleteLogById = async (LogId: mongoose.Types.ObjectId): Promise<ILogDoc | null> => {
  const Log = await getLogById(LogId);
  if (!Log) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Log not found');
  }
  await Log.deleteOne();
  return Log;
};

/**
 * Query for Logs
 * @returns {Promise<LogCounts>}
 */
export const getPercentageByEventEnum = async () => {
  const eventsPercentage = await Log.aggregate([
    {
      $group: {
        _id: '$eventEnum',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        eventEnum: '$_id',
        count: 1,
      },
    },
  ]);
  const smsEvents = await Log.count({ eventEnum: 'ComE', 'receiverDetails.type': 'phoneNumber' });
  const emailEvents = await Log.count({ eventEnum: 'ComE', 'receiverDetails.type': 'email' });
  const totalEvents = eventsPercentage.reduce((acc, item) => acc + item.count, 0);

  // Calculate the percentage for each category
  let percentages: any = {};
  eventsPercentage.map((item) => {
    if (item.eventEnum === 'ComE') {
      percentages['smsEvents'] = percentage(smsEvents, totalEvents);
      percentages['emailEvents'] = percentage(emailEvents, totalEvents);
      percentages[item.eventEnum] = percentage(item.count, totalEvents);
    } else {
      percentages[item.eventEnum] = percentage(item.count, totalEvents);
    }
  });

  return percentages;
};

/**
 * Query for Logs
 */
export const getLastHundredManagementEvent = async () => {
  const lastHundredRecords = await Log.find({
    $or: [{ eventEnum: 'MaE' }, { eventEnum: 'UME' }],
    userId: { $ne: null },
  })
    .populate({ path: 'userId', select: 'firstName lastName fullName phoneNumber email' })
    .sort({ createdAt: -1 }) // Sort by the 'timestamp' field in descending order (most recent first)
    .limit(100); // Limit the result to 100 records
  const alteredRecords = lastHundredRecords?.map((log) => ({
    ...log.toObject(),
    user: log.userId,
    userId: log?.userId?._id,
  }));
  return alteredRecords;
};

/**
 * Query for Logs
 */
export const getSiteEvents = async (userId: string) => {
  const lastHundredRecords = await Log.find({ userId: new mongoose.Types.ObjectId(userId), eventEnum: 'MeE' })
    .populate({ path: 'userId', select: 'firstName lastName fullName phoneNumber email' })
    .sort({ createdAt: -1 }); // Sort by the 'timestamp' field in descending order (most recent first)
  // const alteredRecords = lastHundredRecords?.map((log) => ({
  //   ...log.toObject(),
  //   user: log.userId,
  //   userId: log?.userId?._id,
  // }));
  return lastHundredRecords;
};

export const logsHelper = async (loggedInUser: IUserDoc, flow: 'log' | 'emailLog') => {
  let orFilterAdvance: any = [];
  let andFilter: any = {};
  flow;
  andFilter;
  orFilterAdvance;
  if (loggedInUser.userType.includes('manager')) {
    const ownerId = await userService.getOwnerIdByUserId(new mongoose.Types.ObjectId(loggedInUser.id));
    andFilter = {
      ownerId: ownerId?.toString(),
      userId: loggedInUser.id,
    };
  }
  if (loggedInUser.userType.includes('owner')) {
    // filter.userId = loggedInUser.id;
    // const apartmentComplexUsers = await apartmentComplexService.getMyApartmentComplexes(
    //   new mongoose.Types.ObjectId(loggedInUser.id),
    //   { skipPopulate: true }
    // );
    // const ids = apartmentComplexUsers
    //   ?.map((apartment) => [...(apartment.employees || []), ...(apartment.managers || [])])
    //   .flat();
    // if (flow === 'log') {
    //   orFilterAdvance.push({
    //     affectedUser: {
    //       //To be decided whether to show logs of owner being carried out by the admin or not
    //       // $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id))],
    //       $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id)), new mongoose.Types.ObjectId(loggedInUser.id)],
    //     },
    //   });
    //   orFilterAdvance.push({ userId: new mongoose.Types.ObjectId(loggedInUser.id) });
    // } else {
    //   orFilterAdvance.push({
    //     userId: {
    //       $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id))],
    //     },
    //   });
    // }
    andFilter = {
      ownerId: loggedInUser.id.toString(),
    };
    // affectedUser = JSON.stringify(ids);
  }

  // if (loggedInUser.userType === 'tow-company-owner') {
  //   // filter.userId = loggedInUser.id;
  //   // const apartmentComplexUsers = await apartmentComplexService.getMyApartmentComplexes(
  //   //   new mongoose.Types.ObjectId(loggedInUser.id),
  //   //   { skipPopulate: true }
  //   // );
  //   const ids = [...(loggedInUser?.towCompany?.employees || []), ...(loggedInUser?.towCompany?.managers || [])];
  //   if (flow === 'log') {
  //     orFilterAdvance.push({
  //       //To be decided whether to show logs of owner being carried out by the admin or not
  //       affectedUser: {
  //         $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id)), new mongoose.Types.ObjectId(loggedInUser.id)],
  //         // $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id))],
  //       },
  //     });
  //     orFilterAdvance.push({ userId: new mongoose.Types.ObjectId(loggedInUser.id) });
  //   } else {
  //     orFilterAdvance.push({
  //       userId: {
  //         $in: [...ids?.map((id) => new mongoose.Types.ObjectId(id))],
  //       },
  //     });
  //   }
  //   andFilter = {
  //     onlyAdmin: { $ne: true },
  //   };
  //   // affectedUser = JSON.stringify(ids);
  // }

  return { orFilterAdvance, andFilter };
};
