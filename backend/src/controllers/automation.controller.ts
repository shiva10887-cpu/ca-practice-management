import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { automationQueue } from '../queues';

export async function listJobs(req: AuthRequest, res: Response) {
  const { clientId, status, portal, page = '1', limit = '20' } = req.query as Record<string, string>;

  const clients = await prisma.client.findMany({
    where: { organisationId: req.user!.orgId },
    select: { id: true },
  });
  const orgClientIds = clients.map((c) => c.id);

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    clientId: clientId ? clientId : { in: orgClientIds },
    ...(status && { status }),
    ...(portal && { portal }),
  };

  const [jobs, total] = await Promise.all([
    prisma.automationJob.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, legalName: true } } },
    }),
    prisma.automationJob.count({ where }),
  ]);

  return R.paginated(res, jobs, total, Number(page), Number(limit));
}

export async function triggerJob(req: AuthRequest, res: Response) {
  const { clientId, portal, automationType } = req.body;

  const client = await prisma.client.findFirst({
    where: { id: clientId, organisationId: req.user!.orgId },
  });
  if (!client) return R.notFound(res, 'Client not found');

  const hasCredential = await prisma.credential.findFirst({
    where: { clientId, portal, isActive: true },
  });
  if (!hasCredential) return R.badRequest(res, `No active ${portal} credentials for this client`);

  const job = await prisma.automationJob.create({
    data: {
      clientId,
      portal,
      automationType,
      triggeredById: req.user!.userId,
    },
  });

  if (!automationQueue) return R.serviceUnavailable(res, 'Queue service unavailable (Redis not connected)');

  const bullJob = await automationQueue.add(
    'automation',
    { automationJobId: job.id },
    { jobId: job.id },
  );

  await prisma.automationJob.update({
    where: { id: job.id },
    data: { bullJobId: bullJob.id?.toString() },
  });

  return R.created(res, job);
}

export async function getJobStatus(req: AuthRequest, res: Response) {
  const job = await prisma.automationJob.findUnique({
    where: { id: req.params.id },
    include: { client: { select: { id: true, legalName: true } } },
  });

  if (!job) return R.notFound(res, 'Job not found');
  return R.ok(res, job);
}

export async function cancelJob(req: AuthRequest, res: Response) {
  const job = await prisma.automationJob.findUnique({ where: { id: req.params.id } });
  if (!job) return R.notFound(res, 'Job not found');
  if (job.status !== 'PENDING') return R.badRequest(res, 'Can only cancel pending jobs');

  if (job.bullJobId && automationQueue) {
    const bullJob = await automationQueue.getJob(job.bullJobId);
    await bullJob?.remove();
  }

  await prisma.automationJob.update({
    where: { id: req.params.id },
    data: { status: 'CANCELLED' },
  });

  return R.ok(res, null, 'Job cancelled');
}
