'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { SkeletonList } from '@/components/ui/Skeleton';
import { ListViewLayout, ListRow, StatusBadge } from '@/components/ui/ListView';
import { useViewMode, useVisibleColumns, ReportViewControls, ReportTable, exportToExcel, ReportColumn } from '@/components/ui/ReportView';
import { PurchaseInvoice } from '@/types';
import { FileText, Wallet } from 'lucide-react';

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'orange'> = {
  Submitted: 'blue',
  'Partially Paid': 'orange',
  Paid: 'green',
};

const REPORT_COLUMNS: ReportColumn<PurchaseInvoice>[] = [
  { key: 'pi_id', header: 'Invoice ID' },
  { key: 'po_id', header: 'PO' },
  { key: 'supplier_name', header: 'Supplier' },
  { key: 'posting_date', header: 'Posting Date' },
  { key: 'due_date', header: 'Due Date' },
  { key: 'grand_total', header: 'Grand Total', align: 'right', render: (r) => r.grand_total.toLocaleString('id-ID') },
  { key: 'outstanding_amount', header: 'Outstanding', align: 'right', render: (r) => r.outstanding_amount.toLocaleString('id-ID') },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge label={r.status} tone={STATUS_TONE[r.status] || 'gray'} /> },
];
const DEFAULT_VISIBLE = REPORT_COLUMNS.map((c) => c.key);

export default function PurchaseInvoicesTab() {
  const router = useRouter();
  const [viewMode, setViewMode] = useViewMode('purchasing_invoices_view');
  const [visibleCols, setVisibleCols] = useVisibleColumns('purchasing_invoices_cols', DEFAULT_VISIBLE);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payModalInvoice, setPayModalInvoice] = useState<PurchaseInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/purchase-invoices');
      if (res.ok) setInvoices(await res.json());
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openPay = (inv: PurchaseInvoice) => {
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
          payment_type: 'Pay',
          party_type: 'Supplier',
          party_id: payModalInvoice.supplier_id,
          reference_type: 'Purchase Invoice',
          reference_id: payModalInvoice.pi_id,
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
      console.error('Error paying invoice:', error);
      setError('Gagal memproses pembayaran');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ListViewLayout
      primaryAction={
        <ReportViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          columns={REPORT_COLUMNS}
          visibleColumns={visibleCols}
          onVisibleColumnsChange={setVisibleCols}
          onExport={() => exportToExcel(invoices, REPORT_COLUMNS, 'purchase_invoices', 'Purchase Invoices')}
        />
      }
    >
      {isLoading ? (
        <SkeletonList />
      ) : viewMode === 'report' ? (
        <ReportTable columns={REPORT_COLUMNS} visibleColumns={visibleCols} rows={invoices} keyField={(r) => r.pi_id} />
      ) : invoices.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">No invoices found. Invoice dibuat dari tab Purchase Orders (setelah PO diterima).</p>
      ) : (
        invoices.map((inv) => (
          <ListRow
            key={inv.pi_id}
            onClick={() => router.push(`/dashboard/purchasing/purchase-invoice/${encodeURIComponent(inv.pi_id)}`)}
            avatar={<span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center"><FileText size={14} /></span>}
            title={inv.pi_id}
            statusTone={STATUS_TONE[inv.status] || 'gray'}
            subtitle={`${inv.supplier_name} · PO ${inv.po_id}`}
            meta={`Sisa: Rp${inv.outstanding_amount.toLocaleString('id-ID')} / Rp${inv.grand_total.toLocaleString('id-ID')}`}
            badges={<StatusBadge label={inv.status} tone={STATUS_TONE[inv.status] || 'gray'} />}
            actions={
              inv.outstanding_amount > 0 ? (
                <button onClick={() => openPay(inv)} title="Pay" className="text-green-600 hover:text-green-800 dark:text-green-400">
                  <Wallet size={14} />
                </button>
              ) : undefined
            }
          />
        ))
      )}

      <Modal isOpen={!!payModalInvoice} onClose={() => setPayModalInvoice(null)} title="Pay Invoice" size="sm">
        <form onSubmit={handlePay} className="space-y-3">
          <p className="text-xs text-gray-500">Invoice: {payModalInvoice?.pi_id} · Sisa: Rp{payModalInvoice?.outstanding_amount.toLocaleString('id-ID')}</p>
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
            <Button type="submit" variant="primary" isLoading={isSaving}>Pay</Button>
          </div>
        </form>
      </Modal>
    </ListViewLayout>
  );
}
