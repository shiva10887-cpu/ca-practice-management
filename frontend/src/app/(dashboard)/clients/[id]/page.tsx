'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { formatDate, cn, STATUS_COLORS } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, FileCheck, AlertCircle, CheckSquare, FolderOpen, Receipt, KeyRound, Pencil, Check, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CredentialsTab } from '@/components/clients/CredentialsTab';
import { useToast } from '@/hooks/use-toast';

const SERVICES = [
  { label: 'GST',        value: 'GST',        color: 'bg-green-100 text-green-700 border-green-300' },
  { label: 'Income Tax', value: 'INCOME_TAX', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { label: 'MCA / ROC',  value: 'MCA',        color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { label: 'TDS',        value: 'TDS',        color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { label: 'Audit',      value: 'AUDIT',      color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { label: 'Accounting', value: 'ACCOUNTING', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { label: 'Payroll',    value: 'PAYROLL',    color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { label: 'Other',      value: 'OTHER',      color: 'bg-gray-100 text-gray-600 border-gray-300' },
];
const SERVICE_MAP = Object.fromEntries(SERVICES.map((s) => [s.value, s]));

function ServiceBadge({ value }: { value: string }) {
  const svc = SERVICE_MAP[value];
  if (!svc) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', svc.color)}>
      {svc.label}
    </span>
  );
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') ?? 'overview';
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingServices, setEditingServices] = useState(false);
  const [draftServices, setDraftServices] = useState<string[]>([]);

  const startEdit = (current: string[]) => {
    setDraftServices([...(current ?? [])]);
    setEditingServices(true);
  };
  const cancelEdit = () => setEditingServices(false);
  const toggleService = (val: string) =>
    setDraftServices((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);

  const saveServicesMutation = useMutation({
    mutationFn: (services: string[]) =>
      api.patch(`/clients/${id}`, { complianceApplicability: services }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      setEditingServices(false);
      toast({ title: 'Services updated' });
    },
    onError: () => toast({ title: 'Failed to update services', variant: 'destructive' }),
  });

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['client-activity', id],
    queryFn: () => api.get(`/clients/${id}/activity`).then((r) => r.data.data),
  });

  const { data: compliance } = useQuery({
    queryKey: ['compliance', id],
    queryFn: () => api.get('/compliance', { params: { clientId: id, limit: 10 } }).then((r) => r.data.data),
  });

  const { data: notices } = useQuery({
    queryKey: ['notices', id],
    queryFn: () => api.get('/notices', { params: { clientId: id, limit: 5 } }).then((r) => r.data.data),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  if (!client) return <p className="text-muted-foreground">Client not found.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary text-xl font-bold">
          {client.legalName[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.legalName}</h1>
            <span className={cn('status-badge', STATUS_COLORS[client.status])}>{client.status}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{client.clientCode} · {client.businessType}</span>
            {client.tradeName && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Trade: {client.tradeName}</span>
            )}
          </div>
          {client.complianceApplicability?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {client.complianceApplicability.map((s: string) => (
                <ServiceBadge key={s} value={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: CheckSquare, label: 'Tasks', value: client._count?.tasks || 0 },
          { icon: AlertCircle, label: 'Notices', value: client._count?.notices || 0, color: 'text-red-600' },
          { icon: FileCheck, label: 'Compliances', value: client._count?.complianceRecords || 0 },
          { icon: FolderOpen, label: 'Documents', value: client._count?.documents || 0 },
          { icon: Receipt, label: 'Invoices', value: client._count?.invoices || 0 },
        ].map((item) => (
          <Card key={item.label} className="p-4 text-center">
            <item.icon className={cn('h-5 w-5 mx-auto mb-1 text-muted-foreground', item.color)} />
            <p className="text-xl font-bold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logins">
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />Logins
          </TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Services Card */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Services</CardTitle>
                  {!editingServices ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => startEdit(client.complianceApplicability ?? [])}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs"
                        disabled={saveServicesMutation.isPending}
                        onClick={() => saveServicesMutation.mutate(draftServices)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {saveServicesMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={cancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingServices ? (
                  <div className="flex flex-wrap gap-2">
                    {SERVICES.map((svc) => {
                      const active = draftServices.includes(svc.value);
                      return (
                        <button
                          key={svc.value}
                          type="button"
                          onClick={() => toggleService(svc.value)}
                          className={cn(
                            'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                            active
                              ? cn(svc.color, 'ring-2 ring-offset-1 ring-current')
                              : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                          )}
                        >
                          {svc.label}
                        </button>
                      );
                    })}
                  </div>
                ) : client.complianceApplicability?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {client.complianceApplicability.map((s: string) => (
                      <ServiceBadge key={s} value={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No services marked.{' '}
                    <button
                      className="text-primary underline underline-offset-2"
                      onClick={() => startEdit([])}
                    >
                      Add services
                    </button>
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />{client.email}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />{client.phone}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{[client.address, client.city, client.state, client.pincode].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Tax Identifiers</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[['PAN', client.pan], ['GSTIN', client.gstin], ['TAN', client.tan]].map(([label, val]) => (
                  val && (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-medium">{val}</span>
                    </div>
                  )
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned To</span>
                  <span className="font-medium">
                    {client.assignedManager ? `${client.assignedManager.firstName} ${client.assignedManager.lastName}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Onboarded</span>
                  <span>{client.onboardingDate ? formatDate(client.onboardingDate) : formatDate(client.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logins" className="mt-4">
          <CredentialsTab clientId={id} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {!compliance?.length
                ? <p className="text-sm text-muted-foreground text-center py-8">No compliance records</p>
                : (
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        {['Type', 'Period', 'Due Date', 'Status', 'ARN'].map((h) => (
                          <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {compliance.map((r: Record<string, unknown>) => (
                        <tr key={String(r.id)}>
                          <td className="py-2.5 font-medium">{String(r.complianceType)}</td>
                          <td className="py-2.5 text-muted-foreground">{String(r.period)}</td>
                          <td className="py-2.5">{formatDate(String(r.dueDate))}</td>
                          <td className="py-2.5">
                            <span className={cn('status-badge', STATUS_COLORS[String(r.status)])}>{String(r.status)}</span>
                          </td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">{String(r.arn || '—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notices" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {!notices?.length
                ? <p className="text-sm text-muted-foreground text-center py-8">No notices</p>
                : notices.map((n: Record<string, unknown>) => (
                  <div key={String(n.id)} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{String(n.subject)}</p>
                      <p className="text-xs text-muted-foreground">{String(n.noticeType)} · {String(n.portal)}</p>
                    </div>
                    <span className={cn('status-badge text-[11px]', STATUS_COLORS[String(n.riskLevel)])}>{String(n.riskLevel)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {!activity?.length
                ? <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
                : activity.map((log: Record<string, unknown>) => {
                  const user = log.user as Record<string, unknown> | null;
                  return (
                    <div key={String(log.id)} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {user ? `${String(user.firstName)[0]}${String(user.lastName)[0]}` : 'S'}
                      </div>
                      <div>
                        <p className="text-sm">{String(log.description)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(String(log.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
