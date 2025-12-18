import { Document, Model } from 'mongoose';

/**
 * Location interface for trip origin and destination
 */
export interface ILocation {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  coordinates?: [number, number]; // GeoJSON format: [longitude, latitude] for 2dsphere index
}

/**
 * Passenger booking information
 */
export interface IPassenger {
  userId: string; // Reference to User
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  seats: number; // Number of seats booked
  pricePerSeat: number; // Price paid per seat
  totalPrice: number; // Total price for this booking
  bookedAt: Date;
  requestedAt?: Date; // When booking was requested
  respondedAt?: Date; // When driver responded (accept/reject)
  cancelledAt?: Date;
  cancellationReason?: string;
  rejectionReason?: string; // Reason for rejection
  pickupLocation?: ILocation; // Custom pickup if different from origin
  dropoffLocation?: ILocation; // Custom dropoff if different from destination
  pickupNote?: string; // Note from passenger about pickup location
}

/**
 * Trip status enum
 */
export type TripStatus = 
  | 'scheduled'      // Trip is scheduled but not started
  | 'active'         // Trip is currently in progress
  | 'completed'      // Trip completed successfully
  | 'cancelled'      // Trip was cancelled
  | 'full';          // All seats are booked

/**
 * Trip interface for Faisal Ride carpooling
 */
export interface ITrip {
  // Driver/Creator
  driverId: string; // Reference to User (driver)
  
  // Trip Details
  origin: ILocation;
  destination: ILocation;
  waypoints?: ILocation[]; // Optional intermediate stops
  
  // Schedule
  departureDate: Date; // When the trip starts
  departureTime: string; // Time in HH:mm format
  estimatedDuration?: number; // Estimated duration in minutes
  estimatedArrival?: Date; // Calculated arrival time
  
  // Capacity & Pricing
  totalSeats: number; // Total available seats (including driver)
  availableSeats: number; // Currently available seats
  pricePerSeat: number; // Price per seat
  currency: string; // Currency code (default: USD)
  
  // Passengers
  passengers: IPassenger[];
  
  // Trip Preferences
  smokingAllowed: boolean;
  petsAllowed: boolean;
  musicAllowed: boolean;
  chatPreference: 'quiet' | 'friendly' | 'any';
  genderPreference: 'male' | 'female' | 'any';
  
  // Status & Metadata
  status: TripStatus;
  isRecurring: boolean; // Is this a recurring trip?
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    endDate?: Date;
  };
  
  // Vehicle Information
  vehicleId?: string; // Reference to driver's vehicle
  
  // Route Information
  routeDistance?: number; // Distance in kilometers
  routePolyline?: string; // Encoded polyline for route visualization
  
  // Additional Info
  description?: string; // Trip description/notes
  luggageSpace?: boolean; // Is luggage space available?
  maxLuggage?: number; // Maximum luggage pieces allowed
  
  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string; // User ID who cancelled
  
  // Completion
  completedAt?: Date;
  actualDepartureTime?: Date;
  actualArrivalTime?: Date;
  
  // Ratings & Reviews
  driverRating?: number; // Average rating from passengers
  passengerRatings?: {
    userId: string;
    rating: number;
    review?: string;
  }[];
  
  // Safety & Verification
  isVerified: boolean; // Trip verified by admin
  safetyScore?: number; // Calculated safety score
  
  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITripDoc extends ITrip, Document {
  // Instance methods can be added here
}

export interface ITripModel extends Model<ITripDoc> {
  // Static methods can be added here
}

/**
 * Create Trip DTO
 */
export type CreateTripDTO = Omit<
  ITrip,
  | 'driverId'
  | 'passengers'
  | 'status'
  | 'availableSeats'
  | 'createdAt'
  | 'updatedAt'
  | 'cancelledAt'
  | 'completedAt'
  | 'isVerified'
>;

/**
 * Update Trip DTO
 */
export type UpdateTripDTO = Partial<CreateTripDTO> & {
  status?: TripStatus;
};

/**
 * Book Trip DTO
 */
export interface BookTripDTO {
  seats: number;
  pickupLocation?: ILocation;
  dropoffLocation?: ILocation;
  pickupNote?: string; // Note about pickup location
}

/**
 * Search Trips Query
 */
export interface SearchTripsQuery {
  origin?: {
    latitude: number;
    longitude: number;
    radius?: number; // Radius in degrees (0.1 ≈ 11km)
  };
  destination?: {
    latitude: number;
    longitude: number;
    radius?: number; // Radius in degrees (0.1 ≈ 11km)
  };
  // Query parameters from HTTP request (will be converted to proper types)
  originLatitude?: number | string;
  originLongitude?: number | string;
  originRadius?: number | string;
  destinationLatitude?: number | string;
  destinationLongitude?: number | string;
  destinationRadius?: number | string;
  departureDate?: Date;
  departureDateFrom?: Date;
  departureDateTo?: Date;
  maxPrice?: number;
  minSeats?: number;
  smokingAllowed?: boolean;
  petsAllowed?: boolean;
  genderPreference?: 'male' | 'female' | 'any';
  status?: TripStatus[];
  driverId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'departureDate' | 'pricePerSeat' | 'createdAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  // Ranking parameters
  useRanking?: boolean; // Enable ranking algorithm
  userId?: string; // User ID for personalized ranking
  preferredDepartureTime?: string; // HH:mm format
}
