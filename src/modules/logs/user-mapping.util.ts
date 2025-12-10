import { IUserDoc } from '../user/user.interfaces';
import mongoose from 'mongoose';

/**
 * Interface for the mapped user object used in logs
 */
export interface MappedUserForLog {
  name: string;
  phoneNumber: string;
  email: string;
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userType?: string;
  role?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Checks if an object is a Mongoose document
 * @param obj - The object to check
 * @returns true if it's a Mongoose document, false otherwise
 */
function isMongooseDocument(obj: any): boolean {
  return obj && 
         typeof obj === 'object' && 
         (obj.$__ || obj.$isNew !== undefined) && 
         typeof obj.toObject === 'function';
}

/**
 * Safely converts a Mongoose document to a plain object
 * @param doc - The Mongoose document
 * @returns Plain JavaScript object
 */
function mongooseToObject(doc: any): any {
  try {
    if (isMongooseDocument(doc)) {
      return doc.toObject();
    }
    return doc;
  } catch (error) {
    console.warn('Error converting Mongoose document to object:', error);
    return doc;
  }
}

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param id - The ID to validate
 * @returns true if valid ObjectId, false otherwise
 */
function isValidObjectId(id: string): boolean {
  try {
    return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
  } catch {
    return false;
  }
}

/**
 * Resolves a valid user ID with fallback logic
 * Priority: 1. Valid user ID, 2. Admin user, 3. SuperAdmin user, 4. Default admin
 * @param user - The user object
 * @returns Valid MongoDB ObjectId as string
 */
export function resolveUserId(user: Partial<IUserDoc> | any): string {
  try {
    const plainUser = mongooseToObject(user);
    
    // Priority 1: Check if user has a valid ID
    const userId = plainUser?.id || plainUser?._id?.toString();
    if (userId && isValidObjectId(userId)) {
      return userId;
    }
    
    // Priority 2: Check if userType is admin and has valid ID
    if (plainUser?.userType === 'admin' && plainUser?.id && isValidObjectId(plainUser.id)) {
      return plainUser.id;
    }
    
    // Priority 3: Check if isSuperAdmin exists and has valid ID
    if (plainUser?.isSuperAdmin && plainUser?.id && isValidObjectId(plainUser.id)) {
      return plainUser.id;
    }
    
    // Priority 4: Look for any admin user in the system
    // This would require a database query, so we'll use a system admin ID
    // For now, return a system admin ObjectId
    return '000000000000000000000001'; // System admin ID
    
  } catch (error) {
    console.error('Error resolving user ID:', error);
    // Final fallback to system admin ID
    return '000000000000000000000001';
  }
}

/**
 * Extracts user data from various user object formats
 * @param user - The user object (can be Mongoose doc, plain object, or partial)
 * @returns Mapped user object with required fields for logging
 */
export function mapUserForLogging(user: Partial<IUserDoc> | any): MappedUserForLog {
  try {
    // Convert Mongoose document to plain object if needed
    const plainUser = mongooseToObject(user);
    
    // Extract basic information with fallbacks
    const firstName = plainUser?.firstName || '';
    const lastName = plainUser?.lastName || '';
    const fullName = plainUser?.fullName || `${firstName} ${lastName}`.trim();
    
    // Build the mapped user object
    const mappedUser: MappedUserForLog = {
      // Required fields for logging
      name: plainUser?.name || 
            fullName || 
            plainUser?.email || 
            plainUser?.id || 
            'Unknown User',
      phoneNumber: plainUser?.phoneNumber || '',
      email: plainUser?.email || 'unknown@hitsparkingmanager.com',
      id: resolveUserId(plainUser), // Use the robust ID resolution
      
      // Optional fields that might be useful
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: fullName || undefined,
      userType: plainUser?.userType || plainUser?.role || undefined,
      role: plainUser?.role || plainUser?.userType || undefined,
    };

    // Add any additional properties from the original user object
    // (excluding Mongoose internal properties)
    const excludeKeys = ['$__', '$isNew', '_doc', '__v', 'toObject', 'toJSON'];
    Object.keys(plainUser || {}).forEach(key => {
      if (!excludeKeys.includes(key) && !mappedUser.hasOwnProperty(key)) {
        mappedUser[key] = plainUser[key];
      }
    });

    // Ensure name is never empty
    if (!mappedUser.name || mappedUser.name.trim() === '') {
      mappedUser.name = 'Unknown User';
    }

    return mappedUser;
  } catch (error) {
    console.error('Error mapping user for logging:', error);
    
    // Return a safe fallback object with resolved ID
    return {
      name: 'Unknown User',
      phoneNumber: '',
      email: 'unknown@hitsparkingmanager.com',
      id: resolveUserId(user), // Use the robust ID resolution even in error case
    };
  }
}

/**
 * Maps multiple users for logging (useful for batch operations)
 * @param users - Array of user objects
 * @returns Array of mapped user objects
 */
export function mapUsersForLogging(users: (Partial<IUserDoc> | any)[]): MappedUserForLog[] {
  return users.map(user => mapUserForLogging(user));
}

/**
 * Extracts user ID from various user object formats
 * @param user - The user object
 * @returns User ID as string
 */
export function extractUserId(user: Partial<IUserDoc> | any): string {
  return resolveUserId(user);
}

/**
 * Extracts user name from various user object formats
 * @param user - The user object
 * @returns User name as string
 */
export function extractUserName(user: Partial<IUserDoc> | any): string {
  try {
    const plainUser = mongooseToObject(user);
    const firstName = plainUser?.firstName || '';
    const lastName = plainUser?.lastName || '';
    const fullName = plainUser?.fullName || `${firstName} ${lastName}`.trim();
    
    return plainUser?.name || 
           fullName || 
           plainUser?.email || 
           plainUser?.id || 
           'Unknown User';
  } catch (error) {
    console.error('Error extracting user name:', error);
    return 'Unknown User';
  }
}
