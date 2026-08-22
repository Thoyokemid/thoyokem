'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Truck,
  ShieldAlert,
  Cpu,
  ScrollText,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  animateIn?: boolean;
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    registration_request: boolean;
    setting: boolean;
    staff: boolean;
    inventory: boolean;
    purchasing: boolean;
    sales_order: boolean;
    delivery_order: boolean;
    report_builder: boolean;
  };
}

function SidebarInner({ permissions, animateIn }: SidebarProps) {
  const { data: session } = useSession();
  const isSuperAdmin = !!session?.user.isSuperAdmin;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    setIsCollapsed(localStorage.getItem('sidebar_collapsed') === '1');
  }, []);

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then((res) => setIsHealthy(res.ok))
        .catch(() => setIsHealthy(false));
    };
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };
  const [expanded, setExpanded] = useState<string[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab');

  const toggleExpanded = (href: string) => {
    setExpanded((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
  };

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      enabled: permissions.dashboard,
    },
    {
      name: 'HR',
      icon: Users,
      href: '/dashboard/hr',
      enabled: permissions.attendance || permissions.leave || permissions.staff,
      subItems: [
        { name: 'Attendance Data', href: '/dashboard/hr/attendance?tab=data', enabled: permissions.attendance },
        { name: 'Attendance Report', href: '/dashboard/hr/attendance?tab=report', enabled: permissions.attendance },
        { name: 'Attendance Recap', href: '/dashboard/hr/attendance?tab=recap', enabled: permissions.attendance },
        { name: 'Leave', href: '/dashboard/hr/leave', enabled: permissions.leave },
        { name: 'Staff', href: '/dashboard/hr/staff', enabled: permissions.staff },
      ],
    },
    {
      name: 'Inventory',
      icon: Boxes,
      href: '/dashboard/inventory',
      enabled: permissions.inventory,
      subItems: [
        { name: 'Stock Balance', href: '/dashboard/inventory?tab=balance' },
        { name: 'Stock Ledger', href: '/dashboard/inventory?tab=ledger' },
        { name: 'Stock Entries', href: '/dashboard/inventory?tab=entries' },
        { name: 'Items', href: '/dashboard/inventory?tab=items' },
        { name: 'Product Campuran (BOM)', href: '/dashboard/inventory?tab=bom' },
        { name: 'Warehouses', href: '/dashboard/inventory?tab=warehouses' },
      ],
    },
    {
      name: 'Purchasing',
      icon: ShoppingCart,
      href: '/dashboard/purchasing',
      enabled: permissions.purchasing,
      subItems: [
        { name: 'Purchase Orders', href: '/dashboard/purchasing?tab=orders' },
        { name: 'Invoices', href: '/dashboard/purchasing?tab=invoices' },
        { name: 'Suppliers', href: '/dashboard/purchasing?tab=suppliers' },
      ],
    },
    {
      name: 'Sales Order',
      icon: ShoppingBag,
      href: '/dashboard/sales-order',
      enabled: permissions.sales_order,
      subItems: [
        { name: 'Sales Orders', href: '/dashboard/sales-order?tab=orders' },
        { name: 'Invoices', href: '/dashboard/sales-order?tab=invoices' },
        { name: 'Customers', href: '/dashboard/sales-order?tab=customers' },
      ],
    },
    {
      name: 'Delivery Order',
      icon: Truck,
      href: '/dashboard/delivery-order',
      enabled: permissions.delivery_order,
      subItems: [
        { name: 'Ready to Deliver', href: '/dashboard/delivery-order?tab=ready' },
        { name: 'Delivery History', href: '/dashboard/delivery-order?tab=history' },
      ],
    },
    {
      name: 'Registration',
      icon: UserPlus,
      href: '/dashboard/registration',
      enabled: permissions.registration_request,
    },
    {
      name: 'Report Builder',
      icon: BarChart3,
      href: '/dashboard/reports',
      enabled: permissions.report_builder,
    },
    {
      name: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      enabled: permissions.setting,
    },
    {
      name: 'Stock Reconciliation',
      icon: ShieldAlert,
      href: '/dashboard/stock-reconciliation',
      enabled: isSuperAdmin,
    },
    {
      name: 'Audit Log',
      icon: ScrollText,
      href: '/dashboard/audit-log',
      enabled: isSuperAdmin,
    },
    {
      name: 'System Console',
      icon: Cpu,
      href: '/dashboard/system-console',
      enabled: isSuperAdmin,
    },
  ];

  const stripQuery = (url: string) => url.split('?')[0];

  useEffect(() => {
    const active = menuItems.find(
      (item) =>
        item.subItems &&
        (pathname === item.href || item.subItems.some((sub: any) => stripQuery(sub.href) === pathname))
    );
    if (active && !expanded.includes(active.href)) {
      setExpanded((prev) => [...prev, active.href]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const SidebarContent = () => (
    <>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 relative flex items-center justify-center min-h-[52px]">
        {!isCollapsed ? (
          <div className="min-w-0">
            <Image
              src="/Header-Light.png"
              alt="Thoyokem"
              width={2000}
              height={800}
              priority
              className="block dark:hidden h-9 w-auto object-contain mx-auto"
            />
            <Image
              src="/Header-Dark.png"
              alt="Thoyokem"
              width={2000}
              height={800}
              priority
              className="hidden dark:block h-9 w-auto object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            T
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {!isCollapsed && (
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Menu
          </p>
        )}
        {menuItems.map((item) => {
          if (!item.enabled) return null;

          const Icon = item.icon;
          const currentUrl = pathname + (activeTab ? `?tab=${activeTab}` : '');
          const isActive = pathname === item.href && !activeTab;
          const isExpanded = expanded.includes(item.href);

          return (
            <div key={item.href}>
              <div
                className={`flex items-center gap-1 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300 font-semibold'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Link
                  href={item.href}
                  onClick={() => {
                    setIsMobileOpen(false);
                    if (item.subItems && !expanded.includes(item.href)) toggleExpanded(item.href);
                  }}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2 min-w-0"
                >
                  <Icon size={16} className={isActive ? 'text-primary' : ''} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
                {item.subItems && !isCollapsed && (
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className="p-2 flex-shrink-0"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {item.subItems && !isCollapsed && isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-2.5">
                  {item.subItems.map((sub: any) => {
                    if (sub.enabled === false) return null;
                    const subActive = sub.href === currentUrl;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                          subActive
                            ? 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300 font-semibold'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {sub.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={`p-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5 ${isCollapsed ? 'justify-center' : 'px-3'}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isHealthy === null ? 'bg-gray-300 dark:bg-gray-600' : isHealthy ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
          title={isHealthy === null ? 'Mengecek koneksi...' : isHealthy ? 'Sistem normal' : 'Gangguan koneksi database'}
        />
        {!isCollapsed && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {isHealthy === null ? 'Checking...' : isHealthy ? 'Sistem normal' : 'Gangguan koneksi'}
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg text-gray-700 dark:text-gray-300"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <motion.aside
        initial={animateIn ? { x: -60, opacity: 0 } : false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-52'
        }`}
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transition-transform duration-300 w-52 flex flex-col ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={null}>
      <SidebarInner {...props} />
    </Suspense>
  );
}