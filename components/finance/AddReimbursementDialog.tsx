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
import { Textarea } from '@/components/ui/textarea';

export function AddReimbursementDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    person: '',
    mobile_number: '',
    expense_id: '',
    amount: '',
    status: 'Pending',
    money_type_paid: '',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    const { count: rawCount } = await supabase.from('reimbursements').select('*', { count: 'exact', head: true });
    const nextId = `REIM-${String(Number(rawCount ?? 0) + 1).padStart(3, '0')}`;

    startTransition(async () => {
      const { error: err } = await supabase.from('reimbursements').insert({
        id: nextId,
        date: form.date,
        person: form.person,
        mobile_number: form.mobile_number || null,
        expense_id: form.expense_id,
        amount: parseFloat(form.amount),
        status: form.status,
        money_type_paid: form.status === 'Paid' && form.money_type_paid ? form.money_type_paid : null,
        notes: form.notes || null,
      });

      if (err) {
        setError(err.message);
      } else {
        setOpen(false);
        setForm({
          date: new Date().toISOString().split('T')[0],
          person: '',
          mobile_number: '',
          expense_id: '',
          amount: '',
          status: 'Pending',
          money_type_paid: '',
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
            id="add-reimb-btn"
            className="gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-md shadow-cyan-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Reimbursement
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Reimbursement Record</DialogTitle>
          <DialogDescription>Log a personal expense reimbursement settlement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-date">Date</Label>
              <Input id="reimb-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reimb-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger id="reimb-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-person">Person Name</Label>
              <Input id="reimb-person" placeholder="Person being reimbursed" value={form.person} onChange={(e) => set('person', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reimb-mobile">Mobile Number</Label>
              <Input id="reimb-mobile" type="tel" placeholder="Mobile (optional)" value={form.mobile_number} onChange={(e) => set('mobile_number', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-exp">Expense ID</Label>
              <Input id="reimb-exp" placeholder="EXP-XXXX" value={form.expense_id} onChange={(e) => set('expense_id', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reimb-amount">Amount (₹)</Label>
              <Input id="reimb-amount" type="number" min="1" step="1" placeholder="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
            </div>
          </div>

          {form.status === 'Paid' && (
            <div className="space-y-1.5">
              <Label htmlFor="reimb-money-type">Paid Via</Label>
              <Select value={form.money_type_paid} onValueChange={(v) => set('money_type_paid', v ?? '')}>
                <SelectTrigger id="reimb-money-type"><SelectValue placeholder="Cash / UPI" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reimb-notes">Notes</Label>
            <Textarea id="reimb-notes" placeholder="Optional notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-cyan-600 to-sky-600 text-white">
              {isPending ? 'Saving…' : 'Add Reimbursement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
