'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 via-primary-900 to-gray-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Image
            src="/Header-Dark.png"
            alt="Thoyokem"
            width={2000}
            height={800}
            priority
            className="w-64 sm:w-80 h-auto object-contain"
          />
        </motion.div>
      </motion.div>

      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-primary-300"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <p className="text-sm text-gray-300">Loading...</p>
    </div>
  );
}
