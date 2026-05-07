import { Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { runAutomationJob } from '../../automation/runner';
import { AutomationStatus } from '@prisma/client';

export function automationWorker() {
  return new Worker(
    'automation',
    async (job: Job) => {
      const { automationJobId } = job.data as { automationJobId: string };

      await prisma.automationJob.update({
        where: { id: automationJobId },
        data: { status: AutomationStatus.RUNNING, startedAt: new Date() },
      });

      try {
        const result = await runAutomationJob(automationJobId);

        await prisma.automationJob.update({
          where: { id: automationJobId },
          data: {
            status: AutomationStatus.COMPLETED,
            completedAt: new Date(),
            result,
          },
        });

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await prisma.automationJob.update({
          where: { id: automationJobId },
          data: {
            status: AutomationStatus.FAILED,
            error: errorMsg,
            retryCount: { increment: 1 },
          },
        });
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 2,
    },
  );
}
