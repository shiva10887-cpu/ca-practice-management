import { Worker, Job } from 'bullmq';
import { redis } from '../../lib/redis';
import { sendNotification } from '../../services/notification.service';

export function notificationWorker() {
  return new Worker(
    'notification',
    async (job: Job) => {
      const { notificationId } = job.data as { notificationId: string };
      await sendNotification(notificationId);
    },
    { connection: redis, concurrency: 5 },
  );
}
