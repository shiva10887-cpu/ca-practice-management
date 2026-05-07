import { Response } from 'express';
import { prisma } from '../lib/prisma';
import * as R from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { uploadFile, getPresignedUrl, deleteFile } from '../services/storage.service';
import crypto from 'crypto';

export async function listDocuments(req: AuthRequest, res: Response) {
  const { clientId, folder, documentType, search, page = '1', limit = '20' } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = {
    ...(clientId && { clientId }),
    ...(folder && { folder }),
    ...(documentType && { documentType }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { ocrText: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [docs, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, originalName: true, documentType: true,
        folder: true, mimeType: true, fileSize: true, version: true,
        tags: true, isShared: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.document.count({ where }),
  ]);

  return R.paginated(res, docs, total, Number(page), Number(limit));
}

export async function uploadDocument(req: AuthRequest, res: Response) {
  if (!req.file) return R.badRequest(res, 'No file uploaded');

  const { clientId, folder = '/general', documentType = 'OTHER', name, tags } = req.body;
  if (!clientId) return R.badRequest(res, 'clientId is required');

  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const folderPath = `clients/${clientId}${folder}`;

  const { key } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, folderPath);

  const doc = await prisma.document.create({
    data: {
      clientId,
      name: name || req.file.originalname,
      originalName: req.file.originalname,
      documentType,
      folder,
      storageKey: key,
      mimeType: req.file.mimetype,
      fileSize: BigInt(req.file.size),
      checksum,
      tags: tags ? tags.split(',') : [],
      uploadedById: req.user!.userId,
    },
  });

  return R.created(res, { ...doc, fileSize: doc.fileSize.toString() });
}

export async function getDocumentUrl(req: AuthRequest, res: Response) {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return R.notFound(res, 'Document not found');

  const url = await getPresignedUrl(doc.storageKey, 3600);
  return R.ok(res, { url, expiresIn: 3600 });
}

export async function deleteDocument(req: AuthRequest, res: Response) {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return R.notFound(res, 'Document not found');

  await deleteFile(doc.storageKey);
  await prisma.document.delete({ where: { id: req.params.id } });

  return R.noContent(res);
}

export async function shareDocument(req: AuthRequest, res: Response) {
  const { expiryHours = 24 } = req.body;
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return R.notFound(res, 'Document not found');

  const shareToken = crypto.randomBytes(32).toString('hex');
  const shareExpiry = new Date(Date.now() + expiryHours * 3600 * 1000);

  await prisma.document.update({
    where: { id: req.params.id },
    data: { isShared: true, shareToken, shareExpiry },
  });

  return R.ok(res, {
    shareToken,
    shareUrl: `${process.env.FRONTEND_URL}/shared/doc/${shareToken}`,
    expiresAt: shareExpiry,
  });
}

export async function getFolderTree(req: AuthRequest, res: Response) {
  const { clientId } = req.params;

  const docs = await prisma.document.findMany({
    where: { clientId },
    select: { folder: true, documentType: true },
    distinct: ['folder'],
  });

  const folders = [...new Set(docs.map((d) => d.folder))].sort();

  const standardFolders = [
    '/GST', '/IncomeTax', '/Audit', '/Notices', '/Financials', '/Agreements', '/Miscellaneous',
  ];

  const allFolders = [...new Set([...standardFolders, ...folders])].sort();

  return R.ok(res, allFolders);
}
