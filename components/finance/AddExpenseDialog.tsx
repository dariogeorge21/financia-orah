'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES = [
  'Food',
  'Venue',
  'Transport',
  'Accommodation',
  'Printing',
  'Decoration',
  'Equipment',
  'Media',
  'Marketing',
  'Stationery',
  'Security',
  'Medical',
  'Miscellaneous',
];

export function AddExpenseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasReceipt, setHasReceipt] = useState(false);

  const [form, setForm] = useState({
    category: '',
    description: '',
    amount: '',
    money_type: '',
    paid_by: '',
    mobile_number: '',
    payment_source: 'Event',
    status: 'Approved',
    receipt_link: '',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.category || !form.money_type || !form.paid_by) {
      setError('Please fill all required fields (Category, Paid By, Money Type).');
      return;
    }

    const supabase = createClient();
    const { count: rawCount } = await supabase.from('expenses').select('*', { count: 'exact', head: true });
    const nextId = `EXP-${String(Number(rawCount ?? 0) + 1).padStart(4, '0')}`;

    startTransition(async () => {
      const { error: err } = await supabase.from('expenses').insert({
        id: nextId,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        money_type: form.money_type,
        paid_by: form.paid_by,
        mobile_number: form.mobile_number || null,
        payment_source: form.payment_source,
        status: form.status,
        has_receipt: hasReceipt,
        receipt_link: form.receipt_link || null,
        notes: form.notes || null,
      });

      if (err) {
        setError(err.message);
      } else {
        setOpen(false);
        setForm({
          category: '',
          description: '',
          amount: '',
          money_type: '',
          paid_by: '',
          mobile_number: '',
          payment_source: 'Event',
          status: 'Approved',
          receipt_link: '',
          notes: '',
        });
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            id="add-expense-btn"
            className="gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-md shadow-rose-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Expense
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Record a new expenditure item for the event.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-cat">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
                <SelectTrigger id="exp-cat"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger id="exp-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description</Label>
            <Input id="exp-desc" placeholder="What was this for?" value={form.description} onChange={(e) => set('description', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-paid-by">Paid By</Label>
              <Input id="exp-paid-by" placeholder="Person / Treasurer" value={form.paid_by} onChange={(e) => set('paid_by', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-mobile">Mobile Number</Label>
              <Input id="exp-mobile" type="tel" placeholder="Mobile (optional)" value={form.mobile_number} onChange={(e) => set('mobile_number', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-amount">Amount (₹)</Label>
              <Input id="exp-amount" type="number" min="1" step="1" placeholder="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-money-type">Money Type</Label>
              <Select value={form.money_type} onValueChange={(v) => set('money_type', v ?? '')}>
                <SelectTrigger id="exp-money-type"><SelectValue placeholder="Cash / UPI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-source">Payment Source</Label>
            <Select value={form.payment_source} onValueChange={(v) => set('payment_source', v ?? '')}>
              <SelectTrigger id="exp-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Event">Event (Direct from Event balance)</SelectItem>
                <SelectItem value="Personal">Personal (Paid from personal pocket - needs reimbursement)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="exp-receipt" checked={hasReceipt} onCheckedChange={setHasReceipt} />
            <Label htmlFor="exp-receipt">Has Receipt / Invoice</Label>
          </div>

          {hasReceipt && (
            <div className="space-y-1.5">
              <Label htmlFor="exp-receipt-link">Receipt Image URL / Drive Link</Label>
              <Input id="exp-receipt-link" placeholder="https://..." value={form.receipt_link} onChange={(e) => set('receipt_link', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea id="exp-notes" placeholder="Optional notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-rose-600 to-pink-600 text-white">
              {isPending ? 'Saving…' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
