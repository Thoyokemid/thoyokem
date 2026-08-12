'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Printer, ArrowLeft } from 'lucide-react';

export type PaperSize = 'a4' | 'f4' | 'thermal';
export const SIZE_LABEL: Record<PaperSize, string> = { a4: 'A4', f4: 'F4', thermal: 'Thermal' };

interface PrintItem {
  item_code: string;
  item_name: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
}

interface DocumentPrintLayoutProps {
  size: PaperSize;
  backHref: string;
  printSizeBaseHref: string; // e.g. /dashboard/purchasing/purchase-order/PO-2026-00001/print
  docTitle: string; // e.g. "PURCHASE ORDER THOYOKEM"
  docId: string;
  partyLabel: string; // "Supplier" or "Customer"
  partyName: string;
  partyAddress?: string;
  partyPhone?: string;
  rightFields: { label: string; value: string }[];
  items: PrintItem[];
  footerNote?: string;
}

export default function DocumentPrintLayout({
  size,
  backHref,
  printSizeBaseHref,
  docTitle,
  docId,
  partyLabel,
  partyName,
  partyAddress,
  partyPhone,
  rightFields,
  items,
  footerNote,
}: DocumentPrintLayoutProps) {
  const router = useRouter();
  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className={`doc-print-wrapper size-${size}`}>
      <style jsx global>{`
        @media print {
          @page {
            size: ${size === 'a4' ? 'A4' : size === 'f4' ? '215mm 330mm' : '80mm auto'};
            margin: ${size === 'thermal' ? '4mm' : '12mm'};
          }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .doc-print-page {
          background: white;
          color: #111;
          margin: 0 auto;
          padding: 16mm;
          box-shadow: 0 0 0 1px #e5e7eb;
        }
        .size-a4 .doc-print-page { width: 210mm; min-height: 297mm; }
        .size-f4 .doc-print-page { width: 215mm; min-height: 330mm; }
        .size-thermal .doc-print-page { width: 80mm; min-height: auto; padding: 4mm; font-size: 10px; }
        .doc-table th, .doc-table td { border: 1px solid #999; padding: 4px 6px; }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.push(backHref)} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-2">
          {(['a4', 'f4', 'thermal'] as PaperSize[]).map((s) => (
            <button
              key={s}
              onClick={() => router.push(`${printSizeBaseHref}?size=${s}`)}
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

      <div className="doc-print-page">
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-3">
          <Image src="/Header-Light.png" alt="Thoyokem" width={size === 'thermal' ? 90 : 140} height={40} style={{ objectFit: 'contain' }} />
          <div className="flex-1 text-center">
            <h1 className={size === 'thermal' ? 'text-sm font-bold' : 'text-lg font-bold'}>{docTitle}</h1>
          </div>
          <div style={{ width: size === 'thermal' ? 0 : 140 }} />
        </div>

        <div className="flex justify-between items-start mb-4 text-sm gap-4">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-0.5">{partyLabel}</p>
            <p className="font-semibold">{partyName}</p>
            {partyAddress && <p className="text-xs text-gray-600 max-w-[220px]">{partyAddress}</p>}
            {partyPhone && <p className="text-xs text-gray-600">{partyPhone}</p>}
          </div>
          <div className="text-right">
            {rightFields.map((f) => (
              <p key={f.label} className="text-xs text-gray-600 mt-0.5">
                <span className="text-gray-500">{f.label}: </span>
                <span className="font-medium text-gray-900">{f.value}</span>
              </p>
            ))}
          </div>
        </div>

        <table className="doc-table w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left w-8">No</th>
              <th className="text-left">Nama Item</th>
              <th className="text-right">Qty</th>
              <th className="text-left">Unit</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{i.item_name} ({i.item_code})</td>
                <td className="text-right">{i.qty}</td>
                <td>{i.uom}</td>
                <td className="text-right">Rp{i.rate.toLocaleString('id-ID')}</td>
                <td className="text-right">Rp{i.amount.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="text-right font-semibold">Total</td>
              <td className="text-right font-semibold">Rp{total.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>

        {footerNote && <p className="text-xs text-gray-500 mb-8">{footerNote}</p>}

        <div className="flex justify-between text-sm mt-12">
          <div className="text-center w-40">
            <p>Dibuat oleh,</p>
            <div className="h-20" />
            <p className="border-t border-gray-800 pt-1">( ________________ )</p>
          </div>
          <div className="text-center w-40">
            <p>Disetujui oleh,</p>
            <div className="h-20" />
            <p className="border-t border-gray-800 pt-1">( ________________ )</p>
          </div>
        </div>
      </div>
    </div>
  );
}
