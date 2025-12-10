import * as unsubService from './unsub.service';

import { Request, Response } from 'express';

import { ALL_EVENTS } from '../utils/events';
import ApiError from '../errors/ApiError';
import { IOptions } from '../paginate/paginate';
import Unsub from './unsub.model';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { logService } from '../logs';
import pick from '../utils/pick';

export const createUnsubscribe = catchAsync(async (req: Request, res: Response) => {
  if (req.body['unsubToken']) {
    const payload = await jwt.verify(req.body['unsubToken'], config.jwt.secret);

    const contactInfo = ((payload as any)?.sub as any)?.contactInfo;
    const source = ((payload as any)?.sub as any)?.source;
    const contactType = (payload as any)?.type as any;
    if (contactInfo) {
      if (!contactInfo || !contactType || !source) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Token is not valid');
      }
      if (contactType !== 'EMAIL' || source !== 'EMAIL_API') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Token is not valid');
      }
      const payload = { contactInfo, contactType, source };
      const category = await unsubService.createUnsub({ ...payload, unsubscribedOn: new Date().toISOString() });
      if (category?._id) {
        await logService.createAnonymousUnsubLog({
          name: `Anonymous -- ${payload.contactInfo}`,
          event: ALL_EVENTS.UserEvents.unsubEmail(payload.contactInfo),
        });
        res
          .status(httpStatus.CREATED)
          .send({ code: 200, message: 'You have successfuly Unsubscribed from our email services' });
      }
    }
  }
});

export const decodeToken = catchAsync(async (req: Request, res: Response) => {
  try {
    if (req.body['unsubToken']) {
      // const decoded = decryptEmail(req.body['unsubToken']);
      const payload = await jwt.verify(req.body['unsubToken'], config.jwt.secret);

      const contactInfo = ((payload as any)?.sub as any)?.contactInfo;
      const source = ((payload as any)?.sub as any)?.source;
      const contactType = (payload as any)?.type as any;
      if (contactInfo) {
        if (!contactInfo || !contactType || !source) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Token is not valid');
        }
        if (contactType !== 'EMAIL' || source !== 'EMAIL_API') {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Token is not valid');
        }

        const isAlreadyUnsubscribed = await Unsub.isAlreadyUnsubscribed(contactInfo);

        const payload = { contactInfo, contactType, source, isAlreadyUnsubscribed };
        res.send({ code: 200, payload });
      }
    }
  } catch (e: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, e?.message);
  }
});

export const getUnsubs = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['categoryName', 'siteId']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const result = await unsubService.queryUnsub(filter, options);

  // const loggedInUser = req.user as unknown as IUserDoc;
  // await logService.createLog({ user: loggedInUser, event: ALL_EVENTS.category.getAll });
  res.send(result);
});
