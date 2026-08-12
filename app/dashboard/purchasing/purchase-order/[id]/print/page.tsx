'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DocumentPrintLayout, { PaperSize } from '@/components/print/DocumentPrintLayout';
import { Supplier } from '@/types';

interface PurchaseOrderWithItems {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  order_date: string;
  expected_date: string;
  status: string;
  items: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number }[];
}

export default function PurchaseOrderPrintPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const size = (searchParams.get('size') as PaperSize) || 'a4';

  const [po, setPo] = useState<PurchaseOrderWithItems | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!session?.user.permissions.purchasing;

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [poRes, supRes] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/suppliers').catch(() => null)]);
      if (poRes.ok) {
        const list: PurchaseOrderWithItems[] = await poRes.json();
        const found = list.find((p) => p.po_id === id) || null;
        setPo(found);
        if (found && supRes?.ok) {
          const supList: Supplier[] = await supRes.json();
          setSupplier(supList.find((s) => s.supplier_id === found.supplier_id) || null);
        }
      }
    } catch (error) {
      console.error('Error fetching PO for print:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' || isLoading) return null;
  if (!session) return null;
  if (!hasAccess) return <p className="p-6 text-sm text-red-600">You don't have permission to access this page.</p>;
  if (!po) return <p className="p-6 text-sm text-gray-500">Purchase order tidak ditemukan.</p>;

  return (
    <DocumentPrintLayout
      size={size}
      backHref={`/dashboard/purchasing/purchase-order/${encodeURIComponent(id)}`}
      printSizeBaseHref={`/dashboard/purchasing/purchase-order/${encodeURIComponent(id)}/print`}
      docTitle="PURCHASE ORDER THOYOKEM"
      docId={po.po_id}
      partyLabel="Supplier"
      partyName={po.supplier_name}
      partyAddress={supplier?.address}
      partyPhone={supplier?.phone}
      rightFields={[
        { label: 'No. PO', value: po.po_id },
        { label: 'Tanggal Order', value: po.order_date },
        { label: 'Tanggal Dibutuhkan', value: po.expected_date || '-' },
        { label: 'Status', value: po.status },
      ]}
      items={po.items}
    />
  );
}
