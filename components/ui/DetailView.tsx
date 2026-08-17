'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ChevronRight } from 'lucide-react';
import Loading from '@/components/ui/Loading';
import { addRecentlyViewed } from '@/lib/recentlyViewed';

interface DetailViewProps {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  isLoading?: boolean;
  notFound?: boolean;
  children?: React.ReactNode;
}

/** ERPNext-style single-document page: breadcrumb, title/badges, action buttons, and a body slot. */
export function DetailView({ backHref, backLabel, title, subtitle, badges, actions, isLoading, notFound, children }: DetailViewProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !notFound && title) {
      addRecentlyViewed({ href: pathname, label: title, subtitle: backLabel });
    }
  }, [isLoading, notFound, title, subtitle, pathname, backLabel]);

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-1 hover:text-primary flex-shrink-0">
          <LayoutDashboard size={12} />
          Dashboard
        </Link>
        <ChevronRight size={12} className="flex-shrink-0" />
        <Link href={backHref} className="hover:text-primary flex-shrink-0">
          {backLabel}
        </Link>
        <ChevronRight size={12} className="flex-shrink-0" />
        <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{title}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loading size="lg" /></div>
      ) : notFound ? (
        <p className="px-3 py-16 text-center text-sm text-gray-500">Dokumen tidak ditemukan.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
                {badges}
              </div>
              {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
          </div>
          {children}
        </>
      )}
    </div>
  );
}

export function DetailSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      {title && <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h2>}
      {children}
    </div>
  );
}

export function FieldGrid({ fields }: { fields: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
      {fields.map((f, i) => (
        <div key={i}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{f.label}</p>
          <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 break-words">{f.value ?? '-'}</p>
        </div>
      ))}
    </div>
  );
}

export function DetailTable({ columns, rows }: { columns: { key: string; header: string; align?: 'left' | 'right' }[]; rows: Record<string, React.ReactNode>[] }) {
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-xs text-gray-400">No rows</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2 text-gray-800 dark:text-gray-200 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
