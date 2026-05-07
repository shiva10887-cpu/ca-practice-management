import { Router } from 'express';
import authRoutes from './auth.routes';
import clientRoutes from './client.routes';
import taskRoutes from './task.routes';
import complianceRoutes from './compliance.routes';
import documentRoutes from './document.routes';
import billingRoutes from './billing.routes';
import credentialRoutes from './credential.routes';
import noticeRoutes from './notice.routes';
import automationRoutes from './automation.routes';
import dashboardRoutes from './dashboard.routes';
import teamRoutes from './team.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/clients', clientRoutes);
router.use('/tasks', taskRoutes);
router.use('/compliance', complianceRoutes);
router.use('/documents', documentRoutes);
router.use('/billing', billingRoutes);
router.use('/credentials', credentialRoutes);
router.use('/notices', noticeRoutes);
router.use('/automation', automationRoutes);
router.use('/team', teamRoutes);
router.use('/ai', aiRoutes);

export default router;
