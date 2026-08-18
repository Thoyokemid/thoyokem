'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/ListView';
import { AlertCircle, ScrollText, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateTime } from '@/lib/date';

interface FieldChange {
  field: string;
  from: string;
  to: string;
}

interface AuditEntry {
  log_id: string;
  doctype: string;
  document_id: string;
  action: string;
  changed_by: string;
  timestamp: string;
  changes: FieldChange[];
}

const ACTION_TONE: Record<string, 'gray' | 'green' | 'blue' | 'red' | 'orange' | 'purple'> = {
  Created: 'green',
  Updated: 'blue',
  Deleted: 'red',
  Submitted: 'blue',
  Approved: 'green',
  Rejected: 'red',
  Cancelled: 'red',
  Amended: 'orange',
  Received: 'green',
  Delivered: 'green',
  Paid: 'green',
  Imported: 'blue',
  Exported: 'gray',
};

const DOCTYPE_HREF: Record<string, (id: string) => string> = {
  'Purchase Order': (id) => `/dashboard/purchasing/purchase-order/${encodeURIComponent(id)}`,
  'Purchase Invoice': (id) => `/dashboard/purchasing/purchase-invoice/${encodeURIComponent(id)}`,
  Supplier: (id) => `/dashboard/purchasing/supplier/${encodeURIComponent(id)}`,
  'Sales Order': (id) => `/dashboard/sales-order/sales-order/${encodeURIComponent(id)}`,
  'Sales Invoice': (id) => `/dashboard/sales-order/sales-invoice/${encodeURIComponent(id)}`,
  Customer: (id) => `/dashboard/sales-order/customer/${encodeURIComponent(id)}`,
  'Delivery Note': (id) => `/dashboard/delivery-order/delivery-note/${encodeURIComponent(id)}`,
  Item: (id) => `/dashboard/inventory/item/${encodeURIComponent(id)}`,
  Warehouse: (id) => `/dashboard/inventory/warehouse/${encodeURIComponent(id)}`,
  'Stock Entry': (id) => `/dashboard/inventory/stock-entry/${encodeURIComponent(id)}`,
  BOM: (id) => `/dashboard/inventory/bom/${encodeURIComponent(id)}`,
  Staff: (id) => `/dashboard/hr/staff/${encodeURIComponent(id)}`,
  Leave: (id) => `/dashboard/hr/leave/${encodeURIComponent(id)}`,
  Registration: (id) => `/dashboard/registration/${encodeURIComponent(id)}`,
  User: (id) => `/dashboard/settings/user/${encodeURIComponent(id)}`,
  Role: (id) => `/dashboard/settings/role/${encodeURIComponent(id)}`,
  Attendance: () => `/dashboard/hr/attendance?tab=data`,
};

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [doctypeOptions, setDoctypeOptions] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filterDoctype, setFilterDoctype] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const isSuperAdmin = !!session?.user.isSuperAdmin;

  const fetchData = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(targetPage) });
        if (filterDoctype) params.set('doctype', filterDoctype);
        if (filterUser) params.set('changed_by', filterUser);
        if (filterAction) params.set('action', filterAction);
        if (filterDateFrom) params.set('date_from', filterDateFrom);
        if (filterDateTo) params.set('date_to', filterDateTo);

        const res = await fetch(`/api/audit-log?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries);
          setTotal(data.total);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setDoctypeOptions(data.filterOptions.doctypes);
          setUserOptions(data.filterOptions.users);
        } else {
          setError((await res.json()).error || 'Gagal memuat audit log');
        }
      } catch (err) {
        console.error('Error fetching audit log:', err);
        setError('Gagal memuat audit log');
      } finally {
        setIsLoading(false);
      }
    },
    [filterDoctype, filterUser, filterAction, filterDateFrom, filterDateTo]
  );

  useEffect(() => {
    if (isSuperAdmin) fetchData(1);
    else setIsLoading(false);
  }, [session, fetchData]);

  const clearFilters = () => {
    setFilterDoctype('');
    setFilterUser('');
    setFilterAction('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilter = filterDoctype || filterUser || filterAction || filterDateFrom || filterDateTo;

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
            <ScrollText size={22} className="text-primary" />
            Audit Log
          </h1>
          <Button variant="secondary" onClick={() => fetchData(page)} disabled={isLoading}>
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
        </div>

        <div className="card p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <select value={filterDoctype} onChange={(e) => setFilterDoctype(e.target.value)} className="input-field text-sm">
              <option value="">Semua Doctype</option>
              {doctypeOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="input-field text-sm">
              <option value="">Semua User</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-field text-sm">
              <option value="">Semua Aksi</option>
              {Object.keys(ACTION_TONE).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="input-field text-sm" />
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="input-field text-sm" />
          </div>
          {hasActiveFilter && (
            <button onClick={clearFilters} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
              <X size={12} /> Bersihkan filter
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">Tidak ada log ditemukan</div>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Waktu</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Doctype</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dokumen</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Aksi</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">Oleh</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const hrefFn = DOCTYPE_HREF[e.doctype];
                  const isExpanded = expanded === e.log_id;
                  return (
                    <Fragment key={e.log_id}>
                      <tr
                        onClick={() => setExpanded(isExpanded ? null : e.log_id)}
                        className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(e.timestamp)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">{e.doctype}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {hrefFn ? (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); router.push(hrefFn(e.document_id)); }}
                              className="text-primary hover:underline"
                            >
                              {e.document_id}
                            </button>
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300">{e.document_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge label={e.action} tone={ACTION_TONE[e.action] || 'gray'} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300">{e.changed_by || '-'}</td>
                      </tr>
                      {isExpanded && e.changes.length > 0 && (
                        <tr className="bg-gray-50 dark:bg-gray-900/40">
                          <td colSpan={5} className="px-4 py-2.5">
                            <div className="space-y-1">
                              {e.changes.map((c, i) => (
                                <p key={i} className="text-xs text-gray-500">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{c.field}</span>: {c.from || '-'} → {c.to || '-'}
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{total} total log &middot; Halaman {page} / {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => fetchData(page - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => fetchData(page + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
