'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate, getInitials } from '@/lib/utils';
import { Plus, Search, Upload, Download, MoreHorizontal, Eye, Edit, Trash2, KeyRound, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientDialog } from '@/components/clients/ClientDialog';
import { ImportDialog } from '@/components/clients/ImportDialog';
import { useToast } from '@/hooks/use-toast';

const SERVICES = [
  { label: 'GST',          value: 'GST',          color: 'bg-green-100 text-green-700 border-green-300' },
  { label: 'Income Tax',   value: 'INCOME_TAX',   color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { label: 'MCA / ROC',    value: 'MCA',          color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { label: 'TDS',          value: 'TDS',          color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { label: 'Audit',        value: 'AUDIT',        color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { label: 'Accounting',   value: 'ACCOUNTING',   color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { label: 'Payroll',      value: 'PAYROLL',      color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { label: 'Other',        value: 'OTHER',        color: 'bg-gray-100 text-gray-600 border-gray-300' },
];

const SERVICE_MAP = Object.fromEntries(SERVICES.map((s) => [s.value, s]));

interface Client {
  id: string;
  clientCode: string;
  legalName: string;
  tradeName?: string;
  pan?: string;
  gstin?: string;
  businessType: string;
  status: string;
  email?: string;
  phone?: string;
  state?: string;
  assignedManager?: { firstName: string; lastName: string };
  complianceApplicability: string[];
  _count?: { tasks: number; notices: number };
  createdAt: string;
}

function ServiceBadge({ value }: { value: string }) {
  const svc = SERVICE_MAP[value];
  if (!svc) return <span className="text-xs text-muted-foreground">{value}</span>;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', svc.color)}>
      {svc.label}
    </span>
  );
}

function MarkServicesDialog({
  client,
  open,
  onClose,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  // sync selection when dialog opens
  const handleOpen = (isOpen: boolean) => {
    if (isOpen && client) setSelected([...(client.complianceApplicability ?? [])]);
    if (!isOpen) onClose();
  };

  const toggle = (value: string) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/clients/${client!.id}`, { complianceApplicability: selected }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: `Services updated for ${client?.legalName}` });
      onClose();
    },
    onError: () => toast({ title: 'Failed to update services', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Services</DialogTitle>
          <DialogDescription>
            Select applicable services for{' '}
            <span className="font-semibold">{client?.legalName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {SERVICES.map((svc) => {
            const active = selected.includes(svc.value);
            return (
              <button
                key={svc.value}
                type="button"
                onClick={() => toggle(svc.value)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                  active
                    ? cn(svc.color, 'ring-2 ring-offset-1 ring-current')
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                )}
              >
                {svc.label}
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [markServicesClient, setMarkServicesClient] = useState<Client | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, status, serviceFilter],
    queryFn: () =>
      api.get('/clients', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
          complianceApplicability: serviceFilter || undefined,
        },
      }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setClientToDelete(null);
      toast({ title: 'Client deleted successfully' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete client';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  const clients: Client[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="text-sm text-muted-foreground">{pagination?.total || 0} total clients</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() =>
            api.get('/clients/template', { responseType: 'blob' })
              .then((r) => {
                const url = window.URL.createObjectURL(r.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'client_template.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              })
              .catch(() => toast({ title: 'Failed to download template', variant: 'destructive' }))
          }>
            <Download className="h-4 w-4 mr-1.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Client
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, PAN, GSTIN..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="PROSPECT">Prospect</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Services</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                {['Legal Name', 'Trade Name', 'PAN / GSTIN', 'Type', 'Services', 'Status', 'Manager', 'Tasks', 'Added'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/clients/${client.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                            {getInitials(client.legalName)}
                          </div>
                          <div>
                            <p className="font-medium">{client.legalName}</p>
                            <p className="text-xs text-muted-foreground">{client.clientCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {client.tradeName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-xs">{client.pan || '—'}</p>
                          <p className="font-mono text-xs text-muted-foreground">{client.gstin || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{client.businessType}</td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMarkServicesClient(client);
                        }}
                      >
                        {client.complianceApplicability?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {client.complianceApplicability.map((s) => (
                              <ServiceBadge key={s} value={s} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic hover:text-primary cursor-pointer">
                            + Add
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('status-badge', STATUS_COLORS[client.status])}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {client.assignedManager
                          ? `${client.assignedManager.firstName} ${client.assignedManager.lastName}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-muted-foreground">{client._count?.tasks || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}`)}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}?edit=true`)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMarkServicesClient(client)}>
                              <Tags className="h-4 w-4 mr-2" /> Mark Services
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/clients/${client.id}?tab=logins`)}>
                              <KeyRound className="h-4 w-4 mr-2" /> Manage Logins
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setClientToDelete(client)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.pages} · {pagination.total} clients
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ClientDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['clients'] })}
      />
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['clients'] })}
      />

      <MarkServicesDialog
        client={markServicesClient}
        open={!!markServicesClient}
        onClose={() => setMarkServicesClient(null)}
      />

      <Dialog open={!!clientToDelete} onOpenChange={(open) => { if (!open) setClientToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{clientToDelete?.legalName}</span>? This will archive
              the client and remove them from active lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClientToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => clientToDelete && deleteMutation.mutate(clientToDelete.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
