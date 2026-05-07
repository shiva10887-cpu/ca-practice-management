import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'CA Practice Manager'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    ...opts,
  });
}

export async function createNotification(opts: {
  userId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: opts.userId,
      channel: opts.channel,
      title: opts.title,
      body: opts.body,
      data: opts.data,
      status: NotificationStatus.PENDING,
    },
  });
}

export async function sendNotification(notificationId: string) {
  const notif = await prisma.notification.findUnique({ where: { id: notificationId }, include: { user: true } });
  if (!notif || !notif.user) return;

  try {
    if (notif.channel === NotificationChannel.EMAIL && notif.user.email) {
      await sendEmail({ to: notif.user.email, subject: notif.title, html: notif.body });
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  } catch (err) {
    logger.error('Notification send failed', err);
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: NotificationStatus.FAILED, error: String(err) },
    });
  }
}
