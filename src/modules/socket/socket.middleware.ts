// import httpStatus from 'http-status';
// import passport from 'passport';

// import { ApiError } from '../errors';
// import { IPayload } from '../token/token.interfaces';
// import { roleRights } from '../../config/roles';
// import ApiError from '../errors/ApiError';
// import { IUserDoc } from '../user/user.interfaces';
// import mongoose from 'mongoose';
import { Socket } from 'socket.io';
const socketMiddleware =
  (...requiredRights: string[]) =>
  async (sock: Socket, next: (err?: any) => void) =>
    new Promise<void>(async (resolve, reject) => {
      const socket = sock as unknown as Socket & { handshake: { user: any } };
      console.log(requiredRights);
      resolve();
      if (socket.handshake?.headers?.authorization) {
        // throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized')
        reject();
      }
    })
      .then(() => {
        // console.log('everything is fine here')
        return next();
      })
      .catch((err) => {
        // console.log('something went wrong hereeee')
        return next(err);
      });

export default socketMiddleware;
