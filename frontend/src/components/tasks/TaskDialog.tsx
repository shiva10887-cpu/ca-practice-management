'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  title: z.string().min(2, 'Title required'),
  description: z.string().optional(),
  category: z.string().default('INTERNAL'),
  priority: z.string().default('MEDIUM'),
  clientId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function TaskDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();

  const { data: clients } = useQuery({
    queryKey: ['clients-minimal'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then((r) => r.data.data),
    enabled: open,
  });

  const { data: users } = useQuery({
    queryKey: ['users-minimal'],
    queryFn: () => api.get('/team/users', { params: { limit: 50 } }).then((r) => r.data.data),
    enabled: open,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'INTERNAL', priority: 'MEDIUM' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/tasks', {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      estimatedHours: data.estimatedHours ? Number(data.estimatedHours) : undefined,
      clientId: data.clientId || undefined,
      assigneeId: data.assigneeId || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Task created' });
      onSuccess();
      onClose();
      reset();
    },
    onError: () => toast({ title: 'Failed to create task', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input {...register('title')} placeholder="Task title" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea {...register('description')} className="w-full min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GST', 'INCOME_TAX', 'AUDIT', 'ROC', 'INTERNAL', 'FOLLOW_UP', 'TDS', 'OTHER'].map((c) => (
                    <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={watch('clientId')} onValueChange={(v) => setValue('clientId', v)}>
              <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
              <SelectContent>
                {(clients || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assignee</Label>
            <Select value={watch('assigneeId')} onValueChange={(v) => setValue('assigneeId', v)}>
              <SelectTrigger><SelectValue placeholder="Select assignee (optional)" /></SelectTrigger>
              <SelectContent>
                {(users || []).map((u: { id: string; firstName: string; lastName: string }) => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Est. Hours</Label>
              <Input type="number" step="0.5" {...register('estimatedHours')} placeholder="2.5" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
