'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import { Item, StockBalance } from '@/types';
import { fetchUsdIdrRate, toIDR } from '@/lib/currency';
import { AlertCircle } from 'lucide-react';

export default function ItemDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [item, setItem] = useState<Item | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [usdRate, setUsdRate] = useState(15800);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.inventory) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [itemRes, balRes, rate] = await Promise.all([fetch('/api/items'), fetch('/api/stock-balance'), fetchUsdIdrRate()]);
      if (itemRes.ok) {
        const list: Item[] = await itemRes.json();
        setItem(list.find((i) => i.item_code === id) || null);
      }
      if (balRes.ok) {
        const list: StockBalance[] = await balRes.json();
        setBalances(list.filter((b) => b.item_code === id));
      }
      setUsdRate(rate);
    } catch (error) {
      console.error('Error fetching item:', error);
    } finally {
      setIsLoading(false);
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

  if (!session.user.permissions.inventory) {
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

  const totalQty = balances.reduce((sum, b) => sum + b.qty_on_hand, 0);

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/inventory"
        backLabel="Items"
        title={item?.item_name || id}
        subtitle={item?.item_code}
        isLoading={isLoading}
        notFound={!isLoading && !item}
        badges={
          item && (
            <>
              <StatusBadge label={item.item_type} tone={item.item_type === 'Trading' ? 'purple' : 'blue'} />
              <StatusBadge label={item.is_active ? 'Active' : 'Inactive'} tone={item.is_active ? 'green' : 'gray'} />
            </>
          )
        }
      >
        {item && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Item Group', value: item.item_group || '-' },
                  { label: 'Unit', value: item.unit || '-' },
                  { label: 'Currency', value: item.currency },
                  {
                    label: 'Purchase Price',
                    value:
                      item.currency === 'USD'
                        ? `$${item.purchase_price.toLocaleString('id-ID')} (≈ Rp${toIDR(item.purchase_price, 'USD', usdRate).toLocaleString('id-ID')})`
                        : `Rp${item.purchase_price.toLocaleString('id-ID')}`,
                  },
                  {
                    label: 'Selling Price',
                    value:
                      item.currency === 'USD'
                        ? `$${item.selling_price.toLocaleString('id-ID')} (≈ Rp${toIDR(item.selling_price, 'USD', usdRate).toLocaleString('id-ID')})`
                        : `Rp${item.selling_price.toLocaleString('id-ID')}`,
                  },
                  { label: 'Reorder Level', value: item.reorder_level },
                  { label: 'Valuation Method', value: item.valuation_method },
                  { label: 'Opening Qty', value: item.opening_qty },
                  { label: 'Total Qty on Hand', value: totalQty },
                ]}
              />
            </DetailSection>
            <DetailSection title="Stock Balance by Warehouse">
              <DetailTable
                columns={[
                  { key: 'warehouse_id', header: 'Warehouse' },
                  { key: 'qty_on_hand', header: 'Qty', align: 'right' },
                  { key: 'valuation_rate', header: 'Valuation Rate', align: 'right' },
                  { key: 'stock_value', header: 'Stock Value', align: 'right' },
                  { key: 'last_transaction_date', header: 'Last Transaction' },
                ]}
                rows={balances.map((b) => ({
                  warehouse_id: b.warehouse_id,
                  qty_on_hand: b.qty_on_hand,
                  valuation_rate: `Rp${b.valuation_rate.toLocaleString('id-ID')}`,
                  stock_value: `Rp${b.stock_value.toLocaleString('id-ID')}`,
                  last_transaction_date: b.last_transaction_date,
                }))}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
