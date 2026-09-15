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
import { Bom } from '@/types';
import { AlertCircle } from 'lucide-react';

function BomDetailPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(searchParams.get('id')));
  const [bom, setBom] = useState<Bom | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.inventory) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/boms');
      if (res.ok) {
        const list: Bom[] = await res.json();
        setBom(list.find((b) => b.bom_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching BOM:', error);
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
        backHref="/dashboard/inventory?tab=bom"
        backLabel="Product Campuran (BOM)"
        title={bom?.item_name || id}
        subtitle={bom?.bom_id}
        isLoading={isLoading}
        notFound={!isLoading && !bom}
        badges={bom && <StatusBadge label={bom.is_active ? 'Active' : 'Inactive'} tone={bom.is_active ? 'green' : 'gray'} />}
        sidebar={
          bom && (
            <>
              <AssignedToSection doctype="BOM" documentId={bom.bom_id} />
              <DetailSection title="Riwayat">
                <ActivityLogView doctype="BOM" documentId={bom.bom_id} />
                <AttachmentSection doctype="BOM" documentId={bom.bom_id} />
              </DetailSection>
            </>
          )
        }
      >
        {bom && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  {
                    label: 'Produk',
                    value: (
                      <Link href={`/dashboard/inventory/item?id=${encodeURIComponent(bom.item_code)}`} className="text-primary hover:underline">
                        {bom.item_name || bom.item_code}
                      </Link>
                    ),
                  },
                  { label: 'Output Qty per Produksi', value: bom.qty },
                  { label: 'Owner', value: bom.owner || '-' },
                  { label: 'Dibuat', value: bom.creation || '-' },
                ]}
              />
            </DetailSection>
            <DetailSection title="Komponen">
              <DetailTable
                columns={[
                  { key: 'component', header: 'Item Komponen' },
                  { key: 'qty', header: 'Qty', align: 'right' },
                ]}
                rows={bom.components.map((c) => ({
                  component: (
                    <Link href={`/dashboard/inventory/item?id=${encodeURIComponent(c.component_item_code)}`} className="text-primary hover:underline">
                      {c.component_item_name || c.component_item_code} ({c.component_item_code})
                    </Link>
                  ),
                  qty: c.qty,
                }))}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    
  );
}

export default function BomDetailPage() {
  return (
    <Suspense fallback={null}>
      <BomDetailPageInner />
    </Suspense>
  );
}
