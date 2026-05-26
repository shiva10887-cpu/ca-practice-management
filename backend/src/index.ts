import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './utils/logger';
import { initQueues } from './queues';

const PORT = process.env.PORT || 4000;

const isDev = process.env.NODE_ENV !== 'production';

async function checkRedisVersion(): Promise<boolean> {
  try {
    const info = await redis.info('server');
    const match = info.match(/redis_version:(\S+)/);
    if (!match) return false;
    const major = parseInt(match[1].split('.')[0], 10);
    return major >= 5;
  } catch {
    return false;
  }
}

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
        redis.disconnect();
      } else {
        throw err;
      }
    }

    if (redisAvailable) {
      const versionOk = await checkRedisVersion();
      if (versionOk) {
        await initQueues();
        logger.info('BullMQ queues initialized');
      } else if (isDev) {
        redisAvailable = false;
      } else {
        throw new Error('Redis version too old for BullMQ — requires >= 5.0.0');
      }
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
