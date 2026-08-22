'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import { Cake } from 'lucide-react';

interface BirthdayEntry {
  employee_id: string;
  employee_name: string;
  date_of_birth: string;
}

interface UpcomingBirthday extends BirthdayEntry {
  daysUntil: number;
  nextBirthday: Date;
}

// date_of_birth is stored as a plain "YYYY-MM-DD" string. Parsing it with `new Date(str)`
// reads it as UTC midnight, which shifts to the previous day in negative-UTC-offset
// timezones once read back via local getMonth()/getDate() — parse the parts directly instead.
function parseDobParts(dob: string): { month: number; day: number } | null {
  const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Visible to anyone with dashboard access — not gated behind the `staff` permission. */
export default function UpcomingBirthdaysWidget() {
  const [isLoading, setIsLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<UpcomingBirthday[]>([]);

  useEffect(() => {
    fetch('/api/staff/birthdays')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: BirthdayEntry[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const computed = data
          .map((entry) => {
            const parts = parseDobParts(entry.date_of_birth);
            if (!parts) return null;
            const { month, day } = parts;
            // Feb 29 birthdays: land on Feb 28 in non-leap years instead of silently
            // rolling into March 1, which is what `new Date(y, 1, 29)` would otherwise do.
            const dayForYear = (year: number) => (month === 1 && day === 29 && !isLeapYear(year) ? 28 : day);
            const thisYear = new Date(today.getFullYear(), month, dayForYear(today.getFullYear()));
            const nextBirthday =
              thisYear < today ? new Date(today.getFullYear() + 1, month, dayForYear(today.getFullYear() + 1)) : thisYear;
            const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return { ...entry, nextBirthday, daysUntil };
          })
          .filter((e): e is UpcomingBirthday => e !== null)
          .sort((a, b) => a.daysUntil - b.daysUntil)
          .slice(0, 5);

        setUpcoming(computed);
      })
      .catch(() => setUpcoming([]))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || upcoming.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-500 flex items-center justify-center flex-shrink-0">
          <Cake size={16} />
        </span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upcoming Birthdays</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {upcoming.map((entry) => (
          <div key={entry.employee_id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
              {getInitials(entry.employee_name)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{entry.employee_name}</p>
              <p className="text-xs text-gray-400">{format(entry.nextBirthday, 'd MMMM', { locale: id })}</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${
                entry.daysUntil === 0
                  ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                  : entry.daysUntil <= 7
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {entry.daysUntil === 0 ? 'Hari ini!' : `${entry.daysUntil} hari lagi`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
