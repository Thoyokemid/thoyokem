import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readSheetAsObjects, appendSheet, objectToRow } from '@/lib/sheets';
import { requiredDoctypePerms } from '@/lib/activityLog';

const SHEET = 'comments';

function requireDoctypeAccess(perms: any, doctype: string) {
  const map = requiredDoctypePerms(perms);
  return !!map[doctype];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype');
  const documentId = searchParams.get('document_id');
  if (!doctype || !documentId) {
    return NextResponse.json({ error: 'doctype dan document_id wajib diisi' }, { status: 400 });
  }
  if (!requireDoctypeAccess(session.user.permissions, doctype)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { records } = await readSheetAsObjects<any>(SHEET);
    const comments = records
      .filter((r) => r.doctype === doctype && r.document_id === documentId)
      .map((r) => ({
        comment_id: r.comment_id,
        doctype: r.doctype,
        document_id: r.document_id,
        author: r.author,
        text: r.text,
        mentions: r.mentions ? r.mentions.split(',').filter(Boolean) : [],
        timestamp: r.timestamp,
      }))
      .sort((a, b) => Number(b.comment_id) - Number(a.comment_id));
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { doctype, documentId, text } = await request.json();
    if (!doctype || !documentId || !text || !text.trim()) {
      return NextResponse.json({ error: 'doctype, documentId, dan text wajib diisi' }, { status: 400 });
    }
    if (!requireDoctypeAccess(session.user.permissions, doctype)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Extract @Mentioned Names — matches "@" followed by words/spaces up to the next "@" or line end,
    // then keeps only names that exist in the users sheet, longest match first so "@Faiz Ramdhan"
    // doesn't get shadowed by a shorter "@Faiz" also being a valid user.
    const { records: users } = await readSheetAsObjects<any>('users');
    const userNames = users.map((u) => u.name).filter(Boolean).sort((a, b) => b.length - a.length);
    const mentioned = new Set<string>();
    for (const name of userNames) {
      if (text.includes(`@${name}`)) mentioned.add(name);
    }

    const { headers, records } = await readSheetAsObjects<any>(SHEET);
    const newId = String(records.length + 1);
    const row = objectToRow(headers, {
      comment_id: newId,
      doctype,
      document_id: documentId,
      author: session.user.name || '',
      text: text.trim(),
      mentions: Array.from(mentioned).join(','),
      timestamp: new Date().toISOString(),
    });
    await appendSheet(SHEET, [row]);

    return NextResponse.json({ success: true, comment_id: newId });
  } catch (error) {
    console.error('Error posting comment:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
