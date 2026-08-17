'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { Item, StockBalance, StockLedgerEntry, Warehouse } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Package, Warehouse as WarehouseIcon } from 'lucide-react';
import { StatCardGrid, StatCardDef, useVisibleCards } from '@/components/ui/StatCards';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16'];

export default function InventoryOverview() {
  const [items, setItems] = useState<Item[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [ledger, setLedger] = useState<StockLedgerEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [itemsRes, balRes, ledgerRes, whRes] = await Promise.all([
        fetch('/api/items'),
        fetch('/api/stock-balance'),
        fetch('/api/stock-ledger'),
        fetch('/api/warehouses'),
      ]);
      if (itemsRes.ok) setItems(await itemsRes.json());
      if (balRes.ok) setBalances(await balRes.json());
      if (ledgerRes.ok) setLedger(await ledgerRes.json());
      if (whRes.ok) setWarehouses(await whRes.json());
    } catch (error) {
      console.error('Error fetching inventory overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalStockValue = useMemo(() => balances.reduce((sum, b) => sum + b.stock_value, 0), [balances]);

  // Real stock value trend from the stock ledger: at each transaction, update that
  // item+warehouse's running value, then sum the latest value across all combos.
  const valueTrend = useMemo(() => {
    const chrono = [...ledger].sort((a, b) => Number(a.entry_id) - Number(b.entry_id));
    const latestByKey = new Map<string, number>();
    const byDate = new Map<string, number>();
    for (const e of chrono) {
      latestByKey.set(`${e.item_code}::${e.warehouse_id}`, e.stock_value);
      const total = Array.from(latestByKey.values()).reduce((sum, v) => sum + v, 0);
      byDate.set(e.posting_date, total);
    }
    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
  }, [ledger]);

  const topItems = useMemo(
    () => [...balances].sort((a, b) => b.stock_value - a.stock_value).slice(0, 8),
    [balances]
  );

  const lowStock = useMemo(() => {
    const qtyByItem = new Map<string, number>();
    balances.forEach((b) => qtyByItem.set(b.item_code, (qtyByItem.get(b.item_code) || 0) + b.qty_on_hand));
    return items
      .filter((i) => i.reorder_level > 0 && (qtyByItem.get(i.item_code) || 0) < i.reorder_level)
      .map((i) => ({ ...i, qty_on_hand: qtyByItem.get(i.item_code) || 0 }));
  }, [items, balances]);

  const warehouseDist = useMemo(() => {
    const nameMap = new Map(warehouses.map((w) => [w.warehouse_id, w.warehouse_name]));
    const byWarehouse = new Map<string, number>();
    balances.forEach((b) => byWarehouse.set(b.warehouse_id, (byWarehouse.get(b.warehouse_id) || 0) + b.stock_value));
    return Array.from(byWarehouse.entries()).map(([id, value]) => ({ name: nameMap.get(id) || id, value }));
  }, [balances, warehouses]);

  const [visibleCards, setVisibleCards] = useVisibleCards('inventory_overview_cards', ['value', 'items', 'lowstock']);

  const statCards: StatCardDef[] = [
    { key: 'value', label: 'Total Nilai Stok', value: `Rp${totalStockValue.toLocaleString('id-ID')}`, icon: TrendingUp, color: 'primary' },
    { key: 'items', label: 'Total Item', value: items.length, icon: Package, color: 'blue' },
    { key: 'lowstock', label: 'Item Stok Menipis', value: lowStock.length, icon: AlertTriangle, color: 'orange' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatCardGrid cards={statCards} visible={visibleCards} onVisibleChange={setVisibleCards} />

      <Card title="Trend Nilai Stok">
        {valueTrend.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">Belum ada pergerakan stok</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={valueTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Nilai Stok']} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Item by Stock Value">
          {topItems.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">Belum ada stok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topItems} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="item_name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Nilai']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="stock_value" fill="#22c55e" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Distribusi Stok per Warehouse">
          {warehouseDist.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">Belum ada stok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={warehouseDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {warehouseDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Nilai']} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title={`Item Stok Menipis (${lowStock.length})`}>
        {lowStock.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">Semua item stoknya aman</div>
        ) : (
          <div className="space-y-1.5">
            {lowStock.map((i) => (
              <div key={i.item_code} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-orange-50 dark:bg-orange-900/10 text-xs">
                <span className="font-medium text-gray-800 dark:text-gray-200">{i.item_name}</span>
                <span className="text-orange-600 dark:text-orange-400">{i.qty_on_hand} / reorder {i.reorder_level}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
