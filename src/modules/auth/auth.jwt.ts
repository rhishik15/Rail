import { UserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
};

const isAuthTokenPayload = (payload: string | JwtPayload): payload is JwtPayload & AuthTokenPayload =>
  typeof payload !== 'string' &&
  typeof payload.userId === 'string' &&
  typeof payload.role === 'string';

export const signAuthToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, getJwtSecret());

  if (!isAuthTokenPayload(decoded)) {
    throw new Error('Invalid token payload');
  }

  return {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };
};
