import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

if (typeof process !== 'undefined') {
  process.on('uncaughtException', (err) => {
    console.error('CAUGHT UNCAUGHT EXCEPTION:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('CAUGHT UNHANDLED REJECTION:', reason);
  });
}

export async function GET() {
  const report: Record<string, any> = {
    status: 'pong',
    nodeVersion: process.version,
    steps: {},
  };

  const rawUrl = process.env.DATABASE_URL || '';
  report.rawUrlLength = rawUrl.length;
  report.startsWithPostgres = rawUrl.startsWith('postgres');

  // Step 1: dotenv
  try {
    await import('dotenv');
    report.steps.dotenv = 'ok';
  } catch (e: any) {
    report.steps.dotenv = { error: e.message };
  }

  // Step 2: pg import
  try {
    const pg = await import('pg');
    report.steps.pg = 'ok';
  } catch (e: any) {
    report.steps.pg = { error: e.message };
  }

  // Step 3: drizzle-orm
  try {
    await import('drizzle-orm/node-postgres');
    report.steps.drizzle = 'ok';
  } catch (e: any) {
    report.steps.drizzle = { error: e.message };
  }

  // Step 4: schema import
  try {
    const schema = await import('@/src/server/db/schema');
    report.steps.schema = Boolean(schema.users) ? 'ok' : 'missing_users';
  } catch (e: any) {
    report.steps.schema = { error: e.message };
  }

  // Step 5: client import
  let clientModule: any = null;
  try {
    clientModule = await import('@/src/server/db/client');
    report.steps.client = Boolean(clientModule.db) ? 'ok' : 'missing_db';
    report.hasConfiguredDb = clientModule.hasConfiguredDb;
  } catch (e: any) {
    report.steps.client = { error: e.message };
  }

  // Step 6: raw pool query
  if (clientModule?.pool) {
    try {
      const res = await clientModule.pool.query('SELECT 1 as ok, current_database() as db');
      report.steps.rawPoolQuery = res.rows;
    } catch (e: any) {
      report.steps.rawPoolQuery = { error: e.message, code: e.code };
    }
  }

  // Step 7: Drizzle query
  if (clientModule?.db) {
    try {
      const { users } = await import('@/src/server/db/schema');
      const { sql } = await import('drizzle-orm');
      const rows = await clientModule.db
        .select({ count: sql<number>`count(*)` })
        .from(users);
      report.steps.drizzleQuery = rows;
    } catch (e: any) {
      report.steps.drizzleQuery = { error: e.message, code: e.code };
    }
  }

  // Step 8: ensureDatabaseReady
  try {
    const { ensureDatabaseReady } = await import('@/src/server/db/migrate');
    await ensureDatabaseReady();
    report.steps.ensureDatabaseReady = 'ok';
  } catch (e: any) {
    report.steps.ensureDatabaseReady = { error: e.message, code: e.code };
  }

  return NextResponse.json(report);
}
