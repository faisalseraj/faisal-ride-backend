import { IUserDoc } from './modules/user/user.interfaces';

declare global {
  const fetch: typeof globalThis.fetch;
}

declare module 'express-serve-static-core' {
  export interface Request {
    user: IUserDoc;
  }
}
