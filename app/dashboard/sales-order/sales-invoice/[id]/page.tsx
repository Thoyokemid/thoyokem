'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { SalesInvoice } from '@/types';
import { AlertCircle, Wallet, Printer } from 'lucide-react';

interface PaymentEntry {
  payment_id: string;
  paid_amount: number;
  posting_date: string;
  mode_of_payment: string;
  status: string;
}

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'orange'> = {
  Submitted: 'blue',
  'Partially Paid': 'orange',
  Paid: 'green',
};

export default function SalesInvoiceDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session?.user.permissions.sales_order) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [invRes, payRes] = await Promise.all([
        fetch('/api/sales-invoices'),
        fetch(`/api/payments?reference_id=${encodeURIComponent(id)}`),
      ]);
      if (invRes.ok) {
        const list: SalesInvoice[] = await invRes.json();
        setInvoice(list.find((i) => i.si_id === id) || null);
      }
      if (payRes.ok) setPayments(await payRes.json());
    } catch (error) {
      console.error('Error fetching sales invoice:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openPay = () => {
    setPayAmount(String(invoice?.outstanding_amount || ''));
    setPayMode('Cash');
    setError('');
    setIsPayOpen(true);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_type: 'Receive',
          party_type: 'Customer',
          party_id: invoice.customer_id,
          reference_type: 'Sales Invoice',
          reference_id: invoice.si_id,
          paid_amount: parseFloat(payAmount) || 0,
          mode_of_payment: payMode,
        }),
      });
      if (res.ok) {
        setIsPayOpen(false);
        fetchData();
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

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading') return null;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.sales_order) {
    return (
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/sales-order"
        backLabel="Sales Invoices"
        title={invoice?.si_id || id}
        subtitle={invoice ? `${invoice.customer_name} · SO ${invoice.so_id}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !invoice}
        badges={invoice && <StatusBadge label={invoice.status} tone={STATUS_TONE[invoice.status] || 'gray'} />}
        actions={
          invoice && (
            <>
              <Button variant="secondary" onClick={() => router.push(`/dashboard/sales-order/sales-invoice/${encodeURIComponent(id)}/print?size=a4`)}>
                <Printer size={14} className="mr-1.5" />Print
              </Button>
              {invoice.outstanding_amount > 0 && (
                <Button variant="secondary" onClick={openPay}><Wallet size={14} className="mr-1.5" />Receive Payment</Button>
              )}
            </>
          )
        }
      >
        {invoice && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Customer', value: <Link href={`/dashboard/sales-order/customer/${encodeURIComponent(invoice.customer_id)}`} className="text-primary hover:underline">{invoice.customer_name}</Link> },
                  { label: 'Sales Order', value: <Link href={`/dashboard/sales-order/sales-order/${encodeURIComponent(invoice.so_id)}`} className="text-primary hover:underline">{invoice.so_id}</Link> },
                  { label: 'Delivery Note', value: invoice.dn_id ? <Link href={`/dashboard/delivery-order/delivery-note/${encodeURIComponent(invoice.dn_id)}`} className="text-primary hover:underline">{invoice.dn_id}</Link> : '-' },
                  { label: 'Posting Date', value: invoice.posting_date },
                  { label: 'Due Date', value: invoice.due_date || '-' },
                  { label: 'Grand Total', value: `Rp${invoice.grand_total.toLocaleString('id-ID')}` },
                  { label: 'Outstanding', value: `Rp${invoice.outstanding_amount.toLocaleString('id-ID')}` },
                ]}
              />
            </DetailSection>
            <DetailSection title="Payment History">
              <DetailTable
                columns={[
                  { key: 'payment_id', header: 'Payment' },
                  { key: 'posting_date', header: 'Date' },
                  { key: 'mode_of_payment', header: 'Mode' },
                  { key: 'paid_amount', header: 'Amount', align: 'right' },
                ]}
                rows={payments.map((p) => ({
                  payment_id: p.payment_id,
                  posting_date: p.posting_date,
                  mode_of_payment: p.mode_of_payment,
                  paid_amount: `Rp${p.paid_amount.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Sales Invoice" documentId={id} />
              <AttachmentSection doctype="Sales Invoice" documentId={id} />
            </DetailSection>
          </div>
        )}
      </DetailView>

      <Modal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} title="Receive Payment" size="sm">
        <form onSubmit={handlePay} className="space-y-3">
          <p className="text-xs text-gray-500">Invoice: {invoice?.si_id} · Sisa: Rp{invoice?.outstanding_amount.toLocaleString('id-ID')}</p>
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
            <Button type="button" variant="secondary" onClick={() => setIsPayOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>Pay</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
