import * as tierService from './tier.service';

import { Request, Response } from 'express';

import { IOptions } from '../paginate/paginate';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from '../utils/pick';

export const createTier = catchAsync(async (req: Request, res: Response) => {
  const tier = await tierService.createTier(req.body);
  res.status(httpStatus.CREATED).send(tier);
});

export const getTiers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['name', 'isActive']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await tierService.queryTiers(filter, options);
  res.send(result);
});

export const getActiveTiers = catchAsync(async (_: Request, res: Response) => {
  const tiers = await tierService.getAllActiveTiers();
  res.send(tiers);
});

export const getTier = catchAsync(async (req: Request, res: Response) => {
  if (req.params['tierId']) {
    const tier = await tierService.getTierById(new mongoose.Types.ObjectId(req.params['tierId']));
    if (!tier) {
      throw new Error('Tier not found');
    }
    res.send(tier);
  }
});

export const updateTier = catchAsync(async (req: Request, res: Response) => {
  if (req.params['tierId']) {
    const tier = await tierService.updateTierById(new mongoose.Types.ObjectId(req.params['tierId']), req.body);
    res.send(tier);
  }
});

export const deleteTier = catchAsync(async (req: Request, res: Response) => {
  if (req.params['tierId']) {
    await tierService.deleteTierById(new mongoose.Types.ObjectId(req.params['tierId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

export const hardDeleteTier = catchAsync(async (req: Request, res: Response) => {
  if (req.params['tierId']) {
    await tierService.hardDeleteTierById(new mongoose.Types.ObjectId(req.params['tierId']));
    res.status(httpStatus.NO_CONTENT).send();
  }
});

