'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { Warehouse, StockBalance } from '@/types';
import { AlertCircle } from 'lucide-react';

function WarehouseDetailPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(searchParams.get('id')));
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.inventory) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [whRes, balRes] = await Promise.all([fetch('/api/warehouses'), fetch('/api/stock-balance')]);
      if (whRes.ok) {
        const list: Warehouse[] = await whRes.json();
        setWarehouse(list.find((w) => w.warehouse_id === id) || null);
      }
      if (balRes.ok) {
        const list: StockBalance[] = await balRes.json();
        setBalances(list.filter((b) => b.warehouse_id === id));
      }
    } catch (error) {
      console.error('Error fetching warehouse:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' && !session) return null;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.inventory) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      
    );
  }

  return (
    
      <DetailView
        backHref="/dashboard/inventory"
        backLabel="Warehouses"
        title={warehouse?.warehouse_name || id}
        subtitle={warehouse?.warehouse_id}
        isLoading={isLoading}
        notFound={!isLoading && !warehouse}
        badges={warehouse && <StatusBadge label={warehouse.is_active ? 'Active' : 'Inactive'} tone={warehouse.is_active ? 'green' : 'gray'} />}
        sidebar={
          warehouse && (
            <>
              <AssignedToSection doctype="Warehouse" documentId={warehouse.warehouse_id} />
              <DetailSection title="Riwayat">
                <ActivityLogView doctype="Warehouse" documentId={warehouse.warehouse_id} />
                <AttachmentSection doctype="Warehouse" documentId={warehouse.warehouse_id} />
              </DetailSection>
            </>
          )
        }
      >
        {warehouse && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'City', value: warehouse.location || '-' },
                  { label: 'PIC', value: warehouse.pic || '-' },
                  { label: 'Phone Number', value: warehouse.phone || '-' },
                  { label: 'Address', value: warehouse.address || '-' },
                  { label: 'Postal Code', value: warehouse.postal_code || '-' },
                ]}
              />
            </DetailSection>
            <DetailSection title="Stock Balance">
              <DetailTable
                columns={[
                  { key: 'item_name', header: 'Item' },
                  { key: 'qty_on_hand', header: 'Qty', align: 'right' },
                  { key: 'valuation_rate', header: 'Valuation Rate', align: 'right' },
                  { key: 'stock_value', header: 'Stock Value', align: 'right' },
                ]}
                rows={balances.map((b) => ({
                  item_name: (
                    <Link href={`/dashboard/inventory/item?id=${encodeURIComponent(b.item_code)}`} className="text-primary hover:underline">
                      {b.item_name}
                    </Link>
                  ),
                  qty_on_hand: b.qty_on_hand,
                  valuation_rate: `Rp${b.valuation_rate.toLocaleString('id-ID')}`,
                  stock_value: `Rp${b.stock_value.toLocaleString('id-ID')}`,
                }))}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    
  );
}

export default function WarehouseDetailPage() {
  return (
    <Suspense fallback={null}>
      <WarehouseDetailPageInner />
    </Suspense>
  );
}
