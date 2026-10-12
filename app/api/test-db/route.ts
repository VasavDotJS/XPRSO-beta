import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const steps: Record<string, any> = {};

  try {
    // Step 1: Check environment variable format (masked)
    const dbUrl = process.env.DATABASE_URL || '';
    let parsedHost = 'none';
    let parsedPort = 'none';
    let parsedUser = 'none';
    try {
      if (dbUrl) {
        const u = new URL(dbUrl);
        parsedHost = u.host;
        parsedPort = u.port;
        parsedUser = u.username;
      }
    } catch (e: any) {
      steps.urlParseError = e.message;
    }

    steps.envCheck = {
      hasUrl: Boolean(dbUrl),
      urlLength: dbUrl.length,
      parsedHost,
      parsedPort,
      parsedUser,
    };

    // Step 2: Test importing pg
    steps.step = 'importing_pg';
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    steps.pgImported = Boolean(Pool);

    // Step 3: Test pool creation
    steps.step = 'creating_pool';
    const pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    });
    steps.poolCreated = true;

    // Step 4: Test query
    steps.step = 'executing_query';
    const res = await pool.query('SELECT 1 as ok');
    steps.queryResult = res.rows;

    await pool.end();

    // Step 5: Test importing drizzle
    steps.step = 'importing_drizzle';
    const { drizzle } = await import('drizzle-orm/node-postgres');
    steps.drizzleImported = Boolean(drizzle);

    // Step 6: Test importing db client
    steps.step = 'importing_client';
    const { db, checkDbHealth } = await import('@/src/server/db/client');
    steps.clientImported = Boolean(db);
    steps.healthResult = await checkDbHealth();

    return NextResponse.json({
      success: true,
      steps,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        failedAtStep: steps.step,
        steps,
        error: err.message,
        name: err.name,
        code: err.code,
        stack: err.stack,
      },
      { status: 200 }
    );
  }
}
