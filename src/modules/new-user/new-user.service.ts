/**
 * Faisal Ride - New User Service
 * Simplified user registration queue for carpooling application
 */

import { INewUserDoc, NewNewCreatedUser } from './new-user.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';

import { ApiError } from '../errors';
import { IUserDoc } from '../user/user.interfaces';
import User from './new-user.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { userService } from '../user';

/**
 * Create user helper
 */
export const createUserHelper = async (user: INewUserDoc) => {
  return { user };
};

/**
 * Create a pending user registration
 */
export const createUser = async (
  userBodyToCreate: NewNewCreatedUser,
  loggedInUser: IUserDoc
): Promise<INewUserDoc> => {
  const userBody: any = userBodyToCreate;

  userBody.email = userBody.email.toLowerCase();
  const userByEmail = await userService.getUserByEmail(userBody.email!);
  const newUserByEmail = await User.find({ email: userBody.email });

  if (userByEmail || newUserByEmail.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another email.');
  }

  const user = await User.create({
    ...userBody,
    requestCreatedBy: loggedInUser._id,
  });

  return user;
};

/**
 * Query for pending users
 */
export const queryUsers = async (
  filter: Record<string, any>,
  options: IOptions
): Promise<QueryResult> => {
  const users = await User.paginate(
    { ...filter, isDeleted: { $ne: true } },
    options
  );

  return users;
};

/**
 * Get user by id
 */
export const getUserById = async (id: mongoose.Types.ObjectId): Promise<INewUserDoc> => {
  const user = await User.findById(new mongoose.Types.ObjectId(id));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

/**
 * Get user by email
 */
export const getUserEmail = async (email: string): Promise<INewUserDoc | null> => {
  return User.findOne({ email });
};

/**
 * Approve or reject a pending user registration
 */
export const approveRejectUser = async (
  id: mongoose.Types.ObjectId,
  status: 'approved' | 'rejected',
  _comments?: string, // Prefixed with _ to indicate intentionally unused
  _loggedInUser?: IUserDoc // Prefixed with _ to indicate intentionally unused
): Promise<any> => {
  const user = await getUserById(new mongoose.Types.ObjectId(id));
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (status === 'rejected') {
    await User.findByIdAndDelete(new mongoose.Types.ObjectId(id));
    return { status: 'rejected', message: 'User registration rejected' };
  }

  if (status === 'approved') {
    // Create the actual user
    const newUser = await userService.createUser({
      userType: 'rider',
      firstName: user.firstName!,
      lastName: user.lastName!,
      email: user.email!,
      phoneNumber: user.phoneNumber!,
      password: 'TemporaryPassword123!', // Will be reset via email
      isVerified: false,
      loggedInDevices: [],
      notifications: [],
    });

    // Delete from pending queue
    await User.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    // Send password reset email
    await userService.createUserHelper(newUser);

    return { status: 'approved', user: newUser };
  }

  return { status: 'unknown' };
};

/**
 * Delete a pending user registration
 */
export const deleteUserById = async (userId: mongoose.Types.ObjectId): Promise<INewUserDoc | null> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.deleteOne();
  return user;
};
