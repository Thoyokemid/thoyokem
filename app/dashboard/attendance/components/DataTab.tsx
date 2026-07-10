'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import ColumnPicker, { ColumnDef } from '@/components/ui/ColumnPicker';
import { AttendanceImport } from '@/types';
import { getInitials } from '@/utils/format';
import { Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'nama', header: 'Nama' },
  { key: 'tanggal_absensi', header: 'Tanggal' },
  { key: 'jam_absensi', header: 'Jam' },
  { key: 'jam_set', header: 'Jam Set' },
  { key: 'tipe_absensi', header: 'Tipe' },
  { key: 'jabatan', header: 'Jabatan' },
  { key: 'kantor', header: 'Kantor' },
  { key: 'verifikasi', header: 'Verifikasi' },
  { key: 'keterangan', header: 'Keterangan' },
];

const DEFAULT_VISIBLE = ['nama', 'tanggal_absensi', 'jam_absensi', 'tipe_absensi', 'jabatan', 'verifikasi'];
const STORAGE_KEY = 'attendance_data_columns';

function VerifikasiBadge({ value }: { value: string }) {
  const ok = value?.toLowerCase() === 'vein' || value?.toLowerCase() === 'fingerprint' || value?.toLowerCase() === 'face';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
      ok ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}>
      {value || '-'}
    </span>
  );
}

function TipeBadge({ value }: { value: string }) {
  const masuk = value?.includes('Masuk');
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
      masuk ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    }`}>
      {value || '-'}
    </span>
  );
}

export default function DataTab() {
  const [data, setData] = useState<AttendanceImport[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [page, setPage] = useState(1);
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleCols(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    filterData();
    setPage(1);
  }, [searchTerm, selectedDate, data]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/attendance');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setFilteredData(result);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...data];
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedDate) {
      filtered = filtered.filter((item) => item.tanggal_absensi === selectedDate);
    }
    setFilteredData(filtered);
  };

  const handleExport = () => {
    const exportData = filteredData.map((item) => ({
      'Cloud ID': item.cloud_id,
      'ID': item.id,
      'Nama': item.nama,
      'Tanggal Absensi': item.tanggal_absensi,
      'Jam Set': item.jam_set,
      'Jam Absensi': item.jam_absensi,
      'Verifikasi': item.verifikasi,
      'Tipe Absensi': item.tipe_absensi,
      'Jabatan': item.jabatan,
      'Kantor': item.kantor,
      'Keterangan': item.keterangan,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Data');
    XLSX.writeFile(workbook, `attendance_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportModalOpen(false);
  };

  const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));

  const columns = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="w-full md:w-40">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex gap-2">
              <ColumnPicker columns={ALL_COLUMNS} visible={visibleCols} onChange={setVisibleCols} />
              <Button onClick={() => setIsExportModalOpen(true)} variant="outline">
                <Download size={14} className="mr-1.5" />
                Export
              </Button>
            </div>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {filteredData.length} of {data.length} records
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {columns.map((col) => {
                      const value = row[col.key as keyof AttendanceImport];
                      if (col.key === 'nama') {
                        return (
                          <td key={col.key} className="px-3 py-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {getInitials(String(value || '?'))}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
                            </div>
                          </td>
                        );
                      }
                      if (col.key === 'verifikasi') {
                        return <td key={col.key} className="px-3 py-2.5 text-xs"><VerifikasiBadge value={String(value || '')} /></td>;
                      }
                      if (col.key === 'tipe_absensi') {
                        return <td key={col.key} className="px-3 py-2.5 text-xs"><TipeBadge value={String(value || '')} /></td>;
                      }
                      return (
                        <td key={col.key} className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                          {value || <span className="text-gray-300 dark:text-gray-600">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredData.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        )}
      </Card>

      <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Data" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Data yang sedang ditampilkan (sesuai filter aktif) akan diekspor ke Excel.
          </p>
          <div className="text-xs rounded-md px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
            ✓ {filteredData.length} baris akan diekspor
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={handleExport} disabled={filteredData.length === 0}>
              <Download size={14} className="mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
