import { prisma } from '../lib/prisma';
import { decrypt } from '../services/encryption.service';
import { logger } from '../utils/logger';
import { AutomationType, Portal } from '@prisma/client';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export async function runAutomationJob(jobId: string): Promise<Record<string, unknown>> {
  const job = await prisma.automationJob.findUnique({
    where: { id: jobId },
    include: { client: { include: { credentials: true } } },
  });

  if (!job) throw new Error(`Automation job ${jobId} not found`);

  const credential = job.client?.credentials.find((c) => c.portal === job.portal && c.isActive);
  if (!credential) throw new Error(`No active credential found for portal ${job.portal}`);

  const username = decrypt(credential.usernameEncrypted);
  const password = decrypt(credential.passwordEncrypted);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    const result = await dispatchAutomation(page, job.automationType, job.portal, username, password);

    await context.close();
    return result;
  } finally {
    await browser?.close();
  }
}

async function dispatchAutomation(
  page: Page,
  type: AutomationType,
  portal: Portal,
  username: string,
  password: string,
): Promise<Record<string, unknown>> {
  switch (portal) {
    case Portal.GST_PORTAL:
      return runGstPortalJob(page, type, username, password);
    case Portal.INCOME_TAX:
      return runIncomeTaxJob(page, type, username, password);
    default:
      throw new Error(`Automation for portal ${portal} not implemented yet`);
  }
}

async function runGstPortalJob(
  page: Page,
  type: AutomationType,
  username: string,
  password: string,
): Promise<Record<string, unknown>> {
  logger.info(`GST portal automation: ${type} for user ${username}`);

  await page.goto('https://www.gst.gov.in/', { waitUntil: 'networkidle' });

  return {
    portal: 'GST_PORTAL',
    type,
    status: 'simulated',
    message: 'Automation placeholder — CAPTCHA/OTP handling requires manual assist mode',
    timestamp: new Date().toISOString(),
  };
}

async function runIncomeTaxJob(
  page: Page,
  type: AutomationType,
  username: string,
  password: string,
): Promise<Record<string, unknown>> {
  logger.info(`Income tax portal automation: ${type} for user ${username}`);

  await page.goto('https://www.incometax.gov.in/', { waitUntil: 'networkidle' });

  return {
    portal: 'INCOME_TAX',
    type,
    status: 'simulated',
    message: 'Automation placeholder — requires OTP handling',
    timestamp: new Date().toISOString(),
  };
}
