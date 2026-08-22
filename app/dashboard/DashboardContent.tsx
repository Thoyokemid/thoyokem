'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import ModuleOverview from '@/components/dashboard/ModuleOverview';
import UpcomingBirthdaysWidget from '@/components/dashboard/UpcomingBirthdaysWidget';
import {
  LayoutDashboard, Clock, FileText, Users, UserPlus, Settings,
  Boxes, ShoppingCart, ShoppingBag, Truck, ChevronRight, SlidersHorizontal, Check,
} from 'lucide-react';

interface WidgetDef {
  key: string;
  label: string;
}

const WIDGETS: WidgetDef[] = [
  { key: 'overview', label: 'Ringkasan Modul' },
  { key: 'birthdays', label: 'Upcoming Birthdays' },
  { key: 'quick_action', label: 'Quick Action' },
];
const DEFAULT_VISIBLE_WIDGETS = WIDGETS.map((w) => w.key);
const STORAGE_KEY = 'dashboard_widgets';

interface DashboardContentProps {
  userName: string;
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    staff: boolean;
    registration_request: boolean;
    setting: boolean;
    inventory: boolean;
    purchasing: boolean;
    sales_order: boolean;
    delivery_order: boolean;
  };
}

interface QuickAction {
  name: string;
  href: string;
  icon: React.ElementType;
  enabled: boolean;
}

export default function DashboardContent({ userName, permissions }: DashboardContentProps) {
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(DEFAULT_VISIBLE_WIDGETS);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setVisibleWidgets(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) setIsCustomizeOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleWidget = (key: string) => {
    setVisibleWidgets((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const quickActions: QuickAction[] = [
    { name: 'HR Dashboard', href: '/dashboard/hr', icon: Users, enabled: permissions.attendance || permissions.leave || permissions.staff },
    { name: 'Attendance', href: '/dashboard/hr/attendance', icon: Clock, enabled: permissions.attendance },
    { name: 'Leave', href: '/dashboard/hr/leave', icon: FileText, enabled: permissions.leave },
    { name: 'Staff', href: '/dashboard/hr/staff', icon: Users, enabled: permissions.staff },
    { name: 'Inventory', href: '/dashboard/inventory', icon: Boxes, enabled: permissions.inventory },
    { name: 'Purchasing', href: '/dashboard/purchasing', icon: ShoppingCart, enabled: permissions.purchasing },
    { name: 'Sales Order', href: '/dashboard/sales-order', icon: ShoppingBag, enabled: permissions.sales_order },
    { name: 'Delivery Order', href: '/dashboard/delivery-order', icon: Truck, enabled: permissions.delivery_order },
    { name: 'Registration', href: '/dashboard/registration', icon: UserPlus, enabled: permissions.registration_request },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: permissions.setting },
  ].filter((a) => a.enabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="relative" ref={customizeRef}>
          <button
            onClick={() => setIsCustomizeOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <SlidersHorizontal size={13} /> Customize
          </button>
          {isCustomizeOpen && (
            <div className="absolute right-0 z-20 mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1.5">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Tampilkan widget
              </p>
              {WIDGETS.map((w) => {
                const isVisible = visibleWidgets.includes(w.key);
                return (
                  <button
                    key={w.key}
                    onClick={() => toggleWidget(w.key)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span>{w.label}</span>
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
      </div>

      {visibleWidgets.includes('overview') && <ModuleOverview permissions={permissions} />}

      {visibleWidgets.includes('birthdays') && <UpcomingBirthdaysWidget />}

      {visibleWidgets.includes('quick_action') && quickActions.length > 0 && (
        <Card title="Quick Action">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors -mx-3 px-3 md:-mx-4 md:px-4"
                >
                  <span className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon size={14} />
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{action.name}</span>
                  <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
