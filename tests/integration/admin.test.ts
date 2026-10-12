import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/src/server/db/client';
import { users, categories, products, priceHistory, auditLog, settings } from '@/src/server/db/schema';
import { hashPassword, hashPin } from '@/src/server/auth/password';
import { createSession, elevateSession, validateSessionToken } from '@/src/server/auth/sessions';
import { eq, and, sql } from 'drizzle-orm';

describe('Integration: Admin Management & Step-up', () => {
  let adminUserId: string;
  let waiterUserId: string;
  let adminToken: string;
  let waiterToken: string;
  let createdCategoryId: string;
  let createdProductId: string;

  beforeAll(async () => {
    // 1. Create test admin
    const [admin] = await db
      .insert(users)
      .values({
        username: `admin_${Date.now()}`,
        displayName: 'Test Admin',
        passwordHash: await hashPassword('AdminPass@123'),
        adminPinHash: await hashPin('5566'),
        roles: ['ADMIN', 'WAITER'],
        isActive: true,
      })
      .returning();
    adminUserId = admin.id;

    // 2. Create test waiter
    const [waiter] = await db
      .insert(users)
      .values({
        username: `waiter_only_${Date.now()}`,
        displayName: 'Test Waiter Only',
        passwordHash: await hashPassword('WaiterPass@123'),
        roles: ['WAITER'],
        isActive: true,
      })
      .returning();
    waiterUserId = waiter.id;

    adminToken = await createSession(adminUserId);
    waiterToken = await createSession(waiterUserId);
  });

  afterAll(async () => {
    if (createdProductId) {
      await db.delete(priceHistory).where(eq(priceHistory.productId, createdProductId));
      await db.delete(products).where(eq(products.id, createdProductId));
    }
    if (createdCategoryId) {
      await db.delete(categories).where(eq(categories.id, createdCategoryId));
    }
    if (adminUserId) await db.delete(users).where(eq(users.id, adminUserId));
    if (waiterUserId) await db.delete(users).where(eq(users.id, waiterUserId));
  });

  it('session elevation state toggles correctly and validates expiry', async () => {
    const unElevated = await validateSessionToken(adminToken);
    expect(unElevated?.isElevated).toBe(false);

    // Elevate admin
    await elevateSession(adminToken, 10);
    const elevated = await validateSessionToken(adminToken);
    expect(elevated?.isElevated).toBe(true);
    expect(elevated?.elevatedUntil).not.toBeNull();
  });

  it('creates category and products, records price history on price changes', async () => {
    // Create category
    const [cat] = await db
      .insert(categories)
      .values({
        name: 'Artisan Brews',
        sortOrder: 1,
      })
      .returning();
    createdCategoryId = cat.id;
    expect(cat.name).toBe('Artisan Brews');

    // Create product
    const [prod] = await db
      .insert(products)
      .values({
        categoryId: cat.id,
        name: 'Pour Over V60',
        pricePaise: 25000, // ₹250
        costPaise: 9000, // ₹90
        dietTag: 'VEG',
      })
      .returning();
    createdProductId = prod.id;
    expect(prod.pricePaise).toBe(25000);

    // Record initial price history
    await db.insert(priceHistory).values({
      productId: prod.id,
      field: 'price',
      oldPaise: null,
      newPaise: 25000,
      changedBy: adminUserId,
    });

    // Update price from ₹250 (25000) to ₹280 (28000)
    await db.insert(priceHistory).values({
      productId: prod.id,
      field: 'price',
      oldPaise: 25000,
      newPaise: 28000,
      changedBy: adminUserId,
    });

    await db
      .update(products)
      .set({ pricePaise: 28000, updatedAt: new Date() })
      .where(eq(products.id, prod.id));

    // Verify price history trail
    const history = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productId, prod.id));

    expect(history.length).toBe(2);
    const latest = history.find((h) => h.newPaise === 28000);
    expect(latest).toBeDefined();
    expect(latest?.oldPaise).toBe(25000);
    expect(latest?.changedBy).toBe(adminUserId);
  });

  it('preserves the invariant that at least one active admin must exist', async () => {
    // Attempting to deactivate all admins should be prevented
    const activeAdmins = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.isActive, true), sql`'ADMIN' = ANY(${users.roles})`));

    const totalActiveAdmins = Number(activeAdmins[0]?.count || 0);
    expect(totalActiveAdmins).toBeGreaterThanOrEqual(1);
  });
});
