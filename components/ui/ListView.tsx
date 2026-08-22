'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, List, Table2, ChevronDown, MoreVertical, Download, Columns3, Check, Bookmark, Trash2 } from 'lucide-react';
import { SavedView } from '@/lib/savedViews';

export interface ListViewFilter {
  label: string;
  value: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

export interface ListViewFilterGroup {
  title: string;
  filters: ListViewFilter[];
}

interface ListViewLayoutProps {
  title?: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  filterGroups?: ListViewFilterGroup[];
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * ERPNext-style list view shell: page header, left filter sidebar,
 * toolbar (search/sort), and a slot for the actual list rows.
 */
export function ListViewLayout({
  title,
  subtitle,
  primaryAction,
  filterGroups = [],
  toolbar,
  children,
}: ListViewLayoutProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className={`flex ${title || subtitle ? 'flex-col sm:flex-row sm:justify-between sm:items-center' : 'justify-end'} gap-3`}>
        {(title || subtitle) && (
          <div>
            {title && <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>}
            {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          {filterGroups.length > 0 && (
            <button
              onClick={() => setIsFilterOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            >
              <Filter size={13} />
              Filter
            </button>
          )}
          {primaryAction}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {filterGroups.length > 0 && (
          <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-48 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 space-y-4 sticky top-4">
              {filterGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.filters.map((f) => (
                      <button
                        key={f.value}
                        onClick={f.onClick}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                          f.active
                            ? 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300 font-semibold'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="truncate">{f.label}</span>
                        {f.count !== undefined && (
                          <span className="text-[10px] text-gray-400 ml-1">{f.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </aside>

            {/* Mobile filter drawer */}
            {isFilterOpen && (
              <div className="lg:hidden fixed inset-0 z-40 flex">
                <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setIsFilterOpen(false)} />
                <div className="relative w-64 bg-white dark:bg-gray-800 h-full p-3 space-y-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Filters</p>
                    <button onClick={() => setIsFilterOpen(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  {filterGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                        {group.title}
                      </p>
                      <div className="space-y-0.5">
                        {group.filters.map((f) => (
                          <button
                            key={f.value}
                            onClick={() => {
                              f.onClick();
                              setIsFilterOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                              f.active
                                ? 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300 font-semibold'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <span className="truncate">{f.label}</span>
                            {f.count !== undefined && (
                              <span className="text-[10px] text-gray-400 ml-1">{f.count}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex-1 min-w-0 space-y-3">
          {toolbar && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2.5">{toolbar}</div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export type StatusDotTone = 'gray' | 'green' | 'red' | 'blue' | 'orange' | 'purple';

const STATUS_DOT_COLOR: Record<StatusDotTone, string> = {
  gray: 'bg-gray-400',
  green: 'bg-green-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
};

/** Small colored dot, ERPNext-style, meant to sit right before a list row's title. */
export function StatusDot({ tone = 'gray' }: { tone?: StatusDotTone }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT_COLOR[tone]}`} />;
}

interface ListRowProps {
  avatar?: React.ReactNode;
  title: React.ReactNode;
  /** Small colored dot rendered right before the title, e.g. status at a glance. */
  statusTone?: StatusDotTone;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
  /** Set both to turn on a bulk-select checkbox at the start of the row. */
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

/** A single ERPNext-style list row: avatar, title/subtitle, meta, badges, actions. */
export function ListRow({ avatar, title, statusTone, subtitle, meta, badges, onClick, actions, selected, onSelectChange }: ListRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
        onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
      } ${selected ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
    >
      {onSelectChange && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
        />
      )}
      {avatar && <div className="flex-shrink-0">{avatar}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
          {statusTone && <StatusDot tone={statusTone} />}
          <span className="truncate">{title}</span>
        </p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{subtitle}</p>}
      </div>
      {meta && <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{meta}</div>}
      {badges && <div className="flex items-center gap-1.5 flex-shrink-0">{badges}</div>}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function ListRowAvatar({ initials }: { initials: string }) {
  return (
    <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-xs font-bold flex items-center justify-center">
      {initials}
    </span>
  );
}

export type ViewMode = 'list' | 'report';

/** ERPNext-style "List View ▾" dropdown to switch between List View and Report View. */
export function ViewModeDropdown({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: { value: ViewMode; label: string; icon: React.ElementType }[] = [
    { value: 'list', label: 'List View', icon: List },
    { value: 'report', label: 'Report View', icon: Table2 },
  ];
  const current = options.find((o) => o.value === mode) ?? options[0];
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <CurrentIcon size={14} />
        {current.label}
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 py-1">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  opt.value === mode
                    ? 'text-primary font-semibold bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={13} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** ERPNext-style "⋮" overflow menu. Put arbitrary menu content as children. */
export function OverflowMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 py-1.5 max-h-80 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function OverflowMenuItem({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

/** "Pick Columns" section meant to live inside an OverflowMenu — an inline expandable checklist. */
export function OverflowMenuColumns({
  columns,
  visible,
  onChange,
}: {
  columns: { key: string; header: string }[];
  visible: string[];
  onChange: (visible: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = (key: string) => {
    if (visible.includes(key)) {
      if (visible.length === 1) return;
      onChange(visible.filter((v) => v !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Columns3 size={13} />
          Pick Columns
        </span>
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 py-1 max-h-56 overflow-y-auto">
          {columns.map((col) => {
            const isVisible = visible.includes(col.key);
            return (
              <button
                key={col.key}
                onClick={() => toggle(col.key)}
                className="w-full flex items-center justify-between gap-2 pl-6 pr-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span>{col.header}</span>
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center border ${
                    isVisible ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'
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

export interface BulkAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

/** Sticky bar that appears above a list once rows are selected — count + bulk action buttons. */
export function ListSelectionBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <span>{count} dipilih</span>
        <button onClick={onClear} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline font-normal">
          Batal
        </button>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-40 ${
                a.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700'
              }`}
            >
              {Icon && <Icon size={13} />}
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatusBadge({ label, tone = 'gray' }: { label: string; tone?: 'gray' | 'green' | 'red' | 'blue' | 'orange' | 'purple' }) {
  const tones: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${tones[tone]}`}>
      {label}
    </span>
  );
}

/** "Views ▾" dropdown: save the current filter combination, or reapply/delete a saved one. */
export function SavedViewsMenu<T>({
  views,
  onApply,
  onSave,
  onDelete,
}: {
  views: SavedView<T>[];
  onApply: (filters: T) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSave = () => {
    const name = window.prompt('Nama untuk filter ini:');
    if (name && name.trim()) onSave(name.trim());
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Bookmark size={13} /> Views <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 py-1">
          <button
            onClick={handleSave}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Bookmark size={13} /> Simpan filter saat ini
          </button>
          {views.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1 max-h-56 overflow-y-auto">
              {views.map((v) => (
                <div key={v.id} className="flex items-center group">
                  <button
                    onClick={() => {
                      onApply(v.filters);
                      setOpen(false);
                    }}
                    className="flex-1 text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 truncate"
                  >
                    {v.name}
                  </button>
                  <button
                    onClick={() => onDelete(v.id)}
                    className="px-2 py-1.5 text-gray-300 hover:text-red-600 dark:text-gray-600 dark:hover:text-red-400"
                    title="Hapus"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
