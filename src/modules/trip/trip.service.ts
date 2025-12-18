import { BookTripDTO, CreateTripDTO, ITripDoc, SearchTripsQuery, UpdateTripDTO } from './trip.interfaces';
import { RankingSearchParams, getRecommendedTrips } from './trip.ranking.service';
import { emitBookingCreated, emitBookingUpdated, emitTripCreated, emitTripUpdated } from './trip.socket.service';

import { ApiError } from '../errors';
import Trip from './trip.model';
import httpStatus from 'http-status';
import { invalidateUserHistoryCache } from './trip.ranking.cache';
import mongoose from 'mongoose';

/**
 * Create a new trip
 */
export const createTrip = async (driverId: string, tripData: CreateTripDTO): Promise<ITripDoc> => {
  // Set available seats initially
  const availableSeats = tripData.totalSeats - 1; // -1 for driver

  const trip = await Trip.create({
    ...tripData,
    driverId,
    availableSeats,
    status: 'scheduled',
  });

  // Emit socket event for trip creation
  console.log('🚗 [TRIP SERVICE] Trip created, emitting socket event:', trip._id.toString());
  await emitTripCreated(trip._id.toString(), driverId);

  return trip;
};

/**
 * Get trip by ID
 */
export const getTripById = async (id: string): Promise<ITripDoc | null> => {
  try {
    return Trip.findById(id)
      .populate('driverId', 'firstName lastName email image avgRating totalRides')
      .populate('passengers.userId', 'firstName lastName email image')
      .populate('cancelledBy', 'firstName lastName');
  } catch (error) {
    console.error('❌ [TRIP SERVICE] Error getting trip by ID:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error getting trip by ID');
  }
};

/**
 * Update trip
 */
export const updateTrip = async (tripId: string, userId: string, updateData: UpdateTripDTO): Promise<ITripDoc | null> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  // Only driver can update their trip
  if (trip.driverId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only trip driver can update this trip');
  }

  // Don't allow updates if trip is completed or cancelled
  if (trip.status === 'completed' || trip.status === 'cancelled') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update completed or cancelled trip');
  }

  Object.assign(trip, updateData);
  await trip.save();

  // Emit socket event for trip update
  console.log('🔄 [TRIP SERVICE] Trip updated, emitting socket event:', tripId);
  await emitTripUpdated(tripId, userId, updateData);

  return trip;
};

/**
 * Delete trip (soft delete by cancelling)
 */
export const deleteTrip = async (tripId: string, userId: string): Promise<void> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  // Only driver can delete their trip
  if (trip.driverId.toString() !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only trip driver can delete this trip');
  }

  trip.status = 'cancelled';
  trip.cancelledAt = new Date();
  trip.cancelledBy = userId as any;
  await trip.save();

  // Emit socket event for trip cancellation (deletion)
  console.log('🚫 [TRIP SERVICE] Trip deleted (cancelled), emitting socket event:', tripId);
  await emitTripUpdated(tripId, userId, { status: 'cancelled', deleted: true });
};

/**
 * Book a trip (add passenger)
 */
export const bookTrip = async (tripId: string, userId: string, bookingData: BookTripDTO): Promise<ITripDoc> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  // Check if user is the driver
  if (trip.driverId.toString() === userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Driver cannot book their own trip');
  }

  // Check if trip is available
  if (trip.status !== 'scheduled' && trip.status !== 'full') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Trip is not available for booking');
  }

  // Check available seats
  if (trip.availableSeats < bookingData.seats) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Not enough seats available');
  }

  // Check if user already has an active booking (not cancelled)
  const existingActiveBooking = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === userId && p.status !== 'cancelled'
  );
  if (existingActiveBooking) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You have already booked this trip');
  }

  // Check if user has a cancelled booking - if so, reactivate it instead of creating new entry
  const cancelledBooking = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === userId && p.status === 'cancelled'
  );

  const totalPrice = bookingData.seats * trip.pricePerSeat;
  const requestedAt = new Date();

  if (cancelledBooking) {
    // Reactivate the cancelled booking by updating it to pending status
    cancelledBooking.status = 'pending';
    cancelledBooking.seats = bookingData.seats;
    cancelledBooking.pricePerSeat = trip.pricePerSeat;
    cancelledBooking.totalPrice = totalPrice;
    cancelledBooking.bookedAt = new Date();
    cancelledBooking.requestedAt = requestedAt;
    cancelledBooking.pickupLocation = bookingData.pickupLocation;
    cancelledBooking.dropoffLocation = bookingData.dropoffLocation;
    cancelledBooking.pickupNote = bookingData.pickupNote;
    // Clear cancellation-related fields
    cancelledBooking.cancelledAt = undefined;
    cancelledBooking.cancellationReason = undefined;
  } else {
    // Add new passenger with pending status (requires driver approval)
    (trip.passengers as any[]).push({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'pending',
      seats: bookingData.seats,
      pricePerSeat: trip.pricePerSeat,
      totalPrice,
      bookedAt: new Date(),
      requestedAt,
      pickupLocation: bookingData.pickupLocation,
      dropoffLocation: bookingData.dropoffLocation,
      pickupNote: bookingData.pickupNote,
    });
  }

  await trip.save();

  // Emit socket event for booking request (pending)
  console.log('🎫 [TRIP SERVICE] Booking request created (pending), emitting socket event:', { tripId, userId });
  await emitBookingCreated(tripId, userId, {
    seats: bookingData.seats,
    totalPrice,
    pickupLocation: bookingData.pickupLocation,
    dropoffLocation: bookingData.dropoffLocation,
    pickupNote: bookingData.pickupNote,
    status: 'pending',
    requestedAt,
  });

  return trip;
};

/**
 * Cancel booking
 */
export const cancelBooking = async (tripId: string, userId: string, reason?: string): Promise<ITripDoc> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  const passenger = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === userId && (p.status === 'confirmed' || p.status === 'pending')
  );

  if (!passenger) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  passenger.status = 'cancelled';
  passenger.cancelledAt = new Date();
  passenger.cancellationReason = reason;

  await trip.save();

  // Emit socket event for booking update (cancellation)
  console.log('🔄 [TRIP SERVICE] Booking cancelled, emitting socket event:', { tripId, userId });
  const driverId = trip.driverId.toString();
  await emitBookingUpdated(tripId, userId, driverId, {
    status: 'cancelled',
    reason,
  });

  return trip;
};

/**
 * Accept booking request
 */
export const acceptBooking = async (tripId: string, driverId: string, passengerId: string): Promise<ITripDoc> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  // Verify driver owns the trip
  if (trip.driverId.toString() !== driverId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only trip driver can accept bookings');
  }

  // Find pending booking
  const passenger = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === passengerId && p.status === 'pending'
  );

  if (!passenger) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Pending booking request not found');
  }

  // Check if there are still available seats
  const confirmedPassengers = (trip.passengers as any[]).filter(
    (p: any) => p.status === 'confirmed' && p._id.toString() !== passenger._id.toString()
  );
  const bookedSeats = confirmedPassengers.reduce((sum: number, p: any) => sum + p.seats, 0);
  const availableSeats = trip.totalSeats - bookedSeats - 1; // -1 for driver

  if (availableSeats < passenger.seats) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Not enough seats available');
  }

  // Accept the booking
  passenger.status = 'confirmed';
  passenger.respondedAt = new Date();

  await trip.save();

  // Emit socket event for booking acceptance
  console.log('✅ [TRIP SERVICE] Booking accepted, emitting socket event:', { tripId, passengerId, driverId });
  await emitBookingUpdated(tripId, passengerId, driverId, {
    status: 'confirmed',
    respondedAt: passenger.respondedAt,
  });

  return trip;
};

/**
 * Reject booking request
 */
export const rejectBooking = async (
  tripId: string,
  driverId: string,
  passengerId: string,
  reason?: string
): Promise<ITripDoc> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  // Verify driver owns the trip
  if (trip.driverId.toString() !== driverId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only trip driver can reject bookings');
  }

  // Find pending booking
  const passenger = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === passengerId && p.status === 'pending'
  );

  if (!passenger) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Pending booking request not found');
  }

  // Reject the booking
  passenger.status = 'rejected';
  passenger.respondedAt = new Date();
  passenger.rejectionReason = reason;

  await trip.save();

  // Emit socket event for booking rejection
  console.log('❌ [TRIP SERVICE] Booking rejected, emitting socket event:', { tripId, passengerId, driverId });
  await emitBookingUpdated(tripId, passengerId, driverId, {
    status: 'rejected',
    reason,
    respondedAt: passenger.respondedAt,
  });

  return trip;
};

/**
 * Auto-reject pending bookings older than 1 hour
 */
export const autoRejectExpiredBookings = async (): Promise<void> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const trips = await Trip.find({
    'passengers.status': 'pending',
    'passengers.requestedAt': { $lt: oneHourAgo },
  });

  let totalRejected = 0;

  for (const trip of trips) {
    const expiredPassengers = (trip.passengers as any[]).filter(
      (p: any) => p.status === 'pending' && p.requestedAt && new Date(p.requestedAt) < oneHourAgo
    );

    for (const passenger of expiredPassengers) {
      passenger.status = 'rejected';
      passenger.respondedAt = new Date();
      passenger.rejectionReason = 'Booking request expired (1 hour timeout)';

      // Emit socket event for auto-rejection
      const driverId = trip.driverId.toString();
      const passengerId = passenger.userId.toString();
      console.log('⏰ [TRIP SERVICE] Auto-rejecting expired booking:', { tripId: trip._id, passengerId });
      await emitBookingUpdated(trip._id.toString(), passengerId, driverId, {
        status: 'rejected',
        reason: 'Booking request expired (1 hour timeout)',
        respondedAt: passenger.respondedAt,
        autoRejected: true,
      });
    }

    if (expiredPassengers.length > 0) {
      totalRejected += expiredPassengers.length;
      await trip.save();
    }
  }

  console.log(`⏰ [TRIP SERVICE] Auto-rejected ${totalRejected} expired booking requests`);
};

/**
 * Search trips
 * If useRanking is true and userId is provided, uses ranking algorithm
 */
export const searchTrips = async (query: SearchTripsQuery): Promise<ITripDoc[] | any[]> => {
  // Use ranking algorithm if requested and userId is provided
  if (query.useRanking && query.userId && query.originLatitude && query.originLongitude) {
    const rankingParams: RankingSearchParams = {
      userId: query.userId,
      pickupLatitude: Number(query.originLatitude),
      pickupLongitude: Number(query.originLongitude),
      ...(query.originRadius && { pickupRadiusKm: Number(query.originRadius) }),
      ...(query.destinationLatitude && { dropoffLatitude: Number(query.destinationLatitude) }),
      ...(query.destinationLongitude && { dropoffLongitude: Number(query.destinationLongitude) }),
      ...(query.destinationRadius && { dropoffRadiusKm: Number(query.destinationRadius) }),
      ...(query.preferredDepartureTime && { preferredDepartureTime: query.preferredDepartureTime }),
      limit: query.limit || 20,
    };

    // Apply additional filters to ranking results
    const rankedTrips = await getRecommendedTrips(rankingParams);

    // Apply additional filters (price, seats, preferences)
    let filteredTrips = rankedTrips;

    if (query.maxPrice !== undefined) {
      filteredTrips = filteredTrips.filter((t) => t.pricePerSeat <= query.maxPrice!);
    }

    if (query.minSeats !== undefined) {
      filteredTrips = filteredTrips.filter((t) => t.availableSeats >= query.minSeats!);
    }

    if (query.smokingAllowed !== undefined) {
      filteredTrips = filteredTrips.filter((t) => t.smokingAllowed === query.smokingAllowed);
    }

    if (query.petsAllowed !== undefined) {
      filteredTrips = filteredTrips.filter((t) => t.petsAllowed === query.petsAllowed);
    }

    if (query.genderPreference) {
      filteredTrips = filteredTrips.filter(
        (t) => t.genderPreference === query.genderPreference || t.genderPreference === 'any'
      );
    }

    // Apply date filters
    if (query.departureDate) {
      const startOfDay = new Date(query.departureDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.departureDate);
      endOfDay.setHours(23, 59, 59, 999);
      filteredTrips = filteredTrips.filter((t) => t.departureDate >= startOfDay && t.departureDate <= endOfDay);
    } else if (query.departureDateFrom || query.departureDateTo) {
      if (query.departureDateFrom) {
        filteredTrips = filteredTrips.filter((t) => t.departureDate >= query.departureDateFrom!);
      }
      if (query.departureDateTo) {
        filteredTrips = filteredTrips.filter((t) => t.departureDate <= query.departureDateTo!);
      }
    }

    return filteredTrips;
  }

  // Standard search (non-ranking)
  const filter: any = {};

  // Status filter
  if (query.status && query.status.length > 0) {
    filter.status = { $in: query.status };
  } else {
    // Default: only show scheduled and active trips
    filter.status = { $in: ['scheduled', 'active'] };
  }

  // Date filters
  if (query.departureDate) {
    const startOfDay = new Date(query.departureDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(query.departureDate);
    endOfDay.setHours(23, 59, 59, 999);
    filter.departureDate = { $gte: startOfDay, $lte: endOfDay };
  } else if (query.departureDateFrom || query.departureDateTo) {
    filter.departureDate = {};
    if (query.departureDateFrom) {
      filter.departureDate.$gte = query.departureDateFrom;
    }
    if (query.departureDateTo) {
      filter.departureDate.$lte = query.departureDateTo;
    }
  } else {
    // Default: only future trips
    filter.departureDate = { $gte: new Date() };
  }

  // Price filter
  if (query.maxPrice !== undefined) {
    filter.pricePerSeat = { $lte: query.maxPrice };
  }

  // Seats filter
  if (query.minSeats !== undefined) {
    filter.availableSeats = { $gte: query.minSeats };
  }

  // Preferences
  if (query.smokingAllowed !== undefined) {
    filter.smokingAllowed = query.smokingAllowed;
  }
  if (query.petsAllowed !== undefined) {
    filter.petsAllowed = query.petsAllowed;
  }
  if (query.genderPreference) {
    filter.genderPreference = { $in: [query.genderPreference, 'any'] };
  }

  // Driver filter
  if (query.driverId) {
    filter.driverId = query.driverId;
  }

  // Location filters (simplified - would need geospatial query for production)
  if (query.origin) {
    // TODO: Implement proper geospatial query using MongoDB $geoNear or $geoWithin
    // For now, using simple latitude/longitude range
    const radius = query.origin.radius || 0.1; // Default 0.1 degrees (~11km)
    filter['origin.latitude'] = {
      $gte: query.origin.latitude - radius,
      $lte: query.origin.latitude + radius,
    };
    filter['origin.longitude'] = {
      $gte: query.origin.longitude - radius,
      $lte: query.origin.longitude + radius,
    };
  }

  if (query.destination) {
    const radius = query.destination.radius || 0.1; // Default 0.1 degrees (~11km)
    filter['destination.latitude'] = {
      $gte: query.destination.latitude - radius,
      $lte: query.destination.latitude + radius,
    };
    filter['destination.longitude'] = {
      $gte: query.destination.longitude - radius,
      $lte: query.destination.longitude + radius,
    };
  }

  // Sort
  const sort: any = {};
  if (query.sortBy) {
    sort[query.sortBy] = query.sortOrder === 'desc' ? -1 : 1;
  } else {
    sort.departureDate = 1; // Default: sort by departure date ascending
  }

  // Pagination
  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const trips = await Trip.find(filter)
    .populate('driverId', 'firstName lastName email image avgRating totalRides')
    .sort(sort)
    .skip(skip)
    .limit(limit);

  return trips;
};

/**
 * Get trips by driver
 */
export const getTripsByDriver = async (driverId: string): Promise<ITripDoc[]> => {
  return Trip.find({ driverId }).populate('passengers.userId', 'firstName lastName email image').sort({ departureDate: -1 });
};

/**
 * Get trips by passenger
 */
export const getTripsByPassenger = async (userId: string): Promise<ITripDoc[]> => {
  return Trip.find({ 'passengers.userId': userId })
    .populate('driverId', 'firstName lastName email image avgRating totalRides')
    .sort({ departureDate: -1 });
};

/**
 * Complete trip
 */
export const completeTrip = async (tripId: string, driverId: string): Promise<ITripDoc> => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  if (trip.driverId.toString() !== driverId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only trip driver can complete this trip');
  }

  trip.status = 'completed';
  trip.completedAt = new Date();
  trip.actualArrivalTime = new Date();

  // Update passenger statuses
  (trip.passengers as any[]).forEach((passenger: any) => {
    if (passenger.status === 'confirmed') {
      passenger.status = 'completed';
    }
  });

  await trip.save();

  // Invalidate ranking cache for affected users
  if (trip.passengers) {
    trip.passengers.forEach((passenger: any) => {
      const userId = passenger.userId?.toString();
      if (userId) {
        invalidateUserHistoryCache(userId as string);
      }
    });
  }
  const tripDriverId = trip.driverId?.toString();
  if (tripDriverId) {
    invalidateUserHistoryCache(tripDriverId);
  }

  // Emit socket event for trip completion
  console.log('✅ [TRIP SERVICE] Trip completed, emitting socket event:', tripId);
  await emitTripUpdated(tripId, driverId, { status: 'completed' });

  return trip;
};
