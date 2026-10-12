import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { passkeys } from '@/src/server/db/schema';
import { requireAuth } from '@/src/server/auth/rbac';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const list = await db
    .select({
      id: passkeys.id,
      deviceLabel: passkeys.deviceLabel,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, auth.session!.user.id))
    .orderBy(desc(passkeys.createdAt));

  return NextResponse.json({ passkeys: list });
}
