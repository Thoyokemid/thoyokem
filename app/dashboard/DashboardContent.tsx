'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Loading from '@/components/ui/Loading';
import { AttendanceImport, StaffList, LeaveAttendance } from '@/types';
import { processAttendanceData, calculateRecap, countUsedLeaveDays } from '@/utils/attendance';
import { useWorkHours } from '@/hooks/useWorkHours';
import ModuleOverview from '@/components/dashboard/ModuleOverview';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, ChevronRight, Cake, FileText, Clock, Users, UserCheck, CalendarClock, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardContentProps {
  userName: string;
  permissions: {
    inventory: boolean;
    purchasing: boolean;
    sales_order: boolean;
    delivery_order: boolean;
  };
}

const PAGE_SIZE = 10;

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function PaginationBar({
  page, total, onChange,
}: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <span className="text-xs text-gray-500">Page {page} of {total}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === total}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function paginate<T>(arr: T[], page: number): T[] {
  return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function totalPages(arr: unknown[]): number {
  return Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
}

export default function DashboardContent({ userName, permissions }: DashboardContentProps) {
  const [attendanceData, setAttendanceData] = useState<AttendanceImport[]>([]);
  const [staffList, setStaffList] = useState<StaffList[]>([]);
  const [leaveData, setLeaveData] = useState<LeaveAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Chart mode: overtime or keterlambatan
  const [chartMode, setChartMode] = useState<'overtime' | 'keterlambatan'>('overtime');
  // Sub-view: daily or per user
  const [chartView, setChartView] = useState<'daily' | 'users'>('daily');
  // Date range for top chart: 3, 7, 30 days, or custom (default 30)
  const [chartRange, setChartRange] = useState<'3' | '7' | '30' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [birthdayPage, setBirthdayPage] = useState(1);
  const [quotaPage, setQuotaPage] = useState(1);
  const [latePage, setLatePage] = useState(1);
  const [absenPage, setAbsenPage] = useState(1);

  // Absen sort
  const [absenSort, setAbsenSort] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [attRes, staffRes, leaveRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/staff'),
        fetch('/api/leave'),
      ]);
      if (attRes.ok) setAttendanceData(await attRes.json());
      if (staffRes.ok) setStaffList(await staffRes.json());
      if (leaveRes.ok) setLeaveData(await leaveRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const workHours = useWorkHours();
  const processed = attendanceData.length ? processAttendanceData(attendanceData, workHours) : [];
  const recap = processed.length ? calculateRecap(processed) : [];

  // --- Date range for top chart ---
  // Anchor "N hari" pada tanggal terbaru yang ADA di data, bukan tanggal hari ini,
  // supaya data yang ditampilkan tetap 30 hari terakhir yang tersedia meski data belum di-import untuk hari ini.
  const latestDataDate = processed.reduce(
    (max, r) => (r.attendance_date > max ? r.attendance_date : max),
    ''
  );

  const { rangeFrom, rangeTo } = (() => {
    if (chartRange === 'custom') {
      return { rangeFrom: customFrom, rangeTo: customTo };
    }
    if (!latestDataDate) return { rangeFrom: '', rangeTo: '' };

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const days = parseInt(chartRange, 10);
    const anchor = new Date(latestDataDate);
    const from = new Date(anchor);
    from.setDate(from.getDate() - (days - 1));
    return { rangeFrom: fmt(from), rangeTo: latestDataDate };
  })();

  const rangeFilteredProcessed = processed.filter((r) => {
    if (rangeFrom && r.attendance_date < rangeFrom) return false;
    if (rangeTo && r.attendance_date > rangeTo) return false;
    return true;
  });
  const rangeRecap = rangeFilteredProcessed.length ? calculateRecap(rangeFilteredProcessed) : [];

  // --- Overtime data ---
  const overtimeDailyData = (() => {
    const dayMap = new Map<string, number>();
    rangeFilteredProcessed.forEach((r) => {
      if (r.overtime_minutes > 0) {
        dayMap.set(r.attendance_date, (dayMap.get(r.attendance_date) ?? 0) + r.overtime_minutes);
      }
    });
    return Array.from(dayMap.entries())
      .map(([date, total]) => ({ name: date.slice(5), fullDate: date, total }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  })();

  const overtimeUsersData = rangeRecap
    .filter((r) => r.total_overtime_menit > 0)
    .map((r) => ({ name: toTitleCase(r.nama_karyawan), total: r.total_overtime_menit }))
    .sort((a, b) => b.total - a.total);

  // --- Keterlambatan data ---
  const keterlambatanDailyData = (() => {
    const dayMap = new Map<string, number>();
    rangeFilteredProcessed.forEach((r) => {
      if (r.late_entry_minutes > 0) {
        dayMap.set(r.attendance_date, (dayMap.get(r.attendance_date) ?? 0) + r.late_entry_minutes);
      }
    });
    return Array.from(dayMap.entries())
      .map(([date, total]) => ({ name: date.slice(5), fullDate: date, total }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  })();

  const keterlambatanUsersData = rangeRecap
    .filter((r) => r.total_keterlambatan_menit > 0)
    .map((r) => ({ name: toTitleCase(r.nama_karyawan), total: r.total_keterlambatan_menit }))
    .sort((a, b) => b.total - a.total);

  // Active chart data
  const activeData = chartMode === 'overtime'
    ? (chartView === 'daily' ? overtimeDailyData : overtimeUsersData)
    : (chartView === 'daily' ? keterlambatanDailyData : keterlambatanUsersData);

  const chartColor = chartMode === 'overtime' ? '#6366f1' : '#ef4444';

  const chartTitle = chartMode === 'overtime'
    ? `Total Overtime ${chartView === 'daily' ? 'per Hari' : 'per Orang'} (menit)`
    : `Total Keterlambatan ${chartView === 'daily' ? 'per Hari' : 'per Orang'} (menit)`;

  const tooltipLabel = chartMode === 'overtime' ? 'Total Overtime' : 'Total Keterlambatan';

  // Birthday data
  const birthdayData = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return staffList
      .filter((s) => s.date_of_birth)
      .map((s) => {
        const bd = new Date(s.date_of_birth!);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        const nextBirthday =
          thisYear < today
            ? new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
            : thisYear;
        const daysUntil = Math.ceil(
          (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        const age = today.getFullYear() - bd.getFullYear() + (thisYear < today ? 1 : 0);
        return { ...s, nextBirthday, daysUntil, age };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  })();

  // Leave quota data
  const leaveQuotaData = staffList
    .map((s) => {
      const used = countUsedLeaveDays(leaveData, s.user_id);
      const quota = s.leave_allocation ?? 12;
      const remaining = Math.max(0, quota - used);
      return { ...s, used, quota, remaining };
    })
    .sort((a, b) => a.remaining - b.remaining);

  // Top 10 least late
  const latenessData = recap
    .map((r) => ({
      name: toTitleCase(r.nama_karyawan),
      avg: r.average_keterlambatan,
      count: r.jumlah_keterlambatan,
    }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 10);

  // --- KPI stats (BI-style) ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthPrefix = todayStr.slice(0, 7);

  const hadirHariIni = new Set(
    processed.filter((r) => r.attendance_date === todayStr && r.in_time).map((r) => r.employee_name)
  ).size;

  const cutiAktifHariIni = leaveData.filter(
    (l) => l.from_date <= todayStr && l.to_date >= todayStr
  ).length;

  const overtimeBulanIni = processed
    .filter((r) => r.attendance_date.startsWith(monthPrefix))
    .reduce((sum, r) => sum + r.overtime_minutes, 0);

  const keterlambatanBulanIni = processed
    .filter((r) => r.attendance_date.startsWith(monthPrefix))
    .reduce((sum, r) => sum + r.late_entry_minutes, 0);

  const kpis = [
    {
      label: 'Total Karyawan',
      value: staffList.length,
      icon: Users,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
    {
      label: 'Hadir Hari Ini',
      value: hadirHariIni,
      icon: UserCheck,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Cuti Aktif Hari Ini',
      value: cutiAktifHariIni,
      icon: CalendarClock,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Overtime Bulan Ini',
      value: `${overtimeBulanIni} min`,
      icon: TrendingUp,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Keterlambatan Bulan Ini',
      value: `${keterlambatanBulanIni} min`,
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  // Jumlah absen per orang
  const absenPerOrangData = recap
    .map((r) => ({
      name: toTitleCase(r.nama_karyawan),
      jumlah: r.jumlah_hadir,
    }))
    .sort((a, b) => absenSort === 'desc' ? b.jumlah - a.jumlah : a.jumlah - b.jumlah);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Welcome back, {userName}!
        </p>
      </div>

      <ModuleOverview permissions={permissions} />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{kpi.label}</p>
                  <p className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mt-0.5">{kpi.value}</p>
                </div>
                <div className={`p-2 rounded-lg flex-shrink-0 ${kpi.bg}`}>
                  <Icon className={kpi.color} size={18} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* TOP: Chart */}
      <Card>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {chartTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
                <button
                  onClick={() => setChartMode('overtime')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    chartMode === 'overtime'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Overtime
                </button>
                <button
                  onClick={() => setChartMode('keterlambatan')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    chartMode === 'keterlambatan'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Keterlambatan
                </button>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
                <button
                  onClick={() => setChartView('daily')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    chartView === 'daily'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setChartView('users')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    chartView === 'users'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Users
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              {(['3', '7', '30'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setChartRange(d)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    chartRange === d
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {d} Hari
                </button>
              ))}
              <button
                onClick={() => setChartRange('custom')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  chartRange === 'custom'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Custom
              </button>
            </div>

            {chartRange === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="input-field !py-1 !px-2 text-xs w-[9.5rem]"
                />
                <span className="text-xs text-gray-400">—</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="input-field !py-1 !px-2 text-xs w-[9.5rem]"
                />
              </div>
            )}
          </div>
        </div>

        {activeData.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activeData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11 }} unit=" min" />
              <Tooltip
                formatter={(val: number) => [`${val} menit`, tooltipLabel]}
                labelFormatter={(label) => {
                  if (chartView === 'daily') {
                    const item = activeData.find((d) => d.name === label);
                    return (item as any)?.fullDate ?? label;
                  }
                  return label;
                }}
                contentStyle={{ fontSize: 12, color: '#111827' }}
              />
              <Bar dataKey="total" radius={[3, 3, 0, 0]} fill={chartColor} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Jumlah Absen Per Orang - full width */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20">
              <Users className="text-indigo-500" size={16} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Jumlah Absen Per Orang
            </h3>
            <span className="text-xs text-gray-400">({absenPerOrangData.length} karyawan)</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
            <button
              onClick={() => { setAbsenSort('desc'); setAbsenPage(1); }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                absenSort === 'desc'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Terbanyak
            </button>
            <button
              onClick={() => { setAbsenSort('asc'); setAbsenPage(1); }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                absenSort === 'asc'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Tersedikit
            </button>
          </div>
        </div>

        {absenPerOrangData.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">No attendance data</p>
        ) : (
          <>
            {/* Bar visualization */}
            <div className="space-y-2">
              {paginate(absenPerOrangData, absenPage).map((item, idx) => {
                const rank = (absenPage - 1) * PAGE_SIZE + idx + 1;
                const maxJumlah = absenPerOrangData[0]?.jumlah || 1;
                const pct = Math.round((item.jumlah / maxJumlah) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{rank}</span>
                    <p className="text-xs font-medium text-gray-900 dark:text-white w-36 truncate flex-shrink-0">
                      {item.name}
                    </p>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 w-14 text-right flex-shrink-0">
                      {item.jumlah} hari
                    </span>
                  </div>
                );
              })}
            </div>
            <PaginationBar
              page={absenPage}
              total={totalPages(absenPerOrangData)}
              onChange={setAbsenPage}
            />
          </>
        )}
      </Card>

      {/* BOTTOM 3 SECTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: Upcoming Birthdays */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-pink-50 dark:bg-pink-900/20">
              <Cake className="text-pink-500" size={16} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Upcoming Birthdays
            </h3>
          </div>

          {birthdayData.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No birthday data</p>
          ) : (
            <>
              <div className="space-y-2">
                {paginate(birthdayData, birthdayPage).map((s) => (
                  <div
                    key={s.employee_id}
                    className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0"
                  >
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">
                        {toTitleCase(s.employee_name)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.nextBirthday.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · Usia {s.age}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.daysUntil === 0
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                          : s.daysUntil <= 7
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {s.daysUntil === 0 ? '🎂 Today' : `${s.daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
              <PaginationBar
                page={birthdayPage}
                total={totalPages(birthdayData)}
                onChange={setBirthdayPage}
              />
            </>
          )}
        </Card>

        {/* MIDDLE: Leave Quota */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20">
              <FileText className="text-blue-500" size={16} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Sisa Kuota Cuti
            </h3>
          </div>

          {leaveQuotaData.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No data</p>
          ) : (
            <>
              <div className="space-y-2">
                {paginate(leaveQuotaData, quotaPage).map((s) => {
                  const pct = Math.round((s.remaining / s.quota) * 100);
                  return (
                    <div
                      key={s.employee_id}
                      className="py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[130px]">
                          {toTitleCase(s.employee_name)}
                        </p>
                        <span
                          className={`text-xs font-bold ${
                            s.remaining <= 2
                              ? 'text-red-600'
                              : s.remaining <= 5
                              ? 'text-orange-500'
                              : 'text-green-600'
                          }`}
                        >
                          {s.remaining}/{s.quota}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            s.remaining <= 2
                              ? 'bg-red-500'
                              : s.remaining <= 5
                              ? 'bg-orange-400'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationBar
                page={quotaPage}
                total={totalPages(leaveQuotaData)}
                onChange={setQuotaPage}
              />
            </>
          )}
        </Card>

        {/* RIGHT: Top 10 Least Late */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-green-50 dark:bg-green-900/20">
              <Clock className="text-green-500" size={16} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Top 10 Paling Tepat Waktu
            </h3>
          </div>

          {latenessData.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No attendance data</p>
          ) : (
            <>
              <div className="space-y-2">
                {paginate(latenessData, latePage).map((item, idx) => {
                  const rank = (latePage - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <span
                        className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                          rank === 1
                            ? 'bg-yellow-100 text-yellow-700'
                            : rank === 2
                            ? 'bg-gray-100 text-gray-600'
                            : rank === 3
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">{item.count}x terlambat</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.avg === 0
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {item.avg === 0 ? '✓ 0 min' : `${item.avg} min`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <PaginationBar
                page={latePage}
                total={totalPages(latenessData)}
                onChange={setLatePage}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}