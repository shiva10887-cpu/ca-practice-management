import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/notice.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listNotices);
router.get('/stats', ctrl.getNoticeSummaryStats);
router.get('/:id', ctrl.getNotice);
router.post('/', ctrl.createNotice);
router.put('/:id', ctrl.updateNotice);
router.post('/:id/summarize', ctrl.summarizeNoticeAi);
router.post('/:id/draft-reply', ctrl.draftReplyAi);
router.post('/:id/replies', ctrl.addReply);

export default router;
