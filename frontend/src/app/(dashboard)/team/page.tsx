'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, formatDate, formatNumber } from '@/lib/utils';
import { UserPlus, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ROLES = ['PARTNER', 'MANAGER', 'ARTICLE_ASSISTANT', 'ACCOUNTANT'];

export default function TeamPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'ACCOUNTANT', phone: '' });

  const { data: users } = useQuery({
    queryKey: ['team-users'],
    queryFn: () => api.get('/team/users', { params: { limit: 50 } }).then((r) => r.data.data),
  });

  const { data: productivity } = useQuery({
    queryKey: ['productivity'],
    queryFn: () => api.get('/team/productivity').then((r) => r.data.data),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/team/users/invite', inviteForm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team-users'] });
      setShowInvite(false);
      toast({
        title: 'User invited',
        description: `Temp password: ${res.data.data.tempPassword} — share securely`,
      });
    },
    onError: () => toast({ title: 'Invite failed', variant: 'destructive' }),
  });

  const ROLE_COLORS: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-700',
    PARTNER: 'bg-blue-100 text-blue-700',
    MANAGER: 'bg-green-100 text-green-700',
    ARTICLE_ASSISTANT: 'bg-yellow-100 text-yellow-700',
    ACCOUNTANT: 'bg-gray-100 text-gray-700',
    CLIENT: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="text-sm text-muted-foreground">User management & productivity</p>
        </div>
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Invite User
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Team Members</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {['Member', 'Role', 'Status', 'Last Login', 'Joined'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(users || []).map((user: Record<string, unknown>) => (
                    <tr key={String(user.id)} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {String(user.firstName)[0]}{String(user.lastName)[0]}
                          </div>
                          <div>
                            <p className="font-medium">{user.firstName as string} {user.lastName as string}</p>
                            <p className="text-xs text-muted-foreground">{user.email as string}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[String(user.role)] || 'bg-gray-100 text-gray-700')}>
                          {String(user.role).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('status-badge', STATUS_COLORS[String(user.status)])}>{user.status as string}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {user.lastLoginAt ? formatDate(String(user.lastLoginAt), 'dd MMM, HH:mm') : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(String(user.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="productivity" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(productivity || []).map((stat: Record<string, unknown>) => {
              const user = stat.user as Record<string, unknown>;
              return (
                <Card key={String(user.id)} className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {String(user.firstName)[0]}{String(user.lastName)[0]}
                    </div>
                    <div>
                      <p className="font-medium">{user.firstName as string} {user.lastName as string}</p>
                      <p className="text-xs text-muted-foreground">{Number(stat.completionRate)}% completion rate</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold text-green-600">{Number(stat.completedTasks)}</p>
                      <p className="text-[10px] text-muted-foreground">Completed</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold">{Number(stat.assignedTasks)}</p>
                      <p className="text-[10px] text-muted-foreground">Assigned</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-600">{Number(stat.hoursLogged)}h</p>
                      <p className="text-[10px] text-muted-foreground">Logged</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Completion</span><span>{Number(stat.completionRate)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Number(stat.completionRate)}%` }} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={() => setShowInvite(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={inviteForm.firstName} onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={inviteForm.lastName} onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={inviteForm.phone} onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !inviteForm.email || !inviteForm.firstName}>
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
