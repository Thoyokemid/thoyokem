'use client';

import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SessionUser } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: SessionUser;
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar permissions={user.permissions} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <Topbar user={user} />
        <div className="p-3 pt-16 md:pt-6 md:p-6 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
