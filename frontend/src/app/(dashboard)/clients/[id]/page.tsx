'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, cn, STATUS_COLORS } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, MapPin, FileCheck, AlertCircle, CheckSquare, FolderOpen, Receipt, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CredentialsTab } from '@/components/clients/CredentialsTab';

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') ?? 'overview';

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
