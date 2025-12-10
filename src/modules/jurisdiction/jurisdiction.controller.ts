import * as jurisdictionService from './jurisdiction.service';

import { Request, Response } from 'express';

import catchAsync from '../utils/catchAsync';
import { createSystemLog } from '../logs/enhanced-log-migration.service';
import httpStatus from 'http-status';

export const createJurisdiction = catchAsync(async (req: Request, res: Response) => {
  const jurisdiction = await jurisdictionService.createJurisdiction(req.body);
  
  // Log jurisdiction creation
  await createSystemLog({
    user: req.user,
    event: 'Jurisdiction Created',
    ipAddress: req.ip,
    customMetadata: {
      action: 'jurisdiction_create',
      category: 'system',
      priority: 'medium',
      jurisdictionId: jurisdiction._id?.toString(),
      jurisdictionName: jurisdiction.name,
    },
  });
  
  res.status(httpStatus.CREATED).send(jurisdiction);
});

export const getJurisdictions = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query['isVerified'] !== undefined ? { isVerified:  req.query['isVerified'] } : {};
  const search = req.query['search'];
  const options = {
    sortBy: req.query['sortBy'] || 'name:asc',
    limit: req.query['limit'],
    page: req.query['page'],
    ...(search ? { search: search } : {}),
  };
  const result = await jurisdictionService.queryJurisdictions(filter, options);
  res.send(result);
});

export const getJurisdiction = catchAsync(async (req: Request, res: Response) => {
  const jurisdiction = await jurisdictionService.getJurisdictionById(req.params['jurisdictionId']!);
  if (!jurisdiction) {
    res.status(httpStatus.NOT_FOUND).send({ message: 'Jurisdiction not found' });
    return;
  }
  res.send(jurisdiction);
});

export const updateJurisdiction = catchAsync(async (req: Request, res: Response) => {
  const jurisdiction = await jurisdictionService.updateJurisdictionById(req.params['jurisdictionId']!, req.body);
  
  // Log jurisdiction update
  await createSystemLog({
    user: req.user,
    event: 'Jurisdiction Updated',
    ipAddress: req.ip,
    customMetadata: {
      action: 'jurisdiction_update',
      category: 'system',
      priority: 'medium',
      jurisdictionId: jurisdiction?._id?.toString(),
      jurisdictionName: jurisdiction?.name || 'Unknown',
      updatedFields: Object.keys(req.body),
    },
  });
  
  res.send(jurisdiction);
});

export const deleteJurisdiction = catchAsync(async (req: Request, res: Response) => {
  const jurisdictionId = req.params['jurisdictionId']!;
  const jurisdiction = await jurisdictionService.getJurisdictionById(jurisdictionId);
  
  await jurisdictionService.deleteJurisdictionById(jurisdictionId);
  
  // Log jurisdiction deletion
  await createSystemLog({
    user: req.user,
    event: 'Jurisdiction Deleted',
    ipAddress: req.ip,
    customMetadata: {
      action: 'jurisdiction_delete',
      category: 'system',
      priority: 'medium',
      jurisdictionId: jurisdictionId,
      jurisdictionName: jurisdiction?.name || 'Unknown',
    },
  });
  
  res.status(httpStatus.NO_CONTENT).send();
});

export const bulkUpdateJurisdictions = catchAsync(async (req: Request, res: Response) => {
  const { jurisdictionIds, updates } = req.body;
  
  if (!jurisdictionIds || !Array.isArray(jurisdictionIds) || jurisdictionIds.length === 0) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'jurisdictionIds array is required' });
    return;
  }
  
  const result = await jurisdictionService.bulkUpdateJurisdictions(jurisdictionIds, updates);
  
  // Log bulk update
  await createSystemLog({
    user: req.user,
    event: 'Jurisdictions Bulk Updated',
    ipAddress: req.ip,
    customMetadata: {
      action: 'jurisdiction_bulk_update',
      category: 'system',
      priority: 'medium',
      jurisdictionIds: jurisdictionIds,
      updatedFields: Object.keys(updates),
      updatedCount: result.modifiedCount,
    },
  });
  
  res.send(result);
});
