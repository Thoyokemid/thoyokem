'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Info } from 'lucide-react';

export interface ImportColumn {
  /** Field key sent to the API. */
  key: string;
  /** Column header shown in the template + expected in the uploaded file. */
  label: string;
  /** Sample value written into the template's example row. */
  example?: string;
  required?: boolean;
}

interface ImportResult {
  success: boolean;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: ImportColumn[];
  apiEndpoint: string;
  templateFilename: string;
  onImported?: () => void;
}

/**
 * Reusable superadmin-only bulk import: download an Excel template with the
 * right headers, fill it in, upload it back. Column matching is by header
 * label (not position), same convention as the rest of the app's sheet-style
 * data access.
 */
export default function BulkImportModal({
  isOpen,
  onClose,
  title,
  columns,
  apiEndpoint,
  templateFilename,
  onImported,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.label);
    const exampleRow = columns.map((c) => c.example ?? '');
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${templateFilename}.xlsx`);
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setParseError('Pilih file CSV atau Excel (.xlsx/.xls).');
      return;
    }

    setFile(selected);
    setResult(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        const mapped = jsonRows.map((row) => {
          const obj: Record<string, any> = {};
          columns.forEach((c) => {
            obj[c.key] = row[c.label] !== undefined ? String(row[c.label]).trim() : '';
          });
          return obj;
        });

        setRows(mapped);
      } catch {
        setParseError('Gagal membaca file. Pastikan formatnya sesuai template.');
        setFile(null);
      }
    };
    reader.onerror = () => setParseError('Gagal membaca file.');
    reader.readAsBinaryString(selected);
  };

  const handleUpload = async () => {
    if (!rows.length) return;
    setIsUploading(true);
    setResult(null);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import gagal');

      setResult(data as ImportResult);
      if (data.created > 0) onImported?.();
    } catch (error: any) {
      setResult({ success: false, created: 0, skipped: rows.length, errors: [{ row: 0, message: error.message || 'Import gagal' }] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Download template dulu, isi datanya, lalu upload lagi di sini. Kolom yang wajib diisi:{' '}
            <strong>{columns.filter((c) => c.required).map((c) => c.label).join(', ')}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Download size={14} />
          Download Template Excel
        </button>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
          <div className="text-center">
            <Upload className="mx-auto text-gray-400 mb-3" size={32} />
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Upload file yang sudah diisi</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="bulk-import-file"
            />
            <label htmlFor="bulk-import-file" className="cursor-pointer">
              <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200">
                <FileText size={14} className="mr-2" />
                Pilih File
              </span>
            </label>
          </div>
        </div>

        {parseError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-red-700 dark:text-red-400">{parseError}</p>
          </div>
        )}

        {file && rows.length > 0 && !result && (
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="text-primary" size={18} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-gray-500">{rows.length} baris terdeteksi</p>
                </div>
              </div>
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline">
                Hapus
              </button>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpload} variant="primary" isLoading={isUploading}>
                Import {rows.length} Baris
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              result.created > 0
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {result.created > 0 ? (
                <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={16} />
              ) : (
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
              )}
              <div>
                <p className={`text-xs font-medium ${result.created > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {result.created} baris berhasil diimport{result.skipped > 0 ? `, ${result.skipped} dilewati` : ''}.
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-gray-500 dark:text-gray-400">
                    {e.row > 0 ? `Baris ${e.row}: ` : ''}{e.message}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={reset} variant="secondary">Import File Lain</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
