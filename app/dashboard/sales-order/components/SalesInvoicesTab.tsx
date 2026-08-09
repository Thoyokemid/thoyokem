'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { SalesInvoice } from '@/types';
import { FileText, Wallet } from 'lucide-react';

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'orange'> = {
  Submitted: 'blue',
  'Partially Paid': 'orange',
  Paid: 'green',
};

export default function SalesInvoicesTab() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payModalInvoice, setPayModalInvoice] = useState<SalesInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/sales-invoices');
      if (res.ok) setInvoices(await res.json());
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openPay = (inv: SalesInvoice) => {
    setPayModalInvoice(inv);
    setPayAmount(String(inv.outstanding_amount));
    setPayMode('Cash');
    setError('');
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalInvoice) return;
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_type: 'Receive',
          party_type: 'Customer',
          party_id: payModalInvoice.customer_id,
          reference_type: 'Sales Invoice',
          reference_id: payModalInvoice.si_id,
          paid_amount: parseFloat(payAmount) || 0,
          mode_of_payment: payMode,
        }),
      });
      if (res.ok) {
        setPayModalInvoice(null);
        fetchInvoices();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal memproses pembayaran');
      }
    } catch (error) {
      console.error('Error receiving payment:', error);
      setError('Gagal memproses pembayaran');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ListViewLayout>
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loading size="lg" /></div>
      ) : invoices.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No invoices found. Invoice dibuat dari tab Sales Orders (setelah SO dikirim).</p>
      ) : (
        invoices.map((inv) => (
          <ListRow
            key={inv.si_id}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><FileText size={14} /></span>}
            title={inv.si_id}
            subtitle={`${inv.customer_name} · SO ${inv.so_id}`}
            meta={`Sisa: Rp${inv.outstanding_amount.toLocaleString('id-ID')} / Rp${inv.grand_total.toLocaleString('id-ID')}`}
            badges={<StatusBadge label={inv.status} tone={STATUS_TONE[inv.status] || 'gray'} />}
            actions={
              inv.outstanding_amount > 0 ? (
                <button onClick={() => openPay(inv)} title="Receive Payment" className="text-green-600 hover:text-green-800 dark:text-green-400">
                  <Wallet size={14} />
                </button>
              ) : undefined
            }
          />
        ))
      )}

      <Modal isOpen={!!payModalInvoice} onClose={() => setPayModalInvoice(null)} title="Receive Payment" size="sm">
        <form onSubmit={handlePay} className="space-y-3">
          <p className="text-xs text-gray-500">Invoice: {payModalInvoice?.si_id} · Sisa: Rp{payModalInvoice?.outstanding_amount.toLocaleString('id-ID')}</p>
          <div>
            <label className="label-field">Amount</label>
            <input type="number" min={0} step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="label-field">Mode of Payment</label>
            <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="input-field">
              <option value="Cash">Cash</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setPayModalInvoice(null)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Receive</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
