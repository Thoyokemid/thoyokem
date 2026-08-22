'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import Button from '@/components/ui/Button';
import { StockEntry } from '@/types';
import { AlertCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StockEntryDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [entry, setEntry] = useState<StockEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const runCancel = async () => {
    if (!confirm('Batalkan Stock Entry ini? Stok yang sudah dipindahkan akan dibalik ke kondisi semula.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/stock-entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id: id, action: 'cancel' }),
      });
      if (res.ok) {
        fetchData();
        toast.success('Stock entry dibatalkan');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal membatalkan');
      }
    } catch (error) {
      console.error('Error cancelling stock entry:', error);
      toast.error('Gagal membatalkan');
    } finally {
      setBusy(false);
    }
  };

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
        badges={entry && <StatusBadge label={entry.status || 'Submitted'} tone={entry.status === 'Cancelled' ? 'red' : 'green'} />}
        actions={
          entry && entry.status !== 'Cancelled' && (
            <Button variant="danger" disabled={busy} onClick={runCancel}>
              <XCircle size={14} className="mr-1.5" />Cancel
            </Button>
          )
        }
        sidebar={
          entry && (
            <>
              <AssignedToSection doctype="Stock Entry" documentId={entry.entry_id} />
              <DetailSection title="Riwayat">
                <ActivityLogView doctype="Stock Entry" documentId={entry.entry_id} />
                <AttachmentSection doctype="Stock Entry" documentId={entry.entry_id} />
              </DetailSection>
            </>
          )
        }
      >
        {entry && (
          <div className="space-y-4">
          <DetailSection title="Detail">
            <FieldGrid
              fields={[
                { label: 'Entry Type', value: entry.entry_type },
                {
                  label: 'Item',
                  value: (
                    <Link href={`/dashboard/inventory/item/${encodeURIComponent(entry.item_code)}`} className="text-primary hover:underline">
                      {entry.item_code}
                    </Link>
                  ),
                },
                { label: 'Qty', value: entry.qty },
                {
                  label: 'Source Warehouse',
                  value: entry.source_warehouse ? (
                    <Link href={`/dashboard/inventory/warehouse/${encodeURIComponent(entry.source_warehouse)}`} className="text-primary hover:underline">
                      {entry.source_warehouse}
                    </Link>
                  ) : '-',
                },
                {
                  label: 'Target Warehouse',
                  value: entry.target_warehouse ? (
                    <Link href={`/dashboard/inventory/warehouse/${encodeURIComponent(entry.target_warehouse)}`} className="text-primary hover:underline">
                      {entry.target_warehouse}
                    </Link>
                  ) : '-',
                },
                { label: 'Date', value: entry.date },
                { label: 'Remarks', value: entry.remarks || '-' },
                { label: 'Owner', value: entry.owner || '-' },
              ]}
            />
          </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
