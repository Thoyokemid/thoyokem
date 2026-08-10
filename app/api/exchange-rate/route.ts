import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Free, no-API-key exchange rate feed (ECB-backed, updated daily on weekdays).
const SOURCE_URL = 'https://open.er-api.com/v6/latest/USD';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.permissions.setting) {
    return NextResponse.json({ error: 'Forbidden: no settings access' }, { status: 403 });
  }

  try {
    const res = await fetch(SOURCE_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);

    const data = await res.json();
    const rate = data?.rates?.IDR;
    if (typeof rate !== 'number') throw new Error('IDR rate not found in response');

    return NextResponse.json({ rate: Math.round(rate), source: SOURCE_URL, fetched_at: data.time_last_update_utc || new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching live exchange rate:', error);
    return NextResponse.json({ error: 'Gagal mengambil kurs dari internet. Coba lagi nanti.' }, { status: 502 });
  }
}
