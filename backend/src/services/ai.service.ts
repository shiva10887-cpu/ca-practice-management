import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.AI_MODEL || 'gpt-4o';

export async function summarizeNotice(noticeText: string): Promise<{
  summary: string;
  riskLevel: string;
  keyPoints: string[];
  suggestedActions: string[];
}> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a CA (Chartered Accountant) expert assistant specializing in Indian tax law.
Analyze tax/GST notices and provide structured JSON responses.`,
      },
      {
        role: 'user',
        content: `Analyze this notice and respond with JSON only:
{
  "summary": "2-3 sentence summary",
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "keyPoints": ["point1", "point2"],
  "suggestedActions": ["action1", "action2"]
}

Notice text:
${noticeText}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content);
}

export async function draftNoticeReply(noticeText: string, clientDetails: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert CA drafting professional replies to Indian tax and GST notices.',
      },
      {
        role: 'user',
        content: `Draft a professional reply to this notice for the following client:
Client: ${clientDetails}

Notice:
${noticeText}

Provide a formal, professional reply suitable for submission.`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1500,
  });

  return response.choices[0]?.message?.content || '';
}

export async function analyzeDocument(extractedText: string, documentType: string): Promise<{
  insights: string[];
  suggestedTasks: string[];
  complianceFlags: string[];
}> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a CA expert analyzing Indian financial and tax documents.',
      },
      {
        role: 'user',
        content: `Analyze this ${documentType} document and respond with JSON:
{
  "insights": ["insight1"],
  "suggestedTasks": ["task1"],
  "complianceFlags": ["flag1"]
}

Document:
${extractedText.slice(0, 4000)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content);
}

export async function getComplianceInsights(clientData: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a CA compliance expert providing actionable insights for Indian businesses.',
      },
      {
        role: 'user',
        content: `Provide compliance insights and recommendations for: ${clientData}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 800,
  });

  return response.choices[0]?.message?.content || '';
}
