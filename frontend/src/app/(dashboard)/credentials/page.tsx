'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Eye, EyeOff, Plus, Shield, KeyRound, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const PORTALS = ['GST_PORTAL', 'INCOME_TAX', 'TRACES', 'MCA', 'EPFO', 'ESI'];

const PORTAL_ICONS: Record<string, string> = {
  GST_PORTAL: '🏛',
  INCOME_TAX: '📊',
  TRACES: '📋',
  MCA: '🏢',
  EPFO: '👥',
  ESI: '🏥',
};

interface RevealData {
  username: string;
  password: string;
  registeredMobile?: string;
  registeredEmail?: string;
}

function CredentialCard({ cred, clientId }: { cred: Record<string, unknown>; clientId: string }) {
  const { toast } = useToast();
  const [otp, setOtp] = useState('');
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [revealed, setRevealed] = useState<RevealData | null>(null);

  const requestOtpMutation = useMutation({
    mutationFn: () => api.post(`/credentials/${cred.id}/request-reveal`),
    onSuccess: () => { setShowOtpDialog(true); toast({ title: 'OTP sent to your email' }); },
  });

  const revealMutation = useMutation({
    mutationFn: () => api.post(`/credentials/${cred.id}/reveal`, { otp }),
    onSuccess: (res) => {
      setRevealed(res.data.data);
      setShowOtpDialog(false);
      setOtp('');
    },
    onError: () => toast({ title: 'Invalid OTP', variant: 'destructive' }),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <>
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{PORTAL_ICONS[String(cred.portal)] || '🔑'}</div>
            <div>
              <p className="font-semibold">{String(cred.portal).replace('_', ' ')}</p>
              {cred.otpContactPerson && (
                <p className="text-xs text-muted-foreground">OTP Contact: {String(cred.otpContactPerson)}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {revealed ? (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setRevealed(null)}>
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => requestOtpMutation.mutate()} disabled={requestOtpMutation.isPending}>
                {requestOtpMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                Reveal
              </Button>
            )}
          </div>
        </div>

        {revealed && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {[
              { label: 'Username', value: revealed.username },
              { label: 'Password', value: revealed.password },
              ...(revealed.registeredMobile ? [{ label: 'Mobile', value: revealed.registeredMobile }] : []),
              ...(revealed.registeredEmail ? [{ label: 'Email', value: revealed.registeredEmail }] : []),
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                  <p className="text-sm font-mono font-medium">{item.value}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(item.value)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* OTP Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={() => setShowOtpDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" /> Enter OTP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">An OTP has been sent to your registered email. Enter it to reveal credentials.</p>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              maxLength={6}
              className="text-center text-2xl font-mono tracking-widest"
            />
            <Button className="w-full" onClick={() => revealMutation.mutate()} disabled={otp.length !== 6 || revealMutation.isPending}>
              {revealMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify & Reveal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CredentialsPage() {
  const [selectedClientId, setSelectedClientId] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-minimal'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then((r) => r.data.data),
  });

  const { data: credentials } = useQuery({
    queryKey: ['credentials', selectedClientId],
    queryFn: () => api.get(`/credentials/${selectedClientId}`).then((r) => r.data.data),
    enabled: !!selectedClientId,
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Credential Vault</h1>
          <p className="text-sm text-muted-foreground">AES-256 encrypted portal credentials</p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-400">Security Notice</p>
          <p className="text-amber-700 dark:text-amber-300/70 text-xs mt-0.5">
            All credentials are encrypted with AES-256. An OTP is required to reveal passwords. All access is logged.
          </p>
        </div>
      </div>

      <div className="max-w-sm">
        <Label>Select Client</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder="Choose a client to view credentials" />
          </SelectTrigger>
          <SelectContent>
            {(clients || []).map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedClientId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!credentials?.length
            ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>No credentials stored for this client</p>
              </div>
            )
            : credentials.map((cred: Record<string, unknown>) => (
                <CredentialCard key={String(cred.id)} cred={cred} clientId={selectedClientId} />
              ))}
        </div>
      )}
    </div>
  );
}
