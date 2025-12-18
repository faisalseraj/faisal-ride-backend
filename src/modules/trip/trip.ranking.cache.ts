/**
 * In-memory cache for user ride history
 * Key: userId
 * Value: UserRideHistory with timestamp
 */

interface CachedUserHistory {
  history: {
    trips: Array<{
      origin: { city?: string; state?: string; country?: string };
      destination: { city?: string; state?: string; country?: string };
      driverId: string | any;
      departureDate: Date;
      departureTime: string;
      status: string;
    }>;
    preferredDepartureTime?: string;
  };
  timestamp: number;
}

const userHistoryCache = new Map<string, CachedUserHistory>();

/**
 * Cache TTL in milliseconds (default: 30 minutes)
 * User ride history doesn't change frequently, so we can cache longer
 */
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached user ride history
 */
export function getCachedUserHistory(userId: string): CachedUserHistory | null {
  const cached = userHistoryCache.get(userId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  
  return null;
}

/**
 * Set cached user ride history
 */
export function setCachedUserHistory(
  userId: string,
  history: CachedUserHistory['history']
): void {
  userHistoryCache.set(userId, {
    history,
    timestamp: Date.now(),
  });
}

/**
 * Invalidate cache for a specific user
 * Call this when user completes a trip
 */
export function invalidateUserHistoryCache(userId: string): void {
  userHistoryCache.delete(userId);
}

/**
 * Clear all cached user histories
 */
export function clearAllUserHistoryCache(): void {
  userHistoryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ userId: string; age: number }>;
} {
  const entries = Array.from(userHistoryCache.entries()).map(([userId, cached]) => ({
    userId,
    age: Date.now() - cached.timestamp,
  }));

  return {
    size: userHistoryCache.size,
    entries,
  };
}

