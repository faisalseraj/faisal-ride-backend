import * as systemSettingsService from './systemSettings.service';

import { Request, Response } from 'express';

import { ApiError } from '../errors';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';

export const createSystemSettings = catchAsync(async (req: Request, res: Response) => {
  const systemSettings = await systemSettingsService.createSystemSettings({ ...req.body, modifiedBy: req.user.id });
  res.status(201).send(systemSettings);
});

export const getSystemSettings = catchAsync(async (_: Request, res: Response) => {
  // const id = req.params['id'] as string;
  const systemSettings = await systemSettingsService.getFirstSystemSettings();
  if (!systemSettings) {
    throw new ApiError(httpStatus.NOT_FOUND, 'SystemSettings not found');
  }
  res.send(systemSettings);
});

export const updateSystemSettings = catchAsync(async (req: Request, res: Response) => {
  // const id = req.params['id'] as string;
  
  const systemSettings = await systemSettingsService.updateSystemSettings({ ...req.body, modifiedBy: req.user.id });
  if (!systemSettings) {
    throw new ApiError(httpStatus.NOT_FOUND, 'SystemSettings not found');
  }
  res.send(systemSettings);
});
// not required
// export const deleteSystemSettings = catchAsync(async (req: Request, res: Response) => {
//   const id = req.params['id'] as string;
//   const systemSettings = await systemSettingsService.deleteSystemSettings(id);
//   if (!systemSettings) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'SystemSettings not found');
//   }
//   res.status(httpStatus.NO_CONTENT).send();
// });
