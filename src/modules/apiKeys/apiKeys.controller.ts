import * as apiKeyService from './apiKeys.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';
import { createSystemLog } from '../logs/enhanced-log-migration.service';

export const createAPIKey = catchAsync(async (req: Request, res: Response) => {
  const key = await apiKeyService.createAPIKey();
  
  // Log API key creation
  await createSystemLog({
    user: req.user,
    event: 'API Key Created',
    ipAddress: req.ip,
    customMetadata: {
      action: 'api_key_create',
      category: 'system',
      priority: 'medium',
      apiKeyId: key._id?.toString(),
      allowedUsage: key.allowedUsage,
    },
  });
  
  res.status(200).send({ key });
});

export const validateAPIKey = catchAsync(async (_: Request, res: Response) => {
  const key = await apiKeyService.createAPIKey();
  res.status(200).send({ key });
});
