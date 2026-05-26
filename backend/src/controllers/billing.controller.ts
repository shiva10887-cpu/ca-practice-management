import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';

function generateInvoiceNumber(orgId: string): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${year}${month}-${rand}`;
}

export async function listInvoices(req: AuthRequest, res: Response) {
  const { clientId, status, page = '1', limit = '20' } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    ...(clientId && { clientId }),
    ...(status && { status }),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { issueDate: 'desc' },
      include: {
        client: { select: { id: true, legalName: true } },
        payments: { select: { amount: true, paymentDate: true } },
        _count: { select: { lineItems: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return R.paginated(res, invoices, total, Number(page), Number(limit));
}

export async function getInvoice(req: AuthRequest, res: Response) {
  const inv = await prisma.invoice.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      client: true,
      lineItems: { orderBy: { order: 'asc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  });

  if (!inv) return R.notFound(res, 'Invoice not found');
  return R.ok(res, inv);
}

export async function createInvoice(req: AuthRequest, res: Response) {
  const { clientId, lineItems, discount = 0, taxRate = 18, dueDate, notes, terms, gstDetails } = req.body;

  const subTotal = lineItems.reduce(
    (sum: number, item: { quantity: number; rate: number }) => sum + item.quantity * item.rate, 0
  );
  const taxAmount = (subTotal - discount) * (taxRate / 100);
  const totalAmount = subTotal - discount + taxAmount;

  const inv = await prisma.invoice.create({
    data: {
      organisationId: req.user!.orgId,
      invoiceNumber: generateInvoiceNumber(req.user!.orgId),
      clientId,
      subTotal,
      discount,
      taxAmount,
      totalAmount,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
      terms,
      gstDetails,
      lineItems: {
        create: lineItems.map((item: Record<string, unknown>, i: number) => ({
          ...item,
          amount: Number(item.quantity) * Number(item.rate),
          order: i,
        })),
      },
    },
    include: { lineItems: true, client: { select: { id: true, legalName: true } } },
  });

  return R.created(res, inv);
}

export async function recordPayment(req: AuthRequest, res: Response) {
  const { invoiceId } = req.params;
  const { amount, paymentDate, paymentMethod, reference, notes } = req.body;

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, organisationId: req.user!.orgId },
    include: { payments: true },
  });
  if (!inv) return R.notFound(res, 'Invoice not found');

  const payment = await prisma.payment.create({
    data: { invoiceId, amount, paymentDate: new Date(paymentDate), paymentMethod, reference, notes },
  });

  const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0) + Number(amount);
  const newStatus = totalPaid >= Number(inv.totalAmount)
    ? 'PAID'
    : totalPaid > 0 ? 'PARTIALLY_PAID' : 'SENT';

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: totalPaid, status: newStatus as never },
  });

  return R.created(res, payment);
}

export async function getRevenueSummary(req: AuthRequest, res: Response) {
  const { year = String(new Date().getFullYear()) } = req.query as Record<string, string>;

  const invoices = await prisma.invoice.findMany({
    where: {
      organisationId: req.user!.orgId,
      issueDate: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    },
    select: {
      totalAmount: true, paidAmount: true, status: true,
      issueDate: true,
    },
  });

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const monthInvoices = invoices.filter((inv) => new Date(inv.issueDate).getMonth() === i);
    return {
      month: i + 1,
      billed: monthInvoices.reduce((s, inv) => s + Number(inv.totalAmount), 0),
      collected: monthInvoices.reduce((s, inv) => s + Number(inv.paidAmount), 0),
    };
  });

  const outstanding = invoices
    .filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
    .reduce((s, inv) => s + Number(inv.totalAmount) - Number(inv.paidAmount), 0);

  return R.ok(res, { monthly, outstanding, year });
}
