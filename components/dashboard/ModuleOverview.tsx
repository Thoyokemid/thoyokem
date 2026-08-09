'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import {
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Wallet,
  PackageCheck,
  Clock3,
} from 'lucide-react';

interface ModuleOverviewProps {
  permissions: {
    inventory: boolean;
    purchasing: boolean;
    sales_order: boolean;
    delivery_order: boolean;
  };
}

interface Stat {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  href: string;
  tone: string;
}

export default function ModuleOverview({ permissions }: ModuleOverviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stat[]>([]);

  const hasAnyModule = permissions.inventory || permissions.purchasing || permissions.sales_order || permissions.delivery_order;

  useEffect(() => {
    if (hasAnyModule) fetchAll();
    else setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    const results: Stat[] = [];

    try {
      if (permissions.inventory) {
        const res = await fetch('/api/stock-balance');
        if (res.ok) {
          const balances: { qty_on_hand: number; stock_value: number }[] = await res.json();
          const totalValue = balances.reduce((sum, b) => sum + b.stock_value, 0);
          const lowStock = balances.filter((b) => b.qty_on_hand <= 0).length;
          results.push({
            label: 'Nilai Stok',
            value: `Rp${totalValue.toLocaleString('id-ID')}`,
            sub: lowStock > 0 ? `${lowStock} item stok kosong` : 'Semua item tersedia',
            icon: Boxes,
            href: '/dashboard/inventory',
            tone: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500',
          });
        }
      }

      if (permissions.purchasing) {
        const [poRes, piRes] = await Promise.all([fetch('/api/purchase-orders'), fetch('/api/purchase-invoices')]);
        if (poRes.ok) {
          const orders: { status: string }[] = await poRes.json();
          const openCount = orders.filter((o) => o.status === 'Draft' || o.status === 'Submitted').length;
          results.push({
            label: 'PO Terbuka',
            value: String(openCount),
            sub: `${orders.length} total purchase order`,
            icon: ShoppingCart,
            href: '/dashboard/purchasing',
            tone: 'bg-orange-50 dark:bg-orange-900/20 text-orange-500',
          });
        }
        if (piRes.ok) {
          const invoices: { outstanding_amount: number }[] = await piRes.json();
          const totalPayable = invoices.reduce((sum, i) => sum + i.outstanding_amount, 0);
          results.push({
            label: 'Hutang ke Supplier',
            value: `Rp${totalPayable.toLocaleString('id-ID')}`,
            sub: 'Sisa tagihan belum dibayar',
            icon: Wallet,
            href: '/dashboard/purchasing',
            tone: 'bg-red-50 dark:bg-red-900/20 text-red-500',
          });
        }
      }

      if (permissions.sales_order) {
        const [soRes, siRes] = await Promise.all([fetch('/api/sales-orders'), fetch('/api/sales-invoices')]);
        if (soRes.ok) {
          const orders: { status: string }[] = await soRes.json();
          const openCount = orders.filter((o) => o.status === 'Draft' || o.status === 'Confirmed').length;
          results.push({
            label: 'SO Terbuka',
            value: String(openCount),
            sub: `${orders.length} total sales order`,
            icon: ShoppingBag,
            href: '/dashboard/sales-order',
            tone: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
          });
        }
        if (siRes.ok) {
          const invoices: { outstanding_amount: number }[] = await siRes.json();
          const totalReceivable = invoices.reduce((sum, i) => sum + i.outstanding_amount, 0);
          results.push({
            label: 'Piutang Customer',
            value: `Rp${totalReceivable.toLocaleString('id-ID')}`,
            sub: 'Sisa tagihan belum diterima',
            icon: Wallet,
            href: '/dashboard/sales-order',
            tone: 'bg-green-50 dark:bg-green-900/20 text-green-500',
          });
        }
      }

      if (permissions.delivery_order) {
        const soRes = await fetch('/api/sales-orders');
        if (soRes.ok) {
          const orders: { status: string }[] = await soRes.json();
          const readyCount = orders.filter((o) => o.status === 'Confirmed').length;
          results.push({
            label: 'Siap Dikirim',
            value: String(readyCount),
            sub: 'Sales order menunggu delivery',
            icon: Truck,
            href: '/dashboard/delivery-order',
            tone: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching module overview:', error);
    } finally {
      setStats(results);
      setIsLoading(false);
    }
  };

  if (!hasAnyModule) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Business Overview</h2>
      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-8">
            <Loading />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5 truncate">{stat.value}</p>
                      {stat.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{stat.sub}</p>}
                    </div>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${stat.tone}`}>
                      <Icon size={18} />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
