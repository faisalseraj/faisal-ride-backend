import { INewUserDoc, NewNewCreatedUser } from './new-user.interfaces';
import { IOptions, QueryResult } from '../paginate/paginate';
import { newUserApprovalDecision, sendApprovalRequestToAdminForNewAccount } from '../email/email.service';

import { ApiError } from '../errors';
import { IUserDoc } from '../user/user.interfaces';
import User from './new-user.model';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { userService } from '../user';

// import { SortOrder, sortArrayOfObjectsByKey } from '../utils/sortUtil';

// import { getSignedUrl } from '../upload/upload.service';
// import { orderService } from '../order';
// import { reviewService } from '../review';

// import fetch from 'node-fetch';
// import { formatExistingBusinessesToNewBusinesses } from './business.util';

// import fetch from 'node-fetch';
// import { formatExistingBusinessesToNewBusinesses } from './business.util';

/**
 * Generates a reset password token and sends a new account email to the user.
 * Also generates authentication tokens for the user.
 *
 * @param {IUserDoc} user - The user document containing user details.
 * @param {string} [exposedPassword] - An optional parameter for the exposed user password.
 * @returns {Promise<{ user: IUserDoc, tokens: AccessAndRefreshTokens }>} - A promise that resolves to an object containing the user and their auth tokens.
 */

export const createUserHelper = async (user: INewUserDoc) => {
  return {
    user,
  };
};

/**
 * Create a user
 * @param {NewCreatedUser} userBody
 * @returns {Promise<IUserDoc>}
 */
export const createUser = async (userBodyToCreate: NewNewCreatedUser, loggedInUser: IUserDoc): Promise<INewUserDoc> => {
  const userBody: any = userBodyToCreate;

  userBody.email = userBody.email.toLowerCase();
  const userByEmail = await userService.getUserByEmail(userBody.email!);
  const newUserByEmail = await User.find({ email: userBody.email });

  if (userByEmail || newUserByEmail.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another Email');
  }
  const admins = await userService.getAllAdmins();
  const user = await User.create({
    ...userBody,
    requestCreatedBy: loggedInUser._id,
    passkey: userBody.passkey,
    company: {
      companyName: userBody.companyName,
    },
    towCompanyId: loggedInUser?.userType === 'tow-company-owner' ? loggedInUser._id : loggedInUser.towCompanyId.toString(),
  });

  const emailContent: {
    requesterName: string;
    requesterEmail: string;
    newUserName: string;
    newUserEmail: string;
    newUserType: string;
  } = {
    requesterEmail: loggedInUser.email!,
    requesterName: loggedInUser.fullName!,
    newUserName: user.fullName!,
    newUserEmail: user.email!,
    newUserType: user.userType,
  };

  Promise.all(
    admins.map((admin) => sendApprovalRequestToAdminForNewAccount(admin.email!, admin.fullName!, user, emailContent))
  );
  // if (await User.isEmailTaken(userBody.email!)) {
  //   throw new ApiError(httpStatus.BAD_REQUEST, 'Email already registered. Try another Email');
  // }
  return user;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const queryUsers = async (filter: Record<string, any>, options: IOptions): Promise<QueryResult> => {
  const users = await User.paginate(
    { ...filter, userType: filter['userType'] ?? { $ne: 'admin' }, isDeleted: { $ne: true } },
    {
      ...options,
    }
  );

  return {
    ...users,
  };
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<IUserDoc>}
 */
export const getUserById = async (id: mongoose.Types.ObjectId): Promise<INewUserDoc> => {
  const user = await User.findById(new mongoose.Types.ObjectId(id));
  if (!user) {
    throw new ApiError(
      httpStatus.NO_CONTENT,
      'The user you are trying to approve/reject is not found. An action may have been performed by other admin related to approval or rejection.'
    );
  }

  return user;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<IUserDoc>}
 */
export const getUserEmail = async (email: string): Promise<INewUserDoc | null> => {
  const user = await User.findOne({ email });

  return user;
};

/**
 * Approve or reject a user
 * @param {ObjectId} id
 * @param {string} status
 * @returns {Promise<void>}
 */
export const approveRejectUser = async (
  id: mongoose.Types.ObjectId,
  status: 'approved' | 'rejected',
  comments?: string,
  loggedInUser?: IUserDoc
): Promise<any> => {
  let migratedUser: any;
  const user = await getUserById(new mongoose.Types.ObjectId(id));
  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'The user you are trying to approve/reject is not found. An action may have been performed by other admin related to approval or rejection.'
    );
  }

  const requesterInfo = await userService.getUserById(new mongoose.Types.ObjectId(user.requestCreatedBy));
  if (status === 'rejected') {
    migratedUser = await User.findByIdAndDelete(new mongoose.Types.ObjectId(id));

    return;
  }

  if (status === 'approved') {
    const newuser = await userService.createUserWithType(
      {
        userType: 'parking-spaces-provider-owner',
        firstName: user.firstName!,
        lastName: user.lastName!,
        email: user.email!,
        phoneNumber: user.phoneNumber!,
        towCompanyId: user.towCompanyId,
        isPaidParkingSpaceProvider: false,
        companyName: user.company.companyName,
        passkey: user.passkey || '',
      },
      loggedInUser!,
      user.id
    );
    migratedUser = newuser;

    if (!(newuser as any)?.id || !(newuser as any)?._id) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'Unable to create the user at this moment. Please try again later.'
      );
    }
    await User.findByIdAndDelete(new mongoose.Types.ObjectId(id));
  }
  if (user.userType === 'parking-spaces-provider-owner') {
    newUserApprovalDecision(
      requesterInfo?.email!,
      requesterInfo?.fullName!,
      requesterInfo!,
      {
        toUpdateUser: migratedUser,
        requestCreatedBy: requesterInfo!,
        comments: comments!,
      },
      status
    );
  }
  return migratedUser;
};

/**
 * Delete user by id
 * @param {ObjectId} id
 * @returns {Promise<void>}
 */
export const deleteUserById = async (id: mongoose.Types.ObjectId): Promise<void> => {
  await User.findByIdAndDelete(id);
};
