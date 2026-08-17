import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requiredDoctypePerms } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { validate, commentCreateSchema } from '@/lib/validation';

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
    const records = await prisma.comment.findMany({
      where: { doctype, documentId },
      orderBy: { timestamp: 'asc' },
    });
    const comments = records.map((r) => ({
      comment_id: r.commentId,
      doctype: r.doctype,
      document_id: r.documentId,
      author: r.author,
      text: r.text,
      mentions: r.mentions ? r.mentions.split(',').filter(Boolean) : [],
      timestamp: r.timestamp,
    }));
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
    const parsed = validate(commentCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { doctype, documentId, text } = parsed.data;
    if (!requireDoctypeAccess(session.user.permissions, doctype)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Extract @Mentioned Names — matches "@" followed by words/spaces up to the next "@" or line end,
    // then keeps only names that exist in the users table, longest match first so "@Faiz Ramdhan"
    // doesn't get shadowed by a shorter "@Faiz" also being a valid user.
    const users = await prisma.user.findMany({ select: { name: true } });
    const userNames = users.map((u) => u.name).filter(Boolean).sort((a, b) => b.length - a.length);
    const mentioned = new Set<string>();
    for (const name of userNames) {
      if (text.includes(`@${name}`)) mentioned.add(name);
    }

    const newId = generateId();
    await prisma.comment.create({
      data: {
        commentId: newId,
        doctype,
        documentId,
        author: session.user.name || '',
        text: text.trim(),
        mentions: Array.from(mentioned).join(','),
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, comment_id: newId });
  } catch (error) {
    console.error('Error posting comment:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
