import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './utils/logger';
import { initQueues } from './queues';

const PORT = process.env.PORT || 4000;

const isDev = process.env.NODE_ENV !== 'production';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected');

    let redisAvailable = false;
    try {
      await redis.ping();
      logger.info('Redis connected');
      redisAvailable = true;
    } catch (err) {
      if (isDev) {
        logger.warn('Redis unavailable — queues and notifications disabled (dev mode)');
      } else {
        throw err;
      }
    }

    if (redisAvailable) {
      await initQueues();
      logger.info('BullMQ queues initialized');
    }

    const server = createServer(app);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await prisma.$disconnect();
        if (redisAvailable) await redis.quit();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Bootstrap failed', err);
    process.exit(1);
  }
}

bootstrap();
