import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// ── Utility: update last_active column ──
export async function updateLastActive(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date().toISOString() },
    });
  } catch (error) {
    // Non-blocking: log but don't throw
    console.error('Failed to update last_active:', error);
  }
}

// ── Utility: is this role flagged as Super Admin? ──
export async function isSuperAdminRole(roleId: string): Promise<boolean> {
  const role = await prisma.role.findUnique({ where: { roleId } });
  return !!role && role.isSuperAdmin;
}

// ── Utility: look up a role's permission set by role_id ──
export async function getRolePermissions(roleId: string) {
  const role = await prisma.role.findUnique({ where: { roleId } });

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
  if (role.isSuperAdmin) {
    return Object.fromEntries(Object.keys(noAccess).map((k) => [k, true])) as typeof noAccess;
  }

  return {
    dashboard: role.dashboard,
    attendance: role.attendance,
    leave: role.leave,
    registration_request: role.registrationRequest,
    setting: role.setting,
    staff: role.staff,
    inventory: role.inventory,
    purchasing: role.purchasing,
    sales_order: role.salesOrder,
    delivery_order: role.deliveryOrder,
    can_approve: role.canApprove,
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
          const user = await prisma.user.findUnique({ where: { username: credentials.username } });

          if (!user) {
            throw new Error('Invalid username or password');
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error('Invalid username or password');
          }

          updateLastActive(user.id);

          const permissions = await getRolePermissions(user.roleId);
          const isSuperAdmin = await isSuperAdminRole(user.roleId);

          return {
            id: user.id,
            name: user.name,
            email: user.username,
            role: user.role,
            role_id: user.roleId,
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
        token.sessionInvalid = false;
        return token;
      }

      // Re-checked on every session access (not just at sign-in), so a user
      // row that gets deleted or has its id rewritten (e.g. by a data
      // migration) doesn't leave a stale, half-broken session lying around —
      // the app cleanly forces a re-login instead of crashing on undefined
      // permissions/role data.
      if (token.id) {
        try {
          const stillExists = await prisma.user.findUnique({ where: { id: token.id as string } });

          if (!stillExists) {
            token.sessionInvalid = true;
            token.permissions = {
              dashboard: false, attendance: false, leave: false, registration_request: false,
              setting: false, staff: false, inventory: false, purchasing: false,
              sales_order: false, delivery_order: false, can_approve: false,
            };
            token.isSuperAdmin = false;
            return token;
          }

          // Keep role/permissions fresh in case they changed since sign-in.
          token.role = stillExists.role;
          token.role_id = stillExists.roleId;
          token.permissions = await getRolePermissions(stillExists.roleId);
          token.isSuperAdmin = await isSuperAdminRole(stillExists.roleId);
          token.sessionInvalid = false;
        } catch (error) {
          // Transient DB error — keep the existing token rather than
          // logging everyone out over a momentary read failure.
          console.error('Session revalidation failed:', error);
        }
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
        session.user.sessionInvalid = token.sessionInvalid as boolean;
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
    maxAge: 30 * 60, // 30 minutes of inactivity before logout
    // How often the session is "renewed" (its expiry pushed back to now + maxAge). Without
    // this, NextAuth's default is 24h, so the session would hard-expire 30 min after sign-in
    // no matter how active the user was. SessionActivityRenewer (AuthProvider.tsx) pings the
    // session endpoint on real user activity, which — combined with this short updateAge —
    // is what makes it a sliding 30-minute idle timeout instead of a fixed one.
    updateAge: 5 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};
