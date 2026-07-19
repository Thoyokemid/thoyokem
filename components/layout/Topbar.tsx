'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
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
} from 'lucide-react';
import { SessionUser } from '@/types';

interface TopbarProps {
  user: SessionUser;
}

interface SearchItem {
  name: string;
  href: string;
  icon: React.ElementType;
  enabled: boolean;
  keywords?: string;
}

export default function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [staffMatches, setStaffMatches] = useState<{ employee_name: string }[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.photo_url) setPhotoUrl(data.photo_url);
      })
      .catch(() => {});
  }, []);

  const items: SearchItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, enabled: user.permissions.dashboard },
    { name: 'Attendance', href: '/dashboard/attendance', icon: Clock, enabled: user.permissions.attendance },
    { name: 'Leave', href: '/dashboard/leave', icon: FileText, enabled: user.permissions.leave },
    { name: 'Staff', href: '/dashboard/staff', icon: Users, enabled: user.permissions.staff },
    { name: 'Registration', href: '/dashboard/registration', icon: UserPlus, enabled: user.permissions.registration_request },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, enabled: user.permissions.setting },
    { name: 'My Profile', href: '/dashboard/profile', icon: UserIcon, enabled: true },
  ];

  const filteredItems = items.filter(
    (i) => i.enabled && i.name.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard shortcut: Cmd/Ctrl + K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
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
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search staff by name when query looks like a name search (and user can view staff)
  useEffect(() => {
    if (!query.trim() || !user.permissions.staff) {
      setStaffMatches([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch('/api/staff');
        if (res.ok) {
          const data: { employee_name: string }[] = await res.json();
          const q = query.toLowerCase();
          setStaffMatches(data.filter((s) => s.employee_name.toLowerCase().includes(q)).slice(0, 5));
        }
      } catch {
        setStaffMatches([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, user.permissions.staff]);

  const goTo = (href: string) => {
    setIsSearchOpen(false);
    setQuery('');
    router.push(href);
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

  return (
    <div className="hidden md:flex sticky top-0 z-20 items-center justify-between gap-4 px-6 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Global search */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsSearchOpen(true)}
          placeholder="Cari modul atau karyawan..."
          className="w-full pl-9 pr-14 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">
          ⌘K
        </span>

        {isSearchOpen && (
          <div className="absolute mt-1.5 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
            {filteredItems.length === 0 && staffMatches.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">Tidak ada hasil</p>
            ) : (
              <>
                {filteredItems.length > 0 && (
                  <div className="py-1">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Modul</p>
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          onClick={() => goTo(item.href)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <Icon size={15} />
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {staffMatches.length > 0 && (
                  <div className="py-1 border-t border-gray-100 dark:border-gray-700">
                    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Karyawan</p>
                    {staffMatches.map((s) => (
                      <button
                        key={s.employee_name}
                        onClick={() => goTo('/dashboard/staff')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <Users size={15} />
                        {s.employee_name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
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
  );
}
