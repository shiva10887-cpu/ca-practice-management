'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate } from '@/lib/utils';
import { Zap, Play, XCircle, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const AUTOMATION_TYPES = [
  'FETCH_NOTICES', 'FETCH_FILING_STATUS', 'DOWNLOAD_ACKNOWLEDGEMENT',
  'DOWNLOAD_NOTICE', 'CHECK_DASHBOARD', 'FETCH_LEDGER',
];
const PORTALS = ['GST_PORTAL', 'INCOME_TAX', 'TRACES', 'MCA'];

interface AutoJob {
  id: string;
  automationType: string;
  portal: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  client?: { name: string };
  createdAt: string;
}

export default function AutomationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ clientId: '', portal: '', automationType: '' });

  const { data: clients } = useQuery({
    queryKey: ['clients-minimal'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['automation-jobs'],
    queryFn: () => api.get('/automation/jobs', { params: { limit: 30 } }).then((r) => r.data),
    refetchInterval: 10000,
  });

  const triggerMutation = useMutation({
    mutationFn: () => api.post('/automation/jobs', triggerForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-jobs'] });
      setShowTrigger(false);
      setTriggerForm({ clientId: '', portal: '', automationType: '' });
      toast({ title: 'Automation job queued' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automation/jobs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation-jobs'] }),
  });

  const jobs: AutoJob[] = data?.data || [];

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'RUNNING': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'PENDING': return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Automation Engine</h1>
          <p className="text-sm text-muted-foreground">Portal automation for GST, IT, TRACES & MCA</p>
        </div>
        <Button size="sm" onClick={() => setShowTrigger(true)}>
          <Play className="h-4 w-4 mr-1.5" /> Trigger Job
        </Button>
      </div>

      {/* Info banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Full Auto', desc: 'Automatic login & data fetch', icon: '🤖', available: false },
          { title: 'Semi Auto', desc: 'Login assisted, fetch auto', icon: '⚡', available: true },
          { title: 'Manual Assist', desc: 'Step-by-step guided flow', icon: '👤', available: true },
        ].map((mode) => (
          <div key={mode.title} className={cn('rounded-xl border p-4', mode.available ? 'bg-card' : 'bg-muted/30 opacity-60')}>
            <div className="text-2xl mb-2">{mode.icon}</div>
            <p className="font-semibold">{mode.title}</p>
            <p className="text-xs text-muted-foreground">{mode.desc}</p>
            {!mode.available && <span className="text-xs text-muted-foreground">(Coming soon)</span>}
          </div>
        ))}
      </div>

      {/* Jobs table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Job History</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Client', 'Portal', 'Type', 'Status', 'Started', 'Completed', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))
                : jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{job.client?.name || '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="bg-muted px-2 py-0.5 rounded font-medium">{job.portal}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{job.automationType}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(job.status)}
                          <span className={cn('text-xs font-medium', STATUS_COLORS[job.status]?.replace('bg-', 'text-').split(' ')[0] || '')}>{job.status}</span>
                        </div>
                        {job.error && <p className="text-xs text-red-500 mt-0.5 truncate max-w-32">{job.error}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.startedAt ? formatDate(job.startedAt, 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.completedAt ? formatDate(job.completedAt, 'dd MMM HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'PENDING' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => cancelMutation.mutate(job.id)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trigger Dialog */}
      <Dialog open={showTrigger} onOpenChange={() => setShowTrigger(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Trigger Automation Job</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={triggerForm.clientId} onValueChange={(v) => setTriggerForm((f) => ({ ...f, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Portal</Label>
              <Select value={triggerForm.portal} onValueChange={(v) => setTriggerForm((f) => ({ ...f, portal: v }))}>
                <SelectTrigger><SelectValue placeholder="Select portal" /></SelectTrigger>
                <SelectContent>
                  {PORTALS.map((p) => <SelectItem key={p} value={p}>{p.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Automation Type</Label>
              <Select value={triggerForm.automationType} onValueChange={(v) => setTriggerForm((f) => ({ ...f, automationType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {AUTOMATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => triggerMutation.mutate()}
              disabled={!triggerForm.clientId || !triggerForm.portal || !triggerForm.automationType || triggerMutation.isPending}
            >
              {triggerMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start Job
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
