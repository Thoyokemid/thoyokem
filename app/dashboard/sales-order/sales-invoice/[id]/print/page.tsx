'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DocumentPrintLayout, { PaperSize } from '@/components/print/DocumentPrintLayout';
import { SalesInvoice, Customer } from '@/types';

export default function SalesInvoicePrintPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const size = (searchParams.get('size') as PaperSize) || 'a4';

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!session?.user.permissions.sales_order;

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [invRes, custRes] = await Promise.all([fetch('/api/sales-invoices'), fetch('/api/customers').catch(() => null)]);
      if (invRes.ok) {
        const list: SalesInvoice[] = await invRes.json();
        const found = list.find((i) => i.si_id === id) || null;
        setInvoice(found);
        if (found && custRes?.ok) {
          const custList: Customer[] = await custRes.json();
          setCustomer(custList.find((c) => c.customer_id === found.customer_id) || null);
        }
      }
    } catch (error) {
      console.error('Error fetching invoice for print:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' || isLoading) return null;
  if (!session) return null;
  if (!hasAccess) return <p className="p-6 text-sm text-red-600">You don't have permission to access this page.</p>;
  if (!invoice) return <p className="p-6 text-sm text-gray-500">Sales invoice tidak ditemukan.</p>;

  return (
    <DocumentPrintLayout
      size={size}
      backHref={`/dashboard/sales-order/sales-invoice/${encodeURIComponent(id)}`}
      printSizeBaseHref={`/dashboard/sales-order/sales-invoice/${encodeURIComponent(id)}/print`}
      docTitle="SALES INVOICE THOYOKEM"
      docId={invoice.si_id}
      partyLabel="Customer"
      partyName={invoice.customer_name || invoice.customer_id}
      partyAddress={customer?.address}
      partyPhone={customer?.phone}
      rightFields={[
        { label: 'No. Invoice', value: invoice.si_id },
        { label: 'No. SO', value: invoice.so_id },
        { label: 'Tanggal', value: invoice.posting_date },
        { label: 'Jatuh Tempo', value: invoice.due_date || '-' },
        { label: 'Status', value: invoice.status },
        { label: 'Outstanding', value: `Rp${invoice.outstanding_amount.toLocaleString('id-ID')}` },
      ]}
      items={invoice.items || []}
    />
  );
}
