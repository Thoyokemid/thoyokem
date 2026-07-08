'use client';

import React from 'react';
import Sidebar from './Sidebar';
import { SessionUser } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: SessionUser;
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar permissions={user.permissions} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-3 pt-16 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
