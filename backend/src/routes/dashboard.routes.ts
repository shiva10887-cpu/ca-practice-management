import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticate);

router.get('/stats', ctrl.getDashboardStats);
router.get('/due-dates', ctrl.getUpcomingDueDates);
router.get('/activity', ctrl.getActivityTimeline);
router.get('/filing-analytics', ctrl.getFilingAnalytics);

export default router;
