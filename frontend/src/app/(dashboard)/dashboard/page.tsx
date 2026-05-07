'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn, STATUS_COLORS } from '@/lib/utils';
import {
  Users, FileCheck, AlertCircle, Receipt, Zap, TrendingUp,
  Clock, CheckSquare, ArrowUpRight, ArrowDownRight, Shield,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function StatCard({
  title, value, subtitle, icon: Icon, trend, color = 'blue',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.value >= 0
            ? <ArrowUpRight className="h-3 w-3 text-green-500" />
            : <ArrowDownRight className="h-3 w-3 text-red-500" />}
          <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-600'}>
            {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data.data),
  });

  const { data: dueDates } = useQuery({
    queryKey: ['dashboard-due-dates'],
    queryFn: () => api.get('/dashboard/due-dates').then((r) => r.data.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => api.get('/dashboard/activity').then((r) => r.data.data),
  });

  const { data: filingAnalytics } = useQuery({
    queryKey: ['filing-analytics'],
    queryFn: () => api.get('/dashboard/filing-analytics').then((r) => r.data.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ['revenue-summary'],
    queryFn: () => api.get('/billing/revenue').then((r) => r.data.data),
  });

  const filingStatusData = filingAnalytics
    ? Object.entries(filingAnalytics.byStatus).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard title="Total Clients" value={stats?.clients?.total || 0} subtitle={`${stats?.clients?.active || 0} active`} icon={Users} color="blue" trend={{ value: 8, label: 'this month' }} />
          <StatCard title="Pending Filings" value={stats?.filings?.pending || 0} subtitle={`${stats?.filings?.overdue || 0} overdue`} icon={FileCheck} color="yellow" />
          <StatCard title="Open Notices" value={stats?.notices?.total || 0} subtitle={`${stats?.notices?.gst || 0} GST · ${stats?.notices?.incomeTax || 0} IT`} icon={AlertCircle} color="red" />
          <StatCard title="Open Tasks" value={stats?.tasks?.open || 0} subtitle={`${stats?.tasks?.overdue || 0} overdue`} icon={CheckSquare} color="purple" />
          <StatCard title="Monthly Revenue" value={formatCurrency(stats?.billing?.monthlyRevenue || 0)} subtitle="Current month" icon={TrendingUp} color="green" trend={{ value: 12, label: 'vs last month' }} />
          <StatCard title="Outstanding Fees" value={formatCurrency(stats?.billing?.outstanding || 0)} subtitle="Unpaid invoices" icon={Receipt} color="red" />
          <StatCard title="Automation" value={`${stats?.automation?.running || 0} running`} subtitle={`${stats?.automation?.failed || 0} failed`} icon={Zap} color="blue" />
          <StatCard title="Compliance Rate" value="92%" subtitle="Filings on time" icon={Shield} color="green" trend={{ value: 4, label: 'vs last month' }} />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Billed vs collected — current year</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenue?.monthly || []}>
                <defs>
                  <linearGradient id="gradBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tickFormatter={(m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="billed" stroke="#3b82f6" fill="url(#gradBilled)" name="Billed" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" stroke="#10b981" fill="url(#gradCollected)" name="Collected" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Filing status pie */}
        <Card>
          <CardHeader>
            <CardTitle>Filing Status</CardTitle>
            <CardDescription>Current year distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={filingStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {filingStatusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full">
              {filingStatusData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="ml-auto font-medium">{String(entry.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming due dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Upcoming Due Dates
            </CardTitle>
            <CardDescription>Next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {!dueDates?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming filings</p>
            ) : (
              <div className="space-y-2">
                {dueDates.slice(0, 8).map((d: Record<string, unknown>) => (
                  <div key={String(d.id)} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{String((d.client as Record<string, unknown>)?.name)}</p>
                      <p className="text-xs text-muted-foreground">{String(d.complianceType)} · {String(d.period)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-orange-600">{formatDate(String(d.dueDate))}</p>
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[String(d.status)])}>
                        {String(d.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {!activity?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {activity.slice(0, 8).map((log: Record<string, unknown>) => {
                  const user = log.user as Record<string, unknown> | null;
                  const client = log.client as Record<string, unknown> | null;
                  return (
                    <div key={String(log.id)} className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {user ? `${String(user.firstName)[0]}${String(user.lastName)[0]}` : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-medium">
                            {user ? `${user.firstName} ${user.lastName}` : 'System'}
                          </span>{' '}
                          <span className="text-muted-foreground">{String(log.description)}</span>
                          {client && <span className="font-medium"> · {String(client.name)}</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(String(log.createdAt), 'dd MMM, HH:mm')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
