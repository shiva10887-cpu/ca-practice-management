'use client';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface LineItem { description: string; quantity: number; rate: number; taxRate: number; }
interface FormData {
  clientId: string;
  dueDate: string;
  notes: string;
  lineItems: LineItem[];
}

export function InvoiceDialog({ open, onClose, onSuccess }: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState('');

  const { data: clients } = useQuery({
    queryKey: ['clients-minimal'],
    queryFn: () => api.get('/clients', { params: { limit: 100 } }).then((r) => r.data.data),
    enabled: open,
  });

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<FormData>({
    defaultValues: {
      lineItems: [{ description: '', quantity: 1, rate: 0, taxRate: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = watch('lineItems');

  const subtotal = lineItems.reduce((s, item) => s + (Number(item.quantity) * Number(item.rate)), 0);
  const taxAmount = lineItems.reduce((s, item) => s + (Number(item.quantity) * Number(item.rate) * Number(item.taxRate) / 100), 0);
  const total = subtotal + taxAmount;

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/billing/invoices', {
      ...data,
      clientId,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      lineItems: data.lineItems.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        taxRate: Number(item.taxRate),
      })),
    }),
    onSuccess: () => {
      toast({ title: 'Invoice created' });
      onSuccess();
      onClose();
      reset();
      setClientId('');
    },
    onError: () => toast({ title: 'Failed to create invoice', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <Label>Line Items</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-center font-medium w-20">Qty</th>
                    <th className="px-3 py-2 text-center font-medium w-28">Rate (₹)</th>
                    <th className="px-3 py-2 text-center font-medium w-20">GST%</th>
                    <th className="px-3 py-2 text-right font-medium w-28">Amount</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fields.map((field, i) => (
                    <tr key={field.id}>
                      <td className="px-3 py-2">
                        <Input {...register(`lineItems.${i}.description`)} placeholder="Service description" className="h-8 border-0 focus:ring-0 p-0 text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Input {...register(`lineItems.${i}.quantity`)} type="number" min="0.01" step="0.01" className="h-8 text-center w-full text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Input {...register(`lineItems.${i}.rate`)} type="number" min="0" className="h-8 text-center w-full text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Input {...register(`lineItems.${i}.taxRate`)} type="number" min="0" max="28" className="h-8 text-center w-full text-sm" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatCurrency(Number(lineItems[i]?.quantity) * Number(lineItems[i]?.rate))}
                      </td>
                      <td className="px-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)} disabled={fields.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, rate: 0, taxRate: 18 })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
          </div>

          {/* Totals */}
          <div className="ml-auto w-64 space-y-1.5 text-sm border rounded-lg p-3 bg-muted/30">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span><span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-1.5">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input {...register('notes')} placeholder="Payment terms, bank details..." />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !clientId}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
