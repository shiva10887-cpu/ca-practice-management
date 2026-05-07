import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/credential.controller';

const router = Router();
router.use(authenticate);

router.get('/:clientId', ctrl.listCredentials);
router.post('/', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.createCredential);
router.put('/:id', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.updateCredential);
router.post('/:id/request-reveal', ctrl.requestReveal);
router.post('/:id/reveal', ctrl.revealCredential);

export default router;
