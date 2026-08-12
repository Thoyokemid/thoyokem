import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects } from '@/lib/sheets';

// Minimal {id, name} list for @mention autocomplete — any authenticated user can
// see who exists to tag, without exposing username/role/last_active (that's /api/users, setting-gated).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { records } = await readSheetAsObjects<any>('users');
    const list = records.map((r) => ({ id: r.id || '', name: r.name || r.username || '' })).filter((u) => u.id && u.name);
    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching mentionable users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
