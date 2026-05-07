import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';

export function auditLog(action: string, entity: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        await prisma.activityLog.create({
          data: {
            userId: req.user.userId,
            organisationId: req.user.orgId,
            action,
            entity,
            entityId: req.params.id,
            description: `${action} on ${entity}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      }
    } catch {
      // Don't block request on audit failure
    }
    next();
  };
}
