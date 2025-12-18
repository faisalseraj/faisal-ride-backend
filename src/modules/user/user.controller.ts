/**
 * Faisal Ride - User Controller
 * Simplified endpoints for carpooling application
 */

import * as userService from './user.service';

import { Request, Response } from 'express';

import { ALL_EVENTS } from '../utils/events';
import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
import { IOptions } from '../paginate/paginate';
import { IUserDoc } from './user.interfaces';
import { Message } from '../utils/errorMessage';
import { authService } from '../auth';
import catchAsync from '../utils/catchAsync';
import config from '../../config/config';
import httpStatus from 'http-status';
import { localesFullForm } from '../auth/auth.helper';
import { logService } from '../logs';
import mongoose from 'mongoose';
import { otpService } from '../otp';
import pick from '../utils/pick';
import { tokenService } from '../token';

// ============================================
// USER CREATION
// ============================================

/**
 * Public registration endpoint (self-registration)
 * Allows users to sign up with minimal info (email/password) and complete profile later
 */
export const registerUser = catchAsync(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, phoneNumber, userType } = req.body;
  
  // Default to 'rider' if userType not provided
  const finalUserType = userType || 'rider';
  
  // Create user with minimal required fields
  // phoneNumber is optional - users can add it later in their profile
  const userData: any = {
    email,
    password,
    userType: finalUserType,
    isDefaultPassword: false,
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(phoneNumber && { phoneNumber }),
  };
  
  const user = await userService.createRider(userData);
  const userHelper = await userService.createUserHelper(user);
  
  res.status(httpStatus.CREATED).send(userHelper);
});

/**
 * Create a new user (admin only)
 */
export const createUser = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can create users');
  }
  
  const user = await userService.createUser(req.body);
  const userHelper = await userService.createUserHelper(user);
  
  res.status(httpStatus.CREATED).send(userHelper);
});

/**
 * Create admin user (super admin only)
 */
export const createAdmin = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only super admin can create admin users');
  }
  
  const user = await userService.createAdmin(req.body, loggedInUser);
  
  await logService.logAdmin(loggedInUser, `Created new admin user: ${user.fullName}`, {
    metadata: { action: 'create_admin', affectedUser: user.id },
  });
  
  res.status(httpStatus.CREATED).send({ user });
});

// ============================================
// USER RETRIEVAL
// ============================================

/**
 * Get all users with pagination (admin only)
 */
export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can list all users');
  }
  
  const filter = pick(req.query, ['userType', 'isVerified', 'isSuspended', 'isArchived', 'city']);
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page', 'projectBy']);
  const search = pick(req.query, ['search']);
  
  // Add search functionality
  if (search.search) {
    const searchTerm = decodeURIComponent(search.search);
    (filter as any).$or = [
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } },
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phoneNumber: { $regex: searchTerm, $options: 'i' } },
    ];
  }
  
  const result = await userService.queryUsers(filter, options);
  
  res.send(result);
});

/**
 * Get all riders (for trip matching)
 */
export const getRiders = catchAsync(async (req: Request, res: Response) => {
  const filter = { userType: 'rider', ...pick(req.query, ['city', 'isDriverVerified']) };
  const options: IOptions = pick(req.query, ['sortBy', 'limit', 'page']);
  
  const result = await userService.queryUsers(filter, options);
  
  res.send(result);
});

/**
 * Get user by ID
 */
export const getUser = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const userId = new mongoose.Types.ObjectId(req.params['userId']);
  
  // Check permissions
  const canView = await userService.canPerformAction(loggedInUser, userId, 'view');
  if (!canView) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to view this user');
  }
  
  const user = await userService.getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  res.send(user);
});

/**
 * Get current user (self)
 */
export const getSelf = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  const user = await userService.getUserById(loggedInUser._id);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // Remove sensitive fields
  const userObj = user.toObject();
  delete (userObj as any).password;
  
  res.send(userObj);
});

/**
 * Get all admins (super admin only)
 */
export const getAllAdmins = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  const admins = await userService.getAllAdmins(loggedInUser);
  
  res.send({ results: admins });
});

/**
 * Search users
 */
export const searchUsers = catchAsync(async (req: Request, res: Response) => {
  const { q, userType, city } = req.query;
  
  const users = await userService.searchUsers({
    searchTerm: decodeURIComponent((q as string) || ''),
    userType: userType as any,
    city: city as string,
  });
  
  res.send(users);
});

/**
 * Get available filters
 */
export const getFilters = catchAsync(async (_: Request, res: Response) => {
  const filters = await userService.getFilters();
  res.send(filters);
});

// ============================================
// USER UPDATE
// ============================================

/**
 * Update user by ID (admin only)
 */
export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const userId = new mongoose.Types.ObjectId(req.params['userId']);
  
  // Check permissions
  const canEdit = await userService.canPerformAction(loggedInUser, userId, 'edit');
  if (!canEdit) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to edit this user');
  }
  
  const user = await userService.updateUserById(userId, req.body);
  
  await logService.logAdmin(loggedInUser, `Updated user: ${user?.fullName}`, {
    metadata: {
      action: 'update_user',
      affectedUser: userId.toString(),
      updatedFields: Object.keys(req.body),
    },
  });
  
  res.send(user);
});

/**
 * Update current user's profile
 */
export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  const user = await userService.updateProfile(loggedInUser._id, req.body);
  
  await logService.logUser(loggedInUser, 'User updated their profile');
  
  res.send(user);
});

/**
 * Update current user's profile (V2 - used by self route)
 */
export const updateProfileV2 = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user;
  const updatePayload = pick(req.body, ['firstName', 'lastName', 'phoneNumber', 'bio', 'image', 'dateOfBirth', 'gender', 'address', 'city', 'country', 'preferredLanguage', 'vehicle', 'ridePreferences']);

  const user = await userService.updateProfile(new mongoose.Types.ObjectId(id), updatePayload);
  const loggedInUser = req.user as unknown as IUserDoc;
  
  await logService.logUser(loggedInUser, ALL_EVENTS.UserEvents.updateUser(user as any));

  res.send(user);
});

// ============================================
// EMAIL SET TOKEN VALIDATION
// ============================================

/**
 * Validate email set token
 */
export const validateEmailSetToken = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], 'english');

    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User Does not exists');
    }
    if (user.isVerified) {
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified['english'],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }
    res.send({ valid: true });
  }
});

/**
 * Validate email set token before phone OTP
 */
export const validateEmailSetTokenPrePhoneOTP = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const validatedToken = await tokenService.validateEmailSetTokenPrePhoneOTP(req.params['token'], 'english');

    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User Does not exists');
    }
    if (user.isVerified) {
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified['english'],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }

    const verificationTokenDetails = await tokenService.getLatestVerificationLink(user?._id);
    if (verificationTokenDetails?.user) {
      res.send({ valid: true, verificationLinkSent: true });
    } else {
      res.send({ valid: true });
    }
  }
});

/**
 * Request OTPs for email set (phone and email OTPs)
 */
export const requestOTPSforEmailSet = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const { language = 'en' } = req.body;
    const languageFullForm = (localesFullForm as any)[language];
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], languageFullForm);
    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));
    if (!user) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        Message.business.userDoesntExist[languageFullForm],
        true,
        '',
        Message.business.userDoesntExist['english']
      );
    }

    if (user.isVerified) {
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified[languageFullForm],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }
    const { email } = req.body;
    const emailOTP = await authService.requestEmailSetOTPInEmail(email, user.firstName, user.id, user, languageFullForm);

    const phoneOtp = await authService.requestSetEmailPhoneVerification(user.phoneNumber!, user.fullName!, user._id!, user);
    await logService.logUser(user, ALL_EVENTS.UserEvents.requestedOtpForEmailSet, {
      metadata: {
        action: 'otp_request',
        type: 'email_set',
      },
    });

    res.send({
      code: 200,
      message: `${Message.business.otpsSentMessage[languageFullForm]}  ${
        config.serverType === Constants.productionServer ? '' : `phone: ${phoneOtp}, email: ${emailOTP}`
      }`,
    });
  }
});

/**
 * Set email after verifying OTPs
 */
export const setEmail = catchAsync(async (req: Request, res: Response) => {
  if (typeof req.params['token'] === 'string') {
    const { language = 'en' } = req.body;
    const languageFullForm = (localesFullForm as any)[language];
    const validatedToken = await tokenService.validateEmailSetToken(req.params['token'], languageFullForm);
    const user = await userService.getUserById(new mongoose.Types.ObjectId(validatedToken.user));
    if (!user) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        Message.business.userDoesntExist[languageFullForm],
        true,
        '',
        Message.business.userDoesntExist['english']
      );
    }

    if (user.isVerified) {
      throw new ApiError(
        200,
        Message.partnerAuth.accountAlreadyVerified[languageFullForm],
        true,
        '',
        Message.partnerAuth.accountAlreadyVerified['english']
      );
    }

    const { email, phoneOtp, emailOtp } = req.body;
    const isEmailOTPValid = await otpService.verifyPhoneTokenOtp(email, emailOtp, 'setEmail');

    const isPhoneOTPValid = await otpService.verifyPhoneTokenOtp(user.phoneNumber!, phoneOtp, 'setEmailPhoneVerification');
    if (isEmailOTPValid && isPhoneOTPValid) {
      await userService.updateUserById(user._id, { isVerified: true, email, isSuspended: false });

      await tokenService.inValidateEmailSetToken(req.params['token']);
    } else {
      await tokenService.decreaseTokenAttempt(req.params['token']);

      throw new ApiError(
        httpStatus.BAD_REQUEST,
        Message.business.invalidOTPProcessFailed[languageFullForm],
        true,
        '',
        Message.business.invalidOTPProcessFailed['english']
      );
    }

    await logService.logUser(user, ALL_EVENTS.UserEvents.emailSetupSuccessful?.replace('<user>', `${user?.fullName}`).replace('<email>', email) || 'Email setup successful');

    res.send({
      code: 200,
      message: Message.partnerAuth.emailVerified[languageFullForm],
      error: Message.partnerAuth.emailVerified['english'],
    });
  }
});

/**
 * Update user status (suspend/archive)
 */
export const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const userId = new mongoose.Types.ObjectId(req.params['userId']);
  
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can update user status');
  }
  
  // Prevent self-suspension
  if (loggedInUser._id.equals(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot suspend/archive your own account');
  }
  
  const updateBody = pick(req.body, ['isSuspended', 'isArchived', 'suspendReason', 'archiveReason']);
  const user = await userService.updateUserStatus(userId, updateBody);
  
  await logService.logAdmin(loggedInUser, `Updated user status: ${user?.fullName}`, {
    metadata: {
      action: 'update_status',
      affectedUser: userId.toString(),
      ...updateBody,
    },
  });
  
  res.send(user);
});

/**
 * Update super admin status (super admin only)
 */
export const updateSuperAdmin = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'admin' || !loggedInUser.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only super admin can update super admin status');
  }
  
  const user = await userService.updateSuperAdmin({
    userId: req.params['userId']!,
    isSuperAdmin: req.body.isSuperAdmin,
  });
  
  await logService.logAdmin(loggedInUser, `Updated super admin status for: ${user.fullName}`, {
    metadata: { affectedUser: user.id },
  });
  
  res.send({ message: 'Super admin status updated successfully' });
});

/**
 * Sync user location
 */
export const syncLocation = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  // Validate location data
  if (!req.body.location || typeof req.body.location.latitude !== 'number' || typeof req.body.location.longitude !== 'number') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid location data. Latitude and longitude must be numbers.');
  }
  
  // Validate latitude range (-90 to 90)
  if (req.body.location.latitude < -90 || req.body.location.latitude > 90) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid latitude. Must be between -90 and 90.');
  }
  
  // Validate longitude range (-180 to 180)
  if (req.body.location.longitude < -180 || req.body.location.longitude > 180) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid longitude. Must be between -180 and 180.');
  }
  
  const updatedUser = await userService.syncLocation(loggedInUser.id, req.body.location);
  
  res.status(httpStatus.OK).send({ 
    message: 'Location updated successfully',
    user: updatedUser 
  });
});

// ============================================
// RIDER SPECIFIC
// ============================================

/**
 * Update vehicle information
 */
export const updateVehicle = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'rider') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only riders can update vehicle information');
  }
  
  const user = await userService.updateVehicle(loggedInUser._id, req.body);
  
  res.send(user);
});

/**
 * Update ride preferences
 */
export const updateRidePreferences = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  
  if (loggedInUser.userType !== 'rider') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only riders can update ride preferences');
  }
  
  const user = await userService.updateRidePreferences(loggedInUser._id, req.body);
  
  res.send(user);
});

// ============================================
// USER DELETION
// ============================================

/**
 * Delete user by ID (admin only)
 */
export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const userId = new mongoose.Types.ObjectId(req.params['userId']);
  
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can delete users');
  }
  
  // Prevent self-deletion
  if (loggedInUser._id.equals(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot delete your own account');
  }
  
  await userService.deleteUserById(userId);
  
  await logService.logAdmin(loggedInUser, `Deleted user with ID: ${userId}`, {
    metadata: { action: 'delete_user', affectedUser: userId.toString() },
  });
  
  res.status(httpStatus.NO_CONTENT).send();
});

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Mark notification as read
 */
export const markNotificationAsRead = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const notificationId = new mongoose.Types.ObjectId(req.params['notificationId']);
  
  const user = await userService.markNotificationAsRead(loggedInUser._id, notificationId);
  
  res.send(user);
});

/**
 * Delete notification
 */
export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const notificationId = new mongoose.Types.ObjectId(req.params['notificationId']);
  
  const user = await userService.deleteNotification(loggedInUser._id, notificationId);
  
  res.send(user);
});

// ============================================
// VERIFICATION
// ============================================

/**
 * Resend verification email
 */
export const resendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  
  const user = await userService.getUserById(new mongoose.Types.ObjectId(userId));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is already verified');
  }
  
  await userService.resendEmailLink(user);
  
  res.send({ message: 'Verification email sent' });
});

/**
 * Verify driver's license (admin only)
 */
export const verifyDriversLicense = catchAsync(async (req: Request, res: Response) => {
  const loggedInUser = req.user as IUserDoc;
  const userId = new mongoose.Types.ObjectId(req.params['userId']);
  
  if (loggedInUser.userType !== 'admin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can verify driver licenses');
  }
  
  const user = await userService.verifyDriversLicense(userId, req.body.isVerified);
  
  await logService.logAdmin(loggedInUser, `${req.body.isVerified ? 'Verified' : 'Unverified'} driver's license for: ${user?.fullName}`, {
    metadata: { action: 'verify_license', affectedUser: userId.toString(), isVerified: req.body.isVerified },
  });
  
  res.send(user);
});
