import * as apiKeyService from './apiKeys.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';
import { logService } from '../logs';

export const createAPIKey = catchAsync(async (req: Request, res: Response) => {
  const key = await apiKeyService.createAPIKey();
  
  // Log API key creation
  await logService.logAdmin(req.user as any, 'API Key Created', {
    metadata: {
      action: 'api_key_create',
      apiKeyId: key._id?.toString(),
      allowedUsage: key.allowedUsage,
      ipAddress: req.ip,
    },
  });
  
  res.status(200).send({ key });
});

export const validateAPIKey = catchAsync(async (_: Request, res: Response) => {
  const key = await apiKeyService.createAPIKey();
  res.status(200).send({ key });
});
