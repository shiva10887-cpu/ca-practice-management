import { Response } from 'express';

export const ok = (res: Response, data: unknown, message = 'Success') =>
  res.status(200).json({ success: true, message, data });

export const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

export const noContent = (res: Response) => res.status(204).send();

export const badRequest = (res: Response, message = 'Bad request', errors?: unknown) =>
  res.status(400).json({ success: false, message, errors });

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message });

export const forbidden = (res: Response, message = 'Forbidden') =>
  res.status(403).json({ success: false, message });

export const notFound = (res: Response, message = 'Not found') =>
  res.status(404).json({ success: false, message });

export const conflict = (res: Response, message = 'Conflict') =>
  res.status(409).json({ success: false, message });

export const serverError = (res: Response, message = 'Internal server error') =>
  res.status(500).json({ success: false, message });

export const serviceUnavailable = (res: Response, message = 'Service unavailable') =>
  res.status(503).json({ success: false, message });

export const paginated = (
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
) =>
  res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
