'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/ListView';
import { AlertCircle, Cpu, Database, HardDrive, RefreshCw, Users, ShoppingCart, ShoppingBag, Package } from 'lucide-react';

interface SystemInfo {
  app: {
    name: string;
    version: string;
    nodeVersion: string;
    nextVersion: string;
    environment: string;
    region: string;
    commitSha: string | null;
    commitMessage: string | null;
    deploymentUrl: string | null;
  };
  database: { status: string; latencyMs: number; error?: string };
  storage: { status: string; latencyMs: number; bucket: string; error?: string };
  counts: { users: number; purchaseOrders: number; salesOrders: number; items: number };
}

function StatusTone(status: string): 'green' | 'red' | 'orange' {
  if (status === 'connected') return 'green';
  if (status === 'bucket_missing') return 'orange';
  return 'red';
}

export default function SystemConsolePage() {
  const { data: session, status } = useSession();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const isSuperAdmin = !!session?.user.isSuperAdmin;

  useEffect(() => {
    if (isSuperAdmin) fetchData();
    else setIsLoading(false);
  }, [session]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/system-console');
      if (res.ok) setInfo(await res.json());
      else setError((await res.json()).error || 'Gagal memuat info sistem');
    } catch (err) {
      console.error('Error fetching system console:', err);
      setError('Gagal memuat info sistem');
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

  if (!isSuperAdmin) {
    return (
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Halaman ini hanya untuk Super Admin.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Cpu size={22} className="text-primary" />
            System Console
          </h1>
          <Button variant="secondary" onClick={fetchData} disabled={isLoading}>
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : info ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card title="Database (Supabase Postgres)">
                <div className="flex items-center gap-3 mb-2">
                  <Database size={16} className="text-gray-400" />
                  <StatusBadge label={info.database.status} tone={StatusTone(info.database.status)} />
                  <span className="text-xs text-gray-400">{info.database.latencyMs}ms</span>
                </div>
                {info.database.error && <p className="text-xs text-red-500">{info.database.error}</p>}
              </Card>
              <Card title="Storage (Supabase)">
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive size={16} className="text-gray-400" />
                  <StatusBadge label={info.storage.status} tone={StatusTone(info.storage.status)} />
                  <span className="text-xs text-gray-400">{info.storage.latencyMs}ms</span>
                </div>
                <p className="text-xs text-gray-500">Bucket: {info.storage.bucket}</p>
                {info.storage.error && <p className="text-xs text-red-500">{info.storage.error}</p>}
              </Card>
            </div>

            <Card title="App Info">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                {[
                  { label: 'App Version', value: info.app.version },
                  { label: 'Node.js Runtime', value: info.app.nodeVersion },
                  { label: 'Next.js', value: info.app.nextVersion },
                  { label: 'Environment', value: info.app.environment },
                  { label: 'Region', value: info.app.region },
                  { label: 'Commit', value: info.app.commitSha || '-' },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{f.label}</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 break-words">{f.value}</p>
                  </div>
                ))}
              </div>
              {info.app.commitMessage && (
                <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                  "{info.app.commitMessage}"
                </p>
              )}
            </Card>

            <Card title="Ringkasan Data">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Users', value: info.counts.users, icon: Users },
                  { label: 'Purchase Orders', value: info.counts.purchaseOrders, icon: ShoppingCart },
                  { label: 'Sales Orders', value: info.counts.salesOrders, icon: ShoppingBag },
                  { label: 'Items', value: info.counts.items, icon: Package },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <s.icon size={16} className="text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-400">{s.label}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
