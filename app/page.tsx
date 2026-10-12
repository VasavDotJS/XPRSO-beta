import { redirect } from 'next/navigation';
import { db, hasConfiguredDb } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { getCurrentSession } from '@/src/server/auth/sessions';
import { sql } from 'drizzle-orm';
import { ensureDatabaseReady } from '@/src/server/db/migrate';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    if (!hasConfiguredDb && (process.env.NETLIFY || process.env.VERCEL)) {
      redirect('/setup');
    }

    await ensureDatabaseReady();

    const adminCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'ADMIN' = ANY(${users.roles}) AND ${users.isActive} = true`);

    const hasAdmin = Number(adminCountResult[0]?.count || 0) > 0;
    if (!hasAdmin) {
      redirect('/setup');
    }

    const session = await getCurrentSession();
    if (!session) {
      redirect('/login');
    }

    redirect('/order');
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    console.error('HomePage redirect check error:', err);
    redirect('/setup');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0A09]">
      <div className="w-8 h-8 rounded-full border-2 border-[#D97706] border-t-transparent animate-spin" />
    </div>
  );
}

