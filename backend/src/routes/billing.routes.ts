import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/billing.controller';

const router = Router();
router.use(authenticate);

router.get('/invoices', ctrl.listInvoices);
router.get('/invoices/:id', ctrl.getInvoice);
router.post('/invoices', ctrl.createInvoice);
router.post('/invoices/:invoiceId/payments', ctrl.recordPayment);
router.get('/revenue', ctrl.getRevenueSummary);

export default router;
