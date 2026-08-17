'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', fontFamily: 'sans-serif' }}>
          <h2>Terjadi kesalahan.</h2>
          <p style={{ color: '#666' }}>Tim kami sudah diberitahu otomatis. Coba muat ulang halaman.</p>
        </div>
      </body>
    </html>
  );
}
