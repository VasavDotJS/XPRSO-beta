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

  // Step 1: test dotenv
  try {
    const dotenv = await import('dotenv');
    report.steps.dotenv = 'ok';
  } catch (e: any) {
    report.steps.dotenv = { error: e.message };
  }

  // Step 2: test pg import
  try {
    const pg = await import('pg');
    report.steps.pg = typeof pg.Pool === 'function' ? 'ok' : typeof pg.default?.Pool === 'function' ? 'ok_default' : 'unknown';
  } catch (e: any) {
    report.steps.pg = { error: e.message };
  }

  // Step 3: test drizzle-orm
  try {
    const drizzle = await import('drizzle-orm/node-postgres');
    report.steps.drizzle = typeof drizzle.drizzle === 'function' ? 'ok' : 'unknown';
  } catch (e: any) {
    report.steps.drizzle = { error: e.message };
  }

  // Step 4: test schema import
  try {
    const schema = await import('@/src/server/db/schema');
    report.steps.schema = Boolean(schema.users) ? 'ok' : 'missing_users';
  } catch (e: any) {
    report.steps.schema = { error: e.message };
  }

  // Step 5: test client import
  try {
    const client = await import('@/src/server/db/client');
    report.steps.client = Boolean(client.db) ? 'ok' : 'missing_db';
    report.hasConfiguredDb = client.hasConfiguredDb;
  } catch (e: any) {
    report.steps.client = { error: e.message };
  }

  return NextResponse.json(report);
}
