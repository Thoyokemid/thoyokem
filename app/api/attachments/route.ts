import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requiredDoctypePerms } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { uploadToSupabaseStorage } from '@/lib/supabase';

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
    const records = await prisma.attachment.findMany({
      where: { doctype, documentId },
      orderBy: { timestamp: 'desc' },
    });
    const attachments = records.map((r) => ({
      attachment_id: r.attachmentId,
      doctype: r.doctype,
      document_id: r.documentId,
      file_name: r.fileName,
      file_url: r.fileUrl,
      uploaded_by: r.uploadedBy,
      timestamp: r.timestamp,
    }));
    return NextResponse.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const doctype = formData.get('doctype') as string;
    const documentId = formData.get('document_id') as string;
    const file = formData.get('file') as File;

    if (!doctype || !documentId || !file) {
      return NextResponse.json({ error: 'doctype, document_id, dan file wajib diisi' }, { status: 400 });
    }
    if (!requireDoctypeAccess(session.user.permissions, doctype)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileUrl = await uploadToSupabaseStorage(buffer, file.name, file.type);

    const newId = generateId();
    await prisma.attachment.create({
      data: {
        attachmentId: newId,
        doctype,
        documentId,
        fileName: file.name,
        fileUrl,
        uploadedBy: session.user.name || '',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, attachment_id: newId, file_url: fileUrl });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get('id');
  if (!attachmentId) {
    return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
  }

  try {
    const record = await prisma.attachment.findUnique({ where: { attachmentId } });
    if (!record) {
      return NextResponse.json({ error: 'Attachment tidak ditemukan' }, { status: 404 });
    }
    if (!requireDoctypeAccess(session.user.permissions, record.doctype)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.attachment.delete({ where: { attachmentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
