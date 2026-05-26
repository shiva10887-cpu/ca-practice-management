import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { generateClientCode, isValidGSTIN, isValidPAN } from '../utils/validators';
import { encrypt } from '../services/encryption.service';
import * as XLSX from 'xlsx';

export async function listClients(req: AuthRequest, res: Response) {
  const {
    page = '1', limit = '20', search = '', status, businessType,
    assignedManagerId, tags, complianceApplicability,
  } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    ...(status && { status }),
    ...(businessType && { businessType }),
    ...(assignedManagerId && { assignedManagerId }),
    ...(search && {
      OR: [
        { legalName: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
        { pan: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    }),
    ...(tags && { tags: { hasSome: tags.split(',') } }),
    ...(complianceApplicability && { complianceApplicability: { has: complianceApplicability } }),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        assignedManager: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tasks: true, notices: true, complianceRecords: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return R.paginated(res, clients, total, Number(page), Number(limit));
}

export async function getClient(req: AuthRequest, res: Response) {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
    include: {
      contacts: true,
      assignedManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: {
        select: { tasks: true, notices: true, complianceRecords: true, documents: true, invoices: true },
      },
    },
  });

  if (!client) return R.notFound(res, 'Client not found');
  return R.ok(res, client);
}

export async function createClient(req: AuthRequest, res: Response) {
  const data = req.body;

  if (data.pan && !isValidPAN(data.pan)) {
    return R.badRequest(res, 'Invalid PAN format');
  }
  if (data.gstin && !isValidGSTIN(data.gstin)) {
    return R.badRequest(res, 'Invalid GSTIN format');
  }

  const existing = await prisma.client.findFirst({
    where: {
      organisationId: req.user!.orgId,
      OR: [
        ...(data.pan ? [{ pan: data.pan }] : []),
        ...(data.gstin ? [{ gstin: data.gstin }] : []),
      ],
    },
  });

  if (existing) return R.conflict(res, 'Client with same PAN/GSTIN already exists');

  const client = await prisma.client.create({
    data: {
      ...data,
      organisationId: req.user!.orgId,
      clientCode: generateClientCode(),
      pan: data.pan?.toUpperCase(),
      gstin: data.gstin?.toUpperCase(),
      tan: data.tan?.toUpperCase(),
    },
  });

  return R.created(res, client);
}

export async function updateClient(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const data = req.body;

  if (data.pan && !isValidPAN(data.pan)) return R.badRequest(res, 'Invalid PAN format');
  if (data.gstin && !isValidGSTIN(data.gstin)) return R.badRequest(res, 'Invalid GSTIN format');

  const client = await prisma.client.findFirst({
    where: { id, organisationId: req.user!.orgId },
  });
  if (!client) return R.notFound(res, 'Client not found');

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...data,
      pan: data.pan?.toUpperCase(),
      gstin: data.gstin?.toUpperCase(),
    },
  });

  return R.ok(res, updated);
}

export async function deleteClient(req: AuthRequest, res: Response) {
  const id = req.params.id;

  const client = await prisma.client.findFirst({
    where: { id, organisationId: req.user!.orgId },
  });
  if (!client) return R.notFound(res, 'Client not found');

  await prisma.$transaction(async (tx) => {
    // Nullify optional FK references that lack cascade
    await tx.task.updateMany({ where: { clientId: id }, data: { clientId: null } });
    await tx.activityLog.updateMany({ where: { clientId: id }, data: { clientId: null } });
    await tx.automationJob.updateMany({ where: { clientId: id }, data: { clientId: null } });

    // Delete payments before invoices (no cascade on Payment → Invoice)
    const invoiceIds = (await tx.invoice.findMany({ where: { clientId: id }, select: { id: true } }))
      .map((inv) => inv.id);
    if (invoiceIds.length) {
      await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { clientId: id } });
    }

    // Delete the client — cascades: contacts, complianceRecords, filings, notices, documents, credentials
    await tx.client.delete({ where: { id } });
  });

  return R.noContent(res);
}

export async function getClientActivity(req: AuthRequest, res: Response) {
  const logs = await prisma.activityLog.findMany({
    where: { clientId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { firstName: true, lastName: true, avatar: true } } },
  });
  return R.ok(res, logs);
}

export async function importClients(req: AuthRequest, res: Response) {
  if (!req.file) return R.badRequest(res, 'No file uploaded');

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];

  const results = { created: 0, updated: 0, errors: [] as { row: number; error: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const pan = (row['PAN'] || row['pan'] || '').toString().toUpperCase().trim() || undefined;

      const VALID_SERVICES = new Set(['GST', 'INCOME_TAX', 'MCA', 'TDS', 'AUDIT', 'ACCOUNTING', 'PAYROLL', 'OTHER']);
      const rawServices = (row['Services'] || row['services'] || '').toString().trim();
      const complianceApplicability = rawServices
        ? rawServices.split(',').map((s) => s.trim().toUpperCase()).filter((s) => VALID_SERVICES.has(s))
        : undefined;

      const data = {
        legalName: (row['Legal Name'] || row['legalName'] || '').toString().trim(),
        tradeName: (row['Trade Name'] || row['tradeName'] || '').toString().trim() || undefined,
        pan,
        gstin: (row['GSTIN'] || row['gstin'] || '').toString().toUpperCase().trim() || undefined,
        tan: (row['TAN'] || row['tan'] || '').toString().toUpperCase().trim() || undefined,
        email: (row['Email'] || row['email'] || '').toString().trim() || undefined,
        phone: (row['Phone'] || row['phone'] || '').toString().trim() || undefined,
        businessType: (row['Business Type'] || row['businessType'] || 'INDIVIDUAL').toString().trim(),
        constitutionType: (row['Constitution Type'] || row['constitutionType'] || 'INDIVIDUAL').toString().trim(),
        address: (row['Address'] || row['address'] || '').toString().trim() || undefined,
        city: (row['City'] || row['city'] || '').toString().trim() || undefined,
        state: (row['State'] || row['state'] || '').toString().trim() || undefined,
        pincode: (row['Pincode'] || row['pincode'] || '').toString().trim() || undefined,
        notes: (row['Notes'] || row['notes'] || '').toString().trim() || undefined,
        ...(complianceApplicability !== undefined ? { complianceApplicability } : {}),
      };

      const gstUserId = (row['GST USER ID'] || row['GST User ID'] || '').toString().trim();
      const gstPassword = (row['GST Password'] || row['GST password'] || '').toString().trim();
      const itPassword = (row['Income tax Login password'] || row['IT Password'] || '').toString().trim();

      if (!data.legalName) {
        results.errors.push({ row: i + 2, error: 'Legal Name is required' });
        continue;
      }

      const existing = pan
        ? await prisma.client.findFirst({ where: { organisationId: req.user!.orgId, pan } })
        : null;

      let clientId: string;
      if (existing) {
        await prisma.client.update({ where: { id: existing.id }, data });
        clientId = existing.id;
        results.updated++;
      } else {
        const created = await prisma.client.create({
          data: { ...data, organisationId: req.user!.orgId, clientCode: generateClientCode() },
        });
        clientId = created.id;
        results.created++;
      }

      // Upsert GST portal credential
      if (gstUserId && gstPassword) {
        const existingGst = await prisma.credential.findFirst({ where: { clientId, portal: 'GST_PORTAL' } });
        if (existingGst) {
          await prisma.credential.update({
            where: { id: existingGst.id },
            data: { usernameEncrypted: encrypt(gstUserId), passwordEncrypted: encrypt(gstPassword) },
          });
        } else {
          await prisma.credential.create({
            data: {
              clientId, portal: 'GST_PORTAL',
              usernameEncrypted: encrypt(gstUserId),
              passwordEncrypted: encrypt(gstPassword),
              createdById: req.user!.userId,
            },
          });
        }
      }

      // Upsert Income Tax credential (username = PAN)
      if (pan && itPassword) {
        const existingIt = await prisma.credential.findFirst({ where: { clientId, portal: 'INCOME_TAX' } });
        if (existingIt) {
          await prisma.credential.update({
            where: { id: existingIt.id },
            data: { usernameEncrypted: encrypt(pan), passwordEncrypted: encrypt(itPassword) },
          });
        } else {
          await prisma.credential.create({
            data: {
              clientId, portal: 'INCOME_TAX',
              usernameEncrypted: encrypt(pan),
              passwordEncrypted: encrypt(itPassword),
              createdById: req.user!.userId,
            },
          });
        }
      }
    } catch (err) {
      results.errors.push({ row: i + 2, error: String(err) });
    }
  }

  return R.ok(res, results);
}

export async function downloadImportTemplate(_req: AuthRequest, res: Response) {
  try {
    const headers = [
      'Legal Name', 'Trade Name', 'PAN', 'GSTIN', 'TAN', 'Business Type', 'Constitution Type',
      'Email', 'Phone', 'Address', 'City', 'State', 'Pincode', 'Notes',
      'Services',
      'GST USER ID', 'GST Password', 'Income tax Login password',
    ];

    // Services column note row
    const noteRow = [
      '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      'Comma-separated: GST, INCOME_TAX, MCA, TDS, AUDIT, ACCOUNTING, PAYROLL, OTHER',
      '', '', '',
    ];

    const sampleRow = [
      'Ramesh Kumar', 'Ramesh Enterprises', 'AABCP1234C', '29AABCP1234C1Z5', 'DELR12345C',
      'INDIVIDUAL', 'INDIVIDUAL', 'ramesh@example.com', '9876543210', '123 Main St',
      'Bengaluru', 'Karnataka', '560001', '',
      'GST,INCOME_TAX,TDS',
      'ramesh_gst', 'gst@pass1', 'it@pass1',
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, noteRow, sampleRow]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="client_import_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
}
