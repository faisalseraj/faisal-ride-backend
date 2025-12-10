import { NextFunction, Request, Response } from 'express';

import passport from 'passport';

const verifyCallback = (req: Request, next: NextFunction) => async (_: Error, user: any, __: string | undefined) => {
  if (user) {
    req.user = user;
  }
  // Proceed to next middleware regardless of JWT presence or errors
  return next();
};

const authOptionalMiddleware = () => (req: Request, res: Response, next: NextFunction) => {
  // Here we adjust the passport.authenticate call to correctly format arguments
  passport.authenticate('jwt', { session: false, failWithError: false }, verifyCallback(req, next))(req, res, next);
};

export default authOptionalMiddleware;
