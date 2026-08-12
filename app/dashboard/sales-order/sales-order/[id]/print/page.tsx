'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DocumentPrintLayout, { PaperSize } from '@/components/print/DocumentPrintLayout';
import { Customer } from '@/types';

interface SalesOrderWithItems {
  so_id: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  delivery_date: string;
  status: string;
  items: { item_code: string; item_name: string; uom: string; qty: number; rate: number; amount: number }[];
}

export default function SalesOrderPrintPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(params.id));
  const size = (searchParams.get('size') as PaperSize) || 'a4';

  const [so, setSo] = useState<SalesOrderWithItems | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!session?.user.permissions.sales_order;

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [soRes, custRes] = await Promise.all([fetch('/api/sales-orders'), fetch('/api/customers').catch(() => null)]);
      if (soRes.ok) {
        const list: SalesOrderWithItems[] = await soRes.json();
        const found = list.find((s) => s.so_id === id) || null;
        setSo(found);
        if (found && custRes?.ok) {
          const custList: Customer[] = await custRes.json();
          setCustomer(custList.find((c) => c.customer_id === found.customer_id) || null);
        }
      }
    } catch (error) {
      console.error('Error fetching SO for print:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' || isLoading) return null;
  if (!session) return null;
  if (!hasAccess) return <p className="p-6 text-sm text-red-600">You don't have permission to access this page.</p>;
  if (!so) return <p className="p-6 text-sm text-gray-500">Sales order tidak ditemukan.</p>;

  return (
    <DocumentPrintLayout
      size={size}
      backHref={`/dashboard/sales-order/sales-order/${encodeURIComponent(id)}`}
      printSizeBaseHref={`/dashboard/sales-order/sales-order/${encodeURIComponent(id)}/print`}
      docTitle="SALES ORDER THOYOKEM"
      docId={so.so_id}
      partyLabel="Customer"
      partyName={so.customer_name}
      partyAddress={customer?.address}
      partyPhone={customer?.phone}
      rightFields={[
        { label: 'No. SO', value: so.so_id },
        { label: 'Tanggal Order', value: so.order_date },
        { label: 'Tanggal Kirim', value: so.delivery_date || '-' },
        { label: 'Status', value: so.status },
      ]}
      items={so.items}
    />
  );
}
