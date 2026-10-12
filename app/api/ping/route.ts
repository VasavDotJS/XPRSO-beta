import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawUrl = process.env.DATABASE_URL || '';
  let urlInfo: Record<string, any> = {
    hasDatabaseUrl: Boolean(rawUrl),
    length: rawUrl.length,
    startsWithPostgres: rawUrl.startsWith('postgres'),
    startsWithKeyName: rawUrl.startsWith('DATABASE_URL'),
  };

  try {
    let cleaned = rawUrl.trim();
    if (cleaned.startsWith('DATABASE_URL=')) cleaned = cleaned.slice(13).trim();
    if (cleaned.startsWith('DATABASE_URL =')) cleaned = cleaned.slice(14).trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    const u = new URL(cleaned);
    urlInfo = {
      ...urlInfo,
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      username: u.username ? u.username.slice(0, 8) + '...' : 'none',
      hasPassword: Boolean(u.password),
      pathname: u.pathname,
    };
  } catch (e: any) {
    urlInfo.parseError = e.message;
  }

  let dbHealth: Record<string, any> = { attempted: false };
  try {
    const { checkDbHealth, hasConfiguredDb } = await import('@/src/server/db/client');
    dbHealth.attempted = true;
    dbHealth.hasConfiguredDb = hasConfiguredDb;
    dbHealth.ok = await checkDbHealth();
  } catch (err: any) {
    dbHealth.error = err.message;
    dbHealth.code = err.code;
  }

  return NextResponse.json({
    status: 'pong',
    nodeVersion: process.version,
    urlInfo,
    dbHealth,
  });
}
