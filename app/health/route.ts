import { NextResponse } from 'next/server';
import { checkDbHealth, hasConfiguredDb } from '@/src/server/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isDbOk = await checkDbHealth();
    return NextResponse.json(
      {
        status: isDbOk ? 'healthy' : 'degraded',
        db: isDbOk ? 'ok' : 'unreachable',
        dbConfigured: hasConfiguredDb,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
      { status: isDbOk ? 200 : 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'error',
        error: err?.message || 'Unknown health error',
        dbConfigured: hasConfiguredDb,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

