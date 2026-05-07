'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate, formatCurrency } from '@/lib/utils';
import { Plus, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount: number;
  client: { name: string };
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn: () => api.get('/billing/invoices', { params: { page, limit: 20, status: status || undefined } }).then((r) => r.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ['revenue'],
    queryFn: () => api.get('/billing/revenue').then((r) => r.data.data),
  });

  const invoices: Invoice[] = data?.data || [];
  const pagination = data?.pagination;

  const totalOutstanding = invoices
    .filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status))
    .reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="text-sm text-muted-foreground">Invoices, payments & revenue</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Invoice
        </Button>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Revenue Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenue?.monthly || []}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickFormatter={(m) => ['J','F','M','A','M','J','J','A','S','O','N','D'][m-1]} tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="collected" stroke="#10b981" fill="url(#gradRev)" name="Collected" strokeWidth={2} />
              <Area type="monotone" dataKey="billed" stroke="#3b82f6" fill="none" name="Billed" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {totalOutstanding > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">Outstanding:</span>
            <span className="font-semibold text-red-600">{formatCurrency(totalOutstanding)}</span>
          </div>
        )}
      </div>

      {/* Invoice table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Amount', 'Paid', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))
                : invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-sm font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-medium">{inv.client.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-xs">
                        {inv.dueDate
                          ? <span className={cn(new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                              {formatDate(inv.dueDate)}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(inv.totalAmount))}</td>
                      <td className="px-4 py-3 text-green-600">{formatCurrency(Number(inv.paidAmount))}</td>
                      <td className="px-4 py-3">
                        <span className={cn('status-badge', STATUS_COLORS[inv.status])}>{inv.status}</span>
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

      <InvoiceDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['revenue'] }); }} />
    </div>
  );
}
