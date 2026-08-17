'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { SalesOrder, SalesInvoice } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ShoppingBag, Wallet, AlertTriangle } from 'lucide-react';
import { StatCardGrid, StatCardDef, useVisibleCards } from '@/components/ui/StatCards';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7'];

interface SO extends SalesOrder {
  customer_name: string;
}

export default function SalesOrderOverview() {
  const [orders, setOrders] = useState<SO[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, invRes] = await Promise.all([fetch('/api/sales-orders'), fetch('/api/sales-invoices')]);
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (error) {
      console.error('Error fetching sales overview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalOutstanding = useMemo(() => invoices.reduce((sum, i) => sum + i.outstanding_amount, 0), [invoices]);
  const totalRevenue = useMemo(() => orders.filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total_amount, 0), [orders]);

  const [visibleCards, setVisibleCards] = useVisibleCards('sales_order_overview_cards', ['orders', 'revenue', 'outstanding']);

  const statCards: StatCardDef[] = [
    { key: 'orders', label: 'Total Sales Orders', value: orders.length, icon: ShoppingBag, color: 'primary' },
    { key: 'revenue', label: 'Total Revenue', value: `Rp${totalRevenue.toLocaleString('id-ID')}`, icon: Wallet, color: 'blue' },
    { key: 'outstanding', label: 'Outstanding Invoice', value: `Rp${totalOutstanding.toLocaleString('id-ID')}`, icon: AlertTriangle, color: 'orange' },
  ];

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => counts.set(o.status, (counts.get(o.status) || 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const revenueTrend = useMemo(() => {
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

  const topCustomers = useMemo(() => {
    const byCustomer = new Map<string, number>();
    orders
      .filter((o) => o.status !== 'Cancelled')
      .forEach((o) => byCustomer.set(o.customer_name, (byCustomer.get(o.customer_name) || 0) + o.total_amount));
    return Array.from(byCustomer.entries())
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
      <StatCardGrid cards={statCards} visible={visibleCards} onVisibleChange={setVisibleCards} />

      <Card title="Trend Revenue per Bulan">
        {revenueTrend.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">Belum ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Revenue']} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Customer by Revenue">
          {topCustomers.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">Belum ada data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topCustomers} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(val: number) => [`Rp${val.toLocaleString('id-ID')}`, 'Revenue']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" fill="#22c55e" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Sales Order per Status">
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
