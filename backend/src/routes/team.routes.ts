import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/team.controller';

const router = Router();
router.use(authenticate);

router.get('/users', ctrl.listUsers);
router.post('/users/invite', authorize('SUPER_ADMIN', 'PARTNER'), ctrl.inviteUser);
router.put('/users/:id', authorize('SUPER_ADMIN', 'PARTNER'), ctrl.updateUser);
router.get('/productivity', ctrl.getProductivityStats);

export default router;
