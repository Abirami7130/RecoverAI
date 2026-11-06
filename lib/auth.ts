import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export type AppRole = 'owner' | 'operator' | 'viewer';

export interface AppSessionUser {
  id: string;
  email: string;
  name: string;
  merchantId: string;
  merchantName: string;
  role: AppRole;
}

export interface AppSession extends Session {
  user: AppSessionUser;
}

const ROLES: AppRole[] = ['owner', 'operator', 'viewer'];

function isAppRole(value: string): value is AppRole {
  return ROLES.includes(value as AppRole);
}

let sessionOverride: AppSession | null | undefined;

export function resetAppSessionForTests() {
  sessionOverride = undefined;
}

export function setAppSessionForTests(session: AppSession | null | undefined) {
  sessionOverride = session;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? '';
        if (!email || !password) {
          return null;
        }

        const rate = checkRateLimit(`login:${email}`, {
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!rate.allowed) {
          throw new Error('Too many login attempts. Try again in 15 minutes.');
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: {
              include: { merchant: true },
              take: 1,
            },
          },
        });

        if (!user || user.memberships.length === 0) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        const membership = user.memberships[0];
        if (!isAppRole(membership.role)) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          merchantId: membership.merchantId,
          merchantName: membership.merchant.name,
          role: membership.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AppSessionUser;
        token.sub = u.id;
        token.email = u.email;
        token.name = u.name;
        token.merchantId = u.merchantId;
        token.merchantName = u.merchantName;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && token.merchantId && token.role) {
        session.user = {
          id: token.sub,
          email: String(token.email ?? ''),
          name: String(token.name ?? ''),
          merchantId: String(token.merchantId),
          merchantName: String(token.merchantName ?? ''),
          role: token.role as AppRole,
        };
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
};

export async function getAppSession(): Promise<AppSession | null> {
  if (sessionOverride !== undefined) {
    return sessionOverride;
  }
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as AppSessionUser).merchantId) {
    return null;
  }
  return session as AppSession;
}

export function requireRole(
  session: AppSession,
  allowed: AppRole[]
): { ok: true } | { ok: false; status: 403 } {
  if (!allowed.includes(session.user.role)) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}
