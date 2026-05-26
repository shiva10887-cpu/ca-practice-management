import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { ComplianceType } from '@prisma/client';

const DUE_DATES: Record<ComplianceType, { day: number; month?: number }[]> = {
  GSTR1: [{ day: 11 }, { day: 13 }],
  GSTR3B: [{ day: 20 }],
  GSTR9: [{ day: 31, month: 12 }],
  GSTR9C: [{ day: 31, month: 12 }],
  CMP08: [{ day: 18 }],
  ITR: [{ day: 31, month: 7 }],
  TDS_24Q: [{ day: 31 }],
  TDS_26Q: [{ day: 31 }],
  TDS_27EQ: [{ day: 15 }],
  FORM_3CD: [{ day: 30, month: 9 }],
  FORM_3CEB: [{ day: 30, month: 11 }],
  MCA_AOC4: [{ day: 30, month: 10 }],
  MCA_MGT7: [{ day: 31, month: 10 }],
  EPFO: [{ day: 15 }],
  ESI: [{ day: 15 }],
  PT: [{ day: 20 }],
  OTHER: [{ day: 30 }],
};

export async function listCompliance(req: AuthRequest, res: Response) {
  const { clientId, status, complianceType, period, page = '1', limit = '20' } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const orgClientIds = clients.map((c) => c.id);

  const where: Record<string, unknown> = {
    clientId: clientId ? clientId : { in: orgClientIds },
    ...(status && { status }),
    ...(complianceType && { complianceType }),
    ...(period && { period }),
  };

  const [records, total] = await Promise.all([
    prisma.complianceRecord.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { dueDate: 'asc' },
      include: { client: { select: { id: true, legalName: true, gstin: true, pan: true } } },
    }),
    prisma.complianceRecord.count({ where }),
  ]);

  return R.paginated(res, records, total, Number(page), Number(limit));
}

export async function getComplianceSummary(req: AuthRequest, res: Response) {
  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const orgClientIds = clients.map((c) => c.id);

  const [pending, filed, overdue, total] = await Promise.all([
    prisma.complianceRecord.count({ where: { clientId: { in: orgClientIds }, status: 'PENDING' } }),
    prisma.complianceRecord.count({ where: { clientId: { in: orgClientIds }, status: 'FILED' } }),
    prisma.complianceRecord.count({ where: { clientId: { in: orgClientIds }, status: 'OVERDUE' } }),
    prisma.complianceRecord.count({ where: { clientId: { in: orgClientIds } } }),
  ]);

  return R.ok(res, { pending, filed, overdue, total });
}

export async function updateComplianceStatus(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { status, filingDate, arn, acknowledgement, remarks } = req.body;

  const record = await prisma.complianceRecord.findUnique({ where: { id } });
  if (!record) return R.notFound(res, 'Compliance record not found');

  const updated = await prisma.complianceRecord.update({
    where: { id },
    data: { status, filingDate: filingDate ? new Date(filingDate) : undefined, arn, acknowledgement, remarks },
  });

  return R.ok(res, updated);
}

export async function bulkUpdateStatus(req: AuthRequest, res: Response) {
  const { ids, status } = req.body as { ids: string[]; status: string };

  await prisma.complianceRecord.updateMany({
    where: { id: { in: ids } },
    data: { status: status as never },
  });

  return R.ok(res, null, `${ids.length} records updated`);
}

export async function getDueDates(req: AuthRequest, res: Response) {
  const { month, year } = req.query as Record<string, string>;

  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const orgClientIds = clients.map((c) => c.id);

  const startDate = new Date(Number(year), Number(month) - 1, 1);
  const endDate = new Date(Number(year), Number(month), 0);

  const records = await prisma.complianceRecord.findMany({
    where: {
      clientId: { in: orgClientIds },
      dueDate: { gte: startDate, lte: endDate },
    },
    include: { client: { select: { id: true, legalName: true } } },
    orderBy: { dueDate: 'asc' },
  });

  return R.ok(res, records);
}
