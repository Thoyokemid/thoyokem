'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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
  MessageCircle,
  Mail,
  Linkedin,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Truck,
} from 'lucide-react';

interface SidebarProps {
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
  };
}

function SidebarInner({ permissions }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
      isGroup: true,
      enabled: permissions.attendance || permissions.leave || permissions.staff,
      subItems: [
        { name: 'Attendance', href: '/dashboard/attendance', enabled: permissions.attendance },
        { name: 'Leave', href: '/dashboard/leave', enabled: permissions.leave },
        { name: 'Staff', href: '/dashboard/staff', enabled: permissions.staff },
      ],
    },
    {
      name: 'Inventory',
      icon: Boxes,
      href: '/dashboard/inventory',
      enabled: permissions.inventory,
      subItems: [
        { name: 'Stock Balance', tab: 'balance' },
        { name: 'Stock Ledger', tab: 'ledger' },
        { name: 'Stock Entries', tab: 'entries' },
        { name: 'Items', tab: 'items' },
        { name: 'Warehouses', tab: 'warehouses' },
      ],
    },
    {
      name: 'Purchasing',
      icon: ShoppingCart,
      href: '/dashboard/purchasing',
      enabled: permissions.purchasing,
      subItems: [
        { name: 'Purchase Orders', tab: 'orders' },
        { name: 'Invoices', tab: 'invoices' },
        { name: 'Suppliers', tab: 'suppliers' },
      ],
    },
    {
      name: 'Sales Order',
      icon: ShoppingBag,
      href: '/dashboard/sales-order',
      enabled: permissions.sales_order,
      subItems: [
        { name: 'Sales Orders', tab: 'orders' },
        { name: 'Invoices', tab: 'invoices' },
        { name: 'Customers', tab: 'customers' },
      ],
    },
    {
      name: 'Delivery Order',
      icon: Truck,
      href: '/dashboard/delivery-order',
      enabled: permissions.delivery_order,
    },
    {
      name: 'Registration',
      icon: UserPlus,
      href: '/dashboard/registration',
      enabled: permissions.registration_request,
    },
    {
      name: 'Settings',
      icon: Settings,
      href: '/dashboard/settings',
      enabled: permissions.setting,
    },
  ];

  useEffect(() => {
    const active = menuItems.find(
      (item) =>
        item.subItems &&
        (pathname === item.href || item.subItems.some((sub: any) => sub.href === pathname))
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
          onClick={() => setIsCollapsed(!isCollapsed)}
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
          const isRouteGroup = !!(item as any).isGroup;
          const isOnModule = isRouteGroup
            ? item.subItems!.some((sub: any) => sub.href === pathname)
            : pathname === item.href;
          const isActive = isRouteGroup ? false : isOnModule && !activeTab;
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
                {isRouteGroup ? (
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 min-w-0 text-left"
                  >
                    <Icon size={16} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </button>
                ) : (
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
                )}
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
                    if (isRouteGroup && sub.enabled === false) return null;
                    const subActive = isRouteGroup ? pathname === sub.href : isOnModule && activeTab === sub.tab;
                    const subHref = isRouteGroup ? sub.href : `${item.href}?tab=${sub.tab}`;
                    return (
                      <Link
                        key={sub.href || sub.tab}
                        href={subHref}
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

      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">Developed by Faiz</p>
        )}
        <div className="flex items-center gap-2">
          <a
            href="https://wa.me/6285215842148"
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <MessageCircle size={14} />
          </a>
          <a
            href="mailto:faizramdhan17@gmail.com"
            title="Email"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Mail size={14} />
          </a>
          <a
            href="https://www.linkedin.com/in/faizramdhann"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn"
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Linkedin size={14} />
          </a>
        </div>
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
      <aside
        className={`hidden md:flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-52'
        }`}
      >
        <SidebarContent />
      </aside>

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