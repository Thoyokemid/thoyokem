'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ViewModeDropdown, ViewMode, OverflowMenu, OverflowMenuItem, OverflowMenuColumns } from '@/components/ui/ListView';
import { Download } from 'lucide-react';
import { logExport } from '@/lib/logExport';

export interface ReportColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Cell content for the report table. Falls back to String(row[key]). */
  render?: (row: T) => React.ReactNode;
  /** Plain value used for Excel export. Falls back to render()/row[key] as string. */
  exportValue?: (row: T) => string | number;
}

/** Persists list/report view choice to localStorage, per tab. */
export function useViewMode(storageKey: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>('list');

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'report' || saved === 'list') setMode(saved);
  }, [storageKey]);

  const update = (m: ViewMode) => {
    setMode(m);
    localStorage.setItem(storageKey, m);
  };

  return [mode, update];
}

/** Persists picked report columns to localStorage, per tab. */
export function useVisibleColumns(storageKey: string, defaultVisible: string[]): [string[], (cols: string[]) => void] {
  const [visible, setVisible] = useState<string[]>(defaultVisible);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setVisible(parsed);
      } catch {}
    }
  }, [storageKey]);

  const update = (cols: string[]) => {
    setVisible(cols);
    localStorage.setItem(storageKey, JSON.stringify(cols));
  };

  return [visible, update];
}

export function exportToExcel<T>(rows: T[], columns: ReportColumn<T>[], filename: string, sheetName: string) {
  const exportRows = rows.map((row) => {
    const obj: Record<string, string | number> = {};
    columns.forEach((col) => {
      if (col.exportValue) obj[col.header] = col.exportValue(row);
      else obj[col.header] = (row as any)[col.key] ?? '';
    });
    return obj;
  });
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  logExport(sheetName, exportRows.length);
}

/** ViewModeDropdown + "Pick Columns"/"Export" overflow menu, meant to sit in a ListViewLayout toolbar or header row. */
export function ReportViewControls<T>({
  viewMode,
  onViewModeChange,
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  onExport,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  columns: ReportColumn<T>[];
  visibleColumns: string[];
  onVisibleColumnsChange: (cols: string[]) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ViewModeDropdown mode={viewMode} onChange={onViewModeChange} />
      {viewMode === 'report' && (
        <OverflowMenu>
          <OverflowMenuColumns columns={columns} visible={visibleColumns} onChange={onVisibleColumnsChange} />
          <OverflowMenuItem icon={Download} onClick={onExport}>
            Export
          </OverflowMenuItem>
        </OverflowMenu>
      )}
    </div>
  );
}

/** Generic report table: renders the given columns (filtered to visibleColumns) for each row. */
export function ReportTable<T>({
  columns,
  visibleColumns,
  rows,
  keyField,
}: {
  columns: ReportColumn<T>[];
  visibleColumns: string[];
  rows: T[];
  keyField: (row: T) => string;
}) {
  const cols = columns.filter((c) => visibleColumns.includes(c.key));

  // No outer card wrapper — meant to be dropped directly into ListViewLayout's
  // children slot, which already provides the surrounding card in both modes.
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {cols.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-3 py-10 text-center text-sm text-gray-500">No data available</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={keyField(row)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                {cols.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.render ? col.render(row) : String((row as any)[col.key] ?? '-')}
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
