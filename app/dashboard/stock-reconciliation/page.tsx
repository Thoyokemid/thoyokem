'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Loading from '@/components/ui/Loading';
import { DetailTable } from '@/components/ui/DetailView';
import Button from '@/components/ui/Button';
import { AlertCircle, ShieldAlert, RefreshCw, Wrench } from 'lucide-react';
import { Warehouse } from '@/types';

interface Discrepancy {
  source: 'Delivery Note' | 'Purchase Receipt' | 'Stock Entry';
  doc_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  expected_qty: number;
  actual_qty: number;
  missing_qty: number;
}

export default function StockReconciliationPage() {
  const { data: session, status } = useSession();
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isSuperAdmin = !!session?.user.isSuperAdmin;

  useEffect(() => {
    if (isSuperAdmin) fetchData();
    else setIsLoading(false);
  }, [session]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [discRes, whRes] = await Promise.all([fetch('/api/stock-reconciliation'), fetch('/api/warehouses')]);
      if (discRes.ok) setDiscrepancies(await discRes.json());
      else setError((await discRes.json()).error || 'Gagal memuat data');
      if (whRes.ok) setWarehouses(await whRes.json());
    } catch (err) {
      console.error('Error fetching reconciliation data:', err);
      setError('Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  const warehouseName = (id: string) => warehouses.find((w) => w.warehouse_id === id)?.warehouse_name || id;
  const rowKey = (d: Discrepancy) => `${d.source}::${d.doc_id}::${d.item_code}::${d.warehouse_id}`;

  const handleFix = async (d: Discrepancy) => {
    if (!confirm(`Tambahkan koreksi ${d.missing_qty > 0 ? '+' : ''}${d.missing_qty} untuk ${d.item_name} di ${warehouseName(d.warehouse_id)}?`)) return;
    setBusyKey(rowKey(d));
    try {
      const res = await fetch('/api/stock-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal memperbaiki');
      }
    } catch (err) {
      console.error('Error applying fix:', err);
      alert('Gagal memperbaiki');
    } finally {
      setBusyKey(null);
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

  if (!isSuperAdmin) {
    return (
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Halaman ini hanya untuk Super Admin.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={22} className="text-orange-500" />
              Stock Reconciliation
            </h1>
          </div>
          <Button variant="secondary" onClick={fetchData} disabled={isLoading}>
            <RefreshCw size={14} className="mr-1.5" />
            Scan Ulang
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : discrepancies.length === 0 ? (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-6 text-center text-sm text-green-700 dark:text-green-400">
            Tidak ada ketidakcocokan ditemukan. Semua Delivery Note, Purchase Receipt, dan Stock Entry sudah sinkron dengan stock ledger.
          </div>
        ) : (
          <div className="card p-0">
            <DetailTable
              columns={[
                { key: 'source', header: 'Sumber' },
                { key: 'doc_id', header: 'Dokumen' },
                { key: 'item', header: 'Item' },
                { key: 'warehouse', header: 'Warehouse' },
                { key: 'expected', header: 'Seharusnya', align: 'right' },
                { key: 'actual', header: 'Di Ledger', align: 'right' },
                { key: 'missing', header: 'Selisih', align: 'right' },
                { key: 'action', header: '' },
              ]}
              rows={discrepancies.map((d) => ({
                source: d.source,
                doc_id: d.doc_id,
                item: `${d.item_name} (${d.item_code})`,
                warehouse: warehouseName(d.warehouse_id),
                expected: d.expected_qty,
                actual: d.actual_qty,
                missing: (
                  <span className={d.missing_qty > 0 ? 'text-green-600' : 'text-red-600'}>
                    {d.missing_qty > 0 ? '+' : ''}{d.missing_qty}
                  </span>
                ),
                action: (
                  <button
                    onClick={() => handleFix(d)}
                    disabled={busyKey === rowKey(d)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-600 disabled:opacity-40"
                  >
                    <Wrench size={12} /> Perbaiki
                  </button>
                ),
              }))}
            />
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Catatan: Stock Entry bertipe Manufacture tidak ikut diperiksa otomatis, karena kebutuhan komponennya mengikuti BOM saat ini yang bisa saja sudah berubah sejak entry itu dibuat.
        </p>
      </div>
    </DashboardLayout>
  );
}
