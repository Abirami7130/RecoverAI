import type { AppRole } from '@/lib/auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      merchantId: string;
      merchantName: string;
      role: AppRole;
    };
  }

  interface User {
    merchantId: string;
    merchantName: string;
    role: AppRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    merchantId?: string;
    merchantName?: string;
    role?: AppRole;
  }
}

export {};
