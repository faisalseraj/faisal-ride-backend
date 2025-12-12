import * as newUserService from './new-user.service';

import { Request, Response } from 'express';

import { ApiError } from '../errors';
import { IOptions } from '../paginate/paginate';
import { IUserDoc } from '../user/user.interfaces';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import pick from '../utils/pick';

// import { uploadService } from '../upload';

export const createNewUser = catchAsync(async (req: Request, res: Response) => {
  const user = await newUserService.createUser(req.body, req.user);
  // const loggedInUser = req.user as unknown as IUserDoc;
  // const country = await Country.findOne({ countryName: req.body.country });

  res.status(httpStatus.CREATED).send(user);
});

export const approveRejectUser = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as unknown as IUserDoc;
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized');
  }
  // const country = await Country.findOne({ countryName: req.body.country });
  const user = await newUserService.approveRejectUser(
    req.body['uid'] as any,
    req.body['status'] as any,
    req.body['comments'] as any,
    req.user
  );

  res.send({ user, status: 200, message: `User ${req.body['status']} successfully` });
});

export const getUserById = catchAsync(async (req: Request, res: Response) => {
  // const loggedInUser = req.user as unknown as IUserDoc;
  // const country = await Country.findOne({ countryName: req.body.country });
  const user = await newUserService.getUserById(req.params['id'] as any);

  res.send(user);
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const filter = pick(req.query, ['requestCreatedBy']);
  if (req.user.userType === 'admin') {
    // if (!filter['requestCreatedBy']) {
    //   throw new ApiError(httpStatus.FORBIDDEN, 'Tow company ID is required');
    // }
  }

  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  // let user = '';

  const result = await newUserService.queryUsers(filter, {
    ...options,

    ...(search?.search
      ? {
          search: `${decodeURIComponent(search?.search)}#firstName,lastName,phoneNumber,email,userType`,
        }
      : {}),
    timeImplementation: 'currentLogin',
  });

  // const loggedInUser = req.user as unknown as IUserDoc;
  // await logService.createLog({ user: loggedInUser, event: ALL_EVENTS.getAllUsers });
  res.send(result);
});

export const deleteUserById = catchAsync(async (req: Request, res: Response) => {
  await newUserService.deleteUserById(req.params['id'] as any);

  res.status(httpStatus.NO_CONTENT).send();
});
