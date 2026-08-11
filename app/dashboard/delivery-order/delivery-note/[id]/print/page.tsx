'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { Item, Customer } from '@/types';
import { Printer, ArrowLeft } from 'lucide-react';

interface DeliveryNoteWithItems {
  dn_id: string;
  so_id: string;
  customer_id: string;
  customer_name: string;
  posting_date: string;
  status: string;
  owner: string;
  items: { item_code: string; delivered_qty: number; warehouse_id: string }[];
}

type PaperSize = 'a4' | 'f4' | 'thermal';

const SIZE_LABEL: Record<PaperSize, string> = { a4: 'A4', f4: 'F4', thermal: 'Thermal' };

export default function SuratJalanPrintPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const size = (searchParams.get('size') as PaperSize) || 'a4';

  const [dn, setDn] = useState<DeliveryNoteWithItems | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasAccess = !!(session?.user.permissions.delivery_order || session?.user.permissions.sales_order);

  useEffect(() => {
    if (hasAccess) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [dnRes, itemsRes, customersRes] = await Promise.all([
        fetch('/api/delivery-notes'),
        fetch('/api/items').catch(() => null),
        fetch('/api/customers').catch(() => null),
      ]);
      if (dnRes.ok) {
        const list: DeliveryNoteWithItems[] = await dnRes.json();
        const found = list.find((d) => d.dn_id === id) || null;
        setDn(found);
        if (found && customersRes?.ok) {
          const custList: Customer[] = await customersRes.json();
          setCustomer(custList.find((c) => c.customer_id === found.customer_id) || null);
        }
      }
      if (itemsRes?.ok) setItems(await itemsRes.json());
    } catch (error) {
      console.error('Error fetching surat jalan data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' || isLoading) return null;
  if (!session) return null;

  if (!hasAccess) {
    return <p className="p-6 text-sm text-red-600">You don't have permission to access this page.</p>;
  }

  if (!dn) {
    return <p className="p-6 text-sm text-gray-500">Delivery note tidak ditemukan.</p>;
  }

  const itemName = (code: string) => items.find((i) => i.item_code === code)?.item_name || code;
  const itemUnit = (code: string) => items.find((i) => i.item_code === code)?.unit || '-';

  return (
    <div className={`surat-jalan-wrapper size-${size}`}>
      <style jsx global>{`
        @media print {
          @page {
            size: ${size === 'a4' ? 'A4' : size === 'f4' ? '215mm 330mm' : '80mm auto'};
            margin: ${size === 'thermal' ? '4mm' : '12mm'};
          }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .surat-jalan-page {
          background: white;
          color: #111;
          margin: 0 auto;
          padding: 16mm;
          box-shadow: 0 0 0 1px #e5e7eb;
        }
        .size-a4 .surat-jalan-page { width: 210mm; min-height: 297mm; }
        .size-f4 .surat-jalan-page { width: 215mm; min-height: 330mm; }
        .size-thermal .surat-jalan-page { width: 80mm; min-height: auto; padding: 4mm; font-size: 10px; }
        .sj-table th, .sj-table td { border: 1px solid #999; padding: 4px 6px; }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push(`/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.dn_id)}`)} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-2">
          {(['a4', 'f4', 'thermal'] as PaperSize[]).map((s) => (
            <button
              key={s}
              onClick={() => router.push(`/dashboard/delivery-order/delivery-note/${encodeURIComponent(dn.dn_id)}/print?size=${s}`)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border ${s === size ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:border-primary'}`}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-600">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="surat-jalan-page">
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-3">
          <Image src="/Header-Light.png" alt="Thoyokem" width={size === 'thermal' ? 90 : 140} height={40} style={{ objectFit: 'contain' }} />
          <div className="flex-1 text-center">
            <h1 className={size === 'thermal' ? 'text-sm font-bold' : 'text-lg font-bold'}>SURAT JALAN THOYOKEM</h1>
          </div>
          <div style={{ width: size === 'thermal' ? 0 : 140 }} />
        </div>

        <div className="flex justify-between items-start mb-4 text-sm gap-4">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-0.5">Customer</p>
            <p className="font-semibold">{dn.customer_name}</p>
            {customer?.address && <p className="text-xs text-gray-600 max-w-[220px]">{customer.address}</p>}
            {customer?.phone && <p className="text-xs text-gray-600">{customer.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs uppercase mb-0.5">SO ID / No. Material Transfer</p>
            <p className="font-semibold">{dn.so_id}</p>
            <p className="text-xs text-gray-600 mt-1">No. Surat Jalan: {dn.dn_id}</p>
            <p className="text-xs text-gray-600">Tanggal: {dn.posting_date}</p>
          </div>
        </div>

        <table className="sj-table w-full text-sm border-collapse mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left w-8">No</th>
              <th className="text-left">Nama Item</th>
              <th className="text-right">Qty</th>
              <th className="text-left">Unit</th>
            </tr>
          </thead>
          <tbody>
            {dn.items.map((i, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{itemName(i.item_code)}</td>
                <td className="text-right">{i.delivered_qty}</td>
                <td>{itemUnit(i.item_code)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between text-sm mt-12">
          <div className="text-center w-40">
            <p>Pengirim,</p>
            <div className="h-20" />
            <p className="border-t border-gray-800 pt-1">( ________________ )</p>
          </div>
          <div className="text-center w-40">
            <p>Penerima,</p>
            <div className="h-20" />
            <p className="border-t border-gray-800 pt-1">( ________________ )</p>
          </div>
        </div>
      </div>
    </div>
  );
}
