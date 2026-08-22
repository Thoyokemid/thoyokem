import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requiredDoctypePerms, logActivity } from '@/lib/activityLog';
import { generateId } from '@/lib/id';
import { uploadToSupabaseStorage, deleteFromSupabaseStorage } from '@/lib/supabase';
import { validate, attachmentUploadSchema } from '@/lib/validation';

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
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'file wajib diisi' }, { status: 400 });
    }

    const parsed = validate(attachmentUploadSchema, {
      doctype: formData.get('doctype'),
      document_id: formData.get('document_id'),
    });
    if (!parsed.success) return parsed.response;
    const { doctype, document_id: documentId } = parsed.data;

    if (!requireDoctypeAccess(session.user.permissions, doctype)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let fileUrl: string;
    try {
      fileUrl = await uploadToSupabaseStorage(buffer, file.name, file.type);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Upload gagal';
      return NextResponse.json({ error: message }, { status: 400 });
    }

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

    await logActivity({
      doctype,
      documentId,
      action: 'Attached',
      changedBy: session.user.name || '',
      before: null,
      after: { file_name: file.name },
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
    await deleteFromSupabaseStorage(record.fileUrl);

    await logActivity({
      doctype: record.doctype,
      documentId: record.documentId,
      action: 'Detached',
      changedBy: session.user.name || '',
      before: null,
      after: { file_name: record.fileName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
