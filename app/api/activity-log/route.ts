import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActivityLog, logActivity, requiredDoctypePerms } from '@/lib/activityLog';

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

/** Client-side exports (XLSX download) have no server route of their own — this lets them ping a log entry after the fact. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const doctype = body?.doctype;
  const rowCount = Number(body?.row_count);
  if (!doctype || typeof doctype !== 'string' || !Number.isFinite(rowCount)) {
    return NextResponse.json({ error: 'doctype dan row_count wajib diisi' }, { status: 400 });
  }

  // No permission gate here: this only records "user X exported Y rows of Z" for the
  // audit trail — the actual export data was already assembled client-side beforehand,
  // so there's nothing sensitive to leak by accepting the ping from any signed-in user.
  await logActivity({
    doctype,
    documentId: '-',
    action: 'Exported',
    changedBy: session.user.name || '',
    before: null,
    after: { row_count: rowCount },
  });

  return NextResponse.json({ success: true });
}
