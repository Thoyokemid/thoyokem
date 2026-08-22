'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Modal from '@/components/ui/Modal';
import {
  Search,
  LayoutDashboard,
  Clock,
  FileText,
  UserPlus,
  Users,
  Settings,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Package,
  Warehouse as WarehouseIcon,
  PackageCheck,
  HelpCircle,
  Info,
  Keyboard,
  ChevronDown,
  Mail,
  Github,
  Bell,
  History,
  Plus,
} from 'lucide-react';
import { SessionUser } from '@/types';
import { getRecentlyViewed, RecentlyViewedItem } from '@/lib/recentlyViewed';
import { supabaseBrowser } from '@/lib/supabaseClient';

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.943.556 3.752 1.517 5.284L2 22l4.865-1.478A9.953 9.953 0 0012.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.13a8.11 8.11 0 01-4.29-1.226l-.308-.183-3.117.947.964-3.043-.2-.313A8.09 8.09 0 013.87 12c0-4.487 3.646-8.13 8.131-8.13 4.486 0 8.13 3.643 8.13 8.13 0 4.487-3.644 8.13-8.13 8.13z" />
    </svg>
  );
}

const KEYBOARD_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '⌘K / Ctrl+K', description: 'Buka pencarian global' },
  { keys: '↑ / ↓', description: 'Navigasi hasil pencarian' },
  { keys: 'Enter', description: 'Buka hasil yang dipilih' },
  { keys: 'Esc', description: 'Tutup pencarian' },
];

interface TopbarProps {
  user: SessionUser;
  animateIn?: boolean;
}

interface ModuleItem {
  name: string;
  href: string;
  icon: React.ElementType;
  enabled: boolean;
}

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
}

interface SearchGroup {
  type: string;
  results: SearchResult[];
}

interface NotificationItem {
  doctype: string;
  id: string;
  label: string;
  subtitle: string;
  href: string;
  action: string;
}

interface FlatItem {
  key: string;
  label: string;
  subtitle?: string;
  href: string;
  icon: React.ElementType;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  'Purchase Order': ShoppingCart,
  'Purchase Invoice': FileText,
  Supplier: Truck,
  'Sales Order': ShoppingBag,
  'Sales Invoice': FileText,
  Customer: UserIcon,
  'Delivery Note': PackageCheck,
  Item: Package,
  Warehouse: WarehouseIcon,
  Staff: Users,
};

export default function Topbar({ user, animateIn }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isDark, setIsDark] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.photo_url) setPhotoUrl(data.photo_url);
      })
      .catch(() => {});
  }, []);

  const fetchNotifications = () => {
    fetch('/api/notifications')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items) setNotifications(data.items);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    // Fallback poll in case the realtime channel drops — realtime below
    // normally makes this a no-op refresh.
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Realtime: server broadcasts a "refresh" ping (no row data) whenever a
  // notification-relevant document changes, so the bell updates instantly
  // instead of waiting for the next poll.
  useEffect(() => {
    const channel = supabaseBrowser
      .channel('notifications-refresh')
      .on('broadcast', { event: 'refresh' }, () => fetchNotifications())
      .subscribe();
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

  const quickCreateItems: ModuleItem[] = [
    { name: 'Purchase Order', href: '/dashboard/purchasing?tab=orders&new=1', icon: ShoppingCart, enabled: user.permissions.purchasing },
    { name: 'Supplier', href: '/dashboard/purchasing?tab=suppliers&new=1', icon: Truck, enabled: user.permissions.purchasing },
    { name: 'Sales Order', href: '/dashboard/sales-order?tab=orders&new=1', icon: ShoppingBag, enabled: user.permissions.sales_order },
    { name: 'Customer', href: '/dashboard/sales-order?tab=customers&new=1', icon: UserIcon, enabled: user.permissions.sales_order },
    { name: 'Item', href: '/dashboard/inventory?tab=items&new=1', icon: Package, enabled: user.permissions.inventory },
    { name: 'Stock Entry', href: '/dashboard/inventory?tab=entries&new=1', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Warehouse', href: '/dashboard/inventory?tab=warehouses&new=1', icon: WarehouseIcon, enabled: user.permissions.inventory },
    { name: 'BOM', href: '/dashboard/inventory?tab=bom&new=1', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Staff', href: '/dashboard/hr/staff?new=1', icon: Users, enabled: user.permissions.staff },
    { name: 'Leave', href: '/dashboard/hr/leave?new=1', icon: FileText, enabled: user.permissions.leave },
    { name: 'Role', href: '/dashboard/settings?new=1', icon: Settings, enabled: user.permissions.setting },
  ];

  const moduleItems: ModuleItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: user.permissions.dashboard },

    { name: 'HR Dashboard', href: '/dashboard/hr', icon: Users, enabled: user.permissions.attendance || user.permissions.leave || user.permissions.staff },
    { name: 'Attendance Data', href: '/dashboard/hr/attendance?tab=data', icon: Clock, enabled: user.permissions.attendance },
    { name: 'Attendance Report', href: '/dashboard/hr/attendance?tab=report', icon: Clock, enabled: user.permissions.attendance },
    { name: 'Attendance Recap', href: '/dashboard/hr/attendance?tab=recap', icon: Clock, enabled: user.permissions.attendance },
    { name: 'Leave', href: '/dashboard/hr/leave', icon: FileText, enabled: user.permissions.leave },
    { name: 'Staff', href: '/dashboard/hr/staff', icon: Users, enabled: user.permissions.staff },

    { name: 'Inventory', href: '/dashboard/inventory', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Stock Balance', href: '/dashboard/inventory?tab=balance', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Stock Ledger', href: '/dashboard/inventory?tab=ledger', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Stock Entries', href: '/dashboard/inventory?tab=entries', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Items', href: '/dashboard/inventory?tab=items', icon: Package, enabled: user.permissions.inventory },
    { name: 'Product Campuran (BOM)', href: '/dashboard/inventory?tab=bom', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Warehouses', href: '/dashboard/inventory?tab=warehouses', icon: WarehouseIcon, enabled: user.permissions.inventory },

    { name: 'Purchasing', href: '/dashboard/purchasing', icon: ShoppingCart, enabled: user.permissions.purchasing },
    { name: 'Purchase Orders', href: '/dashboard/purchasing?tab=orders', icon: ShoppingCart, enabled: user.permissions.purchasing },
    { name: 'Purchase Invoices', href: '/dashboard/purchasing?tab=invoices', icon: FileText, enabled: user.permissions.purchasing },
    { name: 'Suppliers', href: '/dashboard/purchasing?tab=suppliers', icon: Truck, enabled: user.permissions.purchasing },

    { name: 'Sales Order', href: '/dashboard/sales-order', icon: ShoppingBag, enabled: user.permissions.sales_order },
    { name: 'Sales Orders', href: '/dashboard/sales-order?tab=orders', icon: ShoppingBag, enabled: user.permissions.sales_order },
    { name: 'Sales Invoices', href: '/dashboard/sales-order?tab=invoices', icon: FileText, enabled: user.permissions.sales_order },
    { name: 'Customers', href: '/dashboard/sales-order?tab=customers', icon: UserIcon, enabled: user.permissions.sales_order },

    { name: 'Delivery Order', href: '/dashboard/delivery-order', icon: Truck, enabled: user.permissions.delivery_order },
    { name: 'Ready to Deliver', href: '/dashboard/delivery-order?tab=ready', icon: Truck, enabled: user.permissions.delivery_order },
    { name: 'Delivery History', href: '/dashboard/delivery-order?tab=history', icon: PackageCheck, enabled: user.permissions.delivery_order },

    { name: 'Registration', href: '/dashboard/registration', icon: UserPlus, enabled: user.permissions.registration_request },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: user.permissions.setting },
    { name: 'Stock Reconciliation', href: '/dashboard/stock-reconciliation', icon: Boxes, enabled: !!user.isSuperAdmin },
    { name: 'My Profile', href: '/dashboard/profile', icon: UserIcon, enabled: true },
  ];

  const filteredModules = query.trim()
    ? moduleItems.filter((i) => i.enabled && i.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  // Keyboard shortcut: Cmd/Ctrl + K opens search AND focuses the input immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setRecentlyViewed(getRecentlyViewed());
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
      if (e.key === 'Escape') setIsSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setIsHelpOpen(false);
      }
      if (newRef.current && !newRef.current.contains(e.target as Node)) {
        setIsNewOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Global search across ERP documents & master data
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchGroups([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/global-search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchGroups(data.groups || []);
        }
      } catch {
        setSearchGroups([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  // Flatten module matches + search groups into a single navigable list
  const flatItems: FlatItem[] = useMemo(() => {
    if (!query.trim()) {
      return recentlyViewed.map((r) => ({
        key: `recent:${r.href}`,
        label: r.label,
        subtitle: r.subtitle,
        href: r.href,
        icon: History,
      }));
    }
    const fromModules: FlatItem[] = filteredModules.map((m) => ({
      key: `module:${m.href}`,
      label: m.name,
      href: m.href,
      icon: m.icon,
    }));
    const fromGroups: FlatItem[] = searchGroups.flatMap((g) =>
      g.results.map((r) => ({
        key: `${g.type}:${r.id}`,
        label: r.label,
        subtitle: r.subtitle,
        href: r.href,
        icon: TYPE_ICON[g.type] || FileText,
      }))
    );
    return [...fromModules, ...fromGroups];
  }, [query, filteredModules, searchGroups, recentlyViewed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [flatItems.length, query]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const goTo = (href: string) => {
    setIsSearchOpen(false);
    setQuery('');
    router.push(href);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) setActiveIndex((i) => (i + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) goTo(item.href);
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  let runningIndex = -1;

  return (
    <motion.div
      initial={animateIn ? { y: -40, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex sticky top-0 z-20 items-center justify-end gap-3 pl-14 pr-3 py-2.5 md:pl-6 md:pr-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
    >
      {/* Global search */}
      <div ref={searchRef} className="relative w-48 sm:w-64 md:w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setIsSearchOpen(true); setRecentlyViewed(getRecentlyViewed()); }}
          onKeyDown={handleSearchKeyDown}
          placeholder="Cari dokumen, item, karyawan..."
          className="w-full pl-9 pr-14 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">
          ⌘K
        </span>

        {isSearchOpen && (
          <div className="absolute right-0 mt-1.5 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
            {!query.trim() ? (
              flatItems.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">Belum ada dokumen yang dilihat</p>
              ) : (
                <div className="py-1">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Baru Dilihat</p>
                  {flatItems.map((item, idx) => (
                    <button
                      key={item.key}
                      ref={idx === activeIndex ? activeItemRef : undefined}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => goTo(item.href)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                        idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20 text-primary' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <item.icon size={15} className="flex-shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {item.subtitle && <span className="text-xs text-gray-400 flex-shrink-0">{item.subtitle}</span>}
                    </button>
                  ))}
                </div>
              )
            ) : flatItems.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">
                {isSearching ? 'Mencari...' : 'Tidak ada hasil'}
              </p>
            ) : (
              <>
                {filteredModules.length > 0 && (
                  <div className="py-1">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Modul</p>
                    {filteredModules.map((m) => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.href}
                          ref={idx === activeIndex ? activeItemRef : undefined}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => goTo(m.href)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                            idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20 text-primary' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <Icon size={15} />
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {searchGroups.map((group) => (
                  <div key={group.type} className="py-1 border-t border-gray-100 dark:border-gray-700">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.type}</p>
                    {group.results.map((r) => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      const Icon = TYPE_ICON[group.type] || FileText;
                      return (
                        <button
                          key={`${group.type}:${r.id}`}
                          ref={idx === activeIndex ? activeItemRef : undefined}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => goTo(r.href)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                            idx === activeIndex ? 'bg-primary-50 dark:bg-primary-900/20 text-primary' : 'text-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <Icon size={15} className="flex-shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{r.label}</span>
                          {r.subtitle && <span className="text-xs text-gray-400 flex-shrink-0">{r.subtitle}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Global quick-create */}
        <div ref={newRef} className="relative">
          <button
            onClick={() => setIsNewOpen((v) => !v)}
            title="Buat Baru"
            className="flex items-center gap-1 justify-center h-8 px-2.5 rounded-full bg-primary text-white hover:bg-primary-600 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline text-xs font-medium">New</span>
          </button>

          {isNewOpen && (
            <div className="absolute right-0 mt-1.5 w-56 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1">
              {quickCreateItems.filter((i) => i.enabled).length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">Tidak ada akses buat dokumen baru</p>
              ) : (
                quickCreateItems.map((item) => {
                  if (!item.enabled) return null;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => { setIsNewOpen(false); router.push(item.href); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Icon size={15} />
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Notifications — items needing this user's action */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setIsNotifOpen((v) => !v)}
            title="Notifikasi"
            className="relative flex items-center justify-center h-8 w-8 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Perlu Aksi Saya</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-gray-400">Tidak ada yang perlu dikerjakan</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={`${n.doctype}:${n.id}`}
                      onClick={() => {
                        setIsNotifOpen(false);
                        router.push(n.href);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{n.label}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex-shrink-0">
                          {n.action}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{n.subtitle}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Help dropdown — About & Keyboard Shortcuts */}
        <div ref={helpRef} className="relative">
          <button
            onClick={() => setIsHelpOpen((v) => !v)}
            title="Help"
            className="flex items-center gap-1 justify-center h-8 px-2 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <HelpCircle size={16} />
            <span className="hidden sm:inline text-xs font-medium">Help</span>
            <ChevronDown size={12} className={`transition-transform ${isHelpOpen ? 'rotate-180' : ''}`} />
          </button>

          {isHelpOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
              <button
                onClick={() => { setIsHelpOpen(false); setIsAboutOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Info size={14} />
                About
              </button>
              <button
                onClick={() => { setIsHelpOpen(false); setIsShortcutsOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Keyboard size={14} />
                Keyboard Shortcut
              </button>
            </div>
          )}
        </div>

        {/* Theme toggle — sits to the left of the profile dropdown */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setIsProfileOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {photoUrl ? (
              <img src={photoUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary text-xs font-bold flex items-center justify-center">
                {initials}
              </span>
            )}
            <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
              {user.name}
            </span>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
              </div>
              <Link
                href="/dashboard/profile"
                onClick={() => setIsProfileOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <UserIcon size={14} />
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} title="About" size="sm">
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
          <p className="text-base font-semibold text-gray-900 dark:text-white">Thoyokem Workspace</p>
          <p>Developed by <span className="font-medium">Faiz</span></p>
          <div className="flex items-center gap-2">
            <a
              href="https://wa.me/6285215842148"
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-green-600 hover:border-green-600"
            >
              <WhatsAppIcon size={15} />
            </a>
            <a
              href="mailto:faizramdhan17@gmail.com"
              title="Email"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary hover:border-primary"
            >
              <Mail size={15} />
            </a>
            <a
              href="https://github.com/faizramdhannn"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:border-gray-900 dark:hover:border-white"
            >
              <Github size={15} />
            </a>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Built with</p>
            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-disc list-inside">
              <li>Next.js 14 (App Router) + TypeScript</li>
              <li>Tailwind CSS</li>
              <li>Prisma ORM + PostgreSQL (Supabase)</li>
              <li>NextAuth (Credentials/JWT)</li>
              <li>React Hook Form + Zod</li>
              <li>Recharts, Framer Motion, Lucide Icons</li>
            </ul>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} title="Keyboard Shortcut" size="sm">
        <div className="space-y-1.5">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
              <span className="text-sm text-gray-600 dark:text-gray-300">{s.description}</span>
              <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded px-2 py-0.5">
                {s.keys}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </motion.div>
  );
}
