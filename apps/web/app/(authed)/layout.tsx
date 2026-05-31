import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.DEV_AUTH_TOKEN) {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');
  }
  return <>{children}</>;
}
