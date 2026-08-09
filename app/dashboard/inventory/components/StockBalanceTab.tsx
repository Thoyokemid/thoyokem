'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { StockBalance } from '@/types';
import { Search, AlertTriangle } from 'lucide-react';

export default function StockBalanceTab() {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/stock-balance');
      if (res.ok) setBalances(await res.json());
    } catch (error) {
      console.error('Error fetching stock balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return balances;
    const q = searchTerm.toLowerCase();
    return balances.filter((b) => b.item_name.toLowerCase().includes(q) || b.item_code.toLowerCase().includes(q));
  }, [balances, searchTerm]);

  const totalValue = filtered.reduce((sum, b) => sum + b.stock_value, 0);

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Cari item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Total nilai stok: <span className="font-semibold text-gray-900 dark:text-gray-100">Rp{totalValue.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Warehouse</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qty on Hand</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Valuation Rate</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock Value</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Transaction</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">No stock data available</td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={`${b.item_code}::${b.warehouse_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-1.5">
                        {b.qty_on_hand <= 0 && <AlertTriangle size={12} className="text-red-500" />}
                        {b.item_name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">{b.warehouse_id}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-900 dark:text-gray-100 font-medium">{b.qty_on_hand.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-700 dark:text-gray-300">Rp{b.valuation_rate.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2.5 text-xs text-right text-gray-900 dark:text-gray-100 font-medium">Rp{b.stock_value.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{b.last_transaction_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
