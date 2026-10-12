import { redirect } from 'next/navigation';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { getCurrentSession } from '@/src/server/auth/sessions';
import { sql } from 'drizzle-orm';

export default async function HomePage() {
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
}
