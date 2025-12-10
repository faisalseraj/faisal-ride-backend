import * as passkeyService from './passkey.service';

import {
  CreatePasskeyData,
  ValidatePasskeyData,
} from './passkey.interfaces';
import { Request, Response } from 'express';

import { ApiError } from '../errors';
import { catchAsync } from '../utils';
import { createSystemLog } from '../logs/enhanced-log-migration.service';
import httpStatus from 'http-status';

export const createPasskey = catchAsync(async (req: Request, res: Response) => {
  const passkeyData: CreatePasskeyData = req.body;
  const passkeyRecord = await passkeyService.createPasskey(passkeyData);

  // Log passkey creation
  await createSystemLog({
    user: req.user,
    event: 'Passkey Created',
    ipAddress: req.ip,
    customMetadata: {
      action: 'passkey_create',
      category: 'system',
      priority: 'medium',
      passkeyId: passkeyRecord._id?.toString(),
      pspId: passkeyRecord.pspId,
      towCompanyId: passkeyRecord.towCompanyId,
    },
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: 'Passkey created successfully',
    data: {
      id: passkeyRecord._id,
      pspId: passkeyRecord.pspId,
      towCompanyId: passkeyRecord.towCompanyId,
      createdAt: passkeyRecord.createdAt,
    },
  });
});

export const validatePasskey = catchAsync(async (req: Request, res: Response) => {
  const validateData: ValidatePasskeyData = req.body;
  const isValid = await passkeyService.validatePasskey(validateData);

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      isValid,
    },
  });
});

export const checkPasskeyRequirement = catchAsync(async (req: Request, res: Response) => {
  const { pspId } = req.params;
  const { towCompanyId } = req.query;

  if (!pspId || !towCompanyId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'pspId and towCompanyId are required');
  }

  const requiresPasskey = await passkeyService.checkPasskeyRequirement(pspId, towCompanyId as string);

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      requiresPasskey,
    },
  });
});

export const getPasskey = catchAsync(async (req: Request, res: Response) => {
  const { pspId, towCompanyId } = req.query;

  if (!pspId || !towCompanyId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'pspId and towCompanyId are required');
  }

  const passkeyRecord = await passkeyService.getPasskey(pspId as string, towCompanyId as string);

  if (!passkeyRecord) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Passkey not found');
  }

  res.status(httpStatus.OK).json({
    success: true,
    data: {
      id: passkeyRecord._id,
      pspId: passkeyRecord.pspId,
      towCompanyId: passkeyRecord.towCompanyId,
      createdAt: passkeyRecord.createdAt,
      updatedAt: passkeyRecord.updatedAt,
    },
  });
});

export const deletePasskey = catchAsync(async (req: Request, res: Response) => {
  const { pspId, towCompanyId } = req.body;

  const deleted = await passkeyService.deletePasskey(pspId, towCompanyId);

  if (!deleted) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Passkey not found');
  }

  // Log passkey deletion
  await createSystemLog({
    user: req.user,
    event: 'Passkey Deleted',
    ipAddress: req.ip,
    customMetadata: {
      action: 'passkey_delete',
      category: 'system',
      priority: 'medium',
      pspId: pspId,
      towCompanyId: towCompanyId,
    },
  });

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Passkey deleted successfully',
  });
});

export const getPasskeysForPSP = catchAsync(async (req: Request, res: Response) => {
  const { pspId } = req.params;

  if (!pspId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'pspId is required');
  }

  const passkeys = await passkeyService.getPasskeysForPSP(pspId);

  res.status(httpStatus.OK).json({
    success: true,
    data: passkeys,
  });
});

export const getPasskeysForTowCompany = catchAsync(async (req: Request, res: Response) => {
  const { towCompanyId } = req.params;

  if (!towCompanyId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'towCompanyId is required');
  }

  const passkeys = await passkeyService.getPasskeysForTowCompany(towCompanyId);

  res.status(httpStatus.OK).json({
    success: true,
    data: passkeys,
  });
});
