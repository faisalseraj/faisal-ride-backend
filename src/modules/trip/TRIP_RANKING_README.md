# Trip Discovery and Ranking Algorithm

## Overview

This implementation provides a weighted relevance scoring algorithm for ranking inter-city carpooling trips based on multiple signals. The algorithm is integrated into the existing `searchTrips` functionality.

## Features

### Hard Filters (Mandatory)
- Only includes trips with `status === 'scheduled' | 'active'`
- `availableSeats > 0`
- `departureDate >= now`
- `driverId !== userId` (excludes user's own trips)
- Pickup location within `pickupRadiusKm` (default: 10 km)
- Drop-off location within `dropoffRadiusKm` (default: 20 km)

### Scoring Signals

1. **Proximity Score (Weight: 0.30)**
   - Based on distance from user's pickup location
   - Formula: `1 - (pickupDistanceKm / pickupRadiusKm)`
   - Clamped between 0 and 1

2. **Route Familiarity Score (Weight: 0.25)**
   - Exact city-to-city match → 1.0
   - Same origin city → 0.7
   - Same destination city → 0.6
   - Same region/state → 0.4
   - Same country → 0.2
   - No match → 0.0

3. **History Affinity Score (Weight: 0.15)**
   - Same driver previously → +0.2
   - Same weekday → +0.1
   - Departure time within ±1 hour → +0.1
   - Clamped between 0 and 1

4. **Time Relevance Score (Weight: 0.15)**
   - Based on departure time preference
   - Formula: `1 - (abs(tripTime - userPreferredTime) / maxTimeWindowHours)`
   - `maxTimeWindowHours = 6`
   - Clamped between 0 and 1

5. **Trip Quality Score (Weight: 0.10)**
   - Driver rating (normalized 0-5 to 0-1) → 40%
   - Driver completion rate (based on totalRides) → 30%
   - Vehicle comfort (luggage space) → 30%

6. **Optimization/Boost Score (Weight: 0.05)**
   - Under-booked trips (<50% booked) → +0.3
   - Verified drivers → +0.2
   - New but verified drivers → +0.2
   - Clamped between 0 and 1

### Final Score Formula

```
finalScore =
  0.30 * proximityScore +
  0.25 * routeFamiliarityScore +
  0.15 * historyAffinityScore +
  0.15 * timeRelevanceScore +
  0.10 * qualityScore +
  0.05 * optimizationScore
```

### Cold Start Behavior

For users with no ride history:
- Route familiarity weight → 0.0
- History affinity weight → 0.0
- Proximity weight → 0.4 (increased)
- Quality weight → 0.4 (increased)
- Time weight → 0.1
- Optimization weight → 0.1

## Usage

### API Endpoint

```
GET /v1/trips?useRanking=true&originLatitude=40.7128&originLongitude=-74.0060&...
```

### Query Parameters

- `useRanking` (boolean): Enable ranking algorithm (default: false)
- `userId` (string): Automatically extracted from authenticated user
- `originLatitude` (number): User's pickup latitude (required for ranking)
- `originLongitude` (number): User's pickup longitude (required for ranking)
- `originRadius` (number): Pickup radius in km (default: 10)
- `destinationLatitude` (number): User's dropoff latitude (optional)
- `destinationLongitude` (number): User's dropoff longitude (optional)
- `destinationRadius` (number): Dropoff radius in km (default: 20)
- `preferredDepartureTime` (string): Preferred departure time in HH:mm format (optional)
- All other standard search parameters are supported

### Response Format

Ranked trips include additional fields:

```typescript
{
  ...tripData,
  finalScore: number,              // 0-1 composite score
  proximityScore: number,          // 0-1
  routeFamiliarityScore: number,   // 0-1
  historyAffinityScore: number,    // 0-1
  timeRelevanceScore: number,      // 0-1
  qualityScore: number,            // 0-1
  optimizationScore: number,       // 0-1
  matchReasons: string[],         // UI-friendly reasons
  pickupDistanceKm?: number,       // Distance to pickup
  dropoffDistanceKm?: number      // Distance to dropoff
}
```

### Example Request

```bash
GET /v1/trips?useRanking=true&originLatitude=40.7128&originLongitude=-74.0060&originRadius=15&destinationLatitude=40.7589&destinationLongitude=-73.9851&preferredDepartureTime=09:00&limit=20
```

### Example Response

```json
[
  {
    "id": "trip123",
    "origin": { "city": "New York", "latitude": 40.7128, "longitude": -74.0060 },
    "destination": { "city": "Boston", "latitude": 42.3601, "longitude": -71.0589 },
    "departureDate": "2024-01-15T09:00:00Z",
    "pricePerSeat": 25,
    "availableSeats": 2,
    "finalScore": 0.87,
    "proximityScore": 0.95,
    "routeFamiliarityScore": 1.0,
    "historyAffinityScore": 0.3,
    "timeRelevanceScore": 0.9,
    "qualityScore": 0.85,
    "optimizationScore": 0.5,
    "matchReasons": [
      "Near your pickup point",
      "Route you've taken before",
      "Driver you've ridden with",
      "Matches your preferred time",
      "Highly rated driver"
    ],
    "pickupDistanceKm": 0.5,
    "dropoffDistanceKm": 1.2
  }
]
```

## Implementation Details

### Files

- `trip.ranking.service.ts`: Core ranking algorithm implementation
- `trip.service.ts`: Updated `searchTrips` function with ranking integration
- `trip.controller.ts`: Updated controller to handle ranking parameters
- `trip.interfaces.ts`: Added ranking-related interfaces

### Key Functions

- `getRecommendedTrips()`: Main ranking function
- `calculateProximityScore()`: Proximity scoring
- `calculateRouteFamiliarityScore()`: Route familiarity scoring
- `calculateHistoryAffinityScore()`: History-based scoring
- `calculateTimeRelevanceScore()`: Time preference scoring
- `calculateQualityScore()`: Trip quality scoring
- `calculateOptimizationScore()`: Optimization/boost scoring
- `getUserRideHistory()`: Fetches user's completed trips

### Performance Considerations

- User history is limited to 100 most recent completed trips
- Geo-spatial queries use approximate distance calculations (Haversine formula)
- Ranking is applied after initial filtering for better performance
- Results are sorted by `finalScore` DESC and limited to top N trips

## Implemented Enhancements

### ✅ 1. MongoDB `$geoNear` for Efficient Geo-spatial Queries
- Implemented `$geoNear` aggregation pipeline for efficient proximity-based filtering
- Uses MongoDB's 2dsphere index on `origin.coordinates` and `destination.coordinates`
- Automatically calculates distance in meters during query
- Falls back to simple query if geo index is not available
- Coordinates are automatically updated in pre-save hook: `[longitude, latitude]`

### ✅ 2. Caching for User Ride History
- Created `trip.ranking.cache.ts` module for in-memory caching
- Cache TTL: 30 minutes (configurable)
- Cache is invalidated when:
  - User completes a trip
  - User creates a booking
  - Trip is completed
- Reduces database queries for frequently accessed user histories

### ✅ 3. Route Popularity Scoring
- New scoring signal: `routePopularityScore` (optional weight: 0.05)
- Calculates popularity based on number of completed trips on same route
- Uses caching (1 hour TTL) to avoid repeated database queries
- Normalized score: 0 trips = 0.0, 10+ trips = 1.0
- Can be enabled via A/B testing framework

### ✅ 4. A/B Testing Framework for Weight Tuning
- Created `trip.ranking.abtest.ts` module
- Consistent user assignment using hash-based distribution
- Predefined variants:
  - **Control**: Default weights
  - **Variant A**: Higher proximity weight (0.35)
  - **Variant B**: Higher route familiarity weight (0.30)
  - **Variant C**: Includes route popularity signal (0.05)
- Functions:
  - `getWeightsForUser(userId)`: Returns weights for a user
  - `getVariantForUser(userId)`: Returns variant name for analytics
  - `updateABTestConfig()`: Update test configurations
  - `validateWeights()`: Ensure weights sum to 1.0

### 🔄 5. Machine Learning-based Preference Learning (Optional)
- Not implemented (as per requirements - algorithm must be explainable)
- Can be added in the future using external ML service
- Current algorithm uses rule-based scoring which is fully explainable

## Usage

### Enable Ranking Algorithm
```typescript
// In search query
{
  useRanking: true,
  userId: "user123",
  originLatitude: 40.7128,
  originLongitude: -74.0060,
  originRadius: 10, // km
  // ... other params
}
```

### Configure A/B Testing
```typescript
import { updateABTestConfig } from './trip.ranking.abtest';

// Enable variant A for 20% of users
updateABTestConfig('variantA', {
  enabled: true,
  userPercentage: 20,
});
```

### Cache Management
```typescript
import { invalidateUserHistoryCache, getCacheStats } from './trip.ranking.cache';

// Invalidate cache for a user
invalidateUserHistoryCache(userId);

// Get cache statistics
const stats = getCacheStats();
console.log(`Cache size: ${stats.size}`);
```

