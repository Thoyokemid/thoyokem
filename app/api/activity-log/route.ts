import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActivityLog, requiredDoctypePerms } from '@/lib/activityLog';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype');
  const documentId = searchParams.get('document_id');
  if (!doctype || !documentId) {
    return NextResponse.json({ error: 'doctype dan document_id wajib diisi' }, { status: 400 });
  }

  const perms = requiredDoctypePerms(session.user.permissions);
  const allowed = perms[doctype];
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const entries = await getActivityLog(doctype, documentId);
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}
