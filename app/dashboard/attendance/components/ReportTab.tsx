'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { AttendanceImport, AttendanceRecord } from '@/types';
import { processAttendanceData, exportToXLSX } from '@/utils/attendance';
import { useWorkHours } from '@/hooks/useWorkHours';
import { Search, Download, Calendar } from 'lucide-react';

const PAGE_SIZE = 20;

export default function ReportTab() {
  const [rawData, setRawData] = useState<AttendanceImport[]>([]);
  const [reportData, setReportData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const workHours = useWorkHours();

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (rawData.length > 0) {
      const processed = processAttendanceData(rawData, workHours);
      setReportData(processed);
      setFilteredData(processed);
    }
  }, [rawData, workHours]);

  useEffect(() => {
    filterData();
    setPage(1);
  }, [searchTerm, dateFrom, dateTo, reportData]);

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

  const filterData = () => {
    let filtered = [...reportData];
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.jabatan.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (dateFrom) filtered = filtered.filter((item) => item.tanggal_absensi >= dateFrom);
    if (dateTo) filtered = filtered.filter((item) => item.tanggal_absensi <= dateTo);
    setFilteredData(filtered);
  };

  const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));

  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div className="flex flex-col gap-3">
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
              <Button onClick={() => exportToXLSX(filteredData)} variant="secondary">
                <Download size={14} className="mr-1.5" />
                Export
              </Button>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field pl-9" />
              </div>
              <div className="flex-1 relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field pl-9" />
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {filteredData.length} of {reportData.length} records
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {['Nama', 'Jabatan', 'Tanggal', 'Jam Masuk', 'Keterlambatan', 'Jam Pulang', 'Overtime'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500">No data available</td></tr>
              ) : (
                paginatedData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.nama}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.jabatan}</td>
                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{row.tanggal_absensi}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="text-xs text-gray-500">Target: {row.jam_masuk_target}</div>
                      <div className={row.keterlambatan_menit > 0 ? 'text-red-600 font-medium text-xs' : 'text-xs'}>
                        Actual: {row.jam_masuk_actual || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-center">
                      <div className="font-medium text-xs">{row.keterlambatan_menit} min</div>
                      <div className={`text-xs ${row.keterangan_masuk === 'Terlambat' ? 'text-red-600' : 'text-green-600'}`}>
                        {row.keterangan_masuk}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="text-xs text-gray-500">Target: {row.jam_pulang_target}</div>
                      <div className={row.overtime_menit > 0 ? 'text-blue-600 font-medium text-xs' : 'text-xs'}>
                        Actual: {row.jam_pulang_actual || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-center">
                      <div className="font-medium text-xs">{row.overtime_menit} min</div>
                      <div className={`text-xs ${row.keterangan_pulang === 'Overtime' ? 'text-blue-600' : 'text-green-600'}`}>
                        {row.keterangan_pulang}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredData.length > 0 && (
          <Pagination page={page} totalPages={totalPages} totalItems={filteredData.length} pageSize={PAGE_SIZE} onChange={setPage} />
        )}
      </Card>
    </div>
  );
}