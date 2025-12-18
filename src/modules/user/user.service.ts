/**
 * Faisal Ride - User Service
 * Simplified user management for carpooling application
 */

import { IOptions, QueryResult } from '../paginate/paginate';
import {
  IUser,
  IUserDoc,
  IUserType,
  NewCreatedUser,
  SearchUsersOptions,
  UpdateUserBody,
} from './user.interfaces';

import ApiError from '../errors/ApiError';
import User from './user.model';
import { emailService } from '../email';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import pick from 'lodash/pick';
import { tokenService } from '../token';

// ============================================
// USER CREATION
// ============================================

/**
 * Create a new user
 */
export const createUser = async (userBody: NewCreatedUser): Promise<IUserDoc> => {
  if (await User.isEmailTaken(userBody.email!)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  if (userBody.phoneNumber && (await User.isPhoneNumberTaken(userBody.phoneNumber, userBody.userType))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already taken');
  }
  return User.create(userBody);
};

/**
 * Create a rider user (self-registration)
 */
export const createRider = async (userBody: Partial<IUser>): Promise<IUserDoc> => {
  const riderData: Partial<IUser> = {
    ...userBody,
    userType: 'rider',
    isDefaultPassword: false,
  };
  return createUser(riderData as NewCreatedUser);
};

/**
 * Create an admin user (by super admin only)
 */
export const createAdmin = async (userBody: Partial<IUser>, createdBy: IUserDoc): Promise<IUserDoc> => {
  if (createdBy.userType !== 'admin' || !createdBy.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only super admin can create admin users');
  }
  
  const adminData: Partial<IUser> = {
    ...userBody,
    userType: 'admin',
    isDefaultPassword: true,
  };
  
  const user = await createUser(adminData as NewCreatedUser);
  
  // Send welcome email with password setup link
  const resetPasswordToken = await tokenService.generateResetPasswordToken(user.email!, 30);
  await emailService.sendResetPasswordEmail(user.email!, resetPasswordToken, user.fullName!, user);
  
  return user;
};

/**
 * Helper to generate tokens and send welcome email after user creation
 */
export const createUserHelper = async (user: IUserDoc, ) => {
  
  // Send welcome email
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user!, user?.email!);
  await emailService.sendVerificationEmail(user?.email!, verifyEmailToken, user.firstName, user);  
  const tokens = await tokenService.generateAuthTokens(user);
  return { user, tokens };
};

// ============================================
// USER RETRIEVAL
// ============================================

/**
 * Query users with pagination
 */
export const queryUsers = async (
  filter: Record<string, any>,
  options: IOptions,
): Promise<QueryResult> => {
  // Exclude deleted users by default
  const queryFilter = {
    ...filter,
    isDeleted: { $ne: true },
  };
  
  const users = await User.paginate(queryFilter, options);
  return users;
};

/**
 * Get user by ID
 */
export const getUserById = async (id: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  return User.findOne({ _id: id, isDeleted: { $ne: true } });
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<IUserDoc | null> => {
  return User.findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } });
};

/**
 * Get user by phone number
 */
export const getUserByPhone = async (phoneNumber: string): Promise<IUserDoc | null> => {
  return User.findOne({ phoneNumber, isDeleted: { $ne: true } });
};

/**
 * List all users by type
 */
export const listAllUsers = async (userType: IUserType): Promise<IUserDoc[]> => {
  return User.find({
    userType,
    isDeleted: { $ne: true },
    isArchived: { $ne: true },
    isSuspended: { $ne: true },
  }).select('_id firstName lastName fullName email phoneNumber image avgRating');
};

/**
 * Search users
 */
export const searchUsers = async (options: SearchUsersOptions): Promise<IUserDoc[]> => {
  const { searchTerm, userType, city } = options;
  
  const query: any = {
    isDeleted: { $ne: true },
    isArchived: { $ne: true },
    isSuspended: { $ne: true },
  };
  
  if (userType) {
    query.userType = userType;
  }
  
  if (city) {
    query.city = { $regex: city, $options: 'i' };
  }
  
  if (searchTerm) {
    query.$or = [
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } },
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }
  
  return User.find(query)
    .select('_id firstName lastName fullName email phoneNumber image avgRating city')
    .limit(50);
};

/**
 * Get all admins
 */
export const getAllAdmins = async (loggedInUser: IUserDoc): Promise<IUserDoc[]> => {
  if (loggedInUser.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only super admin can view all admins');
  }
  
  return User.find({
    userType: 'admin',
    isDeleted: { $ne: true },
    _id: { $ne: loggedInUser._id },
  }).select('-password');
};

// ============================================
// USER UPDATE
// ============================================

/**
 * Update user by ID
 */
export const updateUserById = async (
  userId: mongoose.Types.ObjectId,
  updateBody: UpdateUserBody,
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Check for email uniqueness
  if (updateBody.email && updateBody.email !== user.email) {
    if (await User.isEmailTaken(updateBody.email, userId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
    }
    // If email is being changed, mark as unverified
    updateBody.isEmailVerified = false;
  }
  
  // Check for phone uniqueness
  if (updateBody.phoneNumber && updateBody.phoneNumber !== user.phoneNumber) {
    if (await User.isPhoneNumberTaken(updateBody.phoneNumber, user.userType, userId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number already taken');
    }
    updateBody.isPhoneNumberVerified = false;
  }
  
  Object.assign(user, updateBody);
  await user.save();
  
  return user;
};

/**
 * Update user profile (self)
 */
export const updateProfile = async (
  userId: mongoose.Types.ObjectId,
  updateBody: Partial<IUser>
): Promise<IUserDoc | null> => {
  // Only allow specific fields to be updated by the user themselves
  const allowedFields = [
    'firstName',
    'lastName',
    'image',
    'bio',
    'dateOfBirth',
    'gender',
    'address',
    'city',
    'country',
    'vehicle',
    'ridePreferences',
    'preferredLanguage',
  ];
  
  const filteredUpdate = pick(updateBody, allowedFields);
  return updateUserById(userId, filteredUpdate);
};

/**
 * Update user location
 */
export const syncLocation = async (
  userId: string,
  location: { latitude: number; longitude: number }
): Promise<IUserDoc> => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      currentLocation: location,
      isOnline: true,
    },
    { new: true }
  );
  
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  return user;
};

/**
 * Update super admin status
 */
export const updateSuperAdmin = async ({
  userId,
  isSuperAdmin,
}: {
  userId: string;
  isSuperAdmin: boolean;
}): Promise<IUserDoc> => {
  const user = await getUserById(new mongoose.Types.ObjectId(userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  if (user.userType !== 'admin') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only admin users can be made super admin');
  }
  
  user.isSuperAdmin = isSuperAdmin;
  await user.save();
  
  return user;
};

/**
 * Update user status (suspend/archive)
 */
export const updateUserStatus = async (
  userId: mongoose.Types.ObjectId,
  updateBody: { isSuspended?: boolean; isArchived?: boolean; suspendReason?: string; archiveReason?: string }
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  Object.assign(user, updateBody);
  await user.save();
  
  return user;
};

// ============================================
// USER DELETION
// ============================================

/**
 * Soft delete user by ID
 */
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  user.isDeleted = true;
  await user.save();
  
  return user;
};

/**
 * Hard delete user (for testing/admin purposes)
 */
export const hardDeleteUserById = async (userId: mongoose.Types.ObjectId): Promise<void> => {
  await User.findByIdAndDelete(userId);
};

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Add notification to user
 */
export const addNotification = async (
  userId: mongoose.Types.ObjectId,
  notification: { status: 'warning' | 'error' | 'success' | 'info'; text: string; html?: string }
): Promise<IUserDoc | null> => {
  return User.findByIdAndUpdate(
    userId,
    {
      $push: {
        notifications: {
          ...notification,
          read: false,
          createdAt: new Date(),
        },
      },
    },
    { new: true }
  );
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (
  userId: mongoose.Types.ObjectId,
  notificationId: mongoose.Types.ObjectId
): Promise<IUserDoc | null> => {
  return User.findOneAndUpdate(
    { _id: userId, 'notifications._id': notificationId },
    { $set: { 'notifications.$.read': true } },
    { new: true }
  );
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  userId: mongoose.Types.ObjectId,
  notificationId: mongoose.Types.ObjectId
): Promise<IUserDoc | null> => {
  return User.findByIdAndUpdate(
    userId,
    { $pull: { notifications: { _id: notificationId } } },
    { new: true }
  );
};

// ============================================
// RIDER SPECIFIC
// ============================================

/**
 * Update rider's vehicle info
 */
export const updateVehicle = async (
  userId: mongoose.Types.ObjectId,
  vehicleData: IUser['vehicle']
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  if (user.userType !== 'rider') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only riders can update vehicle information');
  }
  
  user.vehicle = vehicleData!;
  await user.save();
  
  return user;
};

/**
 * Update rider's preferences
 */
export const updateRidePreferences = async (
  userId: mongoose.Types.ObjectId,
  preferences: IUser['ridePreferences']
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  if (user.userType !== 'rider') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only riders can update ride preferences');
  }
  
  user.ridePreferences = preferences!;
  await user.save();
  
  return user;
};

/**
 * Update rider rating
 */
export const updateRiderRating = async (
  userId: mongoose.Types.ObjectId,
  newRating: number
): Promise<IUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Calculate new average rating
  const totalRatings = user.totalRides || 0;
  const currentAvg = user.avgRating || 0;
  const newAvg = totalRatings === 0 
    ? newRating 
    : ((currentAvg * totalRatings) + newRating) / (totalRatings + 1);
  
  user.avgRating = Math.round(newAvg * 10) / 10; // Round to 1 decimal
  await user.save();
  
  return user;
};

/**
 * Increment rider's trip count
 */
export const incrementTripCount = async (
  userId: mongoose.Types.ObjectId,
  type: 'ride' | 'post'
): Promise<void> => {
  const update = type === 'ride' 
    ? { $inc: { totalRides: 1 } }
    : { $inc: { totalTripsPosted: 1 } };
  
  await User.findByIdAndUpdate(userId, update);
};

// ============================================
// VERIFICATION
// ============================================

/**
 * Verify user's driver license
 */
export const verifyDriversLicense = async (
  userId: mongoose.Types.ObjectId,
  isVerified: boolean
): Promise<IUserDoc | null> => {
  return User.findByIdAndUpdate(
    userId,
    {
      'driversLicense.isVerified': isVerified,
      isDriverVerified: isVerified,
    },
    { new: true }
  );
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (user: IUserDoc): Promise<void> => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user, user.email!);
  await emailService.sendVerificationEmail(user.email!, verifyEmailToken, user.firstName, user);
};

/**
 * Resend verification email
 */
export const resendEmailLink = async (user: IUserDoc): Promise<void> => {
  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is already verified');
  }
  await sendVerificationEmail(user);
};

// ============================================
// SECURITY FUNCTIONS
// ============================================

/**
 * Temporarily block user for 24 hours after brute force login attempts
 */
export const temporaryBlockFor24AfterBruteForceLogin = async (
  userId: mongoose.Types.ObjectId
): Promise<IUserDoc | null> => {
  const blockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  return User.findByIdAndUpdate(
    userId,
    {
      isTemporaryBlocked: true,
      temporaryBlockedTill: blockUntil,
    },
    { new: true }
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get filters for user listing
 */
export const getFilters = async (): Promise<{ userTypes: string[] }> => {
  return {
    userTypes: ['admin', 'rider'],
  };
};

/**
 * Check if user can perform action on target user
 */
export const canPerformAction = async (
  actor: IUserDoc,
  targetUserId: mongoose.Types.ObjectId,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> => {
  // Admins can do everything
  if (actor.userType === 'admin') {
    // Super admins can edit other admins
    if (actor.isSuperAdmin) return true;
    
    // Regular admins cannot edit other admins
    const target = await getUserById(targetUserId);
    if (target?.userType === 'admin') return false;
    
    return true;
  }
  
  // Users can only view/edit themselves
  return actor._id.equals(targetUserId) && action !== 'delete';
};

/**
 * Get owner ID for logging purposes
 */
export const getOwnerIdByUserId = async (
  userId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId | null> => {
  // In Faisal Ride, the owner is the user themselves for riders
  // For admins, there's no owner concept
  const user = await getUserById(userId);
  if (!user) return null;
  
  return user._id;
};

/**
 * Get user by Stripe customer ID
 */
export const getUserByStripeCustomerId = async (
  stripeCustomerId: string
): Promise<IUserDoc | null> => {
  return User.findOne({ stripeCustomerId, isDeleted: { $ne: true } });
};
