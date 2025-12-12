import Role from './role.model';
import { roleRights } from '../../config/roles';

/**
 * In-memory cache for role permissions
 * Key: userType (e.g., 'admin', 'tow-company-owner')
 * Value: Array of permissions
 */
const rolePermissionsCache = new Map<string, string[]>();

/**
 * Cache TTL in milliseconds (default: 5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

/**
 * Initialize cache from database
 * This should be called on server startup
 */
export const initializeRolePermissionsCache = async (): Promise<void> => {
  try {
    const roles = await Role.find({ isActive: true });
    
    // Clear existing cache
    rolePermissionsCache.clear();
    cacheTimestamps.clear();
    
    // Populate cache from database
    for (const role of roles) {
      rolePermissionsCache.set(role.name, role.permissions || []);
      cacheTimestamps.set(role.name, Date.now());
    }
    
    console.log(`✅ Role permissions cache initialized with ${roles.length} roles`);
  } catch (error) {
    console.error('Error initializing role permissions cache:', error);
    // Fallback to roles.ts if database fails
    initializeCacheFromConfig();
  }
};

/**
 * Initialize cache from roles.ts config file (fallback)
 */
const initializeCacheFromConfig = (): void => {
  rolePermissionsCache.clear();
  cacheTimestamps.clear();
  
  // Populate from hardcoded roles.ts
  roleRights.forEach((permissions, userType) => {
    rolePermissionsCache.set(userType, permissions);
    cacheTimestamps.set(userType, Date.now());
  });
  
  console.log('⚠️ Role permissions cache initialized from config file (fallback)');
};

/**
 * Get permissions for a userType from cache
 * If not in cache or cache expired, fetch from database and update cache
 */
export const getCachedRolePermissions = async (userType: string): Promise<string[]> => {
  // Normalize userType to lowercase for consistent cache keys
  const normalizedUserType = userType.toLowerCase();
  
  // Check if in cache and not expired
  const cached = rolePermissionsCache.get(normalizedUserType);
  const timestamp = cacheTimestamps.get(normalizedUserType);
  
  if (cached && timestamp && Date.now() - timestamp < CACHE_TTL) {
    return cached;
  }
  
  // Cache miss or expired - fetch from database
  try {
    const role = await Role.findOne({ name: normalizedUserType, isActive: true });
    
    if (role) {
      const permissions = role.permissions || [];
      // Update cache with normalized key
      rolePermissionsCache.set(normalizedUserType, permissions);
      cacheTimestamps.set(normalizedUserType, Date.now());
      return permissions;
    }
    
    // Role not found in database - fallback to config file
    const configPermissions = roleRights.get(userType) || roleRights.get(normalizedUserType) || [];
    if (configPermissions.length > 0) {
      rolePermissionsCache.set(normalizedUserType, configPermissions);
      cacheTimestamps.set(normalizedUserType, Date.now());
      return configPermissions;
    }
    
    // No permissions found
    return [];
  } catch (error) {
    console.error(`Error fetching permissions for ${userType}:`, error);
    // Fallback to config file
    const configPermissions = roleRights.get(userType) || roleRights.get(normalizedUserType) || [];
    return configPermissions;
  }
};

/**
 * Invalidate cache for a specific role
 * Call this when a role is updated
 */
export const invalidateRoleCache = (roleName: string): void => {
  rolePermissionsCache.delete(roleName.toLowerCase());
  cacheTimestamps.delete(roleName.toLowerCase());
  console.log(`🗑️ Cache invalidated for role: ${roleName}`);
};

/**
 * Invalidate entire cache
 * Call this when roles are bulk updated
 */
export const invalidateAllRoleCache = (): void => {
  rolePermissionsCache.clear();
  cacheTimestamps.clear();
  console.log('🗑️ All role permissions cache invalidated');
};

/**
 * Refresh cache for a specific role from database
 */
export const refreshRoleCache = async (roleName: string): Promise<void> => {
  try {
    const role = await Role.findOne({ name: roleName.toLowerCase(), isActive: true });
    if (role) {
      rolePermissionsCache.set(roleName.toLowerCase(), role.permissions || []);
      cacheTimestamps.set(roleName.toLowerCase(), Date.now());
    } else {
      // Remove from cache if role doesn't exist
      invalidateRoleCache(roleName);
    }
  } catch (error) {
    console.error(`Error refreshing cache for ${roleName}:`, error);
  }
};

/**
 * Get current cache stats (for debugging)
 */
export const getCacheStats = () => {
  return {
    size: rolePermissionsCache.size,
    roles: Array.from(rolePermissionsCache.keys()),
  };
};

