import * as logService from './log.service';

import { Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from '../utils/pick';

export const createLog = catchAsync(async (req: Request, res: Response) => {
  const user = await logService.createLog(req.body);
  res.status(httpStatus.CREATED).send(user);
});

// KEY based External end points
export const createAnonymousSMSLog = catchAsync(async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string; // Assuming the API key is sent in the 'Authorization' header.
  const log = await logService.createAnonymousSMSLog({ ...req.body, apiKey });
  res.status(httpStatus.CREATED).send(log);
});

export const getLogs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['eventType', 'userId', 'eventEnum', 'from', 'to', 'affectedUser', 'event']);
  const search = pick(req.query, ['search']);
  // let affectedUser: any = [];
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const loggedInUser = req.user;
  let advancedFilters = await logService.logsHelper(loggedInUser, 'log');
  const result = await logService.queryLogs(
    { ...filter, ...(advancedFilters.andFilter as any) },
    {
      ...options,
      timeImplementation: 'date',
      // ...(advancedFilters.andFilter as any),
      // affectedUser,
      ...(search?.search
        ? {
            search: `${decodeURIComponent(search?.search)}#country,name,phoneNumber,event,eventType,affectedUser`,
          }
        : {}),
    }
    // orFilter
  );

  // console.log(orFilter. )
  res.send(result);
});

export const getEmailLogs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['eventType', 'userId', 'eventEnum', 'from', 'to', 'country', 'receiverDetails']);
  const search = pick(req.query, ['search']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const loggedInUser = req.user;
  let orFilterAdvance: any = await logService.logsHelper(loggedInUser, 'emailLog');

  const result = await logService.queryEmailLogs({...filter, ...orFilterAdvance.andFilter}, {
    ...options,
    timeImplementation: 'date',
    // orFilterAdvance,
    ...(search?.search
      ? {
          search: `${decodeURIComponent(
            search?.search
          )}#country,name,phoneNumber,event,eventType,ipAddress,status,receiverDetails.name,receiverDetails.sentTo,receiverDetails.content`,
        }
      : {}),
  });
  res.send(result);
});

export const getAILogs = catchAsync(async (req: Request, res: Response) => {
  try {
    const filter = pick(req.query, ['eventType', 'userId', 'eventEnum', 'from', 'to', 'country']);
    const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
    const search = pick(req.query, ['search']);

    const result = await logService.queryAILogs(filter, {
      ...options,
      timeImplementation: 'date',
      ...(search?.search
        ? {
            search: `${decodeURIComponent(
              search?.search
            )}#country,name,event,eventType,ipAddress,GPTDetails.tokensUsage,GPTDetails.charactersLength,GPTDetails.model,GPTDetails.type,GPTDetails.prompt,GPTDetails.response,GPTDetails.language`,
          }
        : {}),
    });
    res.send(result);
  } catch (e: any) {
    console.log(e);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, e.message);
  }
});

export const getSMSLogs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['eventType', 'userId', 'eventEnum', 'from', 'to', 'country']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);

  const result = await logService.querySMSLogs(filter, {
    ...options,
    timeImplementation: 'date',
    ...(search?.search
      ? {
          search: `${decodeURIComponent(
            search?.search
          )}#country,name,phoneNumber,event,eventType,ipAddress,status,receiverDetails.name,receiverDetails.sentTo,receiverDetails.content`,
        }
      : {}),
  });
  res.send(result);
});

export const getLogcounts = catchAsync(async (_: Request, res: Response) => {
  const result = await logService.getCounts();
  res.send(result);
});

export const getEmailLogcounts = catchAsync(async (_: Request, res: Response) => {
  const result = await logService.getEmailCounts();
  res.send(result);
});

export const getAILogcounts = catchAsync(async (_: Request, res: Response) => {
  const result = await logService.getAICounts();
  res.send(result);
});

export const getSMSLogcounts = catchAsync(async (_: Request, res: Response) => {
  const result = await logService.getSMSCounts();
  res.send(result);
});

export const getLog = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['logId'] === 'string') {
    const user = await logService.getLogById(new mongoose.Types.ObjectId(req.params['logId']));
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Log not found');
    }
    res.send(user);
  }
});

export const getPercentageByEventEnum = catchAsync(async (_: Request, res: Response) => {
  const percentages = await logService.getPercentageByEventEnum();
  res.send(percentages);
});

export const getRecentManagementEvents = catchAsync(async (_: Request, res: Response) => {
  const managementEvents = await logService.getLastHundredManagementEvent();
  res.send(managementEvents);
});

export const getSiteEvents = catchAsync(async (req: Request, res: Response) => {
  if (req.query['userId']) {
    const managementEvents = await logService.getSiteEvents(req.query['userId'] as string);
    res.send(managementEvents);
  } else {
    throw new ApiError(400, 'User id is required');
  }
});

export const updateLog = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['logId'] === 'string') {
    const user = await logService.updateLogById(new mongoose.Types.ObjectId(req.params['logId']), req.body);
    res.send(user);
  }
});

export const deleteLog = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['logId'] === 'string') {
    await logService.deleteLogById(new mongoose.Types.ObjectId(req.params['logId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});
