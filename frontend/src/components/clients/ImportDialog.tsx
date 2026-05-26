'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; error: string }[];
}

export function ImportDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onDrop = useCallback((files: File[]) => {
    setFile(files[0] || null);
    setResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file');
      const fd = new FormData();
      fd.append('file', file);
      return api.post<{ data: ImportResult }>('/clients/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data.data);
    },
    onSuccess: (data) => {
      setResult(data);
      onSuccess();
      if (data.errors.length === 0) {
        toast({ title: `Import complete — ${data.created} created, ${data.updated} updated` });
      }
    },
    onError: () => {
      toast({ title: 'Import failed', variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Clients</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!result ? (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                {file ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <p className="font-medium text-sm">{file.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm">Drop your Excel or CSV file here</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                  </>
                )}
              </div>

              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">Required columns:</p>
                <p>Legal Name, Trade Name, PAN, GSTIN, TAN, Business Type, Constitution Type, Email, Phone, Address, City, State, Pincode, Notes, GST USER ID, GST Password, Income tax Login password</p>
                <p className="text-primary cursor-pointer hover:underline" onClick={() =>
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
                  ↓ Download template
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
                  {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
                  <CheckCircle className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-blue-600">Updated</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {result.errors.length} errors
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">Row {e.row}: {e.error}</p>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full" onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
