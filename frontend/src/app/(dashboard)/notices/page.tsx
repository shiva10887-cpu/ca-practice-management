'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate } from '@/lib/utils';
import { Plus, Brain, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const RISK_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-blue-100 text-blue-700',
};

interface Notice {
  id: string;
  noticeType: string;
  portal: string;
  subject: string;
  status: string;
  riskLevel: string;
  issueDate?: string;
  responseDeadline?: string;
  aiSummary?: string;
  client: { id: string; name: string };
  _count?: { replies: number };
}

export default function NoticesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [aiDraft, setAiDraft] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['notice-stats'],
    queryFn: () => api.get('/notices/stats').then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notices', status, riskLevel],
    queryFn: () =>
      api.get('/notices', {
        params: { limit: 30, status: status || undefined, riskLevel: riskLevel || undefined },
      }).then((r) => r.data),
  });

  const summarizeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notices/${id}/summarize`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const notices: Notice[] = data?.data || [];

  const handleDraftReply = async (notice: Notice) => {
    setSelectedNotice(notice);
    setLoadingDraft(true);
    setAiDraft('');
    try {
      const { data: res } = await api.post(`/notices/${notice.id}/draft-reply`);
      setAiDraft(res.data.draft);
    } catch {
      toast({ title: 'AI draft failed', variant: 'destructive' });
    } finally {
      setLoadingDraft(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notice Management</h1>
          <p className="text-sm text-muted-foreground">GST, Income Tax & other legal notices</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Notice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: statsData?.total, color: '' },
          { label: 'Open', value: statsData?.open, color: 'text-orange-600' },
          { label: 'Critical', value: statsData?.critical, color: 'text-red-600' },
          { label: 'Due This Week', value: statsData?.dueThisWeek, color: 'text-yellow-600' },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <p className={cn('text-2xl font-bold', item.color)}>{item.value ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={(v) => setStatus(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {['OPEN', 'IN_PROGRESS', 'REPLIED', 'RESOLVED', 'CLOSED'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Risk Level" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Risk Levels</SelectItem>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Notice cards */}
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : notices.length === 0
            ? <div className="text-center py-16 text-muted-foreground">No notices found</div>
            : notices.map((notice) => (
                <Card key={notice.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold', RISK_COLORS[notice.riskLevel])}>
                          {notice.riskLevel}
                        </span>
                        <span className={cn('status-badge', STATUS_COLORS[notice.status])}>{notice.status}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium">{notice.noticeType}</span>
                        <span className="text-xs text-muted-foreground">{notice.portal}</span>
                      </div>

                      <p className="font-medium">{notice.subject}</p>
                      <p className="text-sm text-primary font-medium">{notice.client.name}</p>

                      {notice.aiSummary && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 text-xs font-semibold mb-1">
                            <Brain className="h-3.5 w-3.5" /> AI Summary
                          </div>
                          <p className="text-muted-foreground text-xs">{notice.aiSummary}</p>
                        </div>
                      )}

                      {notice.responseDeadline && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-muted-foreground">Response deadline:</span>
                          <span className={cn(
                            'font-medium',
                            new Date(notice.responseDeadline) < new Date() ? 'text-red-600' : 'text-orange-600'
                          )}>
                            {formatDate(notice.responseDeadline)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => summarizeMutation.mutate(notice.id)}
                        disabled={summarizeMutation.isPending}
                      >
                        <Brain className="h-3.5 w-3.5 mr-1" />
                        {notice.aiSummary ? 'Re-analyze' : 'AI Analyze'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleDraftReply(notice)}
                      >
                        Draft Reply
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
      </div>

      {/* AI Draft Dialog */}
      <Dialog open={!!selectedNotice && !loadingDraft && !!aiDraft} onOpenChange={() => { setSelectedNotice(null); setAiDraft(''); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" /> AI-Drafted Reply
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">For: <span className="font-medium text-foreground">{selectedNotice?.subject}</span></p>
            <div className="bg-muted/40 rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans">{aiDraft}</pre>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(aiDraft); }}>Copy</Button>
              <Button onClick={() => { setSelectedNotice(null); setAiDraft(''); }}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
