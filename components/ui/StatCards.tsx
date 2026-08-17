'use client';

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import { useVisibleColumns } from '@/components/ui/ReportView';

export interface StatCardDef {
  key: string;
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  color: string; // tailwind color name, e.g. 'primary', 'blue', 'orange', 'green', 'red'
}

const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-500' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-500' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500' },
};

/** Persists which stat cards are shown, per dashboard. */
export function useVisibleCards(storageKey: string, defaultVisible: string[]) {
  return useVisibleColumns(storageKey, defaultVisible);
}

/** Grid of KPI cards with a "customize" control to show/hide individual cards (persisted). */
export function StatCardGrid({
  cards,
  visible,
  onVisibleChange,
}: {
  cards: StatCardDef[];
  visible: string[];
  onVisibleChange: (keys: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleCard = (key: string) => {
    onVisibleChange(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  };

  const shown = cards.filter((c) => visible.includes(c.key));

  return (
    <div>
      <div className="flex justify-end mb-1.5">
        <div ref={ref} className="relative">
          <button
            onClick={() => setIsOpen((v) => !v)}
            title="Kustomisasi kartu"
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-primary rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <SlidersHorizontal size={13} />
            Kustomisasi
          </button>
          {isOpen && (
            <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-10">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tampilkan Kartu</p>
              {cards.map((c) => {
                const isVisible = visible.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCard(c.key)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {c.label}
                    {isVisible && <Check size={14} className="text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Semua kartu disembunyikan</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {shown.map((c) => {
            const Icon = c.icon;
            const colors = COLOR_CLASSES[c.color] || COLOR_CLASSES.primary;
            return (
              <Card key={c.key}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${colors.bg}`}>
                    <Icon className={colors.text} size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{c.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
