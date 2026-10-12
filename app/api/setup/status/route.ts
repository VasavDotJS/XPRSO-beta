import { NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const adminCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`'ADMIN' = ANY(${users.roles}) AND ${users.isActive} = true`);

  const count = Number(adminCountResult[0]?.count || 0);

  return NextResponse.json({
    needsSetup: count === 0,
    hasAdmin: count > 0,
  });
}
