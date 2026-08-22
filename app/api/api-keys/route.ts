import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateId } from '@/lib/id';
import { generateApiKey } from '@/lib/apiAuth';
import { validate, apiKeyCreateSchema } from '@/lib/validation';

// API keys always managed via the normal session cookie — never via another API key
// (no bootstrapping a key from a key), so every handler here uses getServerSession directly.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(
      keys.map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.keyPrefix,
        created_at: k.createdAt,
        last_used_at: k.lastUsedAt,
        revoked_at: k.revokedAt,
      }))
    );
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = validate(apiKeyCreateSchema, await request.json());
    if (!parsed.success) return parsed.response;
    const { name } = parsed.data;

    const activeCount = await prisma.apiKey.count({ where: { userId: session.user.id, revokedAt: null } });
    if (activeCount >= 10) {
      return NextResponse.json({ error: 'Maksimal 10 API key aktif per user — cabut salah satu dulu' }, { status: 400 });
    }

    const { token, prefix, hash } = generateApiKey();
    const newId = generateId();
    await prisma.apiKey.create({
      data: {
        id: newId,
        userId: session.user.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        createdAt: new Date().toISOString(),
      },
    });

    // The plaintext token is only ever returned here, at creation — it's not
    // recoverable afterwards since only its hash is stored.
    return NextResponse.json({ success: true, id: newId, token });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

  try {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== session.user.id) {
      return NextResponse.json({ error: 'API key tidak ditemukan' }, { status: 404 });
    }
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date().toISOString() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
