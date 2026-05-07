import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { summarizeNotice, draftNoticeReply } from '../services/ai.service';

export async function listNotices(req: AuthRequest, res: Response) {
  const {
    clientId, status, noticeType, riskLevel, portal,
    page = '1', limit = '20', search,
  } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const orgClientIds = clients.map((c) => c.id);

  const where: Record<string, unknown> = {
    clientId: clientId ? clientId : { in: orgClientIds },
    ...(status && { status }),
    ...(noticeType && { noticeType }),
    ...(riskLevel && { riskLevel }),
    ...(portal && { portal }),
    ...(search && {
      OR: [
        { subject: { contains: search, mode: 'insensitive' } },
        { noticeNumber: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: [{ riskLevel: 'desc' }, { responseDeadline: 'asc' }],
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { replies: true } },
      },
    }),
    prisma.notice.count({ where }),
  ]);

  return R.paginated(res, notices, total, Number(page), Number(limit));
}

export async function getNotice(req: AuthRequest, res: Response) {
  const notice = await prisma.notice.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, name: true, pan: true, gstin: true } },
      replies: { orderBy: { createdAt: 'desc' } },
      hearings: { orderBy: { hearingDate: 'asc' } },
    },
  });

  if (!notice) return R.notFound(res, 'Notice not found');
  return R.ok(res, notice);
}

export async function createNotice(req: AuthRequest, res: Response) {
  const notice = await prisma.notice.create({ data: req.body });

  if (req.body.description) {
    try {
      const aiResult = await summarizeNotice(req.body.description);
      await prisma.notice.update({
        where: { id: notice.id },
        data: {
          aiSummary: aiResult.summary,
          aiPriority: aiResult.riskLevel,
          riskLevel: aiResult.riskLevel as never,
        },
      });
    } catch { /* AI optional */ }
  }

  return R.created(res, notice);
}

export async function updateNotice(req: AuthRequest, res: Response) {
  const notice = await prisma.notice.update({
    where: { id: req.params.id },
    data: req.body,
  });
  return R.ok(res, notice);
}

export async function summarizeNoticeAi(req: AuthRequest, res: Response) {
  const notice = await prisma.notice.findUnique({ where: { id: req.params.id } });
  if (!notice) return R.notFound(res, 'Notice not found');

  const text = notice.description || notice.subject;
  const result = await summarizeNotice(text);

  await prisma.notice.update({
    where: { id: req.params.id },
    data: { aiSummary: result.summary, aiPriority: result.riskLevel },
  });

  return R.ok(res, result);
}

export async function draftReplyAi(req: AuthRequest, res: Response) {
  const notice = await prisma.notice.findUnique({
    where: { id: req.params.id },
    include: { client: { select: { name: true, pan: true, gstin: true } } },
  });
  if (!notice) return R.notFound(res, 'Notice not found');

  const clientDetails = `Name: ${notice.client?.name}, PAN: ${notice.client?.pan}, GSTIN: ${notice.client?.gstin}`;
  const draft = await draftNoticeReply(notice.description || notice.subject, clientDetails);

  return R.ok(res, { draft });
}

export async function addReply(req: AuthRequest, res: Response) {
  const reply = await prisma.noticeReply.create({
    data: { ...req.body, noticeId: req.params.id, submittedBy: req.user!.userId },
  });
  return R.created(res, reply);
}

export async function getNoticeSummaryStats(req: AuthRequest, res: Response) {
  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const ids = clients.map((c) => c.id);

  const [open, critical, dueThisWeek, total] = await Promise.all([
    prisma.notice.count({ where: { clientId: { in: ids }, status: 'OPEN' } }),
    prisma.notice.count({ where: { clientId: { in: ids }, riskLevel: 'CRITICAL' } }),
    prisma.notice.count({
      where: {
        clientId: { in: ids },
        responseDeadline: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        status: { not: 'CLOSED' },
      },
    }),
    prisma.notice.count({ where: { clientId: { in: ids } } }),
  ]);

  return R.ok(res, { open, critical, dueThisWeek, total });
}
