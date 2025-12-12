import { BookTripDTO, CreateTripDTO, SearchTripsQuery, TripStatus, UpdateTripDTO } from './trip.interfaces';

import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';
import { Request, Response } from 'express';
import { tripService } from './index';

/**
 * Create trip
 */
const createTrip = catchAsync(async (req: Request, res: Response) => {
  const driverId = req.user._id.toString();
  const tripData = req.body as CreateTripDTO;
  const trip = await tripService.createTrip(driverId, tripData);
  res.status(httpStatus.CREATED).send(trip);
});

/**
 * Get trip by ID (public access)
 */
const getTrip = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  const trip = await tripService.getTripById(tripId);
  if (!trip) {
    res.status(httpStatus.NOT_FOUND).send({ message: 'Trip not found' });
    return;
  }
  // Only show scheduled and active trips to non-authenticated users
  if (!req.user && trip.status !== 'scheduled' && trip.status !== 'active') {
    res.status(httpStatus.FORBIDDEN).send({ message: 'Trip not available' });
    return;
  }
  res.send(trip);
});

/**
 * Update trip
 */
const updateTrip = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  const trip = await tripService.updateTrip(
    tripId,
    req.user._id.toString(),
    req.body as UpdateTripDTO
  );
  res.send(trip);
});

/**
 * Delete trip
 */
const deleteTrip = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  await tripService.deleteTrip(tripId, req.user._id.toString());
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Book trip
 */
const bookTrip = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  const trip = await tripService.bookTrip(
    tripId,
    req.user._id.toString(),
    req.body as BookTripDTO
  );
  res.status(httpStatus.CREATED).send(trip);
});

/**
 * Cancel booking
 */
const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  const trip = await tripService.cancelBooking(
    tripId,
    req.user._id.toString(),
    req.body.reason
  );
  res.send(trip);
});

/**
 * Search trips
 * Returns all scheduled and active trips visible to all users (public access)
 */
const searchTrips = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as SearchTripsQuery;
  
  // Convert query parameters to proper types
  // Handle status array - can be single value or array
  let statusArray: TripStatus[] | undefined;
  if (query.status) {
    if (Array.isArray(query.status)) {
      statusArray = query.status as TripStatus[];
    } else {
      statusArray = [query.status as TripStatus];
    }
  }
  
  // Build origin object if coordinates provided
  let originObj: { latitude: number; longitude: number; radius?: number } | undefined;
  if (query.originLatitude && query.originLongitude) {
    originObj = {
      latitude: Number(query.originLatitude),
      longitude: Number(query.originLongitude),
    };
    if (query.originRadius) {
      originObj.radius = Number(query.originRadius);
    }
  }

  // Build destination object if coordinates provided
  let destinationObj: { latitude: number; longitude: number; radius?: number } | undefined;
  if (query.destinationLatitude && query.destinationLongitude) {
    destinationObj = {
      latitude: Number(query.destinationLatitude),
      longitude: Number(query.destinationLongitude),
    };
    if (query.destinationRadius) {
      destinationObj.radius = Number(query.destinationRadius);
    }
  }

  // Handle boolean query parameters
  let smokingAllowed: boolean | undefined;
  if (query.smokingAllowed !== undefined) {
    if (typeof query.smokingAllowed === 'string') {
      smokingAllowed = query.smokingAllowed === 'true';
    } else {
      smokingAllowed = Boolean(query.smokingAllowed);
    }
  }

  let petsAllowed: boolean | undefined;
  if (query.petsAllowed !== undefined) {
    if (typeof query.petsAllowed === 'string') {
      petsAllowed = query.petsAllowed === 'true';
    } else {
      petsAllowed = Boolean(query.petsAllowed);
    }
  }

  const searchQuery: any = {};
  
  if (statusArray) {
    searchQuery.status = statusArray;
  }
  if (originObj) {
    searchQuery.origin = originObj;
  }
  if (destinationObj) {
    searchQuery.destination = destinationObj;
  }
  
  if (query.departureDate) {
    searchQuery.departureDate = new Date(query.departureDate as unknown as string);
  }
  if (query.departureDateFrom) {
    searchQuery.departureDateFrom = new Date(query.departureDateFrom as unknown as string);
  }
  if (query.departureDateTo) {
    searchQuery.departureDateTo = new Date(query.departureDateTo as unknown as string);
  }
  if (query.maxPrice !== undefined) {
    searchQuery.maxPrice = Number(query.maxPrice);
  }
  if (query.minSeats !== undefined) {
    searchQuery.minSeats = Number(query.minSeats);
  }
  if (smokingAllowed !== undefined) {
    searchQuery.smokingAllowed = smokingAllowed;
  }
  if (petsAllowed !== undefined) {
    searchQuery.petsAllowed = petsAllowed;
  }
  if (query.genderPreference) {
    searchQuery.genderPreference = query.genderPreference;
  }
  if (query.driverId) {
    searchQuery.driverId = query.driverId;
  }
  if (query.page !== undefined) {
    searchQuery.page = Number(query.page);
  }
  if (query.limit !== undefined) {
    searchQuery.limit = Number(query.limit);
  }
  if (query.sortBy) {
    searchQuery.sortBy = query.sortBy;
  }
  if (query.sortOrder) {
    searchQuery.sortOrder = query.sortOrder;
  }
  
  const trips = await tripService.searchTrips(searchQuery);
  res.send(trips);
});

/**
 * Get trips by driver
 */
const getMyTrips = catchAsync(async (req: Request, res: Response) => {
  const trips = await tripService.getTripsByDriver(req.user._id.toString());
  res.send(trips);
});

/**
 * Get trips where user is a passenger
 */
const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const trips = await tripService.getTripsByPassenger(req.user._id.toString());
  res.send(trips);
});

/**
 * Complete trip
 */
const completeTrip = catchAsync(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'];
  if (!tripId) {
    res.status(httpStatus.BAD_REQUEST).send({ message: 'Trip ID is required' });
    return;
  }
  const trip = await tripService.completeTrip(
    tripId,
    req.user._id.toString()
  );
  res.send(trip);
});

export default {
  createTrip,
  getTrip,
  updateTrip,
  deleteTrip,
  bookTrip,
  cancelBooking,
  searchTrips,
  getMyTrips,
  getMyBookings,
  completeTrip,
};
