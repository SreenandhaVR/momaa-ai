import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { ApiError } from './errors.js';

export interface AuthenticatedUser {
  userId: string;
  parentId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

interface TokenPayload extends JwtPayload {
  sub: string;
  parentId: string;
  tokenType: 'access' | 'refresh';
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required. Configure it in .env.`);
  return value;
}

function signToken(tokenType: TokenPayload['tokenType'], userId: string, parentId: string): string {
  const secret = requiredEnvironmentValue(
    tokenType === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET'
  );
  const expiresIn = (process.env[
    tokenType === 'access' ? 'JWT_ACCESS_EXPIRES_IN' : 'JWT_REFRESH_EXPIRES_IN'
  ] ?? (tokenType === 'access' ? '15m' : '7d')) as SignOptions['expiresIn'];
  return jwt.sign({ sub: userId, parentId, tokenType }, secret, { expiresIn });
}

export function issueTokens(
  userId: string,
  parentId: string
): { accessToken: string; refreshToken: string } {
  return {
    accessToken: signToken('access', userId, parentId),
    refreshToken: signToken('refresh', userId, parentId)
  };
}

function verifyToken(token: string, tokenType: TokenPayload['tokenType']): TokenPayload {
  const secret = requiredEnvironmentValue(
    tokenType === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET'
  );
  try {
    const payload = jwt.verify(token, secret);
    if (
      typeof payload === 'string' ||
      payload.tokenType !== tokenType ||
      typeof payload.sub !== 'string' ||
      typeof payload.parentId !== 'string'
    )
      throw new Error('Invalid token payload.');
    return payload as TokenPayload;
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'The supplied token is invalid or expired.');
  }
}

export function verifyRefreshToken(token: string): AuthenticatedUser {
  const payload = verifyToken(token, 'refresh');
  return { userId: payload.sub, parentId: payload.parentId };
}

export const requireAuth: RequestHandler = (
  request: Request,
  _response: Response,
  next: NextFunction
) => {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer '))
    return next(new ApiError(401, 'UNAUTHORIZED', 'A Bearer access token is required.'));
  const payload = verifyToken(authorization.slice('Bearer '.length), 'access');
  request.auth = { userId: payload.sub, parentId: payload.parentId };
  next();
};
