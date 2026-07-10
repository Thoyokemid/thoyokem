'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns3, Check } from 'lucide-react';

export interface ColumnDef {
  key: string;
  header: string;
}

interface ColumnPickerProps {
  columns: ColumnDef[];
  visible: string[];
  onChange: (visible: string[]) => void;
}

export default function ColumnPicker({ columns, visible, onChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (key: string) => {
    if (visible.includes(key)) {
      if (visible.length === 1) return; // keep at least 1 column
      onChange(visible.filter((v) => v !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Columns3 size={14} />
        Columns
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1.5 max-h-72 overflow-y-auto">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tampilkan Kolom
          </p>
          {columns.map((col) => {
            const isVisible = visible.includes(col.key);
            return (
              <button
                key={col.key}
                onClick={() => toggle(col.key)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span>{col.header}</span>
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isVisible
                      ? 'bg-primary border-primary text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {isVisible && <Check size={11} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
