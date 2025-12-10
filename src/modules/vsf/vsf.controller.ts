import * as vsfService from './vsf.service';

import { Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { IVSFScrapeRequest } from './vsf.interfaces';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import { createSystemLog } from '../logs/enhanced-log-migration.service';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from '../utils/pick';

export const createVSF = catchAsync(async (req: Request, res: Response) => {
  const vsf = await vsfService.createVSF(req.body);
  
  // Log VSF creation
  await createSystemLog({
    user: req.user,
    event: 'VSF Created',
    ipAddress: req.ip,
    customMetadata: {
      action: 'vsf_create',
      category: 'system',
      priority: 'medium',
      vsfId: vsf._id?.toString(),
      companyName: vsf.companyName,
      mcrNumber: vsf.mcrNumber,
      city: vsf.city,
      state: vsf.state,
    },
  });
  
  res.status(httpStatus.CREATED).send(vsf);
});

export const getVSFs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['city', 'state', 'zipcode', 'carrierType', 'isActive', 'companyName']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'sortOrder', 'search']);
  const result = await vsfService.queryVSFs(filter, options);
  res.send(result);
});

export const getVSF = catchAsync(async (req: Request, res: Response) => {
  const vsfId = req.params['vsfId'];
  if (!vsfId || !mongoose.Types.ObjectId.isValid(vsfId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid VSF ID');
  }
  const vsf = await vsfService.getVSFById(new mongoose.Types.ObjectId(vsfId));
  if (!vsf) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VSF not found');
  }
  res.send(vsf);
});

export const updateVSF = catchAsync(async (req: Request, res: Response) => {
  const vsfId = req.params['vsfId'];
  if (!vsfId || !mongoose.Types.ObjectId.isValid(vsfId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid VSF ID');
  }
  const vsf = await vsfService.updateVSFById(new mongoose.Types.ObjectId(vsfId), req.body);
  
  // Log VSF update
  await createSystemLog({
    user: req.user,
    event: 'VSF Updated',
    ipAddress: req.ip,
    customMetadata: {
      action: 'vsf_update',
      category: 'system',
      priority: 'medium',
      vsfId: vsfId,
      companyName: vsf?.companyName || 'Unknown',
      updatedFields: Object.keys(req.body),
    },
  });
  
  res.send(vsf);
});

export const deleteVSF = catchAsync(async (req: Request, res: Response) => {
  const vsfId = req.params['vsfId'];
  if (!vsfId || !mongoose.Types.ObjectId.isValid(vsfId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid VSF ID');
  }
  
  // Get VSF details before deletion for logging
  const vsf = await vsfService.getVSFById(new mongoose.Types.ObjectId(vsfId));
  
  await vsfService.deleteVSFById(new mongoose.Types.ObjectId(vsfId));
  
  // Log VSF deletion
  await createSystemLog({
    user: req.user,
    event: 'VSF Deleted',
    ipAddress: req.ip,
    customMetadata: {
      action: 'vsf_delete',
      category: 'system',
      priority: 'medium',
      vsfId: vsfId,
      companyName: vsf?.companyName || 'Unknown',
      mcrNumber: vsf?.mcrNumber || 'Unknown',
    },
  });
  
  res.status(httpStatus.NO_CONTENT).send();
});

export const softDeleteVSF = catchAsync(async (req: Request, res: Response) => {
  const vsfId = req.params['vsfId'];
  if (!vsfId || !mongoose.Types.ObjectId.isValid(vsfId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid VSF ID');
  }
  const vsf = await vsfService.softDeleteVSFById(new mongoose.Types.ObjectId(vsfId));
  res.send(vsf);
});

export const bulkCreateVSFs = catchAsync(async (req: Request, res: Response) => {
  const result = await vsfService.bulkCreateVSFs(req.body);
  res.status(httpStatus.CREATED).send(result);
});

export const bulkUpdateVSFs = catchAsync(async (req: Request, res: Response) => {
  const result = await vsfService.bulkUpdateVSFs(req.body);
  res.send(result);
});

export const bulkDeleteVSFs = catchAsync(async (req: Request, res: Response) => {
  const result = await vsfService.bulkDeleteVSFs(req.body);
  res.send(result);
});

export const getVSFStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await vsfService.getVSFStats();
  res.send(stats);
});

export const searchVSFsByLocation = catchAsync(async (req: Request, res: Response) => {
  const { city, state, zipcode, radius } = req.query;
  const vsfs = await vsfService.searchVSFsByLocation(
    city as string,
    state as string,
    zipcode as string,
    radius ? Number(radius) : undefined
  );
  res.send(vsfs);
});

export const getVSFByMcrNumber = catchAsync(async (req: Request, res: Response) => {
  const { mcrNumber } = req.query;
  if (!mcrNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MCR Number is required');
  }
  const vsf = await vsfService.getVSFByMcrNumber(mcrNumber as string);
  if (!vsf) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VSF not found');
  }
  res.send(vsf);
});

export const checkVSFExists = catchAsync(async (req: Request, res: Response) => {
  const { mcrNumber } = req.query;
  if (!mcrNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MCR Number is required');
  }
  const exists = await vsfService.isMcrNumberTaken(mcrNumber as string);
  res.send({ exists });
});

export const searchVSFs = catchAsync(async (req: Request, res: Response) => {
  const { searchTerm, ...filters } = req.query;
  if (!searchTerm) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Search term is required');
  }
  const vsfs = await vsfService.searchVSFs(searchTerm as string, filters as any);
  res.send(vsfs);
});

export const getClosestVSFs = catchAsync(async (req: Request, res: Response) => {
  const { lat, lng, limit = 10, carrierType = 'vsf' } = req.query;
  
  // Validate required parameters
  if (!lat || !lng) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude and longitude are required');
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);
  const limitNum = parseInt(limit as string, 10);

  // Validate numeric values
  if (isNaN(latitude) || isNaN(longitude) || isNaN(limitNum)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid latitude, longitude, or limit values');
  }

  // Validate latitude and longitude ranges
  if (latitude < -90 || latitude > 90) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Longitude must be between -180 and 180');
  }

  // Validate limit
  if (limitNum < 1 || limitNum > 50) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Limit must be between 1 and 50');
  }

  // Validate carrierType
  if (carrierType && !['vsf', 'tow'].includes(carrierType as string)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'carrierType must be either "vsf" or "tow"');
  }

  const vsfs = await vsfService.getClosestVSFs(latitude, longitude, limitNum, carrierType as string);
  res.send(vsfs);
});

export const scrapeVSFs = catchAsync(async (req: Request, res: Response) => {
  const { zipcodes, carrierType = 'vsf', delay = 1.0 } = req.body;
  const Authorization = req.headers['authorization'] as string;
  const xApiKey = req.headers['x-api-key'] as string;
  const serverType = config.serverType;
  // Validate input
  if (!zipcodes || !Array.isArray(zipcodes) || zipcodes.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'zipcodes must be a non-empty array');
  }

  if (carrierType && !['vsf', 'tow'].includes(carrierType)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'carrierType must be either "vsf" or "tow"');
  }

  if (typeof delay !== 'number' || delay < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'delay must be a positive number');
  }

  const scrapeRequest: IVSFScrapeRequest = {
    zipcodes,
    carrierType,
    delay,
  };

  const result = await vsfService.scrapeVSFs(scrapeRequest, Authorization, xApiKey, serverType);
  res.send(result);
});
