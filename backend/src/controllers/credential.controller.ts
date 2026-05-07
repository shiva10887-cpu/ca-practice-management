import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { encrypt, decrypt, generateOtp } from '../services/encryption.service';
import { sendEmail } from '../services/notification.service';

export async function listCredentials(req: AuthRequest, res: Response) {
  const { clientId } = req.params;

  const credentials = await prisma.credential.findMany({
    where: { clientId, isActive: true },
    select: {
      id: true, portal: true, otpContactPerson: true, notes: true,
      lastUsedAt: true, lastVerifiedAt: true, isActive: true, createdAt: true,
    },
  });

  return R.ok(res, credentials);
}

export async function createCredential(req: AuthRequest, res: Response) {
  const { clientId, portal, username, password, registeredMobile, registeredEmail, otpContactPerson, notes } = req.body;

  const existing = await prisma.credential.findFirst({ where: { clientId, portal } });
  if (existing) {
    return R.conflict(res, `Credential for ${portal} already exists. Use update instead.`);
  }

  const cred = await prisma.credential.create({
    data: {
      clientId,
      portal,
      usernameEncrypted: encrypt(username),
      passwordEncrypted: encrypt(password),
      registeredMobileEncrypted: registeredMobile ? encrypt(registeredMobile) : null,
      registeredEmailEncrypted: registeredEmail ? encrypt(registeredEmail) : null,
      otpContactPerson,
      notes,
      createdById: req.user!.userId,
    },
    select: { id: true, portal: true, otpContactPerson: true, createdAt: true },
  });

  await prisma.credentialLog.create({
    data: {
      credentialId: cred.id,
      accessedById: req.user!.userId,
      action: 'CREATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.created(res, cred);
}

export async function updateCredential(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { username, password, registeredMobile, registeredEmail, otpContactPerson, notes } = req.body;

  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return R.notFound(res, 'Credential not found');

  await prisma.credential.update({
    where: { id },
    data: {
      ...(username && { usernameEncrypted: encrypt(username) }),
      ...(password && { passwordEncrypted: encrypt(password) }),
      ...(registeredMobile && { registeredMobileEncrypted: encrypt(registeredMobile) }),
      ...(registeredEmail && { registeredEmailEncrypted: encrypt(registeredEmail) }),
      ...(otpContactPerson !== undefined && { otpContactPerson }),
      ...(notes !== undefined && { notes }),
    },
  });

  await prisma.credentialLog.create({
    data: {
      credentialId: id,
      accessedById: req.user!.userId,
      action: 'UPDATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.ok(res, null, 'Credential updated');
}

export async function requestReveal(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.email) return R.badRequest(res, 'User email not found');

  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpRequest.create({
    data: {
      userId: req.user!.userId,
      otp,
      purpose: `REVEAL_CREDENTIAL:${id}`,
      expiresAt,
    },
  });

  await sendEmail({
    to: user.email,
    subject: 'OTP to view credential',
    html: `<p>Your OTP to view credential is: <strong>${otp}</strong><br>Valid for 5 minutes. Do not share.</p>`,
  });

  return R.ok(res, null, 'OTP sent to your registered email');
}

export async function revealCredential(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { otp } = req.body;

  const otpRecord = await prisma.otpRequest.findFirst({
    where: {
      userId: req.user!.userId,
      purpose: `REVEAL_CREDENTIAL:${id}`,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord || otpRecord.otp !== otp) {
    return R.unauthorized(res, 'Invalid or expired OTP');
  }

  await prisma.otpRequest.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });

  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return R.notFound(res, 'Credential not found');

  await prisma.credentialLog.create({
    data: {
      credentialId: id,
      accessedById: req.user!.userId,
      action: 'REVEALED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.ok(res, {
    username: decrypt(cred.usernameEncrypted),
    password: decrypt(cred.passwordEncrypted),
    registeredMobile: cred.registeredMobileEncrypted ? decrypt(cred.registeredMobileEncrypted) : null,
    registeredEmail: cred.registeredEmailEncrypted ? decrypt(cred.registeredEmailEncrypted) : null,
  });
}
