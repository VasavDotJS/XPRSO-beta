import { NextResponse } from 'next/server';
import { db, hasConfiguredDb } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { sql } from 'drizzle-orm';
import { ensureDatabaseReady } from '@/src/server/db/migrate';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!hasConfiguredDb && (process.env.NETLIFY || process.env.VERCEL)) {
      return NextResponse.json({
        needsSetup: true,
        hasAdmin: false,
        dbConfigured: false,
      });
    }

    // Direct check with fallback if table not yet provisioned
    try {
      const adminCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(sql`'ADMIN' = ANY(${users.roles}) AND ${users.isActive} = true`);

      const count = Number(adminCountResult[0]?.count || 0);

      return NextResponse.json({
        needsSetup: count === 0,
        hasAdmin: count > 0,
        dbConfigured: true,
      });
    } catch (tableErr: any) {
      // If table does not exist or first startup, attempt migration once
      await ensureDatabaseReady().catch((e) => {
        console.warn('ensureDatabaseReady failed during setup status check:', e.message);
      });

      return NextResponse.json({
        needsSetup: true,
        hasAdmin: false,
        dbConfigured: true,
      });
    }
  } catch (err: any) {
    console.error('Setup status check error:', err);
    return NextResponse.json({
      needsSetup: true,
      hasAdmin: false,
      error: err?.message,
    });
  }
}
