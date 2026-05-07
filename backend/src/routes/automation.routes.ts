import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/automation.controller';

const router = Router();
router.use(authenticate);

router.get('/jobs', ctrl.listJobs);
router.post('/jobs', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.triggerJob);
router.get('/jobs/:id', ctrl.getJobStatus);
router.delete('/jobs/:id', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.cancelJob);

export default router;
