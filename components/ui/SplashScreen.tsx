'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 via-primary-900 to-gray-900 overflow-hidden">
      {/* Ambient drifting glow */}
      <motion.div
        className="absolute w-[36rem] h-[36rem] rounded-full bg-primary-500/20 blur-3xl"
        animate={{ x: [-60, 60, -60], y: [-40, 40, -40] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex items-center justify-center">
        {/* Sweeping halo ring around the logo */}
        <motion.div
          className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(165,180,252,0.9) 12%, transparent 28%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gray-900" />

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10"
        >
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image
              src="/Header-Dark.png"
              alt="Thoyokem"
              width={2000}
              height={800}
              priority
              className="w-48 sm:w-60 h-auto object-contain drop-shadow-[0_0_20px_rgba(99,102,241,0.35)]"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Filling progress bar */}
      <div className="relative w-48 sm:w-56 h-1 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
          animate={{ x: ['-100%', '250%'] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.p
        className="text-sm text-gray-300 tracking-wide"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        Loading...
      </motion.p>
    </div>
  );
}
