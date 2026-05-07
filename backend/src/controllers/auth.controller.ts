import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { generateOtp, generateSecureToken } from '../services/encryption.service';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET || 'refresh_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

function signTokens(userId: string, email: string, role: UserRole, orgId: string) {
  const payload = { userId, email, role, orgId };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, JWT_REFRESH, { expiresIn: JWT_REFRESH_EXPIRES } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response) {
  const { orgName, email, password, firstName, lastName, phone } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return R.conflict(res, 'Email already registered');

  const org = await prisma.organisation.create({
    data: { name: orgName, email },
  });

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      organisationId: org.id,
      email,
      password: hashed,
      firstName,
      lastName,
      phone,
      role: UserRole.SUPER_ADMIN,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  const { accessToken, refreshToken } = signTokens(user.id, user.email, user.role, org.id);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return R.created(res, { user, accessToken, refreshToken }, 'Organisation registered');
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { organisation: { select: { id: true, name: true } } },
  });

  if (!user) return R.unauthorized(res, 'Invalid credentials');
  if (user.status !== 'ACTIVE') return R.unauthorized(res, 'Account suspended');

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return R.unauthorized(res, `Account locked until ${user.lockedUntil.toISOString()}`);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    const failCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failCount,
        lockedUntil: failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });
    return R.unauthorized(res, 'Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: req.ip, failedLoginCount: 0, lockedUntil: null },
  });

  const { accessToken, refreshToken } = signTokens(user.id, user.email, user.role, user.organisationId);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshToken,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const { password: _p, ...safeUser } = user;
  return R.ok(res, { user: safeUser, accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  if (!refreshToken) return R.unauthorized(res);

  const session = await prisma.userSession.findUnique({ where: { refreshToken }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return R.unauthorized(res, 'Session expired');

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH) as { userId: string; email: string; role: UserRole; orgId: string };
    const { accessToken, refreshToken: newRefresh } = signTokens(payload.userId, payload.email, payload.role, payload.orgId);

    await prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: newRefresh, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    return R.ok(res, { accessToken, refreshToken: newRefresh });
  } catch {
    return R.unauthorized(res, 'Invalid refresh token');
  }
}

export async function logout(req: AuthRequest, res: Response) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.userSession.deleteMany({ where: { refreshToken } });
  }
  return R.noContent(res);
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, avatar: true, role: true, status: true,
      twoFactorEnabled: true, lastLoginAt: true, preferences: true,
      organisation: { select: { id: true, name: true, logo: true } },
    },
  });

  if (!user) return R.notFound(res);
  return R.ok(res, user);
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return R.notFound(res);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return R.badRequest(res, 'Current password is incorrect');

  const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, passwordChangedAt: new Date() },
  });

  return R.ok(res, null, 'Password changed successfully');
}
