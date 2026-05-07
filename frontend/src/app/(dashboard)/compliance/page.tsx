'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate } from '@/lib/utils';
import { FileCheck, RefreshCw, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const COMPLIANCE_TYPES = ['GSTR1', 'GSTR3B', 'GSTR9', 'ITR', 'TDS_24Q', 'TDS_26Q', 'MCA_AOC4', 'MCA_MGT7', 'EPFO', 'ESI'];

interface ComplianceRecord {
  id: string;
  complianceType: string;
  period: string;
  dueDate: string;
  status: string;
  arn?: string;
  client: { id: string; name: string; gstin?: string; pan?: string };
}

export default function CompliancePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [complianceType, setComplianceType] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['compliance', page, status, complianceType],
    queryFn: () =>
      api.get('/compliance', {
        params: { page, limit: 25, status: status || undefined, complianceType: complianceType || undefined },
      }).then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: () => api.get('/compliance/summary').then((r) => r.data.data),
  });

  const bulkUpdate = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      api.put('/compliance/bulk-update', { ids, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance'] });
      setSelected([]);
      toast({ title: 'Status updated' });
    },
  });

  const records: ComplianceRecord[] = data?.data || [];
  const pagination = data?.pagination;

  const toggleSelect = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Tracker</h1>
          <p className="text-sm text-muted-foreground">Track GST, IT, TDS, MCA & other filings</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: summary?.total, color: 'text-foreground' },
          { label: 'Pending', value: summary?.pending, color: 'text-yellow-600' },
          { label: 'Filed', value: summary?.filed, color: 'text-green-600' },
          { label: 'Overdue', value: summary?.overdue, color: 'text-red-600' },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <p className={cn('text-2xl font-bold', item.color)}>{item.value ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {['PENDING', 'IN_PROGRESS', 'FILED', 'OVERDUE', 'NOT_APPLICABLE'].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={complianceType} onValueChange={(v) => { setComplianceType(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {COMPLIANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          {selected.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ ids: selected, status: 'FILED' })}>
                Mark Filed
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ ids: selected, status: 'IN_PROGRESS' })}>
                In Progress
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" onChange={(e) => {
                    setSelected(e.target.checked ? records.map((r) => r.id) : []);
                  }} checked={selected.length === records.length && records.length > 0} />
                </th>
                {['Client', 'Type', 'Period', 'Due Date', 'Status', 'ARN'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
                <th className="px-4 py-3 w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))
                : records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.includes(record.id)} onChange={() => toggleSelect(record.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{record.client.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{record.client.gstin || record.client.pan || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{record.complianceType}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{record.period}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={cn(
                          'font-medium',
                          new Date(record.dueDate) < new Date() && record.status !== 'FILED' ? 'text-red-600' : ''
                        )}>
                          {formatDate(record.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('status-badge', STATUS_COLORS[record.status])}>{record.status}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{record.arn || '—'}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={record.status}
                          onValueChange={(v) => api.put(`/compliance/${record.id}/status`, { status: v }).then(() => qc.invalidateQueries({ queryKey: ['compliance'] }))}
                        >
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['PENDING', 'IN_PROGRESS', 'FILED', 'OVERDUE', 'NOT_APPLICABLE'].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
