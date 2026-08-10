'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { PurchaseOrder, PurchaseInvoice } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ShoppingCart, Wallet, AlertTriangle } from 'lucide-react';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

interface PO extends PurchaseOrder {
  supplier_name: string;
}

export default function PurchasingOverview() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, invRes] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/purchase-invoices')]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (error) {
      console.error('Error fetching purchasing overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalOutstanding = useMemo(() => invoices.reduce((sum, i) => sum + i.outstanding_amount, 0), [invoices]);
  const totalSpend = useMemo(() => orders.filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total_amount, 0), [orders]);

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => counts.set(o.status, (counts.get(o.status) || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const spendTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    orders
      .filter((o) => o.status !== 'Cancelled')
      .forEach((o) => {
        const month = (o.order_date || '').slice(0, 7);
        byMonth.set(month, (byMonth.get(month) || 0) + o.total_amount);
      });
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total }));
  }, [orders]);

  const topSuppliers = useMemo(() => {
    const bySupplier = new Map<string, number>();
    orders
      .filter((o) => o.status !== 'Cancelled')
      .forEach((o) => bySupplier.set(o.supplier_name, (bySupplier.get(o.supplier_name) || 0) + o.total_amount));
    return Array.from(bySupplier.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary-50 dark:bg-primary-900/20">
              <ShoppingCart className="text-primary" size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Purchase Orders</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{orders.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20">
              <Wallet className="text-blue-500" size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Belanja</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">Rp{totalSpend.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-orange-50 dark:bg-orange-900/20">
              <AlertTriangle className="text-orange-500" size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding Invoice</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">Rp{totalOutstanding.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Trend Belanja per Bulan">
        {spendTrend.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">Belum ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={spendTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Belanja']} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Supplier by Spend">
          {topSuppliers.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topSuppliers} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Belanja']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" fill="#22c55e" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Purchase Order per Status">
          {statusBreakdown.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
