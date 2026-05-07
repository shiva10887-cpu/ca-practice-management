'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import api from '@/lib/api';
import { bytesToHuman, formatDate, cn } from '@/lib/utils';
import { Upload, FolderOpen, File, Download, Trash2, Share2, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const FOLDERS = ['/GST', '/IncomeTax', '/Audit', '/Notices', '/Financials', '/Agreements', '/Miscellaneous'];

export default function DocumentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients-minimal'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then((r) => r.data.data),
  });

  const { data: docs, isLoading } = useQuery({
    queryKey: ['documents', selectedClientId, selectedFolder, search],
    queryFn: () =>
      api.get('/documents', {
        params: {
          clientId: selectedClientId || undefined,
          folder: selectedFolder || undefined,
          search: search || undefined,
          limit: 50,
        },
      }).then((r) => r.data.data),
  });

  const onDrop = useCallback(async (files: File[]) => {
    if (!selectedClientId) {
      toast({ title: 'Select a client first', variant: 'destructive' });
      return;
    }

    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('clientId', selectedClientId);
      fd.append('folder', selectedFolder || '/Miscellaneous');
      try {
        await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch {
        toast({ title: `Failed to upload ${file.name}`, variant: 'destructive' });
      }
    }
    setUploading(false);
    qc.invalidateQueries({ queryKey: ['documents'] });
    toast({ title: `${files.length} file(s) uploaded` });
  }, [selectedClientId, selectedFolder, qc, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: false });

  const deleteDoc = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast({ title: 'Document deleted' }); },
  });

  const openDoc = async (id: string, name: string) => {
    const { data } = await api.get(`/documents/${id}/url`);
    window.open(data.data.url, '_blank');
  };

  const getMimeIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('image')) return '🖼';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return '📊';
    if (mimeType?.includes('word')) return '📝';
    return '📎';
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="text-sm text-muted-foreground">Client-wise secure document management</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>
            {(clients || []).map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedFolder} onValueChange={(v) => setSelectedFolder(v === 'ALL' ? '' : v)}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All Folders" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Folders</SelectItem>
            {FOLDERS.map((f) => <SelectItem key={f} value={f}>{f.replace('/', '')}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search files..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Upload zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          uploading && 'opacity-60 pointer-events-none',
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('h-6 w-6 mx-auto mb-2 text-muted-foreground', uploading && 'animate-bounce')} />
        <p className="text-sm font-medium">{uploading ? 'Uploading...' : isDragActive ? 'Drop files here' : 'Drag & drop files or click to upload'}</p>
        <p className="text-xs text-muted-foreground mt-1">Max 50MB per file · PDF, Excel, Word, Images</p>
        {!selectedClientId && <p className="text-xs text-orange-500 mt-1">Select a client first</p>}
      </div>

      {/* Folder sidebar + file grid */}
      <div className="flex gap-6">
        {/* Folder list */}
        <div className="hidden md:block w-44 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Folders</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFolder('')}
              className={cn('w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-muted transition-colors', !selectedFolder && 'bg-muted font-medium')}
            >
              <FolderOpen className="h-3.5 w-3.5" /> All Files
            </button>
            {FOLDERS.map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFolder(f)}
                className={cn('w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-muted transition-colors', selectedFolder === f && 'bg-muted font-medium')}
              >
                <FolderOpen className="h-3.5 w-3.5" /> {f.replace('/', '')}
              </button>
            ))}
          </div>
        </div>

        {/* File grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : !docs?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <File className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>{selectedClientId ? 'No documents found' : 'Select a client to view documents'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(docs as Record<string, unknown>[]).map((doc) => (
                <div key={String(doc.id)} className="group bg-card border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDoc(String(doc.id), String(doc.name))}>
                  <div className="text-3xl mb-2">{getMimeIcon(String(doc.mimeType))}</div>
                  <p className="text-sm font-medium truncate">{String(doc.name)}</p>
                  <p className="text-xs text-muted-foreground">{String(doc.folder).replace('/', '')} · {bytesToHuman(Number(doc.fileSize))}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(String(doc.updatedAt))}</p>

                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDoc(String(doc.id), String(doc.name)); }}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDoc.mutate(String(doc.id)); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
