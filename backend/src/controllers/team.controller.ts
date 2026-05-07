import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

export async function listUsers(req: AuthRequest, res: Response) {
  const { page = '1', limit = '20', role, status } = req.query as Record<string, string>;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    ...(role && { role }),
    ...(status && { status }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: Number(limit),
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatar: true, role: true, status: true,
        lastLoginAt: true, createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return R.paginated(res, users, total, Number(page), Number(limit));
}

export async function inviteUser(req: AuthRequest, res: Response) {
  const { email, firstName, lastName, role, phone } = req.body;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return R.conflict(res, 'User already exists');

  const tempPassword = Math.random().toString(36).slice(2, 10) + 'Aa1!';
  const hashed = await bcrypt.hash(tempPassword, Number(process.env.BCRYPT_ROUNDS) || 12);

  const user = await prisma.user.create({
    data: {
      organisationId: req.user!.orgId,
      email,
      firstName,
      lastName,
      phone,
      role,
      password: hashed,
      status: 'ACTIVE',
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  return R.created(res, { user, tempPassword }, 'User invited — share temporary password securely');
}

export async function updateUser(req: AuthRequest, res: Response) {
  const { role, status, phone, avatar } = req.body;

  const user = await prisma.user.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!user) return R.notFound(res, 'User not found');

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { role, status, phone, avatar },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true },
  });

  return R.ok(res, updated);
}

export async function getProductivityStats(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;
  const { period = '30' } = req.query as Record<string, string>;
  const since = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { organisationId: orgId, status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, avatar: true },
  });

  const stats = await Promise.all(
    users.map(async (user) => {
      const [completed, assigned, hours] = await Promise.all([
        prisma.task.count({ where: { assigneeId: user.id, status: 'COMPLETED', completedAt: { gte: since } } }),
        prisma.task.count({ where: { assigneeId: user.id, status: { not: 'CANCELLED' } } }),
        prisma.timesheet.aggregate({
          where: { userId: user.id, date: { gte: since } },
          _sum: { hoursWorked: true },
        }),
      ]);

      return {
        user,
        completedTasks: completed,
        assignedTasks: assigned,
        hoursLogged: Number(hours._sum.hoursWorked || 0),
        completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      };
    }),
  );

  return R.ok(res, stats);
}
