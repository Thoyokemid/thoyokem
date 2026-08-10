'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import { StockEntry } from '@/types';
import { AlertCircle } from 'lucide-react';

export default function StockEntryDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [entry, setEntry] = useState<StockEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.inventory) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/stock-entries');
      if (res.ok) {
        const list: StockEntry[] = await res.json();
        setEntry(list.find((e) => e.entry_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching stock entry:', error);
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

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/inventory"
        backLabel="Stock Entries"
        title={entry?.entry_id || id}
        subtitle={entry?.entry_type}
        isLoading={isLoading}
        notFound={!isLoading && !entry}
        badges={entry && <StatusBadge label={entry.status || 'Submitted'} tone="green" />}
      >
        {entry && (
          <DetailSection title="Detail">
            <FieldGrid
              fields={[
                { label: 'Entry Type', value: entry.entry_type },
                { label: 'Item', value: entry.item_code },
                { label: 'Qty', value: entry.qty },
                { label: 'Source Warehouse', value: entry.source_warehouse || '-' },
                { label: 'Target Warehouse', value: entry.target_warehouse || '-' },
                { label: 'Date', value: entry.date },
                { label: 'Remarks', value: entry.remarks || '-' },
                { label: 'Owner', value: entry.owner || '-' },
              ]}
            />
          </DetailSection>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
