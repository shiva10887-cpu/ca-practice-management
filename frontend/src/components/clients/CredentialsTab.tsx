'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Eye, EyeOff, Pencil, Trash2, Shield, Upload, Download } from 'lucide-react';
import { CredentialImportDialog } from './CredentialImportDialog';

// ─── Portal config ───────────────────────────────────────────────────────────

interface PortalDef {
  value: string;
  label: string;
  notesLabel: string;
  showMobile?: boolean;
}

const PORTALS: PortalDef[] = [
  { value: 'INCOME_TAX',     label: 'Income Tax',              notesLabel: 'PAN',               showMobile: true },
  { value: 'GST_PORTAL',     label: 'GST',                     notesLabel: 'GSTIN' },
  { value: 'EWAY_BILL',      label: 'E-Way Bill',              notesLabel: 'GST Linked Account' },
  { value: 'E_INVOICE',      label: 'E-Invoice',               notesLabel: 'API Username / IRP' },
  { value: 'ESI',            label: 'ESI',                     notesLabel: 'Employer Code' },
  { value: 'EPFO',           label: 'PF (EPFO)',               notesLabel: 'Establishment ID' },
  { value: 'PT',             label: 'PT (Professional Tax)',   notesLabel: 'State' },
  { value: 'TAN_INCOME_TAX', label: 'TAN – Income Tax Login',  notesLabel: 'TAN Number' },
  { value: 'TRACES',         label: 'TAN – TRACES Login',      notesLabel: 'TAN + Deductor ID' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Credential {
  id: string;
  portal: string;
  otpContactPerson?: string;
  notes?: string;
  lastUsedAt?: string;
}

interface CredentialForm {
  portal: string;
  username: string;
  password: string;
  registeredMobile: string;
  registeredEmail: string;
  otpContactPerson: string;
  notes: string;
}

interface RevealedData {
  username: string;
  password: string;
  registeredMobile?: string;
  registeredEmail?: string;
}

const EMPTY_FORM: CredentialForm = {
  portal: 'INCOME_TAX',
  username: '',
  password: '',
  registeredMobile: '',
  registeredEmail: '',
  otpContactPerson: '',
  notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CredentialsTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [form, setForm] = useState<CredentialForm>(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [showImport, setShowImport] = useState(false);

  const [revealTarget, setRevealTarget] = useState<Credential | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [revealed, setRevealed] = useState<RevealedData | null>(null);

  const { data: credentials = [] } = useQuery<Credential[]>({
    queryKey: ['credentials', clientId],
    queryFn: () => api.get(`/credentials/${clientId}`).then((r) => r.data.data),
  });

  const credMap = new Map(credentials.map((c) => [c.portal, c]));

  const saveMutation = useMutation({
    mutationFn: (data: CredentialForm) =>
      editing
        ? api.put(`/credentials/${editing.id}`, data)
        : api.post('/credentials', { ...data, clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials', clientId] });
      closeForm();
      toast({ title: editing ? 'Login updated' : 'Login saved' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to save', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/credentials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials', clientId] });
      setDeleteTarget(null);
      toast({ title: 'Login deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: (id: string) => api.post(`/credentials/${id}/request-reveal`),
    onSuccess: () => { setOtpSent(true); toast({ title: 'OTP sent to your registered email' }); },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.response?.data?.message || 'Failed to send OTP', variant: 'destructive' });
    },
  });

  const revealMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) =>
      api.post(`/credentials/${id}/reveal`, { otp }).then((r) => r.data.data as RevealedData),
    onSuccess: (data) => { setRevealed(data); setOtpSent(false); setOtp(''); },
    onError: (err: any) => {
      toast({ title: 'Invalid OTP', description: err?.response?.data?.message || 'OTP incorrect or expired', variant: 'destructive' });
    },
  });

  function openAdd(portalValue: string) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, portal: portalValue });
    setShowPass(false);
    setFormOpen(true);
  }

  function openEdit(cred: Credential) {
    setEditing(cred);
    setForm({ ...EMPTY_FORM, portal: cred.portal, otpContactPerson: cred.otpContactPerson ?? '', notes: cred.notes ?? '' });
    setShowPass(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function openReveal(cred: Credential) {
    setRevealTarget(cred);
    setOtp('');
    setOtpSent(false);
    setRevealed(null);
  }

  function closeReveal() {
    setRevealTarget(null);
    setRevealed(null);
    setOtpSent(false);
    setOtp('');
  }

  const activePortalDef = PORTALS.find((p) => p.value === form.portal);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Encrypted login credentials stored per portal</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              api.get('/credentials/template', { responseType: 'blob' }).then((r) => {
                const url = window.URL.createObjectURL(r.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'credential_import_template.xlsx';
                a.click();
                window.URL.revokeObjectURL(url);
              })
            }
          >
            <Download className="h-4 w-4 mr-1.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import
          </Button>
          <Button size="sm" onClick={() => openAdd('INCOME_TAX')}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Login
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Portal / Service', 'User ID', 'Password', 'Notes / Extra Fields', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {PORTALS.map((portal) => {
                const cred = credMap.get(portal.value);
                return (
                  <tr key={portal.value} className="hover:bg-muted/20">
                    {/* Portal name */}
                    <td className="px-4 py-3 font-medium">{portal.label}</td>

                    {/* User ID */}
                    <td className="px-4 py-3">
                      {cred ? (
                        <span className="font-mono text-xs tracking-widest text-muted-foreground">••••••••</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Password */}
                    <td className="px-4 py-3">
                      {cred ? (
                        <span className="font-mono text-xs tracking-widest text-muted-foreground">••••••••</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Notes / extra fields */}
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      {cred?.notes ? (
                        <span>
                          <span className="font-medium text-foreground">{portal.notesLabel}:</span>{' '}
                          {cred.notes}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">{portal.notesLabel}</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {cred ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => openReveal(cred)}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(cred)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(cred)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => openAdd(portal.value)}
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Add / Edit dialog ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Update' : 'Add'} — {PORTALS.find((p) => p.value === form.portal)?.label}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update stored credentials. Leave password blank to keep existing value.'
                : 'Credentials are stored encrypted.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>User ID</Label>
                <Input
                  placeholder="Login username / user ID"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    placeholder={editing ? 'Leave blank to keep' : 'Password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Portal-specific extra field */}
            {activePortalDef && (
              <div className="space-y-1.5">
                <Label>{activePortalDef.notesLabel}</Label>
                <Input
                  placeholder={`Enter ${activePortalDef.notesLabel}`}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            )}

            {/* Registered mobile — shown for portals that use it */}
            {activePortalDef?.showMobile && (
              <div className="space-y-1.5">
                <Label>Registered Mobile</Label>
                <Input
                  placeholder="10-digit mobile"
                  value={form.registeredMobile}
                  onChange={(e) => setForm((f) => ({ ...f, registeredMobile: e.target.value }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>OTP Contact Person</Label>
                <Input
                  placeholder="Who receives OTP?"
                  value={form.otpContactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, otpContactPerson: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Registered Email</Label>
                <Input
                  placeholder="email@example.com"
                  value={form.registeredEmail}
                  onChange={(e) => setForm((f) => ({ ...f, registeredEmail: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              disabled={saveMutation.isPending || (!editing && (!form.username || !form.password))}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Login</DialogTitle>
            <DialogDescription>
              Delete stored credentials for{' '}
              <span className="font-semibold">
                {PORTALS.find((p) => p.value === deleteTarget?.portal)?.label}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal credentials dialog ──────────────────────────────────────── */}
      <Dialog open={!!revealTarget} onOpenChange={(o) => { if (!o) closeReveal(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {PORTALS.find((p) => p.value === revealTarget?.portal)?.label} — Credentials
            </DialogTitle>
            <DialogDescription>
              {revealed
                ? 'Showing decrypted credentials. Close when done.'
                : 'An OTP will be sent to your email to authorise access.'}
            </DialogDescription>
          </DialogHeader>

          {revealed ? (
            <div className="space-y-2 text-sm">
              {[
                ['User ID', revealed.username],
                ['Password', revealed.password],
                ['Mobile', revealed.registeredMobile],
                ['Email', revealed.registeredEmail],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center py-2 border-b last:border-0 gap-4">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded select-all break-all">{val}</span>
                </div>
              ))}
            </div>
          ) : otpSent ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter the 6-digit OTP sent to your email.</p>
              <Input
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click "Send OTP" to receive a one-time password on your registered email to view the credentials.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeReveal}>Close</Button>
            {!revealed && !otpSent && (
              <Button
                disabled={requestOtpMutation.isPending}
                onClick={() => revealTarget && requestOtpMutation.mutate(revealTarget.id)}
              >
                {requestOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
              </Button>
            )}
            {otpSent && !revealed && (
              <Button
                disabled={otp.length < 6 || revealMutation.isPending}
                onClick={() => revealTarget && revealMutation.mutate({ id: revealTarget.id, otp })}
              >
                {revealMutation.isPending ? 'Verifying...' : 'View Credentials'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ──────────────────────────────────────────────────── */}
      <CredentialImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['credentials', clientId] })}
      />
    </div>
  );
}
