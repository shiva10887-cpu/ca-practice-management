import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { analyzeDocument, getComplianceInsights } from '../services/ai.service';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();
router.use(authenticate);

router.post('/analyze-document', async (req: AuthRequest, res: Response) => {
  const { text, documentType } = req.body;
  if (!text) return R.badRequest(res, 'Document text is required');
  const result = await analyzeDocument(text, documentType || 'financial document');
  return R.ok(res, result);
});

router.post('/compliance-insights', async (req: AuthRequest, res: Response) => {
  const { clientData } = req.body;
  if (!clientData) return R.badRequest(res, 'Client data is required');
  const insights = await getComplianceInsights(clientData);
  return R.ok(res, { insights });
});

export default router;
