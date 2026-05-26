'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; error: string }[];
}

export function CredentialImportDialog({ open, onClose, onSuccess }: {
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

  const importMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      const fd = new FormData();
      fd.append('file', file);
      return api.post<{ data: ImportResult }>('/credentials/import', fd, {
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
    onError: (err: any) => {
      toast({
        title: 'Import failed',
        description: err?.response?.data?.message || 'Please check your file and try again.',
        variant: 'destructive',
      });
    },
  });

  function handleClose() {
    setFile(null);
    setResult(null);
    onClose();
  }

  function downloadTemplate() {
    api.get('/credentials/template', { responseType: 'blob' }).then((r) => {
      const url = window.URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'credential_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Login Credentials</DialogTitle>
          <DialogDescription>
            Upload an Excel file to bulk-import credentials for multiple clients and portals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {!result ? (
            <>
              {/* Drop zone */}
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
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
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm">Drop your Excel or CSV file here</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv · Max 10 MB</p>
                  </>
                )}
              </div>

              {/* Column guide */}
              <div className="rounded-lg bg-muted/40 border p-3 space-y-2 text-xs">
                <p className="font-semibold text-foreground text-sm">Required columns</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                  <span><span className="font-medium text-foreground">Client PAN</span> — to match client</span>
                  <span><span className="font-medium text-foreground">Portal</span> — see Valid Portals sheet</span>
                  <span><span className="font-medium text-foreground">User ID</span> — login username</span>
                  <span><span className="font-medium text-foreground">Password</span> — stored encrypted</span>
                </div>
                <p className="text-muted-foreground">Optional: Notes / Extra Field, Registered Mobile, Registered Email, OTP Contact Person</p>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-primary hover:underline font-medium"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5" /> Download template with examples
                </button>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  disabled={!file || importMutation.isPending}
                  onClick={() => importMutation.mutate()}
                >
                  {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import
                </Button>
              </div>
            </>
          ) : (
            /* Results */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.created}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Created</p>
                </div>
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.updated}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Updated</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    {result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium">Row {e.row}:</span> {e.error}
                      </p>
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
