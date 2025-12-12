import { BookTripDTO, CreateTripDTO, ITripDoc, SearchTripsQuery, UpdateTripDTO } from './trip.interfaces';

import { ApiError } from '../errors';
import Trip from './trip.model';
import httpStatus from 'http-status';

/**
 * Create a new trip
 */
export const createTrip = async (driverId: string, tripData: CreateTripDTO): Promise<ITripDoc> => {
  // Set available seats initially
  const availableSeats = tripData.totalSeats - 1; // -1 for driver

  const trip = await (Trip as any).create({
    ...tripData,
    driverId,
    availableSeats,
    status: 'scheduled',
  });

  return trip;
};

/**
 * Get trip by ID
 */
export const getTripById = async (id: string): Promise<ITripDoc | null> => {
  return (Trip as any).findById(id)
    .populate('driverId', 'firstName lastName email image avgRating totalRides')
    .populate('passengers.userId', 'firstName lastName email image')
    .populate('cancelledBy', 'firstName lastName');
};

/**
 * Update trip
 */
export const updateTrip = async (
  tripId: string,
  userId: string,
  updateData: UpdateTripDTO
): Promise<ITripDoc | null> => {
  const trip = await (Trip as any).findById(tripId);
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
  return trip;
};

/**
 * Delete trip (soft delete by cancelling)
 */
export const deleteTrip = async (tripId: string, userId: string): Promise<void> => {
  const trip = await (Trip as any).findById(tripId);
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
};

/**
 * Book a trip (add passenger)
 */
export const bookTrip = async (
  tripId: string,
  userId: string,
  bookingData: BookTripDTO
): Promise<ITripDoc> => {
  const trip = await (Trip as any).findById(tripId);
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

  // Check if user already booked
  const existingBooking = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === userId && p.status !== 'cancelled'
  );
  if (existingBooking) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'You have already booked this trip');
  }

  // Add passenger
  const totalPrice = bookingData.seats * trip.pricePerSeat;
  (trip.passengers as any[]).push({
    userId: userId as any,
    status: 'confirmed',
    seats: bookingData.seats,
    pricePerSeat: trip.pricePerSeat,
    totalPrice,
    bookedAt: new Date(),
    pickupLocation: bookingData.pickupLocation,
    dropoffLocation: bookingData.dropoffLocation,
  });

  await trip.save();
  return trip;
};

/**
 * Cancel booking
 */
export const cancelBooking = async (
  tripId: string,
  userId: string,
  reason?: string
): Promise<ITripDoc> => {
  const trip = await (Trip as any).findById(tripId);
  if (!trip) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Trip not found');
  }

  const passenger = (trip.passengers as any[]).find(
    (p: any) => p.userId.toString() === userId && p.status === 'confirmed'
  );

  if (!passenger) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  passenger.status = 'cancelled';
  passenger.cancelledAt = new Date();
  passenger.cancellationReason = reason;

  await trip.save();
  return trip;
};

/**
 * Search trips
 */
export const searchTrips = async (query: SearchTripsQuery): Promise<ITripDoc[]> => {
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

  const trips = await (Trip as any).find(filter)
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
  return (Trip as any).find({ driverId })
    .populate('passengers.userId', 'firstName lastName email image')
    .sort({ departureDate: -1 });
};

/**
 * Get trips by passenger
 */
export const getTripsByPassenger = async (userId: string): Promise<ITripDoc[]> => {
  return (Trip as any).find({ 'passengers.userId': userId })
    .populate('driverId', 'firstName lastName email image avgRating totalRides')
    .sort({ departureDate: -1 });
};

/**
 * Complete trip
 */
export const completeTrip = async (tripId: string, driverId: string): Promise<ITripDoc> => {
  const trip = await (Trip as any).findById(tripId);
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
  return trip;
};
