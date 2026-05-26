import { Response } from 'express';
import { Prisma, TaskCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export async function getDashboardStats(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;

  const clients = await prisma.client.findMany({
    where: { organisationId: orgId, isActive: true },
    select: { id: true },
  });
  const clientIds = clients.map((c) => c.id);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [
    totalClients,
    activeClients,
    pendingFilings,
    overdueFilings,
    gstNotices,
    itNotices,
    openTasks,
    overdueTasks,
    totalRevenue,
    outstandingFees,
    runningAutomations,
    failedAutomations,
  ] = await Promise.all([
    prisma.client.count({ where: { organisationId: orgId } }),
    prisma.client.count({ where: { organisationId: orgId, status: 'ACTIVE' } }),
    prisma.complianceRecord.count({ where: { clientId: { in: clientIds }, status: 'PENDING' } }),
    prisma.complianceRecord.count({ where: { clientId: { in: clientIds }, status: 'OVERDUE' } }),
    prisma.notice.count({ where: { clientId: { in: clientIds }, noticeType: { in: ['GST_NOTICE', 'DRC_NOTICE'] }, status: { not: 'CLOSED' } } }),
    prisma.notice.count({ where: { clientId: { in: clientIds }, noticeType: 'IT_NOTICE', status: { not: 'CLOSED' } } }),
    prisma.task.count({ where: { organisationId: orgId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { organisationId: orgId, status: 'OVERDUE' } }),
    prisma.invoice.aggregate({
      where: { organisationId: orgId, issueDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { organisationId: orgId, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      _sum: { totalAmount: true },
    }),
    prisma.automationJob.count({ where: { clientId: { in: clientIds }, status: 'RUNNING' } }),
    prisma.automationJob.count({
      where: { clientId: { in: clientIds }, status: 'FAILED', createdAt: { gte: startOfMonth } },
    }),
  ]);

  return R.ok(res, {
    clients: { total: totalClients, active: activeClients },
    filings: { pending: pendingFilings, overdue: overdueFilings },
    notices: { gst: gstNotices, incomeTax: itNotices, total: gstNotices + itNotices },
    tasks: { open: openTasks, overdue: overdueTasks },
    billing: {
      monthlyRevenue: Number(totalRevenue._sum.totalAmount || 0),
      outstanding: Number(outstandingFees._sum.totalAmount || 0),
    },
    automation: { running: runningAutomations, failed: failedAutomations },
  });
}

export async function getUpcomingDueDates(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;
  const clients = await prisma.client.findMany({ where: { organisationId: orgId }, select: { id: true } });
  const clientIds = clients.map((c) => c.id);

  const upcoming = await prisma.complianceRecord.findMany({
    where: {
      clientId: { in: clientIds },
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      dueDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { dueDate: 'asc' },
    take: 15,
    include: { client: { select: { id: true, legalName: true } } },
  });

  return R.ok(res, upcoming);
}

export async function getActivityTimeline(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;

  const logs = await prisma.activityLog.findMany({
    where: { organisationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { firstName: true, lastName: true, avatar: true } },
      client: { select: { legalName: true } },
    },
  });

  return R.ok(res, logs);
}

export async function getTaskDashboardStats(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;
  const { category } = req.query as Record<string, string>;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const dayAfterTomorrow = new Date(tomorrowStart.getTime() + 86400000);
  const in7Days = new Date(todayStart.getTime() + 7 * 86400000);
  const in30Days = new Date(todayStart.getTime() + 30 * 86400000);
  const minus7Days = new Date(todayStart.getTime() - 7 * 86400000);
  const minus30Days = new Date(todayStart.getTime() - 30 * 86400000);

  const base: Prisma.TaskWhereInput = {
    organisationId: orgId,
    parentTaskId: null,
    ...(category && category !== 'ALL' ? { category: category as TaskCategory } : {}),
  };
  const pending: Prisma.TaskWhereInput = { status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } };

  const [
    dueToday, dueTomorrow, dueIn7Days, dueAfter7Days, dueIn30Days,
    overdueAfter30Days, overdueUpTo7Days, overdueMoreThan7Days, totalOverdue,
    tasksByStatus,
  ] = await Promise.all([
    prisma.task.count({ where: { ...base, ...pending, dueDate: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.task.count({ where: { ...base, ...pending, dueDate: { gte: tomorrowStart, lt: dayAfterTomorrow } } }),
    prisma.task.count({ where: { ...base, ...pending, dueDate: { gte: dayAfterTomorrow, lt: in7Days } } }),
    prisma.task.count({ where: { ...base, ...pending, dueDate: { gte: in7Days } } }),
    prisma.task.count({ where: { ...base, ...pending, dueDate: { gte: todayStart, lt: in30Days } } }),
    prisma.task.count({ where: { ...base, status: 'OVERDUE', dueDate: { lt: minus30Days } } }),
    prisma.task.count({ where: { ...base, status: 'OVERDUE', dueDate: { gte: minus7Days, lt: todayStart } } }),
    prisma.task.count({ where: { ...base, status: 'OVERDUE', dueDate: { gte: minus30Days, lt: minus7Days } } }),
    prisma.task.count({ where: { ...base, status: 'OVERDUE' } }),
    prisma.task.groupBy({ by: ['status'], where: base, _count: { id: true } }),
  ]);

  return R.ok(res, {
    dueToday, dueTomorrow, dueIn7Days, dueAfter7Days, dueIn30Days,
    overdueAfter30Days, overdueUpTo7Days, overdueMoreThan7Days, totalOverdue,
    tasksByStatus: tasksByStatus.map((s) => ({ status: s.status, count: s._count.id })),
  });
}

export async function getFilingAnalytics(req: AuthRequest, res: Response) {
  const orgId = req.user!.orgId;
  const { year = String(new Date().getFullYear()) } = req.query as Record<string, string>;

  const clients = await prisma.client.findMany({ where: { organisationId: orgId }, select: { id: true } });
  const clientIds = clients.map((c) => c.id);

  const records = await prisma.complianceRecord.findMany({
    where: {
      clientId: { in: clientIds },
      periodYear: Number(year),
    },
    select: { status: true, complianceType: true },
  });

  const byStatus = {
    FILED: records.filter((r) => r.status === 'FILED').length,
    PENDING: records.filter((r) => r.status === 'PENDING').length,
    OVERDUE: records.filter((r) => r.status === 'OVERDUE').length,
    IN_PROGRESS: records.filter((r) => r.status === 'IN_PROGRESS').length,
  };

  const byType = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.complianceType] = (acc[r.complianceType] || 0) + 1;
    return acc;
  }, {});

  return R.ok(res, { byStatus, byType, total: records.length });
}
