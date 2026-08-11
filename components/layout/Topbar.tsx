'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { SessionUser } from '@/types';

const KEYBOARD_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: '⌘K / Ctrl+K', description: 'Buka pencarian global' },
  { keys: '↑ / ↓', description: 'Navigasi hasil pencarian' },
  { keys: 'Enter', description: 'Buka hasil yang dipilih' },
  { keys: 'Esc', description: 'Tutup pencarian' },
];

interface TopbarProps {
  user: SessionUser;
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

export default function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isDark, setIsDark] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
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

  const moduleItems: ModuleItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: user.permissions.dashboard },
    { name: 'Attendance', href: '/dashboard/attendance', icon: Clock, enabled: user.permissions.attendance },
    { name: 'Leave', href: '/dashboard/leave', icon: FileText, enabled: user.permissions.leave },
    { name: 'Staff', href: '/dashboard/staff', icon: Users, enabled: user.permissions.staff },
    { name: 'Inventory', href: '/dashboard/inventory', icon: Boxes, enabled: user.permissions.inventory },
    { name: 'Purchasing', href: '/dashboard/purchasing', icon: ShoppingCart, enabled: user.permissions.purchasing },
    { name: 'Sales Order', href: '/dashboard/sales-order', icon: ShoppingBag, enabled: user.permissions.sales_order },
    { name: 'Delivery Order', href: '/dashboard/delivery-order', icon: Truck, enabled: user.permissions.delivery_order },
    { name: 'Registration', href: '/dashboard/registration', icon: UserPlus, enabled: user.permissions.registration_request },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: user.permissions.setting },
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
  }, [filteredModules, searchGroups]);

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
    <div className="flex sticky top-0 z-20 items-center justify-end gap-3 pl-14 pr-3 py-2.5 md:pl-6 md:pr-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Global search */}
      <div ref={searchRef} className="relative w-48 sm:w-64 md:w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsSearchOpen(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Cari dokumen, item, karyawan..."
          className="w-full pl-9 pr-14 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">
          ⌘K
        </span>

        {isSearchOpen && query.trim().length > 0 && (
          <div className="absolute right-0 mt-1.5 w-80 sm:w-96 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
            {flatItems.length === 0 ? (
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Built with</p>
            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 list-disc list-inside">
              <li>Next.js 14 (App Router) + TypeScript</li>
              <li>Tailwind CSS</li>
              <li>NextAuth (Credentials/JWT)</li>
              <li>Google Sheets API (data layer)</li>
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
    </div>
  );
}
