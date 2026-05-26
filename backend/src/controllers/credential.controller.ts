import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { encrypt, decrypt, generateOtp } from '../services/encryption.service';
import { sendEmail } from '../services/notification.service';
import * as XLSX from 'xlsx';

const PORTAL_NAME_MAP: Record<string, string> = {
  'income tax':                 'INCOME_TAX',
  'gst':                        'GST_PORTAL',
  'gst portal':                 'GST_PORTAL',
  'e-way bill':                 'EWAY_BILL',
  'eway bill':                  'EWAY_BILL',
  'e-invoice':                  'E_INVOICE',
  'einvoice':                   'E_INVOICE',
  'esi':                        'ESI',
  'pf':                         'EPFO',
  'epfo':                       'EPFO',
  'pf (epfo)':                  'EPFO',
  'pt':                         'PT',
  'professional tax':           'PT',
  'pt (professional tax)':      'PT',
  'tan income tax':             'TAN_INCOME_TAX',
  'tan – income tax login':     'TAN_INCOME_TAX',
  'tan - income tax login':     'TAN_INCOME_TAX',
  'traces':                     'TRACES',
  'tan traces':                 'TRACES',
  'tan – traces login':         'TRACES',
  'tan - traces login':         'TRACES',
};

export async function listCredentials(req: AuthRequest, res: Response) {
  const { clientId } = req.params;

  const credentials = await prisma.credential.findMany({
    where: { clientId, isActive: true },
    select: {
      id: true, portal: true, otpContactPerson: true, notes: true,
      lastUsedAt: true, lastVerifiedAt: true, isActive: true, createdAt: true,
    },
  });

  return R.ok(res, credentials);
}

export async function createCredential(req: AuthRequest, res: Response) {
  const { clientId, portal, username, password, registeredMobile, registeredEmail, otpContactPerson, notes } = req.body;

  const existing = await prisma.credential.findFirst({ where: { clientId, portal } });
  if (existing) {
    return R.conflict(res, `Credential for ${portal} already exists. Use update instead.`);
  }

  const cred = await prisma.credential.create({
    data: {
      clientId,
      portal,
      usernameEncrypted: encrypt(username),
      passwordEncrypted: encrypt(password),
      registeredMobileEncrypted: registeredMobile ? encrypt(registeredMobile) : null,
      registeredEmailEncrypted: registeredEmail ? encrypt(registeredEmail) : null,
      otpContactPerson,
      notes,
      createdById: req.user!.userId,
    },
    select: { id: true, portal: true, otpContactPerson: true, createdAt: true },
  });

  await prisma.credentialLog.create({
    data: {
      credentialId: cred.id,
      accessedById: req.user!.userId,
      action: 'CREATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.created(res, cred);
}

export async function updateCredential(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { username, password, registeredMobile, registeredEmail, otpContactPerson, notes } = req.body;

  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return R.notFound(res, 'Credential not found');

  await prisma.credential.update({
    where: { id },
    data: {
      ...(username && { usernameEncrypted: encrypt(username) }),
      ...(password && { passwordEncrypted: encrypt(password) }),
      ...(registeredMobile && { registeredMobileEncrypted: encrypt(registeredMobile) }),
      ...(registeredEmail && { registeredEmailEncrypted: encrypt(registeredEmail) }),
      ...(otpContactPerson !== undefined && { otpContactPerson }),
      ...(notes !== undefined && { notes }),
    },
  });

  await prisma.credentialLog.create({
    data: {
      credentialId: id,
      accessedById: req.user!.userId,
      action: 'UPDATED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.ok(res, null, 'Credential updated');
}

export async function requestReveal(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user?.email) return R.badRequest(res, 'User email not found');

  const otp = generateOtp(6);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpRequest.create({
    data: {
      userId: req.user!.userId,
      otp,
      purpose: `REVEAL_CREDENTIAL:${id}`,
      expiresAt,
    },
  });

  await sendEmail({
    to: user.email,
    subject: 'OTP to view credential',
    html: `<p>Your OTP to view credential is: <strong>${otp}</strong><br>Valid for 5 minutes. Do not share.</p>`,
  });

  return R.ok(res, null, 'OTP sent to your registered email');
}

export async function revealCredential(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { otp } = req.body;

  const otpRecord = await prisma.otpRequest.findFirst({
    where: {
      userId: req.user!.userId,
      purpose: `REVEAL_CREDENTIAL:${id}`,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord || otpRecord.otp !== otp) {
    return R.unauthorized(res, 'Invalid or expired OTP');
  }

  await prisma.otpRequest.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } });

  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return R.notFound(res, 'Credential not found');

  await prisma.credentialLog.create({
    data: {
      credentialId: id,
      accessedById: req.user!.userId,
      action: 'REVEALED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  return R.ok(res, {
    username: decrypt(cred.usernameEncrypted),
    password: decrypt(cred.passwordEncrypted),
    registeredMobile: cred.registeredMobileEncrypted ? decrypt(cred.registeredMobileEncrypted) : null,
    registeredEmail: cred.registeredEmailEncrypted ? decrypt(cred.registeredEmailEncrypted) : null,
  });
}

export async function deleteCredential(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const cred = await prisma.credential.findUnique({ where: { id } });
  if (!cred) return R.notFound(res, 'Credential not found');

  await prisma.credential.delete({ where: { id } });
  return R.noContent(res);
}

export async function downloadCredentialTemplate(_req: AuthRequest, res: Response) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Client PAN', 'Client Code', 'Portal', 'User ID', 'Password',
    'Notes / Extra Field', 'Registered Mobile', 'Registered Email', 'OTP Contact Person',
  ];
  const examples = [
    ['ABCDE1234F', 'CLI-001', 'Income Tax',           'user@incometax', 'pass@123',  'ABCDE1234F',       '9876543210', 'user@email.com', 'Ramesh'],
    ['ABCDE1234F', 'CLI-001', 'GST',                  'gstuser01',      'gstpass',   '29AABCP1234C1Z5',  '',           '',              ''],
    ['ABCDE1234F', 'CLI-001', 'E-Way Bill',            'ewayuser',       'ewaypass',  'GST linked info',  '',           '',              ''],
    ['XYZPQ5678R', 'CLI-002', 'TAN – TRACES Login',   'tracesuser',     'tracesp@1', 'TAN: AABB12345C',  '9999900000', '',              'Suresh'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Credentials');

  const portalSheet = XLSX.utils.aoa_to_sheet([
    ['Portal Name (use exactly as shown)'],
    ['Income Tax'],
    ['GST'],
    ['E-Way Bill'],
    ['E-Invoice'],
    ['ESI'],
    ['PF (EPFO)'],
    ['PT (Professional Tax)'],
    ['TAN – Income Tax Login'],
    ['TAN – TRACES Login'],
  ]);
  XLSX.utils.book_append_sheet(wb, portalSheet, 'Valid Portals');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="credential_import_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

export async function importCredentials(req: AuthRequest, res: Response) {
  if (!req.file) return R.badRequest(res, 'No file uploaded');

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];

  const results = { created: 0, updated: 0, errors: [] as { row: number; error: string }[] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const pan         = (row['Client PAN'] || row['PAN'] || '').toString().toUpperCase().trim();
      const clientCode  = (row['Client Code'] || row['clientCode'] || '').toString().trim();
      const portalRaw   = (row['Portal'] || '').toString().trim().toLowerCase();
      const username    = (row['User ID'] || row['Username'] || '').toString().trim();
      const password    = (row['Password'] || '').toString().trim();
      const notes       = (row['Notes / Extra Field'] || row['Notes'] || '').toString().trim() || undefined;
      const mobile      = (row['Registered Mobile'] || row['Mobile'] || '').toString().trim() || undefined;
      const email       = (row['Registered Email'] || row['Email'] || '').toString().trim() || undefined;
      const otpContact  = (row['OTP Contact Person'] || row['OTP Contact'] || '').toString().trim() || undefined;

      if (!pan && !clientCode) {
        results.errors.push({ row: i + 2, error: 'Client PAN or Client Code is required' });
        continue;
      }
      const portal = PORTAL_NAME_MAP[portalRaw];
      if (!portal) {
        results.errors.push({ row: i + 2, error: `Unknown portal "${row['Portal']}" — see Valid Portals sheet` });
        continue;
      }
      if (!username) { results.errors.push({ row: i + 2, error: 'User ID is required' }); continue; }
      if (!password) { results.errors.push({ row: i + 2, error: 'Password is required' }); continue; }

      const client = await prisma.client.findFirst({
        where: {
          organisationId: req.user!.orgId,
          ...(pan ? { pan } : { clientCode }),
        },
      });
      if (!client) {
        results.errors.push({ row: i + 2, error: `Client not found: ${pan || clientCode}` });
        continue;
      }

      const existing = await prisma.credential.findFirst({ where: { clientId: client.id, portal } });
      if (existing) {
        await prisma.credential.update({
          where: { id: existing.id },
          data: {
            usernameEncrypted: encrypt(username),
            passwordEncrypted: encrypt(password),
            ...(mobile    && { registeredMobileEncrypted: encrypt(mobile) }),
            ...(email     && { registeredEmailEncrypted:  encrypt(email)  }),
            ...(otpContact !== undefined && { otpContactPerson: otpContact }),
            ...(notes      !== undefined && { notes }),
          },
        });
        results.updated++;
      } else {
        await prisma.credential.create({
          data: {
            clientId: client.id,
            portal,
            usernameEncrypted: encrypt(username),
            passwordEncrypted: encrypt(password),
            registeredMobileEncrypted: mobile ? encrypt(mobile) : null,
            registeredEmailEncrypted:  email  ? encrypt(email)  : null,
            otpContactPerson: otpContact,
            notes,
            createdById: req.user!.userId,
          },
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push({ row: i + 2, error: String(err) });
    }
  }

  return R.ok(res, results);
}
