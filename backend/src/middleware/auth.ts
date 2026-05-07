import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { unauthorized, forbidden } from '../utils/response';
import { UserRole } from '@prisma/client';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return unauthorized(res);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as AuthPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, passwordChangedAt: true },
    });

    if (!user || user.status !== 'ACTIVE') return unauthorized(res, 'Account is not active');

    req.user = payload;
    next();
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }
}

export function authorize(...roles: (UserRole | string)[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return unauthorized(res);
    if (roles.length && !roles.includes(req.user.role)) {
      return forbidden(res, 'Insufficient permissions');
    }
    next();
  };
}
