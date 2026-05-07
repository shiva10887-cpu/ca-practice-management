import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { logger } from '../utils/logger';
import { automationWorker } from './workers/automation.worker';
import { notificationWorker } from './workers/notification.worker';

export let automationQueue: Queue | null = null;
export let notificationQueue: Queue | null = null;
export let reportQueue: Queue | null = null;

let workers: Worker[] = [];

export async function initQueues() {
  automationQueue = new Queue('automation', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  notificationQueue = new Queue('notification', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 2000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });

  reportQueue = new Queue('report', {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: 20,
      removeOnFail: 50,
    },
  });

  for (const q of [automationQueue, notificationQueue, reportQueue]) {
    q.on('error', (err) => logger.error(`Queue error [${q.name}]`, err));
  }

  workers = [automationWorker(), notificationWorker()];

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, { queue: worker.name, err: err.message });
    });
    worker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed`, { queue: worker.name });
    });
  }

  logger.info('Queue workers started');
}

export async function shutdownQueues() {
  await Promise.all([
    automationQueue?.close(),
    notificationQueue?.close(),
    reportQueue?.close(),
    ...workers.map((w) => w.close()),
  ]);
}
