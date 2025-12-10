import * as apartmentComplexService from '../apartmentComplex/apartmentComplex.service';

import { IBookParking, IBookParkingDoc, NewCreatedBookParking } from './book-parking.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import {
  sendBookingCompletionAndExtensionEmailToParkingProvider,
  sendBookingCompletionAndExtensionEmailToRenter,
  sendBookingCompletionEmailToParkingProvider,
  sendBookingCompletionEmailToRenter,
  sendBookingConfirmationEmailToPSP,
  sendBookingConfirmationEmailToRenter,
  sendBookingEndingEmailToRenter,
  sendBookingExtensionEmailToPSP,
  sendBookingExtensionEmailToRenter,
} from '../email/email.service';

import { ApiError } from '../errors';
import BookParking from './book-parking.model';
import { IUserDoc } from '../user/user.interfaces';
import { getPulse } from '../../lib/pulse';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { userService } from '../user';

/**
 * Create a user
 * @param {NewCreatedBookParking} bookParkingBody
 * @returns {Promise<IBookParkingDoc>}
 */
export const createBookParking = async (
  bookParkingToCreate: NewCreatedBookParking,
  loggedInUser: IUserDoc
): Promise<IBookParkingDoc> => {
  const paidPSP = await userService.getUserById(bookParkingToCreate.parkingProviderId);
  if (!paidPSP) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The parking provider does not exist');
  }
  const startTime = new Date();
  const parkingEndTime = new Date(
    startTime.getTime() + (bookParkingToCreate.parkingTime || 1) * 60 * 60 * 1000
  ).toISOString();

  const payableCharges = bookParkingToCreate.parkingTime * (paidPSP?.parkingDetails?.charges || 0);
  const bookParkingBody: IBookParking = {
    ...bookParkingToCreate,
    bookedById: loggedInUser.id,
    status: 'ONGOING',
    parkingStartTime: new Date().toISOString(),
    parkingEndTime: parkingEndTime,
    payableCharges: payableCharges,
    ...(paidPSP.parkingDetails && { parkingDetails: paidPSP.parkingDetails }),
  };

  //replace parkingEndTimeForScheduling with parkingEndTime
  const reminderTime = new Date(new Date(parkingEndTime).getTime() - 15 * 60 * 1000);

  const bookParking = await BookParking.create({
    ...bookParkingBody,
  });
  const reminderCompleteTime = new Date(new Date(parkingEndTime).getTime() + 0.05 * 60 * 1000);

  const pulse = getPulse();
  (async () => {
    await pulse.start(); // start processing jobs
    await pulse.schedule(reminderTime, 'send booking reminder', {
      bookingId: bookParking._id.toString(),
    });
    await pulse.schedule(reminderCompleteTime, 'complete booking', {
      bookingId: bookParking._id.toString(),
    });
  })();

  sendBookingConfirmationEmailToPSP(
    paidPSP?.fullName!,
    bookParking.licensePlate,
    bookParking.parkingStartTime,
    bookParking.parkingEndTime!,
    bookParking._id,
    paidPSP?.email!,
    paidPSP
  );

  sendBookingConfirmationEmailToRenter(
    loggedInUser.fullName!,
    bookParking.licensePlate,
    bookParking.parkingStartTime,
    bookParking.parkingEndTime!,
    bookParking._id,
    loggedInUser?.email!,
    loggedInUser
  );

  return bookParking;
};

/**
 * Update a booking (extend time)
 * @param {string} bookingId
 * @param {number} extendHours
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<IBookParkingDoc>}
 */
export const updateBookParking = async (
  bookingId: string,
  extendHours: number,
  loggedInUser: IUserDoc
): Promise<IBookParkingDoc> => {
  const booking = await BookParking.findById(bookingId);
  if (!booking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.bookedById.toString() !== loggedInUser.id.toString()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized to update this booking');
  }

  const paidPSP = await userService.getUserById(booking.parkingProviderId);
  if (!paidPSP) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The parking provider does not exist');
  }

  // calculate new end time
  const newEndTime = new Date(
    new Date(booking.parkingStartTime).getTime() + (booking.parkingTime + extendHours) * 60 * 60 * 1000
  );

  // update charges
  const additionalCharges = (booking.parkingTime + extendHours) * (paidPSP?.parkingDetails?.charges || 0);
  const updatedCharges = (booking.payableCharges || 0) + additionalCharges;

  booking.parkingEndTime = newEndTime.toISOString();
  booking.parkingTime += extendHours;
  booking.payableCharges = updatedCharges;
  booking.status = 'ONGOING'; // keep ongoing since extended

  await booking.save();

  // === Update Pulse scheduler ===
  const pulse = getPulse();
  const reminderTime = new Date(newEndTime.getTime() - 15 * 60 * 1000);
  const reminderCompleteTime = new Date(newEndTime.getTime() + 0.05 * 60 * 1000);

  (async () => {
    await pulse.start();
    await pulse.schedule(reminderTime, 'send booking reminder', {
      bookingId: booking._id.toString(),
    });
    await pulse.schedule(reminderCompleteTime, 'complete booking', {
      bookingId: booking._id.toString(),
    });
  })();

  // send update confirmation emails
  sendBookingExtensionEmailToPSP(
    paidPSP?.fullName!,
    booking.licensePlate,
    booking.parkingEndTime!,
    extendHours,
    booking._id,
    paidPSP?.email!,
    paidPSP
  );

  sendBookingExtensionEmailToRenter(
    loggedInUser.fullName!,
    booking.licensePlate,
    booking.parkingEndTime!,
    extendHours,
    booking._id,
    loggedInUser?.email!,
    loggedInUser
  );

  return booking;
};

/**
 * Extend a booking (create a new booking instead of updating existing one)
 * @param {string} bookingId
 * @param {number} extendHours
 * @param {IUserDoc} loggedInUser
 * @returns {Promise<IBookParkingDoc>}
 */
export const extendBookParking = async (
  bookingId: string,
  extendHours: number,
  loggedInUser: IUserDoc
): Promise<IBookParkingDoc> => {
  const booking = await BookParking.findById(bookingId);
  if (!booking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.bookedById.toString() !== loggedInUser.id.toString()) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized to extend this booking');
  }

  const paidPSP = await userService.getUserById(booking.parkingProviderId);
  if (!paidPSP) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The parking provider does not exist');
  }

  // new booking start = previous booking end
  const newStartTime = new Date(booking.parkingEndTime!);

  // new booking end = new start + extendHours
  const newEndTime = new Date(newStartTime.getTime() + extendHours * 60 * 60 * 1000);

  // charges for the extension
  const additionalCharges = extendHours * (paidPSP?.parkingDetails?.charges || 0);

  // create new booking
  const newBooking = await BookParking.create({
    parkingProviderId: booking.parkingProviderId,
    bookedById: booking.bookedById,
    parkingStartTime: newStartTime.toISOString(),
    parkingEndTime: newEndTime.toISOString(),
    licensePlate: booking.licensePlate,
    parkingTime: extendHours,
    payableCharges: additionalCharges,
    parkingDetails: booking.parkingDetails,
    isOcrScanner: booking.isOcrScanner,
    previousBookingIds: [...(booking.previousBookingIds || []), booking._id],
    status: 'ONGOING',
  });

  // update linkage
  booking.nextBookingId = newBooking._id;
  await booking.save();

  // === Update Pulse scheduler ===
  await scheduleBookingNotifications(newBooking);

  // send emails for extension as "new booking created"
  sendBookingExtensionEmailToPSP(
    paidPSP?.fullName!,
    newBooking.licensePlate,
    newBooking.parkingEndTime!,
    extendHours,
    newBooking._id,
    paidPSP?.email!,
    paidPSP
  );

  sendBookingExtensionEmailToRenter(
    loggedInUser.fullName!,
    newBooking.licensePlate,
    newBooking.parkingEndTime!,
    extendHours,
    newBooking._id,
    loggedInUser?.email!,
    loggedInUser
  );

  return newBooking;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryBookParkings = async (
  filter: Record<string, any>,
  options: IOptions,
  loggedInUser: IUserDoc
): Promise<QueryResult> => {
  const bookParkings = await BookParking.paginate(
    { ...filter, isDeleted: { $ne: true } },
    {
      ...options,
    }
  );
  if (loggedInUser.userType === 'parking-spaces-provider-owner' && loggedInUser.isPaidParkingSpaceProvider) {
    const myBookings = bookParkings.results.filter(
      (res) => res.toObject().bookedById.id.toString() === loggedInUser.id.toString()
    );
    const bookings = bookParkings.results.filter(
      (res) => res.toObject().parkingProviderId.id.toString() === loggedInUser.id.toString()
    );
    return {
      ...bookParkings,
      myBookings,
      bookings,
      // results: [...myBookings, ...bookings],
    } as any;
  }

  return {
    ...bookParkings,
  };
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<IBookParkingDoc>}
 */
export const getBookParkingById = async (id: mongoose.Types.ObjectId): Promise<IBookParkingDoc> => {
  const user = await BookParking.findById(new mongoose.Types.ObjectId(id));
  if (!user) {
    throw new ApiError(
      httpStatus.NO_CONTENT,
      'The user you are trying to approve/reject is not found. An action may have been performed by other admin related to approval or rejection.'
    );
  }

  return user;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<IBookParkingDoc>}
 */
export const getBookParkingEmail = async (email: string): Promise<IBookParkingDoc | null> => {
  const user = await BookParking.findOne({ email });

  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} id
 * @returns {Promise<void>}
 */
export const deleteBookParkingById = async (id: mongoose.Types.ObjectId): Promise<void> => {
  await BookParking.findByIdAndDelete(id);
};

export const getBookParkingStatusCounts = async (loggedInUser: IUserDoc) => {
  const filter: any = {};
  
  // Admin can see all bookings
  if (loggedInUser.userType === 'admin') {
    // No filter - get all bookings
  }
  // Parking space provider owner can see bookings for their spaces
  else if (loggedInUser.userType === 'parking-spaces-provider-owner') {
    filter.parkingProviderId = loggedInUser.id;
  }
  // Parking space provider manager can see bookings for their company's spaces
  else if (loggedInUser.userType === 'parking-spaces-provider-manager') {
    filter.parkingProviderId = loggedInUser.towCompanyId;
  }
  // Parking space provider employee can see bookings for their company's spaces
  else if (loggedInUser.userType === 'parking-spaces-provider-employee') {
    filter.parkingProviderId = loggedInUser.towCompanyId;
  }
  // Apartment complex owner can see bookings for their complex
  else if (loggedInUser.userType === 'apartment-complex-owner') {
    // Get apartment complexes owned by this user
    const apartmentComplexes = await apartmentComplexService.getMyApartmentComplexes(loggedInUser.id);
    if (apartmentComplexes.length > 0) {
      // This would need to be implemented based on how parking is linked to apartment complexes
      // For now, we'll use a placeholder - this might need to be adjusted based on your data model
      filter.apartmentComplex = { $in: apartmentComplexes.map(ac => ac._id) };
    }
  }
  // Apartment complex manager can see bookings for their complex
  else if (loggedInUser.userType === 'apartment-complex-manager') {
    filter.apartmentComplex = loggedInUser.apartmentComplex;
  }
  // Apartment complex employee can see bookings for their complex
  else if (loggedInUser.userType === 'apartment-complex-employee') {
    filter.apartmentComplex = loggedInUser.apartmentComplex;
  }
  // Renter can see their own bookings
  else if (loggedInUser.userType === 'renter') {
    filter.bookedById = loggedInUser.id;
  }
  // Tow company roles don't typically manage parking bookings directly
  // but if they do, we can add logic here

  const result = await BookParking.aggregate([
    {
      $match: filter,
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1,
      },
    },
  ]);

  const allStatuses: IBookParking['status'][] = ['ONGOING', 'COMPLETED'];

  const counts = allStatuses.reduce((acc, status) => {
    const found = result.find((r) => r.status === status);
    return { ...acc, [status]: found ? found.count : 0 };
  }, {});

  const total = result.reduce((sum, { count }) => sum + count, 0);

  return { ...counts, total };
};

/**
 * Create a user
 * @param {NewCreatedBookParking} bookParkingBody
 * @returns {Promise<IBookParkingDoc>}
 */
export const parkingReminderNotification = async (parkingId: string) => {
  const booking = await BookParking.findById(new mongoose.Types.ObjectId(parkingId));
  const paidPSP = await userService.getUserById(booking?.parkingProviderId);
  const renter = await userService.getUserById(booking?.bookedById);
  if (!paidPSP) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'The parking provider does not exist');
  }

  await sendBookingEndingEmailToRenter(
    renter?.fullName!,
    booking?.licensePlate!,
    booking?.parkingStartTime!,
    booking?.parkingEndTime!,
    booking?.id!,
    renter?.email!,
    renter,
    paidPSP
  );
  return booking;
};

export const parkingCompletionNotification = async (parkingId: string) => {
  const booking = await BookParking.findById(new mongoose.Types.ObjectId(parkingId));
  if (!booking) throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');

  const parkingEnd = new Date(booking.parkingEndTime!).getTime();
  const now = Date.now();
  const diffMinutes = Math.abs((parkingEnd - now) / (1000 * 60));

  if (diffMinutes > 5) {
    return null; // not time yet
  }

  const paidPSP = await userService.getUserById(booking.parkingProviderId);
  const renter = await userService.getUserById(booking.bookedById);
  if (!paidPSP || !renter) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Provider or renter not found');
  }

  console.log('Booking next id check-me', booking.nextBookingId);
  // ✅ If this booking has an extension (nextBookingId)
  if (booking.nextBookingId) {
    const nextBooking = await BookParking.findById(booking.nextBookingId);
    console.dir(nextBooking, { depth: null });
    console.log('Booking next check-me', booking.nextBookingId);

    if (nextBooking) {
      await sendBookingCompletionAndExtensionEmailToRenter(
        renter.fullName!,
        booking.licensePlate!,
        booking.parkingStartTime!,
        booking.parkingEndTime!,
        nextBooking,
        nextBooking.id,
        renter.email!,
        renter
      );

      await sendBookingCompletionAndExtensionEmailToParkingProvider(
        paidPSP.fullName!,
        booking.licensePlate!,
        booking.parkingStartTime!,
        booking.parkingEndTime!,
        nextBooking,
        nextBooking.id,
        paidPSP.email!,
        paidPSP,
        renter
      );

      // also mark current booking as completed
      await BookParking.updateOne(
        { _id: booking._id },
        { status: 'COMPLETED', parkingCompletedAt: new Date().toISOString() }
      );

      return booking;
    }
  }

  // ✅ Normal completion (no extension)
  await sendBookingCompletionEmailToRenter(
    renter.fullName!,
    booking.licensePlate!,
    booking.parkingStartTime!,
    booking.parkingEndTime!,
    booking.id!,
    renter.email!,
    renter
  );

  await sendBookingCompletionEmailToParkingProvider(
    paidPSP.fullName!,
    booking.licensePlate!,
    booking.parkingStartTime!,
    booking.parkingEndTime!,
    booking.id!,
    paidPSP.email!,
    paidPSP,
    renter
  );

  await BookParking.updateOne({ _id: booking._id }, { status: 'COMPLETED', parkingCompletedAt: new Date().toISOString() });

  return booking;
};

/**
 * Schedule reminder + completion for a booking
 */
export const scheduleBookingNotifications = async (booking: IBookParkingDoc) => {
  const pulse = getPulse();
  const parkingEnd = new Date(booking.parkingEndTime!).getTime();

  const reminderTime = new Date(parkingEnd - 15 * 60 * 1000);
  const completionTime = new Date(parkingEnd + 0.05 * 60 * 1000); // slight buffer

  await pulse.start();
  await pulse.schedule(reminderTime, 'send booking reminder', { bookingId: booking._id.toString() });
  await pulse.schedule(completionTime, 'complete booking', { bookingId: booking._id.toString() });
};
