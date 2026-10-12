import { NextResponse } from 'next/server';
import { checkDbHealth } from '@/src/server/db/client';

export async function GET() {
  const isDbOk = await checkDbHealth();
  return NextResponse.json(
    {
      status: isDbOk ? 'healthy' : 'degraded',
      db: isDbOk ? 'ok' : 'unreachable',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    { status: isDbOk ? 200 : 503 }
  );
}
