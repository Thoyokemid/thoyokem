'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SessionUser } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: SessionUser;
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('just_logged_in') === '1') {
      setAnimateIn(true);
      sessionStorage.removeItem('just_logged_in');
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar permissions={user.permissions} animateIn={animateIn} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <Topbar user={user} animateIn={animateIn} />
        <motion.div
          initial={animateIn ? { x: 40, opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          className="p-3 md:p-6 flex-1"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
