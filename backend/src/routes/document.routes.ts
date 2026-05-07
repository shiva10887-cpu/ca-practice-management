import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/document.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', ctrl.listDocuments);
router.post('/upload', upload.single('file'), ctrl.uploadDocument);
router.get('/folders/:clientId', ctrl.getFolderTree);
router.get('/:id/url', ctrl.getDocumentUrl);
router.post('/:id/share', ctrl.shareDocument);
router.delete('/:id', ctrl.deleteDocument);

export default router;
