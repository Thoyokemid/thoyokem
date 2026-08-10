'use client';

import { useState, useEffect } from 'react';
import { History, Plus, Pencil, Trash2, Send, Check, Ban, XCircle, PackageCheck, Truck } from 'lucide-react';

interface FieldChange {
  field: string;
  from: string;
  to: string;
}

interface ActivityLogEntry {
  log_id: string;
  action: string;
  changed_by: string;
  timestamp: string;
  changes: FieldChange[];
}

const ACTION_ICON: Record<string, React.ElementType> = {
  Created: Plus,
  Updated: Pencil,
  Deleted: Trash2,
  Submitted: Send,
  Approved: Check,
  Rejected: Ban,
  Cancelled: XCircle,
  Amended: Pencil,
  Received: PackageCheck,
  Delivered: Truck,
  Paid: Check,
};

const ACTION_COLOR: Record<string, string> = {
  Created: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Updated: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  Deleted: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Submitted: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  Approved: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Rejected: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Cancelled: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Amended: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
  Received: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Delivered: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Paid: 'text-green-500 bg-green-50 dark:bg-green-900/20',
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ActivityLogView({ doctype, documentId }: { doctype: string; documentId: string }) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/activity-log?doctype=${encodeURIComponent(doctype)}&document_id=${encodeURIComponent(documentId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setIsLoading(false));
  }, [doctype, documentId]);

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-4 text-center">Memuat riwayat...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
        <History size={14} />
        Belum ada riwayat perubahan
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const Icon = ACTION_ICON[entry.action] || Pencil;
        const color = ACTION_COLOR[entry.action] || 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
        return (
          <div key={entry.log_id} className="flex gap-2.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={12} />
            </div>
            <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-100">{entry.changed_by || 'System'}</span>{' '}
                {entry.action.toLowerCase()}
                <span className="text-gray-400"> · {formatTimestamp(entry.timestamp)}</span>
              </p>
              {entry.changes.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {entry.changes.map((c, i) => (
                    <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                      <span className="font-medium">{c.field}</span>:{' '}
                      <span className="line-through text-red-400">{c.from || '(kosong)'}</span>{' '}
                      → <span className="text-green-600 dark:text-green-400">{c.to || '(kosong)'}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
