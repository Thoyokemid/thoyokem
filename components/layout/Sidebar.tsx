'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  FileText,
  UserPlus,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MessageCircle,
  Mail,
  Linkedin,
} from 'lucide-react';

interface SidebarProps {
  permissions: {
    dashboard: boolean;
    attendance: boolean;
    leave: boolean;
    registration_request: boolean;
    setting: boolean;
    staff: boolean;
  };
}

export default function Sidebar({ permissions }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      enabled: permissions.dashboard,
    },
    {
      name: 'Attendance',
      icon: Clock,
      href: '/dashboard/attendance',
      enabled: permissions.attendance,
    },
    {
      name: 'Leave',
      icon: FileText,
      href: '/dashboard/leave',
      enabled: permissions.leave, // ← now uses permission
    },
    {
      name: 'Staff',
      icon: Users,
      href: '/dashboard/staff',
      enabled: permissions.staff,
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

  const SidebarContent = () => (
    <>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                T
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">Thoyokem</h1>
                <p className="text-[10px] text-gray-400 leading-tight">Workspace</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:block p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
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
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300 font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-primary' : ''} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
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