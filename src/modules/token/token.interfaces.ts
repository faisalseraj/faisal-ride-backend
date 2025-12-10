import { Document, Model } from 'mongoose';

import { JwtPayload } from 'jsonwebtoken';

export interface IToken {
  token: string;
  user: string;
  type: string;
  expires: string;
  blacklisted: boolean;
  attempts: number;
  additionalInfo: any;
  createdAt?: string;
}

export type NewToken = Omit<IToken, 'blacklisted'>;

export interface ITokenDoc extends IToken, Document {}

export interface ITokenModel extends Model<ITokenDoc> {}

export interface IPayload extends JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  type: string;
}

export interface TokenPayload {
  token: string;
  expires: string;
}

export interface AccessAndRefreshTokens {
  access: TokenPayload;
  refresh: TokenPayload;
}
