import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/compliance.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listCompliance);
router.get('/summary', ctrl.getComplianceSummary);
router.get('/due-dates', ctrl.getDueDates);
router.put('/bulk-update', ctrl.bulkUpdateStatus);
router.put('/:id/status', ctrl.updateComplianceStatus);

export default router;
