import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { auditLog, users } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { desc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));

  const entries = await db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: users.displayName,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return NextResponse.json({ entries });
}
