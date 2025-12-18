import Joi from 'joi';

const locationSchema = Joi.object({
  address: Joi.string().required(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  zipCode: Joi.string().optional(),
  country: Joi.string().optional(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
});

const createTrip = {
  body: Joi.object().keys({
    origin: locationSchema.required(),
    destination: locationSchema.required(),
    waypoints: Joi.array().items(locationSchema).optional(),
    departureDate: Joi.date().required(),
    departureTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    estimatedDuration: Joi.number().min(1).optional(),
    totalSeats: Joi.number().min(2).max(8).required(),
    pricePerSeat: Joi.number().min(0).required(),
    currency: Joi.string().default('USD'),
    smokingAllowed: Joi.boolean().default(false),
    petsAllowed: Joi.boolean().default(false),
    musicAllowed: Joi.boolean().default(true),
    chatPreference: Joi.string().valid('quiet', 'friendly', 'any').default('any'),
    genderPreference: Joi.string().valid('male', 'female', 'any').default('any'),
    isRecurring: Joi.boolean().default(false),
    recurringPattern: Joi.object({
      frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
      daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).optional(),
      endDate: Joi.date().optional(),
    }).optional(),
    description: Joi.string().max(1000).optional(),
    luggageSpace: Joi.boolean().default(false),
    maxLuggage: Joi.number().min(0).optional(),
    routeDistance: Joi.number().optional(),
    routePolyline: Joi.string().optional(),
    vehicleId: Joi.string().optional(),
  }),
};

const updateTrip = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      origin: locationSchema.optional(),
      destination: locationSchema.optional(),
      waypoints: Joi.array().items(locationSchema).optional(),
      departureDate: Joi.date().optional(),
      departureTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      estimatedDuration: Joi.number().min(1).optional(),
      totalSeats: Joi.number().min(2).max(8).optional(),
      pricePerSeat: Joi.number().min(0).optional(),
      smokingAllowed: Joi.boolean().optional(),
      petsAllowed: Joi.boolean().optional(),
      musicAllowed: Joi.boolean().optional(),
      chatPreference: Joi.string().valid('quiet', 'friendly', 'any').optional(),
      genderPreference: Joi.string().valid('male', 'female', 'any').optional(),
      description: Joi.string().max(1000).optional(),
      luggageSpace: Joi.boolean().optional(),
      maxLuggage: Joi.number().min(0).optional(),
      status: Joi.string().valid('scheduled', 'active', 'completed', 'cancelled', 'full').optional(),
    })
    .min(1),
};

const bookTrip = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    seats: Joi.number().min(1).required(),
    pickupLocation: locationSchema.optional(),
    dropoffLocation: locationSchema.optional(),
    pickupNote: Joi.string().optional(),
  }),
};

const cancelBooking = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    reason: Joi.string().max(500).optional(),
  }),
};

const getTrip = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
};

const deleteTrip = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
};

const searchTrips = {
  query: Joi.object().keys({
    originLatitude: Joi.number().optional(),
    originLongitude: Joi.number().optional(),
    originRadius: Joi.number().optional(),
    destinationLatitude: Joi.number().optional(),
    destinationLongitude: Joi.number().optional(),
    destinationRadius: Joi.number().optional(),
    departureDate: Joi.date().optional(),
    departureDateFrom: Joi.date().optional(),
    departureDateTo: Joi.date().optional(),
    maxPrice: Joi.number().min(0).optional(),
    minSeats: Joi.number().min(1).optional(),
    smokingAllowed: Joi.boolean().optional(),
    petsAllowed: Joi.boolean().optional(),
    genderPreference: Joi.string().valid('male', 'female', 'any').optional(),
    status: Joi.alternatives().try(
      Joi.string().valid('scheduled', 'active', 'completed', 'cancelled', 'full'),
      Joi.array().items(Joi.string().valid('scheduled', 'active', 'completed', 'cancelled', 'full'))
    ).optional(),
    driverId: Joi.string().optional(),
    page: Joi.number().min(1).optional(),
    limit: Joi.number().min(1).max(100).optional(),
    sortBy: Joi.string().valid('departureDate', 'pricePerSeat', 'createdAt').optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
  }),
};

const completeTrip = {
  params: Joi.object().keys({
    tripId: Joi.string().required(),
  }),
};

export default {
  createTrip,
  updateTrip,
  bookTrip,
  cancelBooking,
  getTrip,
  deleteTrip,
  searchTrips,
  completeTrip,
};
