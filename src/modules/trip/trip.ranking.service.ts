import { ITripDoc } from './trip.interfaces';
import Trip from './trip.model';
import mongoose from 'mongoose';
import {
  getCachedUserHistory,
  setCachedUserHistory,
} from './trip.ranking.cache';
import {
  getWeightsForUser,
  RankingWeights,
} from './trip.ranking.abtest';

/**
 * Ranked Trip Interface
 */
export interface RankedTrip extends ITripDoc {
  finalScore: number;
  proximityScore: number;
  routeFamiliarityScore: number;
  historyAffinityScore: number;
  timeRelevanceScore: number;
  qualityScore: number;
  optimizationScore: number;
  routePopularityScore?: number;
  matchReasons: string[];
  pickupDistanceKm?: number;
  dropoffDistanceKm?: number;
}

/**
 * User Ride History (for scoring)
 */
interface UserRideHistory {
  trips: Array<{
    origin: { city?: string; state?: string; country?: string };
    destination: { city?: string; state?: string; country?: string };
    driverId: string | mongoose.Types.ObjectId;
    departureDate: Date;
    departureTime: string;
    status: string;
  }>;
  preferredDepartureTime?: string; // HH:mm format
}

/**
 * Search Parameters for Ranking
 */
export interface RankingSearchParams {
  userId: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupRadiusKm?: number; // Default: 10 km
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffRadiusKm?: number; // Default: 20 km
  preferredDepartureTime?: string; // HH:mm format
  limit?: number; // Default: 20
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get user's ride history for scoring (with caching)
 */
async function getUserRideHistory(userId: string): Promise<UserRideHistory> {
  // Check cache first
  const cached = getCachedUserHistory(userId);
  if (cached) {
    return cached.history;
  }

  // Get completed trips where user was a passenger
  const completedTrips = await (Trip as any).find({
    'passengers.userId': userId,
    'passengers.status': 'completed',
    status: 'completed',
  })
    .select('origin destination driverId departureDate departureTime status')
    .limit(100) // Limit to recent 100 trips for performance
    .sort({ departureDate: -1 });

  // Extract preferred departure time (most common departure time)
  const departureTimes = completedTrips.map((t: any) => t.departureTime).filter(Boolean);
  const timeCounts: Record<string, number> = {};
  departureTimes.forEach((time: string) => {
    timeCounts[time] = (timeCounts[time] || 0) + 1;
  });
  const preferredDepartureTime = Object.keys(timeCounts).length > 0
    ? Object.keys(timeCounts).reduce((a, b) =>
        timeCounts[a] && timeCounts[b] ? (timeCounts[a] > timeCounts[b] ? a : b) : ''
      )
    : undefined;

  const history: UserRideHistory = {
    trips: completedTrips.map((t: any) => ({
      origin: t.origin,
      destination: t.destination,
      driverId: t.driverId,
      departureDate: t.departureDate,
      departureTime: t.departureTime,
      status: t.status,
    })),
    ...(preferredDepartureTime && { preferredDepartureTime }),
  };

  // Cache the result
  setCachedUserHistory(userId, history);

  return history;
}

/**
 * Calculate Proximity Score (Weight: 0.30)
 */
function calculateProximityScore(
  pickupDistanceKm: number,
  pickupRadiusKm: number
): number {
  if (pickupDistanceKm > pickupRadiusKm) return 0;
  const score = 1 - pickupDistanceKm / pickupRadiusKm;
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate Route Familiarity Score (Weight: 0.25)
 */
function calculateRouteFamiliarityScore(
  trip: ITripDoc,
  userHistory: UserRideHistory
): { score: number; reason?: string } {
  if (!userHistory.trips || userHistory.trips.length === 0) {
    return { score: 0 };
  }

  const tripOriginCity = trip.origin.city?.toLowerCase() || '';
  const tripDestCity = trip.destination.city?.toLowerCase() || '';
  const tripOriginState = trip.origin.state?.toLowerCase() || '';
  const tripDestState = trip.destination.state?.toLowerCase() || '';
  const tripOriginCountry = trip.origin.country?.toLowerCase() || '';
  const tripDestCountry = trip.destination.country?.toLowerCase() || '';

  let maxScore = 0;
  let bestMatch = '';

  for (const pastTrip of userHistory.trips) {
    const pastOriginCity = pastTrip.origin.city?.toLowerCase() || '';
    const pastDestCity = pastTrip.destination.city?.toLowerCase() || '';
    const pastOriginState = pastTrip.origin.state?.toLowerCase() || '';
    const pastDestState = pastTrip.destination.state?.toLowerCase() || '';
    const pastOriginCountry = pastTrip.origin.country?.toLowerCase() || '';
    const pastDestCountry = pastTrip.destination.country?.toLowerCase() || '';

    // Exact city-to-city match
    if (
      tripOriginCity === pastOriginCity &&
      tripDestCity === pastDestCity &&
      tripOriginCity &&
      tripDestCity
    ) {
      if (1.0 > maxScore) {
        maxScore = 1.0;
        bestMatch = 'Route you\'ve taken before';
      }
    }
    // Same origin city
    else if (tripOriginCity === pastOriginCity && tripOriginCity) {
      if (0.7 > maxScore) {
        maxScore = 0.7;
        bestMatch = 'From a familiar city';
      }
    }
    // Same destination city
    else if (tripDestCity === pastDestCity && tripDestCity) {
      if (0.6 > maxScore) {
        maxScore = 0.6;
        bestMatch = 'To a familiar city';
      }
    }
    // Same region/state
    else if (
      (tripOriginState === pastOriginState && tripOriginState) ||
      (tripDestState === pastDestState && tripDestState)
    ) {
      if (0.4 > maxScore) {
        maxScore = 0.4;
        bestMatch = 'Same region';
      }
    }
    // Same country
    else if (
      (tripOriginCountry === pastOriginCountry && tripOriginCountry) ||
      (tripDestCountry === pastDestCountry && tripDestCountry)
    ) {
      if (0.2 > maxScore) {
        maxScore = 0.2;
        bestMatch = 'Same country';
      }
    }
  }

  return { 
    score: maxScore, 
    ...(bestMatch && { reason: bestMatch }),
  };
}

/**
 * Calculate History Affinity Score (Weight: 0.15)
 */
function calculateHistoryAffinityScore(
  trip: ITripDoc,
  userHistory: UserRideHistory
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (!userHistory.trips || userHistory.trips.length === 0) {
    return { score: 0, reasons: [] };
  }

  const tripDriverId = trip.driverId.toString();
  const tripDayOfWeek = trip.departureDate.getDay(); // 0-6 (Sunday-Saturday)
  const tripTime = trip.departureTime; // HH:mm format

  // Check if same driver
  const hasRiddenWithDriver = userHistory.trips.some(
    (t) => t.driverId.toString() === tripDriverId
  );
  if (hasRiddenWithDriver) {
    score += 0.2;
    reasons.push('Driver you\'ve ridden with');
  }

  // Check if same weekday
  const hasRiddenOnWeekday = userHistory.trips.some(
    (t) => t.departureDate.getDay() === tripDayOfWeek
  );
  if (hasRiddenOnWeekday) {
    score += 0.1;
    reasons.push('Day you usually travel');
  }

  // Check if departure time within ±1 hour
  if (userHistory.preferredDepartureTime && tripTime) {
    const prefParts = userHistory.preferredDepartureTime.split(':').map(Number);
    const tripParts = tripTime.split(':').map(Number);
    
    if (prefParts.length === 2 && tripParts.length === 2 && 
        !isNaN(prefParts[0]!) && !isNaN(prefParts[1]!) &&
        !isNaN(tripParts[0]!) && !isNaN(tripParts[1]!)) {
      const [prefHour, prefMin] = prefParts;
      const [tripHour, tripMin] = tripParts;
      const prefMinutes = prefHour! * 60 + prefMin!;
      const tripMinutes = tripHour! * 60 + tripMin!;
      const diffMinutes = Math.abs(tripMinutes - prefMinutes);
      
      if (diffMinutes <= 60) {
        score += 0.1;
        reasons.push('Matches your preferred time');
      }
    }
  }

  return { score: Math.min(1, score), reasons };
}

/**
 * Calculate Time Relevance Score (Weight: 0.15)
 */
function calculateTimeRelevanceScore(
  trip: ITripDoc,
  preferredDepartureTime?: string
): number {
  if (!preferredDepartureTime || !trip.departureTime) {
    return 0.5; // Neutral score if no preference
  }

  const prefParts = preferredDepartureTime.split(':').map(Number);
  const tripParts = trip.departureTime.split(':').map(Number);
  
  if (prefParts.length !== 2 || tripParts.length !== 2 ||
      isNaN(prefParts[0]!) || isNaN(prefParts[1]!) ||
      isNaN(tripParts[0]!) || isNaN(tripParts[1]!)) {
    return 0.5; // Neutral score if invalid format
  }

  const [prefHour, prefMin] = prefParts;
  const [tripHour, tripMin] = tripParts;
  const prefMinutes = prefHour! * 60 + prefMin!;
  const tripMinutes = tripHour! * 60 + tripMin!;
  const diffHours = Math.abs(tripMinutes - prefMinutes) / 60;
  const maxTimeWindowHours = 6;

  const score = 1 - diffHours / maxTimeWindowHours;
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate Trip Quality Score (Weight: 0.10)
 */
function calculateQualityScore(trip: ITripDoc): number {
  // Normalize driver rating (0-5 to 0-1)
  const driverRatingNormalized = trip.driverId && typeof trip.driverId === 'object' && trip.driverId !== null && 'avgRating' in trip.driverId
    ? ((trip.driverId as any).avgRating || 0) / 5
    : 0.5; // Default to 0.5 if no rating

  // Calculate driver completion rate
  // For now, use totalRides as a proxy (more rides = higher completion rate assumption)
  const totalRides = trip.driverId && typeof trip.driverId === 'object' && trip.driverId !== null && 'totalRides' in trip.driverId
    ? (trip.driverId as any).totalRides || 0
    : 0;
  const driverCompletionRate = Math.min(1, totalRides / 10); // Normalize: 10+ rides = 1.0

  // Vehicle comfort score (simplified - could be enhanced with vehicle data)
  const vehicleComfortScore = trip.luggageSpace ? 0.8 : 0.6; // Higher if luggage space available

  return (
    0.4 * driverRatingNormalized +
    0.3 * driverCompletionRate +
    0.3 * vehicleComfortScore
  );
}

/**
 * Calculate Route Popularity Score
 * Based on how many users have taken similar routes
 * Uses caching to avoid repeated database queries
 */
const routePopularityCache = new Map<string, { score: number; timestamp: number }>();
const ROUTE_POPULARITY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function calculateRoutePopularityScore(
  trip: ITripDoc
): Promise<number> {
  const originCity = trip.origin.city?.toLowerCase() || '';
  const destCity = trip.destination.city?.toLowerCase() || '';

  if (!originCity || !destCity) {
    return 0.5; // Neutral score if no city data
  }

  const cacheKey = `${originCity}:${destCity}`;
  const cached = routePopularityCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < ROUTE_POPULARITY_CACHE_TTL) {
    return cached.score;
  }

  // Count completed trips on this route
  const routeTrips = await (Trip as any).countDocuments({
    'origin.city': { $regex: new RegExp(`^${originCity}$`, 'i') },
    'destination.city': { $regex: new RegExp(`^${destCity}$`, 'i') },
    status: 'completed',
  });

  // Normalize: 0 trips = 0.0, 10+ trips = 1.0
  const popularityScore = Math.min(1, routeTrips / 10);
  
  // Cache the result
  routePopularityCache.set(cacheKey, {
    score: popularityScore,
    timestamp: Date.now(),
  });
  
  return popularityScore;
}

/**
 * Calculate Optimization/Boost Score (Weight: 0.05)
 */
function calculateOptimizationScore(trip: ITripDoc): number {
  let score = 0;

  // Boost for under-booked trips (less than 50% booked)
  const bookingRate = (trip.totalSeats - trip.availableSeats) / trip.totalSeats;
  if (bookingRate < 0.5) {
    score += 0.3;
  }

  // Boost for verified drivers
  if (trip.isVerified) {
    score += 0.2;
  }

  // Boost for new but verified drivers (low totalRides but verified)
  const totalRides = trip.driverId && typeof trip.driverId === 'object' && trip.driverId !== null && 'totalRides' in trip.driverId
    ? (trip.driverId as any).totalRides || 0
    : 0;
  if (trip.isVerified && totalRides < 5 && totalRides > 0) {
    score += 0.2;
  }

  return Math.min(1, score);
}

/**
 * Get recommended trips with ranking algorithm
 */
export async function getRecommendedTrips(
  params: RankingSearchParams
): Promise<RankedTrip[]> {
  const {
    userId,
    pickupLatitude,
    pickupLongitude,
    pickupRadiusKm = 10,
    dropoffLatitude,
    dropoffLongitude,
    dropoffRadiusKm = 20,
    preferredDepartureTime,
    limit = 20,
  } = params;

  // Step 1: Hard Filters
  const filter: any = {
    status: { $in: ['scheduled', 'active'] }, // ACTIVE or SCHEDULED trips (ACTIVE = in progress, SCHEDULED = upcoming)
    availableSeats: { $gt: 0 }, // Must have available seats
    departureDate: { $gte: new Date() }, // Future trips only
    driverId: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude user's own trips
  };

  // Geo-spatial filters for pickup location
  if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
    // Convert km to degrees (approximate: 1 degree ≈ 111 km)
    const radiusDegrees = pickupRadiusKm / 111;
    filter['origin.latitude'] = {
      $gte: pickupLatitude - radiusDegrees,
      $lte: pickupLatitude + radiusDegrees,
    };
    filter['origin.longitude'] = {
      $gte: pickupLongitude - radiusDegrees,
      $lte: pickupLongitude + radiusDegrees,
    };
  }

  // Geo-spatial filters for dropoff location
  if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
    const radiusDegrees = dropoffRadiusKm / 111;
    filter['destination.latitude'] = {
      $gte: dropoffLatitude - radiusDegrees,
      $lte: dropoffLatitude + radiusDegrees,
    };
    filter['destination.longitude'] = {
      $gte: dropoffLongitude - radiusDegrees,
      $lte: dropoffLongitude + radiusDegrees,
    };
  }

  // Fetch trips matching hard filters using $geoNear for efficient geo-spatial queries
  let trips: any[] = [];
  
  if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
    // Convert km to meters for $geoNear (MongoDB uses meters)
    const radiusMeters = pickupRadiusKm * 1000;
    
    try {
      // Use aggregation pipeline with $geoNear for efficient geo-spatial search
      const pipeline: any[] = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [pickupLongitude, pickupLatitude], // [longitude, latitude]
            },
            distanceField: 'pickupDistance',
            maxDistance: radiusMeters,
            spherical: true,
            query: filter,
          },
        },
        {
          $match: filter,
        },
        {
          $limit: limit * 3, // Fetch more to account for filtering
        },
      ];

      // If dropoff location is specified, add distance calculation
      if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
        const dropoffRadiusMeters = dropoffRadiusKm * 1000;
        pipeline.push({
          $addFields: {
            dropoffDistance: {
              $let: {
                vars: {
                  dist: {
                    $multiply: [
                      6371, // Earth radius in km
                      {
                        $acos: {
                          $add: [
                            {
                              $multiply: [
                                { $sin: { $degreesToRadians: '$destination.latitude' } },
                                { $sin: { $degreesToRadians: dropoffLatitude } },
                              ],
                            },
                            {
                              $multiply: [
                                { $cos: { $degreesToRadians: '$destination.latitude' } },
                                { $cos: { $degreesToRadians: dropoffLatitude } },
                                {
                                  $cos: {
                                    $degreesToRadians: {
                                      $subtract: ['$destination.longitude', dropoffLongitude],
                                    },
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                in: { $multiply: ['$$dist', 1000] }, // Convert to meters
              },
            },
          },
        });
        pipeline.push({
          $match: {
            dropoffDistance: { $lte: dropoffRadiusMeters },
          },
        });
      }

      trips = await (Trip as any).aggregate(pipeline);
      
      // Populate driverId after aggregation
      await (Trip as any).populate(trips, {
        path: 'driverId',
        select: 'firstName lastName email image avgRating totalRides',
      });
    } catch (error) {
      // Fallback to simple query if geo index not available
      console.warn('Geo-spatial query failed, falling back to simple query:', error);
      const radiusDegrees = pickupRadiusKm / 111;
      filter['origin.latitude'] = {
        $gte: pickupLatitude - radiusDegrees,
        $lte: pickupLatitude + radiusDegrees,
      };
      filter['origin.longitude'] = {
        $gte: pickupLongitude - radiusDegrees,
        $lte: pickupLongitude + radiusDegrees,
      };

      if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
        const radiusDegrees = dropoffRadiusKm / 111;
        filter['destination.latitude'] = {
          $gte: dropoffLatitude - radiusDegrees,
          $lte: dropoffLatitude + radiusDegrees,
        };
        filter['destination.longitude'] = {
          $gte: dropoffLongitude - radiusDegrees,
          $lte: dropoffLongitude + radiusDegrees,
        };
      }

      trips = await (Trip as any)
        .find(filter)
        .populate('driverId', 'firstName lastName email image avgRating totalRides')
        .limit(limit * 3);
    }
  } else {
    // No geo-spatial filtering, use standard query
    trips = await (Trip as any)
      .find(filter)
      .populate('driverId', 'firstName lastName email image avgRating totalRides')
      .limit(limit * 3);
  }

  if (trips.length === 0) {
    return [];
  }

  // Get user ride history
  const userHistory = await getUserRideHistory(userId);
  const isColdStart = userHistory.trips.length === 0;

  // Step 2: Calculate scores for each trip
  const rankedTrips: RankedTrip[] = [];

  for (const trip of trips) {
    // Calculate distances
    let pickupDistanceKm = 0;
    let dropoffDistanceKm = 0;

    if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
      if (trip.pickupDistance !== undefined) {
        // Use distance from $geoNear (in meters, convert to km)
        pickupDistanceKm = trip.pickupDistance / 1000;
      } else {
        pickupDistanceKm = calculateDistanceKm(
          pickupLatitude,
          pickupLongitude,
          trip.origin.latitude,
          trip.origin.longitude
        );
      }
    }

    if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
      if (trip.dropoffDistance !== undefined) {
        // Use distance from aggregation (in meters, convert to km)
        dropoffDistanceKm = trip.dropoffDistance / 1000;
      } else {
        dropoffDistanceKm = calculateDistanceKm(
          dropoffLatitude,
          dropoffLongitude,
          trip.destination.latitude,
          trip.destination.longitude
        );
      }
    }

    // Skip if outside radius
    if (
      (pickupLatitude !== undefined && pickupDistanceKm > pickupRadiusKm) ||
      (dropoffLatitude !== undefined && dropoffDistanceKm > dropoffRadiusKm)
    ) {
      continue;
    }

    // Calculate individual scores
    const proximityScore = calculateProximityScore(pickupDistanceKm, pickupRadiusKm);
    const routeFamiliarity = calculateRouteFamiliarityScore(trip, userHistory);
    const historyAffinity = calculateHistoryAffinityScore(trip, userHistory);
    const timeScore = calculateTimeRelevanceScore(
      trip,
      preferredDepartureTime || userHistory.preferredDepartureTime
    );
    const qualityScore = calculateQualityScore(trip);
    const optimizationScore = calculateOptimizationScore(trip);
    const routePopularityScore = await calculateRoutePopularityScore(trip);

    // Get weights from A/B testing framework
    let weights: RankingWeights = getWeightsForUser(userId);

    // Adjust weights for cold start
    if (isColdStart) {
      weights = {
        proximity: 0.4,
        routeFamiliarity: 0.0, // Ignore route familiarity
        historyAffinity: 0.0, // Ignore history affinity
        time: 0.1,
        quality: 0.4,
        optimization: 0.1,
        routePopularity: 0.0,
      };
    }

    // Calculate final score with route popularity if enabled
    const routePopularityWeight = weights.routePopularity || 0;
    const adjustedQualityWeight = routePopularityWeight > 0
      ? weights.quality - routePopularityWeight * 0.5 // Reduce quality weight slightly
      : weights.quality;

    const finalScore =
      weights.proximity * proximityScore +
      weights.routeFamiliarity * routeFamiliarity.score +
      weights.historyAffinity * historyAffinity.score +
      weights.time * timeScore +
      adjustedQualityWeight * qualityScore +
      weights.optimization * optimizationScore +
      routePopularityWeight * routePopularityScore;

    // Build match reasons
    const matchReasons: string[] = [];
    if (proximityScore > 0.7) {
      matchReasons.push('Near your pickup point');
    }
    if (routeFamiliarity.reason) {
      matchReasons.push(routeFamiliarity.reason);
    }
    if (historyAffinity.reasons.length > 0) {
      matchReasons.push(...historyAffinity.reasons);
    }
    if (qualityScore > 0.7) {
      matchReasons.push('Highly rated driver');
    }
    if (optimizationScore > 0.5) {
      matchReasons.push('Great availability');
    }
    if (routePopularityScore > 0.7) {
      matchReasons.push('Popular route');
    }

    rankedTrips.push({
      ...(trip.toObject ? trip.toObject() : trip),
      finalScore,
      proximityScore,
      routeFamiliarityScore: routeFamiliarity.score,
      historyAffinityScore: historyAffinity.score,
      timeRelevanceScore: timeScore,
      qualityScore,
      optimizationScore,
      routePopularityScore,
      matchReasons: matchReasons.length > 0 ? matchReasons : ['Available trip'],
      pickupDistanceKm,
      dropoffDistanceKm,
    });
  }

  // Step 3: Sort by final score DESC
  rankedTrips.sort((a, b) => b.finalScore - a.finalScore);

  // Return top N trips
  return rankedTrips.slice(0, limit);
}

