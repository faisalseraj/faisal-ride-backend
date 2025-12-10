import { NextFunction, Request, Response } from 'express';

import ApiError from '../errors/ApiError';
import { Constants } from '../utils/Constants';
import { IUserDoc } from '../user/user.interfaces';
import config from '../../config/config';
import { getCachedRolePermissions } from '../roles/role-permissions-cache';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import passport from 'passport';

const verifyCallback =
  (req: Request, resolve: any, reject: any, requiredRights: string[]) =>
  async (err: Error, user: IUserDoc, info: string) => {
    if (err || info || !user) {
      return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }

    const isImpersonated = req.headers['x-impersonated'];
    const impersonatedBy = req.headers['x-impersonated-by'] as string;
    if (isImpersonated && !impersonatedBy) {
      return reject(
        new ApiError(httpStatus.BAD_REQUEST, 'SOme thing went wrong in impersonation. Try logout and then retry.')
      );
    }
    if (isImpersonated && new mongoose.Types.ObjectId(user.id) === new mongoose.Types.ObjectId(impersonatedBy!)) {
      return reject(
        new ApiError(
          httpStatus.BAD_REQUEST,
          'It is not good to update the phone number or email of the user. User can loss access to their account'
        )
      );
    }
    req.user = user;

    if (requiredRights.length) {
      // Get user permissions from cache (which uses database-backed roles)
      const userRights = await getCachedRolePermissions(user.userType);
      if (!userRights || userRights.length === 0) {
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
      }
      const hasRequiredRights = requiredRights.every((requiredRight: string) => userRights.includes(requiredRight));
      if (user.isSuspended) {
        return reject(
          new ApiError(
            httpStatus.UNAUTHORIZED,
            'Your account is suspended please contact support or your respective manager'
          )
        );
      }

      if (user.isArchived) {
        return reject(
          new ApiError(httpStatus.UNAUTHORIZED, 'Your account is archived please contact support or your respective manager')
        );
      }
      if (!user.isVerified && (config.serverType !== Constants.demoServer && config.serverType !== Constants.localServer)) {
        return reject(
          new ApiError(
            httpStatus.UNAUTHORIZED,
            'Your email is not verified. Please check your inbox for verification email or try reset password functionality to activate your acccount.'
          )
        );
      }

      if (user.isDeleted) {
        return reject(
          new ApiError(
            httpStatus.NOT_FOUND,
            'Your account is not found. Please ensure your account is active or contact support for assistance.'
          )
        );
      }
      if (!hasRequiredRights && req.params['userId'] !== user.id) {
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
      }
    }

    resolve();
  };

const authMiddleware =
  (...requiredRights: string[]) =>
  async (req: Request, res: Response, next: NextFunction) =>
    new Promise<void>((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => {
        // console.log('everything is fine here')
        return next();
      })
      .catch((err) => {
        // console.log('something went wrong hereeee')

        return next(err);
      });

export const checkSuperadmin = (req: Request, _: Response, next: NextFunction) => {
  // Assumes req.user is set by auth middleware
  if (req.user?.userType !== 'admin' && !req.user?.isSuperAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Access denied. Superadmin only.');
  }

  next();
};

export default authMiddleware;
