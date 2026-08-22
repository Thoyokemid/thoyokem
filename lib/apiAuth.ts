import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, getRolePermissions } from '@/lib/auth';
import { prisma } from '@/lib/db';

const KEY_PREFIX_LENGTH = 8;
const TOKEN_BYTES = 32;

export function generateApiKey(): { token: string; prefix: string; hash: string } {
  const token = `tk_${crypto.randomBytes(TOKEN_BYTES).toString('hex')}`;
  const prefix = token.slice(0, KEY_PREFIX_LENGTH);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, prefix, hash };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Resolves the acting session for an API route — from an `Authorization: Bearer <token>`
 * API key if present (see /api/api-keys), otherwise falls back to the normal NextAuth
 * session cookie. Returns the same shape `getServerSession` does, so every existing
 * hasDoctypePermission()/requiresOwnerMatch()/etc. check works unmodified for either
 * auth method. Pilot-wired into Item and Customer's GET handlers today.
 */
export async function resolveApiSession(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token.startsWith('tk_')) return null;

    const prefix = token.slice(0, KEY_PREFIX_LENGTH);
    const hash = hashToken(token);
    const key = await prisma.apiKey.findFirst({ where: { keyPrefix: prefix, keyHash: hash, revokedAt: null } });
    if (!key) return null;

    const user = await prisma.user.findUnique({ where: { id: key.userId } });
    if (!user) return null;

    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date().toISOString() } }).catch(() => {});

    const role = await prisma.role.findUnique({ where: { roleId: user.roleId } });
    const permissions = await getRolePermissions(user.roleId);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.username,
        role: role?.roleName || '',
        role_id: user.roleId,
        isSuperAdmin: !!role?.isSuperAdmin,
        permissions,
      },
    };
  }

  return getServerSession(authOptions);
}
