import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import * as ctrl from '../controllers/client.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', ctrl.listClients);
router.get('/template', ctrl.downloadImportTemplate);
router.get('/:id', ctrl.getClient);
router.post('/', ctrl.createClient);
router.put('/:id', ctrl.updateClient);
router.delete('/:id', authorize('SUPER_ADMIN', 'PARTNER', 'MANAGER'), ctrl.deleteClient);
router.get('/:id/activity', ctrl.getClientActivity);
router.post('/import', upload.single('file'), ctrl.importClients);

export default router;
