import * as bookParkingService from './book-parking.service';

import { Request, Response } from 'express';
import { createParkingBookingLog, createSystemLog } from '../logs/enhanced-log-migration.service';

import { ApiError } from '../errors';
import { IOptions } from '../paginate/paginate';
import { IUserDoc } from '../user/user.interfaces';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from '../utils/pick';
import { userService } from '../user';

export const createBookingParking = catchAsync(async (req: Request, res: Response) => {
  try {
    // Log booking attempt
    await createParkingBookingLog({
      user: req.user,
      event: 'Parking booking creation attempted',
      customMetadata: {
        parkingProviderId: req.body.parkingProviderId,
        licensePlate: req.body.licensePlate,
        parkingStartTime: req.body.parkingStartTime,
        parkingEndTime: req.body.parkingEndTime,
        ipAddress: req.ip,
      },
    });

    // Save to DB
    const bookParking = await bookParkingService.createBookParking(req.body, req.user);

    // Log successful creation
    await createParkingBookingLog({
      user: req.user,
      event: 'Parking booking created successfully',
      customMetadata: {
        bookingId: bookParking._id,
        parkingProviderId: bookParking.parkingProviderId,
        licensePlate: bookParking.licensePlate,
        parkingStartTime: bookParking.parkingStartTime,
        parkingEndTime: bookParking.parkingEndTime,
        status: bookParking.status,
        ipAddress: req.ip,
      },
    });

    res.send({
      message: 'Book Parking created successfully',
      bookParking,
      code: 200,
    });
  } catch (e) {
    // Log error
    await createSystemLog({
      user: req.user,
      event: 'Parking booking creation failed with error',
      customMetadata: {
        error: (e as any)?.message || 'Unknown error',
        stack: (e as any)?.stack,
        parkingProviderId: req.body.parkingProviderId,
        licensePlate: req.body.licensePlate,
      },
    });
    console.log(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'error' + e);
  }
});

export const updateBookParking = catchAsync(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { extendedHours } = req.body;

    // Log update attempt
    await createParkingBookingLog({
      user: req.user,
      event: 'Parking booking extension attempted',
      customMetadata: {
        bookingId: id,
        extendedHours,
        ipAddress: req.ip,
      },
    });

    // Save to DB
    const bookParking = await bookParkingService.extendBookParking(id!, extendedHours, req.user);

    // Log successful update
    await createParkingBookingLog({
      user: req.user,
      event: 'Parking booking extended successfully',
      customMetadata: {
        bookingId: bookParking._id,
        extendedHours,
        newParkingEndTime: bookParking.parkingEndTime,
        status: bookParking.status,
        ipAddress: req.ip,
      },
    });

    res.send({
      message: 'Book Parking updated successfully',
      bookParking,
      code: 200,
    });
  } catch (e) {
    // Log error
    await createSystemLog({
      user: req.user,
      event: 'Parking booking extension failed with error',
      customMetadata: {
        error: (e as any)?.message || 'Unknown error',
        stack: (e as any)?.stack,
        bookingId: req.params['id'],
        extendedHours: req.body.extendedHours,
      },
    });
    console.log(e, 'error is here');
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'error' + e);
  }
});

export const getBookingParkings = catchAsync(async (req: Request, res: Response) => {
  let filter = pick(req.query, []);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  const loggedInUser = req.user as IUserDoc;
  const orFilterAdvance: any = [];

  if (loggedInUser.userType !== 'admin') {
    filter = {
      $or: [
        { bookedById: loggedInUser._id },
        {
          parkingProviderId:
            loggedInUser.userType === 'parking-spaces-provider-owner' ? loggedInUser._id : loggedInUser.pspCompanyId,
        },
      ],
    };
  }

  const result = await bookParkingService.queryBookParkings(
    filter,
    {
      ...options,
      populate: 'bookedById,parkingProviderId,previousBookingIds,nextBookingId',
      orFilterAdvance,
      ...(search?.search
        ? {
            search: `${decodeURIComponent(search?.search)}#licensePlate,`,
          }
        : {}),
    },
    loggedInUser
  );

  res.send(result);
});

export const getBookingParkingById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Log retrieval attempt
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Parking booking retrieval attempted',
  //   customMetadata: {
  //     bookingId: id,
  //     ipAddress: req.ip,
  //   },
  // });

  const bookParking = await bookParkingService.getBookParkingById(id as any);

  if (!bookParking) {
    // await createSystemLog({
    //   user: req.user,
    //   event: 'Parking booking not found',
    //   customMetadata: {
    //     bookingId: id,
    //     ipAddress: req.ip,
    //   },
    // });
    throw new ApiError(httpStatus.NOT_FOUND, 'Tow Request not found');
  }

  // Log successful retrieval
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Parking booking retrieved successfully',
  //   customMetadata: {
  //     bookingId: bookParking._id,
  //     status: bookParking.status,
  //     licensePlate: bookParking.licensePlate,
  //     ipAddress: req.ip,
  //   },
  // });

  res.send(bookParking);
});

export const getParkingDetailsById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Log parking details retrieval attempt
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Parking details retrieval attempted',
  //   customMetadata: {
  //     parkingProviderId: id,
  //     ipAddress: req.ip,
  //   },
  // });

  const parkingDetails = await userService.getUserById(new mongoose.Types.ObjectId(id));

  if (!parkingDetails) {
    // await createSystemLog({
    //   user: req.user,
    //   event: 'Parking space not found',
    //   customMetadata: {
    //     parkingProviderId: id,
    //     ipAddress: req.ip,
    //   },
    // });
    throw new ApiError(httpStatus.NOT_FOUND, 'Parking space not found');
  }

  if (parkingDetails?.isSuspended || parkingDetails?.isArchived || parkingDetails?.isDeleted) {
    // await createSystemLog({
    //   user: req.user,
    //   event: 'Parking space not available for booking',
    //   customMetadata: {
    //     parkingProviderId: id,
    //     isSuspended: parkingDetails.isSuspended,
    //     isArchived: parkingDetails.isArchived,
    //     isDeleted: parkingDetails.isDeleted,
    //     ipAddress: req.ip,
    //   },
    // });
    throw new ApiError(httpStatus.NOT_FOUND, 'Parking space is not in the state to book slot');
  }

  // // Log successful retrieval
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Parking details retrieved successfully',
  //   customMetadata: {
  //     parkingProviderId: parkingDetails._id,
  //     companyName: parkingDetails.company?.companyName,
  //     ipAddress: req.ip,
  //   },
  // });

  res.send(pick(parkingDetails.toObject(), ['_id', 'parkingDetails', 'company']));
});

// export const updateBookingParkingById = catchAsync(async (req: Request, res: Response) => {
//   const bookParking = await bookParkingService.updateBookingParkingById(req.params['id'] as any, req.body);
//   res.send(bookParking);
// });

export const deleteBookingParkingById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Log deletion attempt
  await createParkingBookingLog({
    user: req.user,
    event: 'Parking booking deletion attempted',
    customMetadata: {
      bookingId: id,
      ipAddress: req.ip,
    },
  });

  await bookParkingService.deleteBookParkingById(id as any);

  // Log successful deletion
  await createParkingBookingLog({
    user: req.user,
    event: 'Parking booking deleted successfully',
    customMetadata: {
      bookingId: id,
      ipAddress: req.ip,
    },
  });

  res.status(httpStatus.NO_CONTENT).send();
});

export const getBookParkingStatusCounts = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    await createSystemLog({
      user: req.user,
      event: 'Book parking status counts request failed - user not authenticated',
      customMetadata: {
        ipAddress: req.ip,
      },
    });
    throw new ApiError(httpStatus.UNAUTHORIZED, 'User not authenticated');
  }

  // Log status counts request
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Book parking status counts requested',
  //   customMetadata: {
  //     userType: req.user.userType,
  //     ipAddress: req.ip,
  //   },
  // });

  const counts = await bookParkingService.getBookParkingStatusCounts(req.user);

  // Log successful status counts retrieval
  // await createParkingBookingLog({
  //   user: req.user,
  //   event: 'Book parking status counts retrieved successfully',
  //   customMetadata: {
  //     counts,
  //     ipAddress: req.ip,
  //   },
  // });

  res.send({
    message: 'Book parking status counts retrieved successfully',
    data: counts,
    code: 200,
  });
});
