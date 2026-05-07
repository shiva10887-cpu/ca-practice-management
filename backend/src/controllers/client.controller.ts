import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { generateClientCode, isValidGSTIN, isValidPAN } from '../utils/validators';
import * as XLSX from 'xlsx';

export async function listClients(req: AuthRequest, res: Response) {
  const {
    page = '1', limit = '20', search = '', status, businessType,
    assignedManagerId, tags,
  } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    organisationId: req.user!.orgId,
    ...(status && { status }),
    ...(businessType && { businessType }),
    ...(assignedManagerId && { assignedManagerId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { pan: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    }),
    ...(tags && { tags: { hasSome: tags.split(',') } }),
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
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, organisationId: req.user!.orgId },
  });
  if (!client) return R.notFound(res, 'Client not found');

  await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false, status: 'ARCHIVED' } });
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
      const data = {
        name: row['Client Name'] || row['name'],
        pan: (row['PAN'] || row['pan'])?.toUpperCase(),
        gstin: (row['GSTIN'] || row['gstin'])?.toUpperCase(),
        email: row['Email'] || row['email'],
        phone: row['Phone'] || row['phone'],
        businessType: row['Business Type'] || row['businessType'] || 'INDIVIDUAL',
        state: row['State'] || row['state'],
        address: row['Address'] || row['address'],
      };

      if (!data.name) {
        results.errors.push({ row: i + 2, error: 'Client name is required' });
        continue;
      }

      const existing = data.pan
        ? await prisma.client.findFirst({ where: { organisationId: req.user!.orgId, pan: data.pan } })
        : null;

      if (existing) {
        await prisma.client.update({ where: { id: existing.id }, data });
        results.updated++;
      } else {
        await prisma.client.create({
          data: { ...data, organisationId: req.user!.orgId, clientCode: generateClientCode() },
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push({ row: i + 2, error: String(err) });
    }
  }

  return R.ok(res, results);
}

export async function downloadImportTemplate(_req: AuthRequest, res: Response) {
  const headers = [
    'Client Name', 'PAN', 'GSTIN', 'TAN', 'Business Type', 'Constitution Type',
    'Email', 'Phone', 'Address', 'City', 'State', 'Pincode', 'Notes',
  ];

  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    ['Ramesh Kumar', 'AABCP1234C', '29AABCP1234C1Z5', '', 'INDIVIDUAL', 'INDIVIDUAL', 'ramesh@example.com', '9876543210', '123 Main St', 'Bengaluru', 'Karnataka', '560001', ''],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="client_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}
