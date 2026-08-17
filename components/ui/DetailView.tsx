'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, ChevronRight } from 'lucide-react';
import Loading from '@/components/ui/Loading';
import { addRecentlyViewed } from '@/lib/recentlyViewed';
import { supabaseBrowser } from '@/lib/supabaseClient';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface Viewer {
  name: string;
  photo_url?: string;
}

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
  const { data: session } = useSession();
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!isLoading && !notFound && title) {
      addRecentlyViewed({ href: pathname, label: title, subtitle: backLabel });
    }
  }, [isLoading, notFound, title, pathname, backLabel]);

  // Presence: shows who else currently has this exact document open, via
  // Supabase Realtime Presence — no data stored, just live browser state.
  useEffect(() => {
    if (!session?.user || isLoading || notFound) return;
    const selfId = session.user.id;
    const selfName = session.user.name || 'Someone';
    let cancelled = false;

    const channel = supabaseBrowser.channel(`presence:${pathname}`, {
      config: { presence: { key: selfId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Viewer[]>;
        const others = Object.entries(state)
          .filter(([key]) => key !== selfId)
          .map(([, entries]) => entries[0])
          .filter((v): v is Viewer => !!v?.name);
        const seen = new Set<string>();
        setViewers(others.filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true))));
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        let photoUrl = '';
        try {
          const res = await fetch('/api/profile');
          if (res.ok) photoUrl = (await res.json()).photo_url || '';
        } catch {}
        if (!cancelled) await channel.track({ name: selfName, photo_url: photoUrl });
      });

    return () => {
      cancelled = true;
      supabaseBrowser.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, pathname, isLoading, notFound]);

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
            <div className="flex items-center gap-3 flex-shrink-0">
              {viewers.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {viewers.map((v) => (
                    <div key={v.name} className="group relative">
                      {v.photo_url ? (
                        <img
                          src={v.photo_url}
                          alt={v.name}
                          className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                          {getInitials(v.name)}
                        </span>
                      )}
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-700 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        {v.name} sedang melihat ini
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
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
