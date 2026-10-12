import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { settings } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const settingsUpdateSchema = z.object({
  cafeName: z.string().min(1).max(100).optional(),
  address: z.string().max(255).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => val === '' || GSTIN_REGEX.test(val), {
      message: 'Invalid GSTIN format (must match 15-character Indian GST format)',
    })
    .optional()
    .nullable(),
  fssai: z.string().max(20).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  receiptFooter: z.string().max(255).optional().nullable(),
  invoicePrefix: z.string().min(1).max(3).regex(/^[A-Z0-9]+$/).optional(),
  timezone: z.string().default('Asia/Kolkata').optional(),
  taxMode: z.enum(['GST_INTRA', 'GST_SINGLE_LINE', 'NONE', 'COMPOSITION']).optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  pricesIncludeTax: z.boolean().optional(),
  serviceChargeEnabled: z.boolean().optional(),
  serviceChargeBps: z.number().int().min(0).max(5000).optional(),
  roundGrandTotal: z.boolean().optional(),
  elevationMinutes: z.number().int().min(1).max(120).optional(),
  sessionIdleHours: z.number().int().min(1).max(72).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return NextResponse.json({ settings: currentSettings });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [existing] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

  const [updated] = await db
    .update(settings)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1))
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'UPDATE_SETTINGS',
    entity: 'settings',
    entityId: '1',
    before: existing,
    after: updated,
  });

  return NextResponse.json({ settings: updated });
}
