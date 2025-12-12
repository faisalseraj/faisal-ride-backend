import { ITripDoc, ITripModel } from './trip.interfaces';
import mongoose from 'mongoose';

import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

/**
 * Location Schema (embedded)
 */
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String, default: 'USA' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

/**
 * Passenger Schema (embedded)
 */
const passengerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    seats: { type: Number, required: true, min: 1 },
    pricePerSeat: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    bookedAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    pickupLocation: { type: locationSchema },
    dropoffLocation: { type: locationSchema },
  },
  { _id: true, timestamps: false }
);

/**
 * Recurring Pattern Schema (embedded)
 */
const recurringPatternSchema = new mongoose.Schema(
  {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    daysOfWeek: { type: [Number], min: 0, max: 6 }, // 0-6 (Sunday-Saturday)
    endDate: { type: Date },
  },
  { _id: false }
);

/**
 * Passenger Rating Schema (embedded)
 */
const passengerRatingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, maxlength: 500 },
  },
  { _id: false }
);

/**
 * Trip Schema
 */
const tripSchema = new mongoose.Schema<ITripDoc, ITripModel>(
  {
    // Driver/Creator
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    } as any,

    // Trip Details
    origin: { type: locationSchema, required: true },
    destination: { type: locationSchema, required: true },
    waypoints: { type: [locationSchema], default: [] },

    // Schedule
    departureDate: { type: Date, required: true, index: true },
    departureTime: { type: String, required: true }, // HH:mm format
    estimatedDuration: { type: Number }, // minutes
    estimatedArrival: { type: Date },

    // Capacity & Pricing
    totalSeats: { type: Number, required: true, min: 2, max: 8 },
    availableSeats: { type: Number, required: true, min: 0 },
    pricePerSeat: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },

    // Passengers
    passengers: { type: [passengerSchema], default: [] },

    // Trip Preferences
    smokingAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    musicAllowed: { type: Boolean, default: true },
    chatPreference: {
      type: String,
      enum: ['quiet', 'friendly', 'any'],
      default: 'any',
    },
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'any'],
      default: 'any',
    },

    // Status & Metadata
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled', 'full'],
      default: 'scheduled',
      index: true,
    },
    isRecurring: { type: Boolean, default: false },
    recurringPattern: { type: recurringPatternSchema },

    // Vehicle Information
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to driver's vehicle

    // Route Information
    routeDistance: { type: Number }, // kilometers
    routePolyline: { type: String }, // Encoded polyline

    // Additional Info
    description: { type: String, maxlength: 1000 },
    luggageSpace: { type: Boolean, default: false },
    maxLuggage: { type: Number, min: 0 },

    // Cancellation
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Completion
    completedAt: { type: Date },
    actualDepartureTime: { type: Date },
    actualArrivalTime: { type: Date },

    // Ratings & Reviews
    driverRating: { type: Number, min: 0, max: 5 },
    passengerRatings: { type: [passengerRatingSchema], default: [] },

    // Safety & Verification
    isVerified: { type: Boolean, default: false },
    safetyScore: { type: Number, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
tripSchema.index({ driverId: 1, departureDate: 1 });
tripSchema.index({ status: 1, departureDate: 1 });
tripSchema.index({ 'origin.latitude': 1, 'origin.longitude': 1 });
tripSchema.index({ 'destination.latitude': 1, 'destination.longitude': 1 });
tripSchema.index({ 'passengers.userId': 1 });

// Plugins
tripSchema.plugin(toJSON);
tripSchema.plugin(paginate);

/**
 * Pre-save hook to update available seats
 */
tripSchema.pre('save', function (next) {
  const doc = this as unknown as ITripDoc;
  if (doc.isModified('passengers') || doc.isNew) {
    const confirmedPassengers = (doc.passengers || []).filter(
      (p: any) => p.status === 'confirmed'
    );
    const bookedSeats = confirmedPassengers.reduce(
      (sum: number, p: any) => sum + p.seats,
      0
    );
    doc.availableSeats = Math.max(0, doc.totalSeats - bookedSeats - 1); // -1 for driver

    // Update status based on available seats
    if (doc.availableSeats === 0 && doc.status === 'scheduled') {
      doc.status = 'full';
    } else if (doc.availableSeats > 0 && doc.status === 'full') {
      doc.status = 'scheduled';
    }
  }

  // Calculate estimated arrival if not set
  if (doc.departureDate && doc.estimatedDuration && !doc.estimatedArrival) {
    doc.estimatedArrival = new Date(
      doc.departureDate.getTime() + doc.estimatedDuration * 60000
    );
  }

  next();
});

const Trip = mongoose.model<ITripDoc, ITripModel>('Trip', tripSchema);

export default Trip;
