'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate } from '@/lib/utils';
import { Plus, LayoutGrid, List, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { useToast } from '@/hooks/use-toast';

const COLUMNS = [
  { key: 'TODO', label: 'To Do', color: 'bg-gray-100 dark:bg-gray-800' },
  { key: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'REVIEW', label: 'Review', color: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'COMPLETED', label: 'Completed', color: 'bg-green-50 dark:bg-green-900/20' },
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  dueDate?: string;
  client?: { name: string };
  assignee?: { firstName: string; lastName: string; avatar?: string };
  checklist?: { isDone: boolean }[];
}

function TaskCard({ task, onUpdate }: { task: Task; onUpdate: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: () => api.put(`/tasks/${task.id}`, { status: 'COMPLETED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kanban'] }); onUpdate(); },
  });

  const progress = task.checklist?.length
    ? Math.round((task.checklist.filter((c) => c.isDone).length / task.checklist.length) * 100)
    : null;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';

  return (
    <div className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0', PRIORITY_COLORS[task.priority])}>
          {task.priority}
        </span>
      </div>

      {task.client && (
        <p className="text-xs text-muted-foreground">{task.client.name}</p>
      )}

      {progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Checklist</span><span>{progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {task.dueDate && (
          <div className={cn('flex items-center gap-1 text-[10px]', isOverdue ? 'text-red-600' : 'text-muted-foreground')}>
            {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {formatDate(task.dueDate)}
          </div>
        )}
        {task.assignee && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold ml-auto">
            {task.assignee.firstName[0]}{task.assignee.lastName[0]}
          </div>
        )}
      </div>

      {task.status !== 'COMPLETED' && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={(e) => { e.stopPropagation(); completeMutation.mutate(); }}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Complete
        </Button>
      )}
    </div>
  );
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [category, setCategory] = useState('');

  const { data: board, isLoading } = useQuery({
    queryKey: ['kanban', category],
    queryFn: () => api.get('/tasks/kanban', { params: category ? { category } : {} }).then((r) => r.data.data),
  });

  const { data: listData } = useQuery({
    queryKey: ['tasks', category],
    queryFn: () => api.get('/tasks', { params: { limit: 50, category: category || undefined } }).then((r) => r.data),
    enabled: view === 'list',
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage and track all tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {['GST', 'INCOME_TAX', 'AUDIT', 'ROC', 'INTERNAL', 'FOLLOW_UP', 'TDS'].map((c) => (
                <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md">
            <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="rounded-r-none" onClick={() => setView('kanban')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="rounded-l-none" onClick={() => setView('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Task
          </Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const tasks: Task[] = board?.[col.key] || [];
            return (
              <div key={col.key} className={cn('rounded-xl p-3 space-y-3', col.color)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="text-xs bg-background rounded-full px-2 py-0.5 font-medium">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onUpdate={() => qc.invalidateQueries({ queryKey: ['kanban'] })} />
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">No tasks</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {['Task', 'Client', 'Category', 'Priority', 'Assignee', 'Due Date', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(listData?.data || []).map((task: Task) => (
                  <tr key={task.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{task.title}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{task.client?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{task.category}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', PRIORITY_COLORS[task.priority])}>{task.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {task.dueDate
                        ? <span className={cn(new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'text-red-600 font-medium' : '')}>
                            {formatDate(task.dueDate)}
                          </span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('status-badge', STATUS_COLORS[task.status])}>{task.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TaskDialog open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['kanban', 'tasks'] })} />
    </div>
  );
}
