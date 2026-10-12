import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/src/server/db/client';
import { requireWaiter } from '@/src/server/auth/rbac';
import { getFinancialYearShort, formatInvoiceNumber } from '@/src/domain/orders/invoice';
import { logAuditEvent } from '@/src/server/auth/audit';

const settleSchema = z.object({
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'OTHER']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = settleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payment mode', details: parsed.error.format() }, { status: 400 });
  }

  const { paymentMode } = parsed.data;
  const staffUserId = auth.session!.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch order and check status
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];
    if (order.status !== 'OPEN') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Cannot settle an order with status ${order.status}` },
        { status: 400 }
      );
    }

    // 2. Fetch invoice prefix from settings
    const settingsRes = await client.query('SELECT invoice_prefix FROM settings WHERE id = 1');
    const invoicePrefix = settingsRes.rows[0]?.invoice_prefix || 'ORD';

    // 3. Gapless consecutive invoice numbering for current Indian FY using SELECT ... FOR UPDATE
    const fy = getFinancialYearShort(new Date());

    // Ensure counter row exists
    await client.query(
      `INSERT INTO invoice_counters (financial_year, last_number)
       VALUES ($1, 0)
       ON CONFLICT (financial_year) DO NOTHING`,
      [fy]
    );

    const counterRes = await client.query(
      'SELECT last_number FROM invoice_counters WHERE financial_year = $1 FOR UPDATE',
      [fy]
    );

    const currentNumber = Number(counterRes.rows[0].last_number || 0);
    const nextNumber = currentNumber + 1;

    await client.query(
      'UPDATE invoice_counters SET last_number = $1 WHERE financial_year = $2',
      [nextNumber, fy]
    );

    const invoiceNo = formatInvoiceNumber(invoicePrefix, fy, nextNumber);
    const now = new Date();

    // 4. Update order to SETTLED
    const updateRes = await client.query(
      `UPDATE orders
       SET status = 'SETTLED',
           payment_mode = $1,
           settled_by = $2,
           settled_at = $3,
           invoice_no = $4,
           financial_year = $5,
           updated_at = $3
       WHERE id = $6
       RETURNING *`,
      [paymentMode, staffUserId, now, invoiceNo, fy, id]
    );

    const settledOrder = updateRes.rows[0];

    await client.query('COMMIT');

    await logAuditEvent({
      actorId: staffUserId,
      action: 'SETTLE_ORDER',
      entity: 'orders',
      entityId: id,
      after: {
        invoiceNo,
        paymentMode,
        grandTotalPaise: settledOrder.grand_total_paise,
      },
    });

    return NextResponse.json({
      success: true,
      order: settledOrder,
      invoiceNo,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Settlement transaction error:', err);
    return NextResponse.json({ error: 'Failed to settle order' }, { status: 500 });
  } finally {
    client.release();
  }
}
