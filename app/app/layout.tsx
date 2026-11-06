import AppProviders from './providers';
import AppShell from '@/components/app/AppShell';
import { getAppSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAppSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
