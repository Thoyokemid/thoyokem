'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DocumentPrintLayout, { PaperSize } from '@/components/print/DocumentPrintLayout';
import { PurchaseInvoice, Supplier } from '@/types';

export default function PurchaseInvoicePrintPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const size = (searchParams.get('size') as PaperSize) || 'a4';

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!session?.user.permissions.purchasing;

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [invRes, supRes] = await Promise.all([fetch('/api/purchase-invoices'), fetch('/api/suppliers').catch(() => null)]);
      if (invRes.ok) {
        const list: PurchaseInvoice[] = await invRes.json();
        const found = list.find((i) => i.pi_id === id) || null;
        setInvoice(found);
        if (found && supRes?.ok) {
          const supList: Supplier[] = await supRes.json();
          setSupplier(supList.find((s) => s.supplier_id === found.supplier_id) || null);
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
  if (!invoice) return <p className="p-6 text-sm text-gray-500">Purchase invoice tidak ditemukan.</p>;

  return (
    <DocumentPrintLayout
      size={size}
      backHref={`/dashboard/purchasing/purchase-invoice/${encodeURIComponent(id)}`}
      printSizeBaseHref={`/dashboard/purchasing/purchase-invoice/${encodeURIComponent(id)}/print`}
      docTitle="PURCHASE INVOICE THOYOKEM"
      docId={invoice.pi_id}
      partyLabel="Supplier"
      partyName={invoice.supplier_name || invoice.supplier_id}
      partyAddress={supplier?.address}
      partyPhone={supplier?.phone}
      rightFields={[
        { label: 'No. Invoice', value: invoice.pi_id },
        { label: 'No. PO', value: invoice.po_id },
        { label: 'Tanggal', value: invoice.posting_date },
        { label: 'Jatuh Tempo', value: invoice.due_date || '-' },
        { label: 'Status', value: invoice.status },
        { label: 'Outstanding', value: `Rp${invoice.outstanding_amount.toLocaleString('id-ID')}` },
      ]}
      items={invoice.items || []}
    />
  );
}
