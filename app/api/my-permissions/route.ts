import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasDoctypePermission } from '@/lib/permissions';
import { ALL_PERMISSION_ACTIONS } from '@/lib/permissionsShared';

/** Read-only, self-scoped permission check for the signed-in user — used to gate
 * UI controls (e.g. an Export button) client-side. Never exposes another user's data. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype');
  if (!doctype) return NextResponse.json({ error: 'doctype wajib diisi' }, { status: 400 });

  try {
    const entries = await Promise.all(
      ALL_PERMISSION_ACTIONS.map(async (action) => [action, await hasDoctypePermission(session, doctype, action)] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  } catch (error) {
    console.error('Error resolving my-permissions:', error);
    return NextResponse.json({ error: 'Failed to resolve permissions' }, { status: 500 });
  }
}
