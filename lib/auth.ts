import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { readSheetAsObjects, readSheet, writeSheet, findRowIndexByField } from '@/lib/sheets';

function toBool(v: any) {
  return v === 'TRUE' || v === true;
}

// ── Utility: update last_active column ──
export async function updateLastActive(userId: string) {
  try {
    const rows = await readSheet('users');
    const headers = (rows[0] || []).map((h: any) => String(h ?? '').trim());
    const dataRowIndex = findRowIndexByField(headers, rows, 'id', userId);
    if (dataRowIndex === -1) return;

    const colIndex = headers.indexOf('last_active');
    if (colIndex === -1) return;

    const now = new Date().toISOString();
    const colLetter = String.fromCharCode(65 + colIndex);
    await writeSheet('users', `${colLetter}${dataRowIndex + 2}`, [[now]]);
  } catch (error) {
    // Non-blocking: log but don't throw
    console.error('Failed to update last_active:', error);
  }
}

// ── Utility: is this role flagged as Super Admin? ──
export async function isSuperAdminRole(roleId: string): Promise<boolean> {
  const { records } = await readSheetAsObjects<any>('roles');
  const role = records.find((r) => String(r.role_id) === String(roleId));
  return !!role && toBool(role.is_super_admin);
}

// ── Utility: look up a role's permission set by role_id ──
export async function getRolePermissions(roleId: string) {
  const { records } = await readSheetAsObjects<any>('roles');
  const role = records.find((r) => String(r.role_id) === String(roleId));

  const noAccess = {
    dashboard: false,
    attendance: false,
    leave: false,
    registration_request: false,
    setting: false,
    staff: false,
    inventory: false,
    purchasing: false,
    sales_order: false,
    delivery_order: false,
    can_approve: false,
  };

  if (!role) {
    // Fallback: no access if role can't be resolved
    return noAccess;
  }

  // Super Admin bypasses every individual flag — always full access,
  // including to modules added after this role was created.
  if (toBool(role.is_super_admin)) {
    return Object.fromEntries(Object.keys(noAccess).map((k) => [k, true])) as typeof noAccess;
  }

  return {
    dashboard: toBool(role.dashboard),
    attendance: toBool(role.attendance),
    leave: toBool(role.leave),
    registration_request: toBool(role.registration_request),
    setting: toBool(role.setting),
    staff: toBool(role.staff),
    inventory: toBool(role.inventory),
    purchasing: toBool(role.purchasing),
    sales_order: toBool(role.sales_order),
    delivery_order: toBool(role.delivery_order),
    can_approve: toBool(role.can_approve),
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Please enter username and password');
        }

        try {
          const { records: users } = await readSheetAsObjects<any>('users');
          const user = users.find((u) => u.username === credentials.username);

          if (!user) {
            throw new Error('Invalid username or password');
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error('Invalid username or password');
          }

          updateLastActive(user.id);

          const permissions = await getRolePermissions(user.role_id);
          const isSuperAdmin = await isSuperAdminRole(user.role_id);

          return {
            id: user.id,
            name: user.name,
            email: user.username,
            role: user.role,
            role_id: user.role_id,
            permissions,
            isSuperAdmin,
          };
        } catch (error) {
          console.error('Auth error:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.role_id = (user as any).role_id;
        token.permissions = user.permissions;
        token.isSuperAdmin = (user as any).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.role_id = token.role_id as string;
        session.user.permissions = token.permissions as any;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
