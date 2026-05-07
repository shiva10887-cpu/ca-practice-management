'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Brain, Sparkles, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function AIPage() {
  const { toast } = useToast();
  const [noticeText, setNoticeText] = useState('');
  const [docText, setDocText] = useState('');
  const [docType, setDocType] = useState('GST Return');
  const [clientInfo, setClientInfo] = useState('');
  const [noticeResult, setNoticeResult] = useState<Record<string, unknown> | null>(null);
  const [docResult, setDocResult] = useState<Record<string, unknown> | null>(null);
  const [insightsResult, setInsightsResult] = useState('');

  const noticeMutation = useMutation({
    mutationFn: () => api.post('/notices/temp-analyze', { text: noticeText })
      .catch(() => api.post('/ai/analyze-document', { text: noticeText, documentType: 'Tax Notice' }))
      .then((r) => r.data.data),
    onSuccess: setNoticeResult,
    onError: () => toast({ title: 'AI analysis failed', variant: 'destructive' }),
  });

  const docMutation = useMutation({
    mutationFn: () => api.post('/ai/analyze-document', { text: docText, documentType: docType }).then((r) => r.data.data),
    onSuccess: setDocResult,
    onError: () => toast({ title: 'Analysis failed', variant: 'destructive' }),
  });

  const insightsMutation = useMutation({
    mutationFn: () => api.post('/ai/compliance-insights', { clientData: clientInfo }).then((r) => r.data.data.insights),
    onSuccess: setInsightsResult,
    onError: () => toast({ title: 'Insights failed', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" /> AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground">Powered by GPT-4o — analyze notices, documents & get compliance insights</p>
        </div>
      </div>

      <Tabs defaultValue="notice">
        <TabsList>
          <TabsTrigger value="notice">Notice Analyzer</TabsTrigger>
          <TabsTrigger value="document">Document Analyzer</TabsTrigger>
          <TabsTrigger value="insights">Compliance Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="notice" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" /> Notice Analyzer & Reply Drafter
              </CardTitle>
              <CardDescription>Paste the notice text to get AI analysis, risk assessment & draft reply</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="Paste notice content here..."
                className="w-full min-h-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button onClick={() => noticeMutation.mutate()} disabled={!noticeText.trim() || noticeMutation.isPending}>
                {noticeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Analyze Notice
              </Button>

              {noticeResult && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-700 mb-2">SUMMARY</p>
                      <p className="text-sm">{String(noticeResult.summary || noticeResult.insights || '')}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                      <p className="text-xs font-semibold text-orange-700 mb-2">RISK LEVEL</p>
                      <p className="text-2xl font-bold text-orange-600">{String(noticeResult.riskLevel || 'MEDIUM')}</p>
                    </div>
                  </div>
                  {noticeResult.suggestedActions && Array.isArray(noticeResult.suggestedActions) && (
                    <div>
                      <p className="text-sm font-semibold mb-2">Suggested Actions</p>
                      <ul className="space-y-1">
                        {(noticeResult.suggestedActions as string[]).map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-green-600 mt-0.5">✓</span>{action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="document" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" /> Document Analyzer
              </CardTitle>
              <CardDescription>Extract insights from financial documents, returns & agreements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              >
                {['GST Return', 'Income Tax Return', 'Balance Sheet', 'P&L Statement', 'Bank Statement', 'Agreement', 'Other'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <textarea
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder="Paste or type document text here..."
                className="w-full min-h-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button onClick={() => docMutation.mutate()} disabled={!docText.trim() || docMutation.isPending}>
                {docMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Analyze Document
              </Button>

              {docResult && (
                <div className="space-y-3 border-t pt-4">
                  {(['insights', 'suggestedTasks', 'complianceFlags'] as const).map((key) => (
                    docResult[key] && Array.isArray(docResult[key]) && (docResult[key] as string[]).length > 0 && (
                      <div key={key}>
                        <p className="text-sm font-semibold capitalize mb-1.5">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <ul className="space-y-1">
                          {(docResult[key] as string[]).map((item, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span>•</span>{item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" /> Compliance Insights
              </CardTitle>
              <CardDescription>Get actionable compliance recommendations for your clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={clientInfo}
                onChange={(e) => setClientInfo(e.target.value)}
                placeholder="Describe the client: business type, turnover, GST registrations, filing history, current issues..."
                className="w-full min-h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button onClick={() => insightsMutation.mutate()} disabled={!clientInfo.trim() || insightsMutation.isPending}>
                {insightsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Get Insights
              </Button>

              {insightsResult && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-t pt-4">
                  <pre className="text-sm whitespace-pre-wrap font-sans">{insightsResult}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
