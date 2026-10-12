import { NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { sql } from 'drizzle-orm';
import { ensureDatabaseReady } from '@/src/server/db/migrate';

export async function GET() {
  try {
    // Automatically provision tables and triggers on brand-new cloud database deployments
    await ensureDatabaseReady();

    const adminCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'ADMIN' = ANY(${users.roles}) AND ${users.isActive} = true`);

    const count = Number(adminCountResult[0]?.count || 0);

    return NextResponse.json({
      needsSetup: count === 0,
      hasAdmin: count > 0,
    });
  } catch (err: any) {
    console.error('Setup status check error:', err);
    return NextResponse.json({
      needsSetup: true,
      hasAdmin: false,
      error: err.message,
    });
  }
}
