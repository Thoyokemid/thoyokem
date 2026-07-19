'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import { AttendanceImport, AttendanceRecord, AttendanceRecap } from '@/types';
import { processAttendanceData, calculateRecap, exportRecapToXLSX } from '@/utils/attendance';
import { useWorkHours } from '@/hooks/useWorkHours';
import { Download, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const PAGE_SIZE = 20;

export default function RecapTab() {
  const [rawData, setRawData] = useState<AttendanceImport[]>([]);
  const [processedRecords, setProcessedRecords] = useState<AttendanceRecord[]>([]);
  const [recapData, setRecapData] = useState<AttendanceRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const workHours = useWorkHours();

  // Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (rawData.length > 0) {
      const processed = processAttendanceData(rawData, workHours);
      setProcessedRecords(processed);
      setRecapData(calculateRecap(processed));
    }
  }, [rawData, workHours]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/attendance');
      if (response.ok) setRawData(await response.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get available date range from data
  const availableDates = processedRecords.map((r) => r.attendance_date).sort();
  const minDate = availableDates[0] || '';
  const maxDate = availableDates[availableDates.length - 1] || '';

  const handleOpenExportModal = () => {
    // Default to full range
    setExportDateFrom(minDate);
    setExportDateTo(maxDate);
    setIsExportModalOpen(true);
  };

  const handleExport = () => {
    exportRecapToXLSX(processedRecords, exportDateFrom || undefined, exportDateTo || undefined);
    setIsExportModalOpen(false);
  };

  // Preview count — how many employees have records in selected range
  const previewCount = (() => {
    let filtered = processedRecords;
    if (exportDateFrom) filtered = filtered.filter((r) => r.attendance_date >= exportDateFrom);
    if (exportDateTo) filtered = filtered.filter((r) => r.attendance_date <= exportDateTo);
    return new Set(filtered.map((r) => r.employee_name)).size;
  })();

  const totalLate = recapData.reduce((sum, r) => sum + r.jumlah_keterlambatan, 0);
  const totalOvertime = recapData.reduce((sum, r) => sum + r.jumlah_overtime, 0);
  const totalAttendance = recapData.reduce((sum, r) => sum + r.jumlah_hadir, 0);
  const avgLateness = recapData.length > 0
    ? Math.round(recapData.reduce((sum, r) => sum + r.average_keterlambatan, 0) / recapData.length)
    : 0;
  const avgOvertime = recapData.length > 0
    ? Math.round(recapData.reduce((sum, r) => sum + r.average_overtime, 0) / recapData.length)
    : 0;

  const paginatedData = recapData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(recapData.length / PAGE_SIZE));

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Attendance</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{totalAttendance}</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <Calendar className="text-green-500" size={20} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Late</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{totalLate}</p>
            </div>
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <TrendingDown className="text-red-500" size={20} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Avg Lateness</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{avgLateness} min</p>
            </div>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <TrendingDown className="text-orange-500" size={20} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Overtime</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalOvertime}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <TrendingUp className="text-blue-500" size={20} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Avg Overtime</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{avgOvertime} min</p>
            </div>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <TrendingUp className="text-green-500" size={20} />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Employee Summary</h3>
          <Button onClick={handleOpenExportModal} variant="secondary" disabled={recapData.length === 0}>
            <Download size={14} className="mr-1.5" />
            Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {['Nama Karyawan', 'Jumlah Hadir', 'Keterlambatan', 'Overtime'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500">No data available</td></tr>
              ) : (
                paginatedData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.nama_karyawan}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="text-green-500" size={14} />
                        <span className="font-semibold text-green-600 dark:text-green-400">{row.jumlah_hadir} hari</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="text-red-500" size={14} />
                        <span className="font-medium">{row.jumlah_keterlambatan}x</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total: {row.total_keterlambatan_menit} min</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg: {row.average_keterlambatan} min</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="text-blue-500" size={14} />
                        <span className="font-medium">{row.jumlah_overtime}x</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total: {row.total_overtime_menit} min</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Avg: {row.average_overtime} min</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {recapData.length > 0 && (
          <Pagination page={page} totalPages={totalPages} totalItems={recapData.length} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </Card>

      {/* Export Date Range Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Recap"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pilih rentang tanggal untuk data yang akan diekspor. Kosongkan untuk ekspor semua data.
          </p>

          {minDate && maxDate && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2">
              Data tersedia: <span className="font-medium text-gray-700 dark:text-gray-300">{minDate}</span>
              {' '}s/d{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">{maxDate}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="label-field">Dari Tanggal</label>
              <input
                type="date"
                value={exportDateFrom}
                min={minDate}
                max={exportDateTo || maxDate}
                onChange={(e) => setExportDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Sampai Tanggal</label>
              <input
                type="date"
                value={exportDateTo}
                min={exportDateFrom || minDate}
                max={maxDate}
                onChange={(e) => setExportDateTo(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Preview */}
          <div className={`text-xs rounded-md px-3 py-2 ${
            previewCount > 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
          }`}>
            {previewCount > 0
              ? `✓ ${previewCount} karyawan akan diekspor`
              : '⚠ Tidak ada data pada rentang ini'}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={previewCount === 0}
            >
              <Download size={14} className="mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}