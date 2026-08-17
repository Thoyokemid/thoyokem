import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const doctype = searchParams.get('doctype') || undefined;
  const changedBy = searchParams.get('changed_by') || undefined;
  const action = searchParams.get('action') || undefined;
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const where: any = {};
  if (doctype) where.doctype = doctype;
  if (changedBy) where.changedBy = changedBy;
  if (action) where.action = action;
  if (dateFrom || dateTo) {
    where.timestamp = {};
    if (dateFrom) where.timestamp.gte = dateFrom;
    if (dateTo) where.timestamp.lte = `${dateTo}T23:59:59.999Z`;
  }

  try {
    const [records, total, doctypes, users] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({ distinct: ['doctype'], select: { doctype: true }, orderBy: { doctype: 'asc' } }),
      prisma.activityLog.findMany({ distinct: ['changedBy'], select: { changedBy: true }, orderBy: { changedBy: 'asc' } }),
    ]);

    const entries = records.map((r) => {
      let changes = [];
      try {
        changes = JSON.parse(r.changes || '[]');
      } catch {}
      return {
        log_id: r.logId,
        doctype: r.doctype,
        document_id: r.documentId,
        action: r.action,
        changed_by: r.changedBy,
        timestamp: r.timestamp,
        changes,
      };
    });

    return NextResponse.json({
      entries,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      filterOptions: {
        doctypes: doctypes.map((d) => d.doctype),
        users: users.map((u) => u.changedBy).filter(Boolean),
      },
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
