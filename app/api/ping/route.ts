import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report: Record<string, any> = {
    status: 'pong',
    nodeVersion: process.version,
    steps: {},
  };

  const rawUrl = process.env.DATABASE_URL || '';
  report.rawUrlLength = rawUrl.length;

  try {
    let cleaned = rawUrl.trim();
    if (cleaned.startsWith('DATABASE_URL=')) cleaned = cleaned.slice(13).trim();
    if (cleaned.startsWith('DATABASE_URL =')) cleaned = cleaned.slice(14).trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    const u = new URL(cleaned);
    report.urlInfo = {
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      username: u.username ? u.username.slice(0, 10) + '...' : 'none',
      hasPassword: Boolean(u.password),
      passwordLength: u.password?.length || 0,
      pathname: u.pathname,
    };
  } catch (e: any) {
    report.urlInfo = { parseError: e.message };
  }

  // Step 1: client import
  let clientModule: any = null;
  try {
    clientModule = await import('@/src/server/db/client');
    report.steps.client = 'ok';
    report.hasConfiguredDb = clientModule.hasConfiguredDb;
  } catch (e: any) {
    report.steps.client = { error: e.message };
    return NextResponse.json(report);
  }

  // Step 2: query with 2s timeout
  if (clientModule?.pool) {
    try {
      const q = clientModule.pool.query('SELECT 1 as ok, current_database() as db');
      const timer = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out after 2000ms')), 2000)
      );
      const res: any = await Promise.race([q, timer]);
      report.steps.poolQuery = { ok: true, rows: res.rows };
    } catch (e: any) {
      report.steps.poolQuery = { ok: false, error: e.message, code: e.code };
    }
  }

  return NextResponse.json(report);
}
