import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { broadcastNotificationsChanged } from '@/lib/realtime';
import { requiredDoctypePerms, logActivity } from '@/lib/activityLog';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype');
  const documentId = searchParams.get('document_id');
  if (!doctype || !documentId) {
    return NextResponse.json({ error: 'doctype dan document_id wajib diisi' }, { status: 400 });
  }
  if (!requiredDoctypePerms(session.user.permissions)[doctype]) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const records = await prisma.assignment.findMany({
      where: { doctype, documentId },
      orderBy: { timestamp: 'desc' },
    });
    const users = await prisma.user.findMany({ select: { id: true, name: true, username: true, photoUrl: true } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const assignments = records.map((r) => {
      const user = userMap.get(r.assignedTo);
      return {
        assignment_id: r.assignmentId,
        assigned_to: r.assignedTo,
        assigned_to_name: user?.name || user?.username || 'Unknown',
        photo_url: user?.photoUrl || '',
        assigned_by: r.assignedBy,
        note: r.note || '',
        timestamp: r.timestamp,
        grants_access: r.grantsAccess,
      };
    });
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { doctype, document_id: documentId, assigned_to: assignedTo, note, grants_access: grantsAccess } = body;
    if (!doctype || !documentId || !assignedTo) {
      return NextResponse.json({ error: 'doctype, document_id, dan assigned_to wajib diisi' }, { status: 400 });
    }
    if (!requiredDoctypePerms(session.user.permissions)[doctype]) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newId = generateId();
    try {
      await prisma.assignment.create({
        data: {
          assignmentId: newId,
          doctype,
          documentId,
          assignedTo,
          assignedBy: session.user.name || '',
          note: note || null,
          timestamp: new Date().toISOString(),
          grantsAccess: !!grantsAccess,
        },
      });
    } catch (createError: any) {
      // Unique constraint on (doctype, documentId, assignedTo) — the DB is the source of
      // truth here so a concurrent duplicate POST is rejected cleanly instead of racing.
      if (createError?.code === 'P2002') {
        return NextResponse.json({ error: 'User ini sudah di-assign ke dokumen ini' }, { status: 400 });
      }
      throw createError;
    }

    await logActivity({
      doctype,
      documentId,
      action: 'Assigned',
      changedBy: session.user.name || '',
      before: null,
      after: { assigned_to: assignedTo, note: note || '' },
    });

    await broadcastNotificationsChanged();
    return NextResponse.json({ success: true, assignment_id: newId });
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('id');
  if (!assignmentId) {
    return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
  }

  try {
    const existing = await prisma.assignment.findUnique({ where: { assignmentId } });
    if (!existing) {
      return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
    }
    // Anyone can unassign themselves; unassigning someone else requires access to that doctype.
    const isSelf = existing.assignedTo === session.user.id;
    if (!isSelf && !requiredDoctypePerms(session.user.permissions)[existing.doctype]) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.assignment.delete({ where: { assignmentId } });

    await logActivity({
      doctype: existing.doctype,
      documentId: existing.documentId,
      action: 'Unassigned',
      changedBy: session.user.name || '',
      before: null,
      after: { assigned_to: existing.assignedTo },
    });

    await broadcastNotificationsChanged();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
