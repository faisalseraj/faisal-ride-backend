import { Request, Response } from 'express';

import { ApiError } from '../errors';
import LicenseProcessing from './licenseProcessing.model';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import { licenseProcessingService } from '.';

/** CRUD operations for License Processing */
export const createLicenseProcessing = catchAsync(async (req: Request, res: Response) => {
  const licenseProcessing = await LicenseProcessing.create(req.body);
  res.status(201).send(licenseProcessing);
});

export const getLicenseProcessing = catchAsync(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const licenseProcessing = await LicenseProcessing.findById(id);
  if (!licenseProcessing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'LicenseProcessing not found');
  }
  res.send(licenseProcessing);
});

// export const updateLicenseProcessing = catchAsync(async (req: Request, res: Response) => {
//   const id = req.params['id'] as string;
//   const licenseProcessing = await LicenseProcessing.findByIdAndUpdate(id, req.body, {
//     new: true,
//     runValidators: true,
//   });
//   if (!licenseProcessing) {
//     throw new ApiError(httpStatus.NOT_FOUND, 'LicenseProcessing not found');
//   }
//   res.send(licenseProcessing);
// });

export const deleteLicenseProcessing = catchAsync(async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const licenseProcessing = await LicenseProcessing.findByIdAndDelete(id);
  if (!licenseProcessing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'LicenseProcessing not found');
  }
  res.status(204).send();
});



export const getLicenseProcessingExtremes = catchAsync(async (_: Request, res: Response) => {
  const stats = await licenseProcessingService.getLicenseProcessingExtremes();
  res.status(200).send(stats);
});

export const getLicenseProcessingStatistics = catchAsync(async (_: Request, res: Response) => {
  const stats = await LicenseProcessing.aggregate([
    {
      $group: {
        _id: '$mainOcr',
        count: { $sum: 1 },
      },
    },
  ]);
  res.send(stats);
});

export const getAllLicenseProcessing = catchAsync(async (_: Request, res: Response) => {
  const records = await licenseProcessingService.getAllLicenseProcessing();
  res.status(httpStatus.OK).send(records);
});

export const getDashboardReasoningTokens = catchAsync(async (_: Request, res: Response) => {
  const summary = await licenseProcessingService.getReasoningTokensSummary();
  res.status(httpStatus.OK).send(summary);
});

export const getDashboardOpenAIOCR = catchAsync(async (_: Request, res: Response) => {
  const summary = await licenseProcessingService.getOpenAIOCRSummary();
  res.status(httpStatus.OK).send(summary);
});

export const getDashboardCases = catchAsync(async (_: Request, res: Response) => {
  const summary = await licenseProcessingService.getCaseSummary();
  res.status(httpStatus.OK).send(summary);
});

export const getDashboardImageStats = catchAsync(async (_: Request, res: Response) => {
  const summary = await licenseProcessingService.getImageProcessingSummary();
  res.status(httpStatus.OK).send(summary);
});

export const getCompleteDashboard = catchAsync(async (_: Request, res: Response) => {
  const summary = await licenseProcessingService.getCompleteDashboardSummary();
  res.status(httpStatus.OK).send(summary);
});
