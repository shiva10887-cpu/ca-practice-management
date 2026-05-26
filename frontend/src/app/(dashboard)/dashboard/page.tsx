'use client';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = [
  { label: 'All', value: 'ALL' },
  { label: 'GST', value: 'GST' },
  { label: 'Income Tax', value: 'INCOME_TAX' },
  { label: 'ROC', value: 'ROC' },
  { label: 'Audit', value: 'AUDIT' },
  { label: 'TDS', value: 'TDS' },
  { label: 'Payroll', value: 'PAYROLL' },
  { label: 'Other', value: 'OTHER' },
];

const TABS = ['Tasks', 'Todo', 'Live Time Tracking'];

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'In Review',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

const STATUS_ROW_COLORS: Record<string, string> = {
  TODO: 'text-gray-700',
  IN_PROGRESS: 'text-blue-700',
  REVIEW: 'text-purple-700',
  COMPLETED: 'text-green-700',
  OVERDUE: 'text-red-600',
  CANCELLED: 'text-gray-400',
};

interface StatCardProps {
  label: string;
  value: number;
  bgClass: string;
  labelClass: string;
  numClass: string;
  borderClass: string;
}

function StatCard({ label, value, bgClass, labelClass, numClass, borderClass }: StatCardProps) {
  return (
    <div className={cn('rounded-2xl p-4 flex flex-col shadow-sm border', bgClass, borderClass)}>
      <span className={cn('text-sm font-medium leading-tight', labelClass)}>{label}</span>
      <span className={cn('text-4xl font-bold mt-3', numClass)}>{value}</span>
    </div>
  );
}

interface TaskStat {
  dueToday: number;
  dueTomorrow: number;
  dueIn7Days: number;
  dueAfter7Days: number;
  dueIn30Days: number;
  overdueAfter30Days: number;
  overdueUpTo7Days: number;
  overdueMoreThan7Days: number;
  totalOverdue: number;
  tasksByStatus: { status: string; count: number }[];
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('Tasks');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const firstLoad = useRef(true);

  const { data: taskStats, isLoading, dataUpdatedAt } = useQuery<TaskStat>({
    queryKey: ['task-dashboard-stats', activeCategory],
    queryFn: () =>
      api.get('/dashboard/task-stats', { params: { category: activeCategory } }).then((r) => r.data.data),
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (dataUpdatedAt && !firstLoad.current) setLastRefreshed(new Date(dataUpdatedAt));
    if (dataUpdatedAt) firstLoad.current = false;
  }, [dataUpdatedAt]);

  const dueCards: StatCardProps[] = [
    {
      label: 'Due Today',
      value: taskStats?.dueToday ?? 0,
      bgClass: 'bg-yellow-50',
      borderClass: 'border-yellow-200',
      labelClass: 'text-yellow-700',
      numClass: 'text-yellow-800',
    },
    {
      label: 'Due Tomorrow',
      value: taskStats?.dueTomorrow ?? 0,
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
      labelClass: 'text-green-700',
      numClass: 'text-green-800',
    },
    {
      label: 'Due in 7 Days',
      value: taskStats?.dueIn7Days ?? 0,
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-200',
      labelClass: 'text-sky-600',
      numClass: 'text-blue-700',
    },
    {
      label: 'Due After 7 Days',
      value: taskStats?.dueAfter7Days ?? 0,
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-200',
      labelClass: 'text-sky-600',
      numClass: 'text-blue-700',
    },
    {
      label: 'Due in 30 Days',
      value: taskStats?.dueIn30Days ?? 0,
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-200',
      labelClass: 'text-sky-600',
      numClass: 'text-blue-700',
    },
  ];

  const overdueCards: StatCardProps[] = [
    {
      label: 'Overdue After 30 Days',
      value: taskStats?.overdueAfter30Days ?? 0,
      bgClass: 'bg-indigo-50',
      borderClass: 'border-indigo-200',
      labelClass: 'text-indigo-500',
      numClass: 'text-indigo-700',
    },
    {
      label: 'Overdue Up to 7 Days',
      value: taskStats?.overdueUpTo7Days ?? 0,
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      labelClass: 'text-rose-500',
      numClass: 'text-rose-600',
    },
    {
      label: 'Overdue More Than 7 Days',
      value: taskStats?.overdueMoreThan7Days ?? 0,
      bgClass: 'bg-red-100',
      borderClass: 'border-red-300',
      labelClass: 'text-red-500',
      numClass: 'text-red-700',
    },
    {
      label: 'Total Due',
      value: taskStats?.totalOverdue ?? 0,
      bgClass: 'bg-violet-50',
      borderClass: 'border-violet-200',
      labelClass: 'text-violet-500',
      numClass: 'text-violet-800',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-50 p-4 animate-fade-in">
      <div className="rounded-3xl overflow-hidden shadow-lg bg-white">
        {/* Purple Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <span className="text-xs text-white/80 bg-white/10 rounded-full px-3 py-1 border border-white/20">
            Last Refreshed: {format(lastRefreshed, 'dd MMM yyyy, hh:mm:ss aa')}
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-5 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Tasks' && (
            <>
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      activeCategory === cat.value
                        ? 'bg-indigo-700 text-white border-indigo-700'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Due Date Cards */}
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {dueCards.map((card) => <StatCard key={card.label} {...card} />)}
                </div>
              )}

              {/* Overdue Cards */}
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {overdueCards.map((card) => <StatCard key={card.label} {...card} />)}
                </div>
              )}

              {/* Task Summary by Status */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-800">All Task Summary - Statuswise</h2>
                  <button className="flex items-center gap-1.5 text-sm text-indigo-600 border border-indigo-300 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors">
                    Select task filter <Filter className="h-3.5 w-3.5" />
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase text-xs tracking-wider">Total Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2.5 px-3"><Skeleton className="h-4 w-24" /></td>
                            <td className="py-2.5 px-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                          </tr>
                        ))
                      : taskStats?.tasksByStatus?.length
                        ? taskStats.tasksByStatus.map((row) => (
                            <tr key={row.status} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className={cn('py-2.5 px-3 font-medium', STATUS_ROW_COLORS[row.status] ?? 'text-gray-700')}>
                                {STATUS_LABELS[row.status] ?? row.status}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">{row.count}</td>
                            </tr>
                          ))
                        : (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-gray-400 text-sm">No tasks found</td>
                          </tr>
                        )
                    }
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === 'Todo' && (
            <div className="py-16 text-center text-gray-400">
              <p className="text-lg font-medium">Todo</p>
              <p className="text-sm mt-1">Coming soon</p>
            </div>
          )}

          {activeTab === 'Live Time Tracking' && (
            <div className="py-16 text-center text-gray-400">
              <p className="text-lg font-medium">Live Time Tracking</p>
              <p className="text-sm mt-1">Coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
