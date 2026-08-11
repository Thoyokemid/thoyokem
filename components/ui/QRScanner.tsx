'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ScanLine } from 'lucide-react';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export default function QRScanner({ isOpen, onClose, onScan }: QRScannerProps) {
  const containerId = 'qr-scanner-region';
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError('');

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {}
        )
        .catch(() => setError('Tidak bisa mengakses kamera. Periksa izin kamera pada browser.'));
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <ScanLine size={16} /> Scan QR Item
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>
        {error ? (
          <p className="text-xs text-red-600 py-6 text-center">{error}</p>
        ) : (
          <div id={containerId} className="w-full overflow-hidden rounded-md" />
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 text-center">
          Arahkan kamera ke QR code pada label item
        </p>
      </div>
    </div>
  );
}
