'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SplashScreen from '@/components/ui/SplashScreen';
import Card from '@/components/ui/Card';
import ModuleOverview from '@/components/dashboard/ModuleOverview';
import {
  LayoutDashboard, Clock, FileText, Users, UserPlus, Settings,
  Boxes, ShoppingCart, ShoppingBag, Truck, ChevronRight,
} from 'lucide-react';

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
  const [showSplash, setShowSplash] = useState(false);
  const [splashMinTimeDone, setSplashMinTimeDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('showSplash')) {
      setShowSplash(true);
      sessionStorage.removeItem('showSplash');
      // Keep the splash on screen for a deliberate 3-5s minimum so it doesn't just flash by.
      const minDuration = 3000 + Math.random() * 2000;
      setTimeout(() => setSplashMinTimeDone(true), minDuration);
    } else {
      setSplashMinTimeDone(true);
    }
  }, []);

  if (showSplash && !splashMinTimeDone) {
    return <SplashScreen />;
  }

  const quickActions: QuickAction[] = [
    { name: 'HR Dashboard', href: '/dashboard/hr', icon: Users, enabled: permissions.attendance || permissions.leave || permissions.staff },
    { name: 'Attendance', href: '/dashboard/attendance', icon: Clock, enabled: permissions.attendance },
    { name: 'Leave', href: '/dashboard/leave', icon: FileText, enabled: permissions.leave },
    { name: 'Staff', href: '/dashboard/staff', icon: Users, enabled: permissions.staff },
    { name: 'Inventory', href: '/dashboard/inventory', icon: Boxes, enabled: permissions.inventory },
    { name: 'Purchasing', href: '/dashboard/purchasing', icon: ShoppingCart, enabled: permissions.purchasing },
    { name: 'Sales Order', href: '/dashboard/sales-order', icon: ShoppingBag, enabled: permissions.sales_order },
    { name: 'Delivery Order', href: '/dashboard/delivery-order', icon: Truck, enabled: permissions.delivery_order },
    { name: 'Registration', href: '/dashboard/registration', icon: UserPlus, enabled: permissions.registration_request },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: permissions.setting },
  ].filter((a) => a.enabled);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Welcome back, {userName}!
        </p>
      </div>

      <ModuleOverview permissions={permissions} />

      {quickActions.length > 0 && (
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
