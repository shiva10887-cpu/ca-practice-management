import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/credential.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authenticate);

router.get('/template', ctrl.downloadCredentialTemplate);
router.post('/import', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), upload.single('file'), ctrl.importCredentials);
router.get('/:clientId', ctrl.listCredentials);
router.post('/', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.createCredential);
router.put('/:id', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.updateCredential);
router.delete('/:id', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.deleteCredential);
router.post('/:id/request-reveal', ctrl.requestReveal);
router.post('/:id/reveal', ctrl.revealCredential);

export default router;
