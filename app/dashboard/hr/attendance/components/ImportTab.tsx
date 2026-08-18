'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import { Upload, FileText, CheckCircle, AlertCircle, Info, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { AttendanceImport } from '@/types';

interface ParsedResult {
  data: AttendanceImport[];
  dates: string[];
}

interface ImportTabProps {
  onImported?: () => void;
}

const PREVIEW_COLUMNS: { key: keyof AttendanceImport; header: string }[] = [
  { key: 'employee_name', header: 'Nama' },
  { key: 'attendance_date', header: 'Tanggal' },
  { key: 'jam_set', header: 'Jam Set' },
  { key: 'jam_absensi', header: 'Jam Absensi' },
  { key: 'verifikasi', header: 'Verifikasi' },
  { key: 'tipe_absensi', header: 'Tipe' },
  { key: 'designation', header: 'Jabatan' },
  { key: 'branch', header: 'Kantor' },
];

function validateRow(row: AttendanceImport): string | null {
  const missing: string[] = [];
  if (!row.employee_name) missing.push('Nama');
  if (!row.attendance_date) missing.push('Tanggal Absensi');
  return missing.length > 0 ? `Kolom wajib kosong: ${missing.join(', ')}` : null;
}

export default function ImportTab({ onImported }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    detail?: string;
  }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      setUploadStatus({ type: 'error', message: 'Please select a valid CSV or Excel file' });
      return;
    }

    setFile(selectedFile);
    setUploadStatus({ type: null, message: '' });
    setParsed(null);
    setRowErrors({});

    // Parse preview
    try {
      const result = await parseFile(selectedFile);
      const dates = Array.from(new Set(result.map((r) => r.attendance_date).filter(Boolean))).sort();
      setParsed({ data: result, dates });
      const errors: Record<number, string> = {};
      result.forEach((row, i) => {
        const err = validateRow(row);
        if (err) errors[i] = err;
      });
      setRowErrors(errors);
    } catch {
      setUploadStatus({ type: 'error', message: 'Failed to read file. Please check the format.' });
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !parsed) return;
    const validRows = parsed.data.filter((_, i) => !rowErrors[i]);
    if (validRows.length === 0) return;

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRows),
      });

      if (!response.ok) throw new Error('Failed to import data');

      const result = await response.json();
      setUploadStatus({
        type: 'success',
        message: `Successfully imported ${result.count} records for ${result.dates_replaced.length} date(s).`,
        detail: `${result.preserved} existing records from other dates were kept. Total in sheet: ${result.total}.`,
      });
      setFile(null);
      setParsed(null);
      setRowErrors({});
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImported?.();
    } catch {
      setUploadStatus({ type: 'error', message: 'Failed to import data. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };

  const parseFile = async (file: File): Promise<AttendanceImport[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const mappedData = (jsonData as any[]).map((row) => ({
            cloud_id: String(row['Cloud ID'] || ''),
            id: String(row['ID'] || ''),
            employee_name: String(row['Nama'] || ''),
            attendance_date: String(row['Tanggal Absensi'] || ''),
            jam_set: String(row['Jam Set'] || ''),
            jam_absensi: String(row['Jam Absensi'] || ''),
            verifikasi: String(row['Verifikasi'] || ''),
            tipe_absensi: String(row['Tipe Absensi'] || ''),
            designation: String(row['Jabatan'] || ''),
            branch: String(row['Kantor'] || ''),
            remarks: String(row['Keterangan'] || ''),
          }));

          resolve(mappedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const resetFile = () => {
    setFile(null);
    setParsed(null);
    setRowErrors({});
    setUploadStatus({ type: null, message: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Import akan <strong>menambah</strong> data baru ke sheet. Data lama dengan tanggal berbeda tetap tersimpan.
              Jika tanggal sudah ada di sheet, data lama untuk tanggal tersebut akan <strong>diganti</strong> dengan data dari file baru.
            </p>
          </div>

          {/* Drop zone */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <div className="text-center">
              <Upload className="mx-auto text-gray-400 mb-3" size={40} />
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                Upload File
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Select a CSV or Excel file with attendance data
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs rounded-md font-medium transition-colors bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200">
                  <FileText size={14} className="mr-2" />
                  Choose File
                </span>
              </label>
            </div>
          </div>

          {/* File preview */}
          {file && parsed && (
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary" size={20} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB · {parsed.data.length} records
                        {Object.keys(rowErrors).length > 0 && (
                          <span className="text-red-600 dark:text-red-400"> · {Object.keys(rowErrors).length} baris error</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetFile}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Row preview */}
              <div className="max-h-60 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                      {PREVIEW_COLUMNS.map((c) => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.data.map((row, i) => {
                      const rowError = rowErrors[i];
                      return (
                        <tr
                          key={i}
                          className={rowError ? 'bg-red-50 dark:bg-red-900/20' : 'odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/50'}
                          title={rowError}
                        >
                          <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                          {PREVIEW_COLUMNS.map((c) => (
                            <td key={c.key} className={`px-2 py-1 whitespace-nowrap ${rowError ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {row[c.key] || <span className="text-gray-300 dark:text-gray-600">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {Object.keys(rowErrors).length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {Object.keys(rowErrors).length} baris (ditandai merah) tidak punya Nama atau Tanggal Absensi dan akan dilewati kalau tetap lanjut import. Arahkan kursor ke baris untuk lihat detailnya.
                  </p>
                </div>
              )}

              {/* Dates preview */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-gray-500" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Tanggal dalam file ({parsed.dates.length} hari):
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.dates.map((date) => (
                    <span
                      key={date}
                      className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium"
                    >
                      {date}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ Data lama untuk tanggal di atas akan diganti. Data tanggal lain tetap aman.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleUpload}
                  variant="primary"
                  isLoading={isUploading}
                  disabled={parsed.data.length - Object.keys(rowErrors).length === 0}
                >
                  {Object.keys(rowErrors).length > 0
                    ? `Import ${parsed.data.length - Object.keys(rowErrors).length} Records Valid`
                    : `Import ${parsed.data.length} Records`}
                </Button>
              </div>
            </div>
          )}

          {/* Status */}
          {uploadStatus.type && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              uploadStatus.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={16} />
              ) : (
                <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
              )}
              <div>
                <p className={`text-xs font-medium ${
                  uploadStatus.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  {uploadStatus.message}
                </p>
                {uploadStatus.detail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{uploadStatus.detail}</p>
                )}
              </div>
            </div>
      )}
    </div>
  );
}